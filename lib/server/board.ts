import type { Json } from "@/lib/supabase/database.types";
import {
  TASK_PRIORITIES,
  type BoardData,
  type BoardFilters,
  type CreateStackInput,
  type CreateTaskInput,
  type DeleteStackInput,
  type MoveTaskInput,
  type RenameStackInput,
  type ReorderStacksInput,
  type Stack,
  type Task,
  type TaskKind,
  type UpdateTaskInput,
} from "@/lib/api/types";
import { richTextToPlainText } from "@/lib/rich-text";
import type { ApiAuth } from "./auth";
import {
  databaseFailure,
  fail,
  rpcFailure,
} from "./errors";
import {
  toBoardStack,
  toProject,
  toStack,
  toTask,
  toTaskKind,
  type ProjectRow,
  type StackRow,
  type TaskKindRow,
  type TaskRow,
} from "./mappers";
import { listTaskKinds } from "./task-kinds";
import {
  dueDate,
  ensureProjectId,
  richTextDescription,
  stackName,
  taskTitle,
} from "./validation";

const PROJECT_COLUMNS = "id, name, key, description, created_at, updated_at";
const STACK_COLUMNS = "id, name, position";
const KIND_COLUMNS = "id, key, name, is_default";
const TASK_COLUMNS =
  "id, number, key, project_id, stack_id, kind_id, title, description, description_text, priority, due_date, position, created_at, updated_at";

async function loadProject(
  auth: ApiAuth,
  projectId: string,
): Promise<ProjectRow> {
  ensureProjectId(projectId);

  const { data, error } = await auth.supabase
    .from("projects")
    .select(PROJECT_COLUMNS)
    .eq("id", projectId)
    .eq("workspace_id", auth.workspace.id)
    .maybeSingle();

  if (error) {
    databaseFailure(error, "Could not load the project.");
  }

  if (!data) {
    fail(404, "NOT_FOUND", "Project not found.");
  }

  return data as ProjectRow;
}

async function loadBoard(
  auth: ApiAuth,
  projectId: string,
): Promise<{ project: ProjectRow; board: { id: string; name: string } }> {
  const project = await loadProject(auth, projectId);

  const { data: board, error } = await auth.supabase
    .from("boards")
    .select("id, name")
    .eq("project_id", project.id)
    .maybeSingle();

  if (error) {
    databaseFailure(error, "Could not load the project board.");
  }

  if (!board) {
    fail(404, "NOT_FOUND", "Board not found.");
  }

  return { project, board };
}

async function loadStacks(
  auth: ApiAuth,
  projectId: string,
): Promise<StackRow[]> {
  const { data, error } = await auth.supabase
    .from("stacks")
    .select(STACK_COLUMNS)
    .eq("project_id", projectId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    databaseFailure(error, "Could not load the board stacks.");
  }

  return (data ?? []) as StackRow[];
}

async function findKindByKey(
  auth: ApiAuth,
  key: string,
): Promise<TaskKindRow> {
  const { data, error } = await auth.supabase
    .from("task_kinds")
    .select(KIND_COLUMNS)
    .eq("workspace_id", auth.workspace.id)
    .eq("key", key)
    .maybeSingle();

  if (error) {
    databaseFailure(error, "Could not load the task kind.");
  }

  if (!data) {
    fail(422, "VALIDATION_ERROR", "That task kind does not exist.");
  }

  return data as TaskKindRow;
}

async function findKindById(
  auth: ApiAuth,
  kindId: string,
): Promise<TaskKindRow> {
  const { data, error } = await auth.supabase
    .from("task_kinds")
    .select(KIND_COLUMNS)
    .eq("workspace_id", auth.workspace.id)
    .eq("id", kindId)
    .maybeSingle();

  if (error) {
    databaseFailure(error, "Could not load the task kind.");
  }

  if (!data) {
    fail(500, "INTERNAL_ERROR", "The task kind could not be loaded.");
  }

  return data as TaskKindRow;
}

async function loadTaskRow(
  auth: ApiAuth,
  taskId: string,
): Promise<TaskRow> {
  const { data, error } = await auth.supabase
    .from("tasks")
    .select(TASK_COLUMNS)
    .eq("id", taskId)
    .eq("workspace_id", auth.workspace.id)
    .maybeSingle();

  if (error) {
    databaseFailure(error, "Could not load the task.");
  }

  if (!data) {
    fail(404, "NOT_FOUND", "Task not found.");
  }

  return data as TaskRow;
}

async function loadStack(
  auth: ApiAuth,
  stackId: string,
): Promise<StackRow & { project_id: string; board_id: string }> {
  const { data, error } = await auth.supabase
    .from("stacks")
    .select("id, project_id, board_id, name, position")
    .eq("id", stackId)
    .maybeSingle();

  if (error) {
    databaseFailure(error, "Could not load the stack.");
  }

  if (!data) {
    fail(404, "NOT_FOUND", "Stack not found.");
  }

  await loadProject(auth, data.project_id);

  return data as StackRow & { project_id: string; board_id: string };
}

function validatePriority(value: string): (typeof TASK_PRIORITIES)[number] {
  if (!TASK_PRIORITIES.includes(value as (typeof TASK_PRIORITIES)[number])) {
    fail(422, "VALIDATION_ERROR", "Choose a valid task priority.", [
      { path: "priority", message: "Choose a valid task priority." },
    ]);
  }

  return value as (typeof TASK_PRIORITIES)[number];
}

async function loadTasks(
  auth: ApiAuth,
  projectId: string,
  filters: BoardFilters,
  kinds: TaskKind[],
  stacks: StackRow[],
): Promise<Task[]> {
  const q = filters.q.trim();

  if (q.length > 200) {
    fail(422, "VALIDATION_ERROR", "Search text must be 200 characters or fewer.", [
      { path: "q", message: "Search text must be 200 characters or fewer." },
    ]);
  }

  const kind = filters.kind
    ? kinds.find((candidate) => candidate.key === filters.kind)
    : null;

  if (filters.kind && !kind) {
    fail(422, "VALIDATION_ERROR", "That task kind does not exist.");
  }

  if (
    filters.stack &&
    !stacks.some((candidate) => candidate.id === filters.stack)
  ) {
    fail(404, "NOT_FOUND", "Stack not found.");
  }

  const priority = filters.priority
    ? validatePriority(filters.priority)
    : null;

  let query = auth.supabase
    .from("tasks")
    .select(TASK_COLUMNS)
    .eq("workspace_id", auth.workspace.id)
    .eq("project_id", projectId);

  if (q) {
    query = query.textSearch("search_vector", q, {
      type: "websearch",
      config: "simple",
    });
  }

  if (priority) {
    query = query.eq("priority", priority);
  }

  if (kind) {
    query = query.eq("kind_id", kind.id);
  }

  if (filters.stack) {
    query = query.eq("stack_id", filters.stack);
  }

  const { data, error } = await query
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    databaseFailure(error, "Could not load tasks.");
  }

  const kindsById = new Map(kinds.map((candidate) => [candidate.id, candidate]));

  return (data ?? []).map((row) => {
    const rowKind = kindsById.get(row.kind_id);

    if (!rowKind) {
      fail(500, "INTERNAL_ERROR", "A task kind could not be loaded.");
    }

    return toTask(row as TaskRow, rowKind);
  });
}

export async function getBoard(
  auth: ApiAuth,
  projectId: string,
  filters: BoardFilters,
): Promise<BoardData> {
  const { project, board } = await loadBoard(auth, projectId);
  const [stacks, kinds] = await Promise.all([
    loadStacks(auth, projectId),
    listTaskKinds(auth),
  ]);
  const tasks = await loadTasks(auth, projectId, filters, kinds, stacks);

  const tasksByStack = new Map<string, Task[]>();

  for (const task of tasks) {
    const stackTasks = tasksByStack.get(task.stackId) ?? [];
    stackTasks.push(task);
    tasksByStack.set(task.stackId, stackTasks);
  }

  return {
    project: toProject(project),
    board,
    stacks: stacks.map((stack) =>
      toBoardStack(stack, tasksByStack.get(stack.id) ?? []),
    ),
    kinds,
    filters: {
      q: filters.q.trim(),
      priority: filters.priority,
      kind: filters.kind,
      stack: filters.stack,
    },
  };
}

export async function listTasks(
  auth: ApiAuth,
  projectId: string,
  filters: BoardFilters,
): Promise<Task[]> {
  const board = await getBoard(auth, projectId, filters);
  return board.stacks.flatMap((stack) => stack.tasks);
}

export async function getTask(auth: ApiAuth, taskId: string): Promise<Task> {
  const row = await loadTaskRow(auth, taskId);
  const kind = await findKindById(auth, row.kind_id);
  return toTask(row, toTaskKind(kind));
}

export async function getTaskByKey(
  auth: ApiAuth,
  key: string,
): Promise<Task> {
  const normalized = key.trim().toUpperCase();

  if (!/^[A-Z][A-Z0-9]{1,9}-[1-9][0-9]*$/.test(normalized)) {
    fail(404, "NOT_FOUND", "Task not found.");
  }

  const { data, error } = await auth.supabase
    .from("tasks")
    .select(TASK_COLUMNS)
    .eq("workspace_id", auth.workspace.id)
    .eq("key", normalized)
    .maybeSingle();

  if (error) {
    databaseFailure(error, "Could not load the task.");
  }

  if (!data) {
    fail(404, "NOT_FOUND", "Task not found.");
  }

  const kind = await findKindById(auth, data.kind_id);
  return toTask(data as TaskRow, toTaskKind(kind));
}

export async function createTask(
  auth: ApiAuth,
  input: CreateTaskInput,
  idempotencyKey?: string | null,
): Promise<Task> {
  const project = await loadProject(auth, input.projectId);
  const kind = await findKindByKey(auth, input.kind);
  const title = taskTitle(input.title);
  const description = richTextDescription(input.description);
  const descriptionText = richTextToPlainText(description);
  const priority = validatePriority(input.priority);
  const due = dueDate(input.dueDate);

  if (input.stackId) {
    const { data: stack, error } = await auth.supabase
      .from("stacks")
      .select("id")
      .eq("id", input.stackId)
      .eq("project_id", project.id)
      .maybeSingle();

    if (error) {
      databaseFailure(error, "Could not load the target stack.");
    }

    if (!stack) {
      fail(404, "NOT_FOUND", "Stack not found.");
    }
  }

  const { data, error } = await auth.supabase.rpc("create_task", {
    p_workspace_id: auth.workspace.id,
    p_project_id: project.id,
    p_stack_id: (input.stackId ?? null) as unknown as string,
    p_kind_key: kind.key,
    p_title: title,
    p_description: description as unknown as Json,
    p_description_text: descriptionText,
    p_priority: priority,
    p_due_date: (due ?? null) as unknown as string,
    ...(idempotencyKey ? { p_idempotency_key: idempotencyKey } : {}),
  });

  if (error) {
    rpcFailure(error, "Could not create the task.");
  }

  if (!data) {
    fail(500, "INTERNAL_ERROR", "Could not create the task.");
  }

  const taskKind = await findKindById(auth, data.kind_id);
  return toTask(data as TaskRow, toTaskKind(taskKind));
}

export async function updateTask(
  auth: ApiAuth,
  input: UpdateTaskInput,
): Promise<Task> {
  await loadTaskRow(auth, input.taskId);

  const update: {
    title?: string;
    description?: Json;
    description_text?: string;
    kind_id?: string;
    priority?: (typeof TASK_PRIORITIES)[number];
    due_date?: string | null;
  } = {};
  let kind: TaskKindRow | null = null;

  if (input.title !== undefined) {
    update.title = taskTitle(input.title);
  }

  if (input.description !== undefined) {
    const description = richTextDescription(input.description);
    update.description = description as unknown as Json;
    update.description_text = richTextToPlainText(description);
  }

  if (input.kind !== undefined) {
    kind = await findKindByKey(auth, input.kind);
    update.kind_id = kind.id;
  }

  if (input.priority !== undefined) {
    update.priority = validatePriority(input.priority);
  }

  if (input.dueDate !== undefined) {
    update.due_date = dueDate(input.dueDate);
  }

  if (Object.keys(update).length === 0) {
    fail(422, "VALIDATION_ERROR", "Provide at least one task field.", [
      { path: "body", message: "Provide at least one task field." },
    ]);
  }

  const { data, error } = await auth.supabase
    .from("tasks")
    .update(update)
    .eq("id", input.taskId)
    .eq("workspace_id", auth.workspace.id)
    .select(TASK_COLUMNS)
    .maybeSingle();

  if (error) {
    databaseFailure(error, "Could not update the task.");
  }

  if (!data) {
    fail(404, "NOT_FOUND", "Task not found.");
  }

  const taskKind = kind ?? (await findKindById(auth, data.kind_id));

  return toTask(data as TaskRow, toTaskKind(taskKind));
}

export async function deleteTask(
  auth: ApiAuth,
  taskId: string,
): Promise<void> {
  const { data, error } = await auth.supabase
    .from("tasks")
    .delete()
    .eq("id", taskId)
    .eq("workspace_id", auth.workspace.id)
    .select("id")
    .maybeSingle();

  if (error) {
    databaseFailure(error, "Could not delete the task.");
  }

  if (!data) {
    fail(404, "NOT_FOUND", "Task not found.");
  }
}

export async function moveTask(
  auth: ApiAuth,
  input: MoveTaskInput,
): Promise<Task> {
  const task = await loadTaskRow(auth, input.taskId);

  const { data: stack, error: stackError } = await auth.supabase
    .from("stacks")
    .select("id")
    .eq("id", input.stackId)
    .eq("project_id", task.project_id)
    .maybeSingle();

  if (stackError) {
    databaseFailure(stackError, "Could not load the target stack.");
  }

  if (!stack) {
    fail(404, "NOT_FOUND", "Stack not found.");
  }

  const { data, error } = await auth.supabase.rpc("move_task", {
    p_task_id: input.taskId,
    p_stack_id: input.stackId,
    p_before_task_id: input.beforeTaskId ?? undefined,
  });

  if (error) {
    rpcFailure(error, "Could not move the task.");
  }

  if (!data) {
    fail(404, "NOT_FOUND", "Task not found.");
  }

  const kind = await findKindById(auth, data.kind_id);
  return toTask(data as TaskRow, toTaskKind(kind));
}

export async function createStack(
  auth: ApiAuth,
  input: CreateStackInput,
): Promise<Stack> {
  const { project, board } = await loadBoard(auth, input.projectId);
  const name = stackName(input.name);

  const { data: last, error: lastError } = await auth.supabase
    .from("stacks")
    .select("position")
    .eq("board_id", board.id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastError) {
    databaseFailure(lastError, "Could not load the board stacks.");
  }

  const { data, error } = await auth.supabase
    .from("stacks")
    .insert({
      project_id: project.id,
      board_id: board.id,
      name,
      position: (last?.position ?? 0) + 1024,
    })
    .select(STACK_COLUMNS)
    .single();

  if (error) {
    databaseFailure(error, "Could not create the stack.");
  }

  return toStack(data as StackRow);
}

export async function renameStack(
  auth: ApiAuth,
  input: RenameStackInput,
): Promise<Stack> {
  const stack = await loadStack(auth, input.stackId);
  const name = stackName(input.name);

  const { data, error } = await auth.supabase
    .from("stacks")
    .update({ name })
    .eq("id", stack.id)
    .eq("project_id", stack.project_id)
    .select(STACK_COLUMNS)
    .maybeSingle();

  if (error) {
    databaseFailure(error, "Could not rename the stack.");
  }

  if (!data) {
    fail(404, "NOT_FOUND", "Stack not found.");
  }

  return toStack(data as StackRow);
}

export async function deleteStack(
  auth: ApiAuth,
  input: DeleteStackInput,
): Promise<void> {
  await loadStack(auth, input.stackId);

  const { error } = await auth.supabase.rpc("delete_stack", {
    p_stack_id: input.stackId,
    p_move_tasks_to: input.moveTasksTo ?? undefined,
  });

  if (error) {
    rpcFailure(error, "Could not delete the stack.");
  }
}

export async function reorderStacks(
  auth: ApiAuth,
  input: ReorderStacksInput,
): Promise<Stack[]> {
  await loadProject(auth, input.projectId);

  if (new Set(input.stackIds).size !== input.stackIds.length) {
    fail(422, "VALIDATION_ERROR", "Stack IDs must be unique.", [
      { path: "stackIds", message: "Stack IDs must be unique." },
    ]);
  }

  const { data, error } = await auth.supabase.rpc("reorder_stacks", {
    p_project_id: input.projectId,
    p_stack_ids: input.stackIds,
  });

  if (error) {
    rpcFailure(error, "Could not reorder the stacks.");
  }

  if (!data) {
    fail(500, "INTERNAL_ERROR", "Could not reorder the stacks.");
  }

  return data.map((stack) => toStack(stack as StackRow));
}
