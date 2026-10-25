import type {
  CreateProjectInput,
  Project,
  ProjectSummary,
  UpdateProjectInput,
} from "@/lib/api/types";
import type { ApiAuth } from "./auth";
import { databaseFailure, fail } from "./errors";
import { toProject, toProjectSummary, type ProjectRow } from "./mappers";
import {
  ensureProjectId,
  projectDescription,
  projectKey,
  projectName,
} from "./validation";

const PROJECT_COLUMNS = "id, name, key, description, created_at, updated_at";

export async function listProjects(auth: ApiAuth): Promise<ProjectSummary[]> {
  const { data: projects, error: projectsError } = await auth.supabase
    .from("projects")
    .select(PROJECT_COLUMNS)
    .eq("workspace_id", auth.workspace.id)
    .order("updated_at", { ascending: false });

  if (projectsError) {
    databaseFailure(projectsError, "Could not load projects.");
  }

  const { data: tasks, error: tasksError } = await auth.supabase
    .from("tasks")
    .select("project_id")
    .eq("workspace_id", auth.workspace.id);

  if (tasksError) {
    databaseFailure(tasksError, "Could not load project task counts.");
  }

  const counts = new Map<string, number>();

  for (const task of tasks ?? []) {
    counts.set(task.project_id, (counts.get(task.project_id) ?? 0) + 1);
  }

  return (projects ?? []).map((project) =>
    toProjectSummary(project as ProjectRow, counts.get(project.id) ?? 0),
  );
}

export async function getProject(
  auth: ApiAuth,
  projectId: string,
): Promise<Project> {
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

  return toProject(data as ProjectRow);
}

export async function createProject(
  auth: ApiAuth,
  input: CreateProjectInput,
): Promise<Project> {
  const name = projectName(input.name);
  const key = projectKey(input.key);
  const description = projectDescription(input.description);

  const { data, error } = await auth.supabase.rpc("create_project", {
    p_workspace_id: auth.workspace.id,
    p_name: name,
    p_key: key,
    p_description: description ?? undefined,
  });

  if (error) {
    if (error.code === "23505") {
      fail(409, "CONFLICT", "That project key is already in use.");
    }

    databaseFailure(error, "Could not create the project.");
  }

  if (!data) {
    fail(500, "INTERNAL_ERROR", "Could not create the project.");
  }

  return toProject(data as ProjectRow);
}

export async function updateProject(
  auth: ApiAuth,
  input: UpdateProjectInput,
): Promise<Project> {
  ensureProjectId(input.projectId);

  const update: { name?: string; description?: string | null } = {};

  if (input.name !== undefined) {
    update.name = projectName(input.name);
  }

  if (input.description !== undefined) {
    update.description = projectDescription(input.description);
  }

  if (Object.keys(update).length === 0) {
    fail(422, "VALIDATION_ERROR", "Provide at least one project field.", [
      { path: "body", message: "Provide at least one project field." },
    ]);
  }

  const { data, error } = await auth.supabase
    .from("projects")
    .update(update)
    .eq("id", input.projectId)
    .eq("workspace_id", auth.workspace.id)
    .select(PROJECT_COLUMNS)
    .maybeSingle();

  if (error) {
    databaseFailure(error, "Could not update the project.");
  }

  if (!data) {
    fail(404, "NOT_FOUND", "Project not found.");
  }

  return toProject(data as ProjectRow);
}

export async function deleteProject(
  auth: ApiAuth,
  projectId: string,
): Promise<void> {
  ensureProjectId(projectId);

  const { data, error } = await auth.supabase
    .from("projects")
    .delete()
    .eq("id", projectId)
    .eq("workspace_id", auth.workspace.id)
    .select("id")
    .maybeSingle();

  if (error) {
    databaseFailure(error, "Could not delete the project.");
  }

  if (!data) {
    fail(404, "NOT_FOUND", "Project not found.");
  }
}
