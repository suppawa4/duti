import type {
  CreateTaskKindInput,
  TaskKind,
  UpdateTaskKindInput,
} from "@/lib/api/types";
import type { ApiAuth } from "./auth";
import { databaseFailure, fail } from "./errors";
import { toTaskKind, type TaskKindRow } from "./mappers";
import { taskKindKey, taskKindName } from "./validation";

const KIND_COLUMNS = "id, key, name, is_default";

export async function listTaskKinds(auth: ApiAuth): Promise<TaskKind[]> {
  const { data, error } = await auth.supabase
    .from("task_kinds")
    .select(KIND_COLUMNS)
    .eq("workspace_id", auth.workspace.id)
    .order("is_default", { ascending: false })
    .order("name", { ascending: true });

  if (error) {
    databaseFailure(error, "Could not load task kinds.");
  }

  return (data ?? []).map((kind) => toTaskKind(kind as TaskKindRow));
}

export async function createTaskKind(
  auth: ApiAuth,
  input: CreateTaskKindInput,
): Promise<TaskKind> {
  const key = taskKindKey(input.key);
  const name = taskKindName(input.name);

  const { data, error } = await auth.supabase
    .from("task_kinds")
    .insert({
      workspace_id: auth.workspace.id,
      key,
      name,
      is_default: false,
    })
    .select(KIND_COLUMNS)
    .single();

  if (error) {
    if (error.code === "23505") {
      fail(409, "CONFLICT", "That kind key is already in use.");
    }

    databaseFailure(error, "Could not create the task kind.");
  }

  return toTaskKind(data as TaskKindRow);
}

export async function updateTaskKind(
  auth: ApiAuth,
  input: UpdateTaskKindInput,
): Promise<TaskKind> {
  const name = taskKindName(input.name);

  const { data, error } = await auth.supabase
    .from("task_kinds")
    .update({ name })
    .eq("id", input.kindId)
    .eq("workspace_id", auth.workspace.id)
    .select(KIND_COLUMNS)
    .maybeSingle();

  if (error) {
    databaseFailure(error, "Could not rename the task kind.");
  }

  if (!data) {
    fail(404, "NOT_FOUND", "Task kind not found.");
  }

  return toTaskKind(data as TaskKindRow);
}

export async function deleteTaskKind(
  auth: ApiAuth,
  kindId: string,
): Promise<void> {
  const { data: kind, error: kindError } = await auth.supabase
    .from("task_kinds")
    .select("id, is_default")
    .eq("id", kindId)
    .eq("workspace_id", auth.workspace.id)
    .maybeSingle();

  if (kindError) {
    databaseFailure(kindError, "Could not load the task kind.");
  }

  if (!kind) {
    fail(404, "NOT_FOUND", "Task kind not found.");
  }

  if (kind.is_default) {
    fail(409, "CONFLICT", "The default task kind cannot be deleted.");
  }

  const { error } = await auth.supabase
    .from("task_kinds")
    .delete()
    .eq("id", kindId)
    .eq("workspace_id", auth.workspace.id);

  if (error) {
    if (error.code === "23503") {
      fail(
        409,
        "CONFLICT",
        "This kind is in use by one or more tasks. Reassign those tasks first.",
      );
    }

    databaseFailure(error, "Could not delete the task kind.");
  }
}
