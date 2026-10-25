"use server";

import type {
  CreateProjectInput,
  Project,
  UpdateProjectInput,
} from "@/lib/api/types";
import {
  revalidateWorkspace,
  withApi,
  withApiVoid,
} from "@/lib/actions/helpers";
import type { ActionResult } from "@/lib/actions/types";

export async function createProjectAction(
  input: CreateProjectInput,
): Promise<ActionResult<Project>> {
  const result = await withApi((api) =>
    api.v1.projects.post({
      name: input.name,
      key: input.key,
      description: input.description,
    }),
  );

  if (result.ok) {
    revalidateWorkspace(result.data.id);
  }

  return result;
}

export async function updateProjectAction(
  input: UpdateProjectInput,
): Promise<ActionResult<Project>> {
  const result = await withApi((api) =>
    api.v1.projects({ projectId: input.projectId }).patch({
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.description === undefined
        ? {}
        : { description: input.description }),
    }),
  );

  if (result.ok) {
    revalidateWorkspace(result.data.id);
  }

  return result;
}

export async function deleteProjectAction(
  projectId: string,
): Promise<ActionResult<null>> {
  const result = await withApiVoid((api) =>
    api.v1.projects({ projectId }).delete(),
  );

  if (result.ok) {
    revalidateWorkspace();
  }

  return result;
}
