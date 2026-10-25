-- Duti initial schema.
--
-- Locked decisions represented here:
--   * Task IDs are PROJECTKEY-NUMBER (for example DUTI-1), with a per-project counter.
--   * Task kinds are workspace metadata; they do not own ID prefixes or counters.
--   * The web UI uses Supabase JWT + RLS. Agents use the service role with explicit
--     workspace scoping in Elysia; RLS is intentionally bypassed on that path.
--   * Every Google account gets one personal workspace via the auth.users trigger.
--
-- Apply with: bunx supabase db push

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles (id) on delete cascade,
  name text not null default 'Personal',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspaces_name_not_blank check (length(btrim(name)) > 0)
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  key text not null,
  description text,
  next_task_number bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_name_not_blank check (length(btrim(name)) > 0),
  constraint projects_key_format check (key ~ '^[A-Z][A-Z0-9]{1,9}$'),
  constraint projects_next_task_number_positive check (next_task_number >= 1),
  constraint projects_workspace_key_unique unique (workspace_id, key),
  -- Required as the target of the composite FK from tasks.
  constraint projects_workspace_id_unique unique (workspace_id, id)
);

create table public.boards (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects (id) on delete cascade,
  name text not null default 'Board',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint boards_name_not_blank check (length(btrim(name)) > 0),
  -- Required as the target of the composite FK from stacks.
  constraint boards_project_id_unique unique (project_id, id)
);

create table public.stacks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  board_id uuid not null,
  name text not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stacks_name_not_blank check (length(btrim(name)) > 0),
  constraint stacks_position_nonnegative check (position >= 0),
  constraint stacks_board_fk
    foreign key (project_id, board_id)
    references public.boards (project_id, id)
    on delete cascade,
  -- Required as the target of the composite FK from tasks.
  constraint stacks_project_id_unique unique (project_id, id)
);

create table public.task_kinds (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  key text not null,
  name text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint task_kinds_key_format check (key ~ '^[a-z][a-z0-9_]{0,31}$'),
  constraint task_kinds_name_not_blank check (length(btrim(name)) > 0),
  constraint task_kinds_workspace_key_unique unique (workspace_id, key),
  -- Required as the target of the composite FK from tasks.
  constraint task_kinds_workspace_id_unique unique (workspace_id, id)
);

create unique index task_kinds_one_default_per_workspace
  on public.task_kinds (workspace_id)
  where is_default;

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  stack_id uuid not null,
  kind_id uuid not null,
  number bigint not null,
  key text not null,
  title text not null,
  description jsonb not null default '{"type":"doc","content":[]}'::jsonb,
  description_text text not null default '',
  search_vector tsvector generated always as (
    to_tsvector(
      'simple',
      coalesce(title, '') || ' ' || coalesce(description_text, '')
    )
  ) stored,
  priority text not null default 'medium',
  due_date date,
  position integer not null default 0,
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_title_not_blank check (length(btrim(title)) > 0),
  constraint tasks_title_length check (length(title) <= 500),
  constraint tasks_description_object check (jsonb_typeof(description) = 'object'),
  constraint tasks_priority_check
    check (priority in ('low', 'medium', 'high', 'critical')),
  constraint tasks_number_positive check (number >= 1),
  constraint tasks_key_format check (key ~ '^[A-Z][A-Z0-9]{1,9}-[1-9][0-9]*$'),
  constraint tasks_position_nonnegative check (position >= 0),
  constraint tasks_project_number_unique unique (project_id, number),
  constraint tasks_workspace_key_unique unique (workspace_id, key),
  constraint tasks_workspace_idempotency_unique
    unique (workspace_id, idempotency_key),
  constraint tasks_project_fk
    foreign key (workspace_id, project_id)
    references public.projects (workspace_id, id)
    on delete cascade,
  constraint tasks_stack_fk
    foreign key (project_id, stack_id)
    references public.stacks (project_id, id)
    on delete cascade,
  constraint tasks_kind_fk
    foreign key (workspace_id, kind_id)
    references public.task_kinds (workspace_id, id)
    on delete restrict
);

create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  key_prefix text not null unique,
  key_hash text not null,
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint api_keys_name_not_blank check (length(btrim(name)) > 0),
  constraint api_keys_prefix_not_blank check (length(key_prefix) > 0),
  constraint api_keys_hash_not_blank check (length(key_hash) > 0)
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index projects_workspace_id_idx on public.projects (workspace_id);
create index stacks_board_position_idx on public.stacks (board_id, position);
create index tasks_stack_position_idx on public.tasks (stack_id, position);
create index tasks_project_created_idx
  on public.tasks (project_id, created_at desc);
create index tasks_workspace_kind_idx on public.tasks (workspace_id, kind_id);
create index tasks_search_idx on public.tasks using gin (search_vector);
create index api_keys_workspace_id_idx on public.api_keys (workspace_id);

-- ---------------------------------------------------------------------------
-- Timestamps
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger workspaces_set_updated_at
  before update on public.workspaces
  for each row execute function public.set_updated_at();

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

create trigger boards_set_updated_at
  before update on public.boards
  for each row execute function public.set_updated_at();

create trigger stacks_set_updated_at
  before update on public.stacks
  for each row execute function public.set_updated_at();

create trigger task_kinds_set_updated_at
  before update on public.task_kinds
  for each row execute function public.set_updated_at();

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

create trigger api_keys_set_updated_at
  before update on public.api_keys
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Identity guards
--
-- RLS limits rows, not columns. These triggers keep generated/identity columns
-- immutable so a direct PostgREST update cannot rewrite a task key, move a row
-- to another workspace, or advance a project counter.
-- ---------------------------------------------------------------------------

create or replace function public.prevent_project_identity_change()
returns trigger
language plpgsql
as $$
begin
  if new.key is distinct from old.key then
    raise exception 'project key is immutable' using errcode = '23514';
  end if;

  if new.workspace_id is distinct from old.workspace_id then
    raise exception 'project workspace is immutable' using errcode = '23514';
  end if;

  if new.next_task_number is distinct from old.next_task_number
     and coalesce(
       current_setting('duti.allow_task_counter_update', true),
       ''
     ) <> 'on' then
    raise exception 'next_task_number is managed by create_task'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger projects_prevent_identity_change
  before update on public.projects
  for each row execute function public.prevent_project_identity_change();

create or replace function public.prevent_board_project_change()
returns trigger
language plpgsql
as $$
begin
  if new.project_id is distinct from old.project_id then
    raise exception 'board project is immutable' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger boards_prevent_project_change
  before update on public.boards
  for each row execute function public.prevent_board_project_change();

create or replace function public.prevent_stack_scope_change()
returns trigger
language plpgsql
as $$
begin
  if new.project_id is distinct from old.project_id
     or new.board_id is distinct from old.board_id then
    raise exception 'stack project and board are immutable' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger stacks_prevent_scope_change
  before update on public.stacks
  for each row execute function public.prevent_stack_scope_change();

create or replace function public.prevent_task_identity_change()
returns trigger
language plpgsql
as $$
begin
  if new.workspace_id is distinct from old.workspace_id
     or new.project_id is distinct from old.project_id
     or new.number is distinct from old.number
     or new.key is distinct from old.key then
    raise exception 'task identity is immutable' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger tasks_prevent_identity_change
  before update on public.tasks
  for each row execute function public.prevent_task_identity_change();

create or replace function public.prevent_workspace_owner_change()
returns trigger
language plpgsql
as $$
begin
  if new.owner_id is distinct from old.owner_id then
    raise exception 'workspace owner is immutable' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger workspaces_prevent_owner_change
  before update on public.workspaces
  for each row execute function public.prevent_workspace_owner_change();

create or replace function public.prevent_task_kind_workspace_change()
returns trigger
language plpgsql
as $$
begin
  if new.workspace_id is distinct from old.workspace_id then
    raise exception 'task kind workspace is immutable' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger task_kinds_prevent_workspace_change
  before update on public.task_kinds
  for each row execute function public.prevent_task_kind_workspace_change();

create or replace function public.prevent_api_key_identity_change()
returns trigger
language plpgsql
as $$
begin
  if new.workspace_id is distinct from old.workspace_id
     or new.key_prefix is distinct from old.key_prefix
     or new.key_hash is distinct from old.key_hash then
    raise exception 'api key identity is immutable' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger api_keys_prevent_identity_change
  before update on public.api_keys
  for each row execute function public.prevent_api_key_identity_change();

-- ---------------------------------------------------------------------------
-- Workspace provisioning
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_workspace_id uuid;
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;

  new_workspace_id := null;

  insert into public.workspaces (owner_id, name)
  values (new.id, 'Personal')
  on conflict (owner_id) do nothing
  returning id into new_workspace_id;

  if new_workspace_id is null then
    select id
    into new_workspace_id
    from public.workspaces
    where owner_id = new.id;
  end if;

  if new_workspace_id is null then
    raise exception 'could not provision workspace for user %', new.id;
  end if;

  insert into public.task_kinds (workspace_id, key, name, is_default)
  values
    (new_workspace_id, 'issue', 'Issue', false),
    (new_workspace_id, 'bug', 'Bug', false),
    (new_workspace_id, 'feat', 'Feature', false),
    (new_workspace_id, 'task', 'Task', true)
  on conflict (workspace_id, key) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill accounts that existed before this migration.
do $$
declare
  auth_user record;
  workspace_id uuid;
begin
  for auth_user in select id from auth.users loop
    insert into public.profiles (id)
    values (auth_user.id)
    on conflict (id) do nothing;

    workspace_id := null;

    insert into public.workspaces (owner_id, name)
    values (auth_user.id, 'Personal')
    on conflict (owner_id) do nothing
    returning id into workspace_id;

    if workspace_id is null then
      select id
      into workspace_id
      from public.workspaces
      where owner_id = auth_user.id;
    end if;

    if workspace_id is not null then
      insert into public.task_kinds (workspace_id, key, name, is_default)
      values
        (workspace_id, 'issue', 'Issue', false),
        (workspace_id, 'bug', 'Bug', false),
        (workspace_id, 'feat', 'Feature', false),
        (workspace_id, 'task', 'Task', true)
      on conflict (workspace_id, key) do nothing;
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Ownership helpers
--
-- SECURITY DEFINER avoids recursive RLS lookups in policies. The functions
-- only return a boolean and always compare the row owner to auth.uid().
-- ---------------------------------------------------------------------------

create or replace function public.is_workspace_owner(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspaces w
    where w.id = p_workspace_id
      and w.owner_id = (select auth.uid())
  );
$$;

create or replace function public.is_project_owner(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.projects p
    join public.workspaces w on w.id = p.workspace_id
    where p.id = p_project_id
      and w.owner_id = (select auth.uid())
  );
$$;

-- ---------------------------------------------------------------------------
-- Project creation
--
-- One transaction creates the project, its single board, and the four default
-- stacks. The API must call this function instead of inserting the three
-- resources separately.
-- ---------------------------------------------------------------------------

create or replace function public.create_project(
  p_workspace_id uuid,
  p_name text,
  p_key text,
  p_description text default null
)
returns public.projects
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_project public.projects%rowtype;
  v_board_id uuid;
begin
  if not exists (
    select 1
    from public.workspaces
    where id = p_workspace_id
  ) then
    raise exception 'workspace not found' using errcode = 'P0002';
  end if;

  insert into public.projects (workspace_id, name, key, description)
  values (
    p_workspace_id,
    btrim(p_name),
    upper(btrim(p_key)),
    p_description
  )
  returning * into v_project;

  insert into public.boards (project_id, name)
  values (v_project.id, v_project.name || ' Board')
  returning id into v_board_id;

  insert into public.stacks (project_id, board_id, name, position)
  values
    (v_project.id, v_board_id, 'Backlog', 0),
    (v_project.id, v_board_id, 'In Progress', 1024),
    (v_project.id, v_board_id, 'Review', 2048),
    (v_project.id, v_board_id, 'Done', 3072);

  return v_project;
end;
$$;

-- ---------------------------------------------------------------------------
-- Task creation
--
-- Generates the next PROJECTKEY-NUMBER atomically. The project row is updated
-- in the same transaction as the insert, and the counter guard trigger only
-- permits that update while this function sets the transaction-local flag.
-- ---------------------------------------------------------------------------

create or replace function public.create_task(
  p_workspace_id uuid,
  p_project_id uuid,
  p_stack_id uuid,
  p_kind_key text,
  p_title text,
  p_description jsonb,
  p_description_text text,
  p_priority text,
  p_due_date date,
  p_idempotency_key text default null
)
returns public.tasks
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_project public.projects%rowtype;
  v_kind public.task_kinds%rowtype;
  v_stack_id uuid;
  v_number bigint;
  v_task public.tasks%rowtype;
  v_existing public.tasks%rowtype;
  v_idempotency_key text;
begin
  v_idempotency_key := nullif(p_idempotency_key, '');

  if v_idempotency_key is not null then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        p_workspace_id::text || ':' || v_idempotency_key,
        0
      )
    );

    select *
    into v_existing
    from public.tasks
    where workspace_id = p_workspace_id
      and idempotency_key = v_idempotency_key;

    if found then
      if v_existing.project_id <> p_project_id then
        raise exception 'idempotency key already used for another project'
          using errcode = '22000';
      end if;

      return v_existing;
    end if;
  end if;

  select *
  into v_project
  from public.projects
  where id = p_project_id
    and workspace_id = p_workspace_id;

  if not found then
    raise exception 'project not found' using errcode = 'P0002';
  end if;

  select *
  into v_kind
  from public.task_kinds
  where workspace_id = p_workspace_id
    and key = p_kind_key;

  if not found then
    raise exception 'task kind not found' using errcode = 'P0002';
  end if;

  if p_stack_id is null then
    select id
    into v_stack_id
    from public.stacks
    where project_id = p_project_id
    order by position, created_at
    limit 1;
  else
    select id
    into v_stack_id
    from public.stacks
    where id = p_stack_id
      and project_id = p_project_id;
  end if;

  if v_stack_id is null then
    raise exception 'stack not found in project' using errcode = 'P0002';
  end if;

  perform pg_catalog.set_config(
    'duti.allow_task_counter_update',
    'on',
    true
  );

  update public.projects
  set next_task_number = next_task_number + 1
  where id = p_project_id
    and workspace_id = p_workspace_id
  returning next_task_number - 1 into v_number;

  if v_number is null then
    raise exception 'project not found' using errcode = 'P0002';
  end if;

  insert into public.tasks (
    workspace_id,
    project_id,
    stack_id,
    kind_id,
    number,
    key,
    title,
    description,
    description_text,
    priority,
    due_date,
    position,
    idempotency_key
  )
  values (
    p_workspace_id,
    p_project_id,
    v_stack_id,
    v_kind.id,
    v_number,
    v_project.key || '-' || v_number,
    p_title,
    coalesce(p_description, '{"type":"doc","content":[]}'::jsonb),
    coalesce(p_description_text, ''),
    coalesce(p_priority, 'medium'),
    p_due_date,
    coalesce(
      (
        select max(position) + 1024
        from public.tasks
        where stack_id = v_stack_id
      ),
      1024
    ),
    v_idempotency_key
  )
  returning * into v_task;

  perform pg_catalog.set_config(
    'duti.allow_task_counter_update',
    'off',
    true
  );

  return v_task;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.projects enable row level security;
alter table public.boards enable row level security;
alter table public.stacks enable row level security;
alter table public.task_kinds enable row level security;
alter table public.tasks enable row level security;
alter table public.api_keys enable row level security;

-- Profiles: a user can read and update only their own profile. Creation and
-- deletion are handled by the auth trigger / cascade.
create policy profiles_select_own
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Workspaces: one personal workspace per account. Creation is trigger-only.
create policy workspaces_select_own
  on public.workspaces for select
  to authenticated
  using (owner_id = (select auth.uid()));

create policy workspaces_update_own
  on public.workspaces for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- Projects
create policy projects_select_own
  on public.projects for select
  to authenticated
  using (public.is_workspace_owner(workspace_id));

create policy projects_insert_own
  on public.projects for insert
  to authenticated
  with check (public.is_workspace_owner(workspace_id));

create policy projects_update_own
  on public.projects for update
  to authenticated
  using (public.is_workspace_owner(workspace_id))
  with check (public.is_workspace_owner(workspace_id));

create policy projects_delete_own
  on public.projects for delete
  to authenticated
  using (public.is_workspace_owner(workspace_id));

-- Boards
create policy boards_select_own
  on public.boards for select
  to authenticated
  using (public.is_project_owner(project_id));

create policy boards_insert_own
  on public.boards for insert
  to authenticated
  with check (public.is_project_owner(project_id));

create policy boards_update_own
  on public.boards for update
  to authenticated
  using (public.is_project_owner(project_id))
  with check (public.is_project_owner(project_id));

create policy boards_delete_own
  on public.boards for delete
  to authenticated
  using (public.is_project_owner(project_id));

-- Stacks
create policy stacks_select_own
  on public.stacks for select
  to authenticated
  using (public.is_project_owner(project_id));

create policy stacks_insert_own
  on public.stacks for insert
  to authenticated
  with check (public.is_project_owner(project_id));

create policy stacks_update_own
  on public.stacks for update
  to authenticated
  using (public.is_project_owner(project_id))
  with check (public.is_project_owner(project_id));

create policy stacks_delete_own
  on public.stacks for delete
  to authenticated
  using (public.is_project_owner(project_id));

-- Task kinds
create policy task_kinds_select_own
  on public.task_kinds for select
  to authenticated
  using (public.is_workspace_owner(workspace_id));

create policy task_kinds_insert_own
  on public.task_kinds for insert
  to authenticated
  with check (public.is_workspace_owner(workspace_id));

create policy task_kinds_update_own
  on public.task_kinds for update
  to authenticated
  using (public.is_workspace_owner(workspace_id))
  with check (public.is_workspace_owner(workspace_id));

create policy task_kinds_delete_own
  on public.task_kinds for delete
  to authenticated
  using (public.is_workspace_owner(workspace_id));

-- Tasks
create policy tasks_select_own
  on public.tasks for select
  to authenticated
  using (public.is_workspace_owner(workspace_id));

create policy tasks_insert_own
  on public.tasks for insert
  to authenticated
  with check (public.is_workspace_owner(workspace_id));

create policy tasks_update_own
  on public.tasks for update
  to authenticated
  using (public.is_workspace_owner(workspace_id))
  with check (public.is_workspace_owner(workspace_id));

create policy tasks_delete_own
  on public.tasks for delete
  to authenticated
  using (public.is_workspace_owner(workspace_id));

-- API keys: metadata is readable/writable by the owner. Raw keys are never
-- stored, and the identity guard prevents rewriting the prefix or hash.
create policy api_keys_select_own
  on public.api_keys for select
  to authenticated
  using (public.is_workspace_owner(workspace_id));

create policy api_keys_insert_own
  on public.api_keys for insert
  to authenticated
  with check (public.is_workspace_owner(workspace_id));

create policy api_keys_update_own
  on public.api_keys for update
  to authenticated
  using (public.is_workspace_owner(workspace_id))
  with check (public.is_workspace_owner(workspace_id));

create policy api_keys_delete_own
  on public.api_keys for delete
  to authenticated
  using (public.is_workspace_owner(workspace_id));

-- ---------------------------------------------------------------------------
-- Grants
--
-- The project sets auto_expose_new_tables = false, so grants are explicit.
-- Never grant TRUNCATE to authenticated: it bypasses RLS.
-- ---------------------------------------------------------------------------

grant usage on schema public to authenticated, service_role;

revoke all on table public.profiles from anon;
revoke all on table public.workspaces from anon;
revoke all on table public.projects from anon;
revoke all on table public.boards from anon;
revoke all on table public.stacks from anon;
revoke all on table public.task_kinds from anon;
revoke all on table public.tasks from anon;
revoke all on table public.api_keys from anon;

grant select, update on table public.profiles to authenticated;
grant select, update on table public.workspaces to authenticated;
grant select, insert, update, delete on table public.projects to authenticated;
grant select, insert, update, delete on table public.boards to authenticated;
grant select, insert, update, delete on table public.stacks to authenticated;
grant select, insert, update, delete on table public.task_kinds to authenticated;
grant select, insert, update, delete on table public.tasks to authenticated;
grant select, insert, update, delete on table public.api_keys to authenticated;

grant all on table public.profiles to service_role;
grant all on table public.workspaces to service_role;
grant all on table public.projects to service_role;
grant all on table public.boards to service_role;
grant all on table public.stacks to service_role;
grant all on table public.task_kinds to service_role;
grant all on table public.tasks to service_role;
grant all on table public.api_keys to service_role;

revoke execute on function public.create_project(uuid, text, text, text)
  from public, anon;
revoke execute on function public.create_task(
  uuid, uuid, uuid, text, text, jsonb, text, text, date, text
) from public, anon;
revoke execute on function public.is_workspace_owner(uuid) from public, anon;
revoke execute on function public.is_project_owner(uuid) from public, anon;

grant execute on function public.create_project(uuid, text, text, text)
  to authenticated, service_role;
grant execute on function public.create_task(
  uuid, uuid, uuid, text, text, jsonb, text, text, date, text
) to authenticated, service_role;
grant execute on function public.is_workspace_owner(uuid)
  to authenticated, service_role;
grant execute on function public.is_project_owner(uuid)
  to authenticated, service_role;

notify pgrst, 'reload schema';
