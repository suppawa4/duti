"use server";

import type {
  CreateTaskKindInput,
  TaskKind,
  UpdateTaskKindInput,
} from "@/lib/api/types";
import {
  revalidateWorkspace,
  withApi,
  withApiVoid,
} from "@/lib/actions/helpers";
import type { ActionResult } from "@/lib/actions/types";

export async function createTaskKindAction(
  input: CreateTaskKindInput,
): Promise<ActionResult<TaskKind>> {
  const result = await withApi((api) =>
    api.v1["task-kinds"].post({
      key: input.key,
      name: input.name,
    }),
  );

  if (result.ok) {
    revalidateWorkspace();
  }

  return result;
}

export async function updateTaskKindAction(
  input: UpdateTaskKindInput,
): Promise<ActionResult<TaskKind>> {
  const result = await withApi((api) =>
    api.v1["task-kinds"]({ kindId: input.kindId }).patch({
      name: input.name,
    }),
  );

  if (result.ok) {
    revalidateWorkspace();
  }

  return result;
}

export async function deleteTaskKindAction(
  kindId: string,
): Promise<ActionResult<null>> {
  const result = await withApiVoid((api) =>
    api.v1["task-kinds"]({ kindId }).delete(),
  );

  if (result.ok) {
    revalidateWorkspace();
  }

  return result;
}
