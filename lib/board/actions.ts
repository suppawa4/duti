"use server";

import type {
  CreateStackInput,
  CreateTaskInput,
  DeleteStackInput,
  MoveTaskInput,
  RenameStackInput,
  ReorderStacksInput,
  Stack,
  Task,
  UpdateTaskInput,
} from "@/lib/api/types";
import {
  revalidateWorkspace,
  withApi,
  withApiVoid,
} from "@/lib/actions/helpers";
import type { ActionResult } from "@/lib/actions/types";

export async function createTaskAction(
  input: CreateTaskInput,
): Promise<ActionResult<Task>> {
  const result = await withApi((api) =>
    api.v1.projects({ projectId: input.projectId }).tasks.post({
      title: input.title,
      description: input.description,
      kind: input.kind,
      priority: input.priority,
      dueDate: input.dueDate,
      stackId: input.stackId,
    }),
  );

  if (result.ok) {
    revalidateWorkspace(input.projectId);
  }

  return result;
}

export async function updateTaskAction(
  input: UpdateTaskInput & { projectId: string },
): Promise<ActionResult<Task>> {
  const result = await withApi((api) =>
    api.v1.tasks({ taskId: input.taskId }).patch({
      ...(input.title === undefined ? {} : { title: input.title }),
      ...(input.description === undefined
        ? {}
        : { description: input.description }),
      ...(input.kind === undefined ? {} : { kind: input.kind }),
      ...(input.priority === undefined ? {} : { priority: input.priority }),
      ...(input.dueDate === undefined ? {} : { dueDate: input.dueDate }),
    }),
  );

  if (result.ok) {
    revalidateWorkspace(input.projectId);
  }

  return result;
}

export async function deleteTaskAction(
  taskId: string,
  projectId: string,
): Promise<ActionResult<null>> {
  const result = await withApiVoid((api) =>
    api.v1.tasks({ taskId }).delete(),
  );

  if (result.ok) {
    revalidateWorkspace(projectId);
  }

  return result;
}

export async function moveTaskAction(
  input: MoveTaskInput & { projectId: string },
): Promise<ActionResult<Task>> {
  const result = await withApi((api) =>
    api.v1.tasks({ taskId: input.taskId }).move.post({
      stackId: input.stackId,
      beforeTaskId: input.beforeTaskId,
    }),
  );

  if (result.ok) {
    revalidateWorkspace(input.projectId);
  }

  return result;
}

export async function createStackAction(
  input: CreateStackInput,
): Promise<ActionResult<Stack>> {
  const result = await withApi((api) =>
    api.v1.projects({ projectId: input.projectId }).stacks.post({
      name: input.name,
    }),
  );

  if (result.ok) {
    revalidateWorkspace(input.projectId);
  }

  return result;
}

export async function renameStackAction(
  input: RenameStackInput & { projectId: string },
): Promise<ActionResult<Stack>> {
  const result = await withApi((api) =>
    api.v1.stacks({ stackId: input.stackId }).patch({
      name: input.name,
    }),
  );

  if (result.ok) {
    revalidateWorkspace(input.projectId);
  }

  return result;
}

export async function deleteStackAction(
  input: DeleteStackInput & { projectId: string },
): Promise<ActionResult<null>> {
  const result = await withApiVoid((api) =>
    api.v1.stacks({ stackId: input.stackId }).delete({
      query: {
        ...(input.moveTasksTo === null
          ? {}
          : { moveTasksTo: input.moveTasksTo }),
      },
    }),
  );

  if (result.ok) {
    revalidateWorkspace(input.projectId);
  }

  return result;
}

export async function reorderStacksAction(
  input: ReorderStacksInput,
): Promise<ActionResult<Stack[]>> {
  const result = await withApi((api) =>
    api.v1.projects({ projectId: input.projectId }).stacks.reorder.post({
      stackIds: input.stackIds,
    }),
  );

  if (result.ok) {
    revalidateWorkspace(input.projectId);
  }

  return result;
}
