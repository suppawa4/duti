-- Atomic board mutations used by the Elysia API.
--
-- Reordering stacks, moving a task between stacks, and deleting a non-empty
-- stack each touch more than one row. Keeping them in SQL functions means a
-- failed request cannot leave a partially reordered board. All functions are
-- security invoker, so the normal RLS policies remain the authorization
-- boundary for the web UI and for any future API-key path.

-- ---------------------------------------------------------------------------
-- Reorder every stack in a project
-- ---------------------------------------------------------------------------

create or replace function public.reorder_stacks(
  p_project_id uuid,
  p_stack_ids uuid[]
)
returns setof public.stacks
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
  v_distinct_count integer;
begin
  if not exists (
    select 1
    from public.projects
    where id = p_project_id
  ) then
    raise exception 'project not found' using errcode = 'P0002';
  end if;

  select count(*)
  into v_count
  from public.stacks
  where project_id = p_project_id;

  select count(distinct x.id)
  into v_distinct_count
  from unnest(p_stack_ids) as x(id);

  if coalesce(array_length(p_stack_ids, 1), 0) <> v_count
     or v_distinct_count <> v_count then
    raise exception 'stack list must contain every stack exactly once'
      using errcode = '22000';
  end if;

  if exists (
    select 1
    from unnest(p_stack_ids) as x(id)
    left join public.stacks s
      on s.id = x.id
     and s.project_id = p_project_id
    where s.id is null
  ) then
    raise exception 'stack not found in project' using errcode = 'P0002';
  end if;

  update public.stacks s
  set position = (u.ord - 1) * 1024
  from unnest(p_stack_ids) with ordinality as u(id, ord)
  where s.id = u.id
    and s.project_id = p_project_id;

  return query
    select *
    from public.stacks
    where project_id = p_project_id
    order by position, created_at;
end;
$$;

-- ---------------------------------------------------------------------------
-- Move a task to a stack and position it before another task
-- ---------------------------------------------------------------------------

create or replace function public.move_task(
  p_task_id uuid,
  p_stack_id uuid,
  p_before_task_id uuid default null
)
returns public.tasks
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_task public.tasks%rowtype;
  v_stack public.stacks%rowtype;
  v_ids uuid[];
  v_index integer;
  v_i integer;
  v_updated public.tasks%rowtype;
begin
  select *
  into v_task
  from public.tasks
  where id = p_task_id;

  if not found then
    raise exception 'task not found' using errcode = 'P0002';
  end if;

  select *
  into v_stack
  from public.stacks
  where id = p_stack_id
    and project_id = v_task.project_id;

  if not found then
    raise exception 'stack not found in project' using errcode = 'P0002';
  end if;

  if p_before_task_id is not null then
    if p_before_task_id = p_task_id then
      raise exception 'task cannot be moved before itself'
        using errcode = '22000';
    end if;

    if not exists (
      select 1
      from public.tasks
      where id = p_before_task_id
        and project_id = v_task.project_id
        and stack_id = p_stack_id
    ) then
      raise exception 'before task not found in target stack'
        using errcode = 'P0002';
    end if;
  end if;

  select coalesce(
    array_agg(id order by position, created_at, id),
    '{}'::uuid[]
  )
  into v_ids
  from public.tasks
  where stack_id = p_stack_id
    and id <> p_task_id;

  if p_before_task_id is null then
    v_ids := array_append(v_ids, p_task_id);
  else
    v_index := array_position(v_ids, p_before_task_id);

    if v_index is null then
      raise exception 'before task not found in target stack'
        using errcode = 'P0002';
    end if;

    v_ids := v_ids[1:v_index - 1] || p_task_id || v_ids[v_index:];
  end if;

  for v_i in 1..coalesce(array_length(v_ids, 1), 0) loop
    update public.tasks
    set stack_id = p_stack_id,
        position = (v_i - 1) * 1024
    where id = v_ids[v_i];
  end loop;

  select *
  into v_updated
  from public.tasks
  where id = p_task_id;

  return v_updated;
end;
$$;

-- ---------------------------------------------------------------------------
-- Delete a stack, optionally moving its tasks first
-- ---------------------------------------------------------------------------

create or replace function public.delete_stack(
  p_stack_id uuid,
  p_move_tasks_to uuid default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_stack public.stacks%rowtype;
  v_stack_count integer;
  v_task_count integer;
  v_target public.stacks%rowtype;
  v_base_position integer;
begin
  select *
  into v_stack
  from public.stacks
  where id = p_stack_id;

  if not found then
    raise exception 'stack not found' using errcode = 'P0002';
  end if;

  select count(*)
  into v_stack_count
  from public.stacks
  where project_id = v_stack.project_id;

  if v_stack_count <= 1 then
    raise exception 'cannot delete the last stack' using errcode = '22000';
  end if;

  select count(*)
  into v_task_count
  from public.tasks
  where stack_id = p_stack_id;

  if v_task_count > 0 then
    if p_move_tasks_to is null then
      raise exception 'stack has tasks; provide moveTasksTo'
        using errcode = '22000';
    end if;

    if p_move_tasks_to = p_stack_id then
      raise exception 'moveTasksTo must be another stack'
        using errcode = '22000';
    end if;

    select *
    into v_target
    from public.stacks
    where id = p_move_tasks_to
      and project_id = v_stack.project_id;

    if not found then
      raise exception 'target stack not found in project'
        using errcode = 'P0002';
    end if;

    select coalesce(max(position), 0)
    into v_base_position
    from public.tasks
    where stack_id = p_move_tasks_to;

    with moved as (
      select
        id,
        row_number() over (order by position, created_at, id) as row_number
      from public.tasks
      where stack_id = p_stack_id
    )
    update public.tasks t
    set stack_id = p_move_tasks_to,
        position = v_base_position + (moved.row_number::integer * 1024)
    from moved
    where t.id = moved.id;
  end if;

  delete from public.stacks where id = p_stack_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke execute on function public.reorder_stacks(uuid, uuid[])
  from public, anon;
revoke execute on function public.move_task(uuid, uuid, uuid)
  from public, anon;
revoke execute on function public.delete_stack(uuid, uuid)
  from public, anon;

grant execute on function public.reorder_stacks(uuid, uuid[])
  to authenticated, service_role;
grant execute on function public.move_task(uuid, uuid, uuid)
  to authenticated, service_role;
grant execute on function public.delete_stack(uuid, uuid)
  to authenticated, service_role;

notify pgrst, 'reload schema';
