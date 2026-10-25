-- Deleting a workspace cascades to both tasks and task_kinds. The original
-- RESTRICT foreign key could fire before the task cascade and block account
-- deletion. A deferred NO ACTION constraint keeps direct kind deletion safe
-- while allowing the workspace cascade to complete in one transaction.

alter table public.tasks
  drop constraint tasks_kind_fk;

alter table public.tasks
  add constraint tasks_kind_fk
  foreign key (workspace_id, kind_id)
  references public.task_kinds (workspace_id, id)
  on delete no action
  deferrable initially deferred;

notify pgrst, 'reload schema';
