import {
  Elysia,
  NotFound,
  ParseError,
  ValidationError,
  status,
  t,
} from "elysia";
import { openapi } from "@elysia/openapi";
import type { BoardFilters, TaskPriority } from "@/lib/api/types";
import {
  createStack,
  createTask,
  deleteStack,
  deleteTask,
  getBoard,
  getTask,
  getTaskByKey,
  listTasks,
  moveTask,
  renameStack,
  reorderStacks,
  updateTask,
} from "./server/board";
import { ApiError, apiError, fail } from "./server/errors";
import { toTaskKind, type TaskKindRow } from "./server/mappers";
import {
  createProject,
  deleteProject,
  getProject,
  listProjects,
  updateProject,
} from "./server/projects";
import { auth } from "./server/auth";
import {
  createTaskKind,
  deleteTaskKind,
  listTaskKinds,
  updateTaskKind,
} from "./server/task-kinds";
import { createApiKey, listApiKeys, revokeApiKey } from "./server/api-keys";

const priority = t.Union([
  t.Literal("low"),
  t.Literal("medium"),
  t.Literal("high"),
  t.Literal("critical"),
]);

const dueDateSchema = t.String({
  pattern: "^\\d{4}-\\d{2}-\\d{2}$",
  maxLength: 10,
});

const projectParams = t.Object({ projectId: t.String() });
const taskParams = t.Object({ taskId: t.String() });
const taskKeyParams = t.Object({
  key: t.String({ maxLength: 32 }),
});
const stackParams = t.Object({ stackId: t.String() });
const kindParams = t.Object({ kindId: t.String() });
const apiKeyParams = t.Object({ keyId: t.String() });

const boardQuery = t.Object({
  q: t.Optional(t.String({ maxLength: 200 })),
  priority: t.Optional(priority),
  kind: t.Optional(t.String({ maxLength: 32 })),
  stack: t.Optional(t.String()),
});

const createProjectBody = t.Object({
  name: t.String({ minLength: 1, maxLength: 120 }),
  key: t.String({ minLength: 2, maxLength: 10 }),
  description: t.Optional(t.Union([t.String({ maxLength: 2_000 }), t.Null()])),
});

const updateProjectBody = t.Object({
  name: t.Optional(t.String({ minLength: 1, maxLength: 120 })),
  description: t.Optional(t.Union([t.String({ maxLength: 2_000 }), t.Null()])),
});

const createStackBody = t.Object({
  name: t.String({ minLength: 1, maxLength: 80 }),
});

const renameStackBody = t.Object({
  name: t.String({ minLength: 1, maxLength: 80 }),
});

const reorderStacksBody = t.Object({
  stackIds: t.Array(t.String(), { minItems: 1 }),
});

const createTaskBody = t.Object({
  title: t.String({ minLength: 1, maxLength: 500 }),
  description: t.Optional(t.Any()),
  kind: t.String({ minLength: 1, maxLength: 32 }),
  priority,
  dueDate: t.Optional(t.Union([dueDateSchema, t.Null()])),
  stackId: t.Optional(t.Union([t.String(), t.Null()])),
});

const updateTaskBody = t.Object({
  title: t.Optional(t.String({ minLength: 1, maxLength: 500 })),
  description: t.Optional(t.Any()),
  kind: t.Optional(t.String({ minLength: 1, maxLength: 32 })),
  priority: t.Optional(priority),
  dueDate: t.Optional(t.Union([dueDateSchema, t.Null()])),
});

const moveTaskBody = t.Object({
  stackId: t.String(),
  beforeTaskId: t.Optional(t.Union([t.String(), t.Null()])),
});

const deleteStackQuery = t.Object({
  moveTasksTo: t.Optional(t.String()),
});

const createKindBody = t.Object({
  key: t.String({ minLength: 1, maxLength: 32 }),
  name: t.String({ minLength: 1, maxLength: 80 }),
});

const updateKindBody = t.Object({
  name: t.String({ minLength: 1, maxLength: 80 }),
});

const createApiKeyBody = t.Object({
  name: t.String({ minLength: 1, maxLength: 80 }),
  expiresAt: t.Optional(t.Union([t.String({ maxLength: 40 }), t.Null()])),
});

function toFilters(query: {
  q?: string;
  priority?: TaskPriority;
  kind?: string;
  stack?: string;
}): BoardFilters {
  return {
    q: query.q?.trim() ?? "",
    priority: query.priority ?? null,
    kind: query.kind?.trim() || null,
    stack: query.stack?.trim() || null,
  };
}

function validationDetails(error: ValidationError) {
  return error.all.map((issue) => ({
    path:
      typeof issue.path === "string" && issue.path.length > 0
        ? issue.path.replace(/^\//, "").replaceAll("/", ".")
        : "body",
    message:
      typeof issue.message === "string" ? issue.message : "Invalid value.",
  }));
}

export const app = new Elysia({ prefix: "/api" })
  .use(
    openapi({
      path: "/docs",
      specPath: "/openapi.json",
      documentation: {
        info: {
          title: "Duti API",
          version: "0.1.0",
          description:
            "API for managing Duti workspaces, projects, boards, tasks, task kinds, and API keys. Protected endpoints accept either a Supabase access token or a Duti API key in the Authorization: Bearer header.",
        },
        servers: [{ url: "/", description: "Current Duti server" }],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: "http",
              scheme: "bearer",
              description:
                "Enter a Supabase access token for the web app, or a generated Duti API key beginning with duti_live_ for external agents. Do not include the Bearer prefix in this field.",
            },
          },
        },
        security: [{ bearerAuth: [] }],
        tags: [
          { name: "Health", description: "Service health and status." },
          {
            name: "Workspace",
            description: "Current user and workspace context.",
          },
          {
            name: "Projects",
            description: "Create and manage projects and boards.",
          },
          {
            name: "Tasks",
            description: "Create, retrieve, update, move, and delete tasks.",
          },
          {
            name: "Stacks",
            description: "Manage board columns and their ordering.",
          },
          {
            name: "Task kinds",
            description: "Manage workspace-defined task kinds.",
          },
          {
            name: "API keys",
            description: "Create, list, and revoke external-agent API keys.",
          },
        ],
      },
      scalar: {
        setPageTitle: () => "Duti API Reference",
        hideDarkModeToggle: false,
        telemetry: false,
      },
    }),
  )
  .use(auth)
  .onError(({ error, set }) => {
    if (error instanceof ApiError) {
      set.status = error.status;
      return apiError(error.code, error.message, error.details);
    }

    if (error instanceof ValidationError) {
      set.status = 422;
      return apiError(
        "VALIDATION_ERROR",
        "The request is invalid.",
        validationDetails(error),
      );
    }

    if (error instanceof ParseError) {
      set.status = 400;
      return apiError(
        "VALIDATION_ERROR",
        "The request body could not be read.",
      );
    }

    if (error instanceof NotFound) {
      set.status = 404;
      return apiError("NOT_FOUND", "Route not found.");
    }

    console.error("Unhandled API error", error);
    set.status = 500;
    return apiError("INTERNAL_ERROR", "Something went wrong.");
  })
  .get(
    "/v1/health",
    {
      detail: {
        tags: ["Health"],
        summary: "Check API health",
        description:
          "Public endpoint used to verify that the Duti API is responding.",
        security: [],
      },
    },
    () => ({ ok: true, service: "duti", version: "0.1.0" }),
  )
  .get(
    "/v1/me",
    {
      auth: true,
      detail: {
        tags: ["Workspace"],
        summary: "Get current user and workspace",
      },
    },
    async ({ auth }) => {
      const { data: defaultKind, error: kindError } = await auth.supabase
        .from("task_kinds")
        .select("id, key, name, is_default")
        .eq("workspace_id", auth.workspace.id)
        .eq("is_default", true)
        .maybeSingle();

      if (kindError) {
        fail(500, "INTERNAL_ERROR", "Could not load the default task kind.");
      }

      return {
        user: auth.user,
        workspace: auth.workspace,
        authMode: auth.authMode,
        apiKey: auth.apiKey,
        defaultKind: defaultKind
          ? toTaskKind(defaultKind as TaskKindRow)
          : null,
      };
    },
  )
  .get(
    "/v1/projects",
    { auth: true, detail: { tags: ["Projects"], summary: "List projects" } },
    async ({ auth }) => listProjects(auth),
  )
  .post(
    "/v1/projects",
    {
      auth: true,
      body: createProjectBody,
      detail: { tags: ["Projects"], summary: "Create project" },
    },
    async ({ auth, body }) =>
      status(
        201,
        await createProject(auth, {
          name: body.name,
          key: body.key,
          description: body.description ?? "",
        }),
      ),
  )
  .get(
    "/v1/projects/:projectId",
    {
      auth: true,
      params: projectParams,
      detail: { tags: ["Projects"], summary: "Get project" },
    },
    async ({ auth, params }) => getProject(auth, params.projectId),
  )
  .patch(
    "/v1/projects/:projectId",
    {
      auth: true,
      params: projectParams,
      body: updateProjectBody,
      detail: { tags: ["Projects"], summary: "Update project" },
    },
    async ({ auth, params, body }) =>
      updateProject(auth, {
        projectId: params.projectId,
        ...body,
      }),
  )
  .delete(
    "/v1/projects/:projectId",
    {
      auth: true,
      params: projectParams,
      detail: { tags: ["Projects"], summary: "Delete project" },
    },
    async ({ auth, params }) => {
      await deleteProject(auth, params.projectId);
      return status(204);
    },
  )
  .get(
    "/v1/projects/:projectId/board",
    {
      auth: true,
      params: projectParams,
      query: boardQuery,
      detail: { tags: ["Projects"], summary: "Get project board" },
    },
    async ({ auth, params, query }) =>
      getBoard(auth, params.projectId, toFilters(query)),
  )
  .get(
    "/v1/projects/:projectId/tasks",
    {
      auth: true,
      params: projectParams,
      query: boardQuery,
      detail: { tags: ["Tasks"], summary: "List project tasks" },
    },
    async ({ auth, params, query }) =>
      listTasks(auth, params.projectId, toFilters(query)),
  )
  .post(
    "/v1/projects/:projectId/tasks",
    {
      auth: true,
      params: projectParams,
      body: createTaskBody,
      detail: { tags: ["Tasks"], summary: "Create task" },
    },
    async ({ auth, params, body, headers }) => {
      const idempotencyKey =
        headers["idempotency-key"]?.trim() ||
        headers["Idempotency-Key"]?.trim() ||
        null;

      if (idempotencyKey && idempotencyKey.length > 200) {
        fail(422, "VALIDATION_ERROR", "Idempotency-Key is too long.");
      }

      return status(
        201,
        await createTask(
          auth,
          {
            projectId: params.projectId,
            title: body.title,
            description: body.description,
            kind: body.kind,
            priority: body.priority,
            dueDate: body.dueDate ?? null,
            stackId: body.stackId ?? null,
          },
          idempotencyKey,
        ),
      );
    },
  )
  .get(
    "/v1/tasks/by-key/:key",
    {
      auth: true,
      params: taskKeyParams,
      detail: { tags: ["Tasks"], summary: "Get task by human-readable key" },
    },
    async ({ auth, params }) => getTaskByKey(auth, params.key),
  )
  .get(
    "/v1/tasks/:taskId",
    {
      auth: true,
      params: taskParams,
      detail: { tags: ["Tasks"], summary: "Get task" },
    },
    async ({ auth, params }) => getTask(auth, params.taskId),
  )
  .patch(
    "/v1/tasks/:taskId",
    {
      auth: true,
      params: taskParams,
      body: updateTaskBody,
      detail: { tags: ["Tasks"], summary: "Update task" },
    },
    async ({ auth, params, body }) =>
      updateTask(auth, {
        taskId: params.taskId,
        ...body,
      }),
  )
  .delete(
    "/v1/tasks/:taskId",
    {
      auth: true,
      params: taskParams,
      detail: { tags: ["Tasks"], summary: "Delete task" },
    },
    async ({ auth, params }) => {
      await deleteTask(auth, params.taskId);
      return status(204);
    },
  )
  .post(
    "/v1/tasks/:taskId/move",
    {
      auth: true,
      params: taskParams,
      body: moveTaskBody,
      detail: { tags: ["Tasks"], summary: "Move task to a stack" },
    },
    async ({ auth, params, body }) =>
      moveTask(auth, {
        taskId: params.taskId,
        stackId: body.stackId,
        beforeTaskId: body.beforeTaskId ?? null,
      }),
  )
  .post(
    "/v1/projects/:projectId/stacks",
    {
      auth: true,
      params: projectParams,
      body: createStackBody,
      detail: { tags: ["Stacks"], summary: "Create stack" },
    },
    async ({ auth, params, body }) =>
      status(
        201,
        await createStack(auth, {
          projectId: params.projectId,
          name: body.name,
        }),
      ),
  )
  .patch(
    "/v1/stacks/:stackId",
    {
      auth: true,
      params: stackParams,
      body: renameStackBody,
      detail: { tags: ["Stacks"], summary: "Rename stack" },
    },
    async ({ auth, params, body }) =>
      renameStack(auth, { stackId: params.stackId, name: body.name }),
  )
  .delete(
    "/v1/stacks/:stackId",
    {
      auth: true,
      params: stackParams,
      query: deleteStackQuery,
      detail: { tags: ["Stacks"], summary: "Delete stack" },
    },
    async ({ auth, params, query }) => {
      await deleteStack(auth, {
        stackId: params.stackId,
        moveTasksTo: query.moveTasksTo ?? null,
      });
      return status(204);
    },
  )
  .post(
    "/v1/projects/:projectId/stacks/reorder",
    {
      auth: true,
      params: projectParams,
      body: reorderStacksBody,
      detail: { tags: ["Stacks"], summary: "Reorder stacks" },
    },
    async ({ auth, params, body }) =>
      reorderStacks(auth, {
        projectId: params.projectId,
        stackIds: body.stackIds,
      }),
  )
  .get(
    "/v1/task-kinds",
    {
      auth: true,
      detail: { tags: ["Task kinds"], summary: "List task kinds" },
    },
    async ({ auth }) => listTaskKinds(auth),
  )
  .post(
    "/v1/task-kinds",
    {
      auth: true,
      body: createKindBody,
      detail: { tags: ["Task kinds"], summary: "Create task kind" },
    },
    async ({ auth, body }) => status(201, await createTaskKind(auth, body)),
  )
  .patch(
    "/v1/task-kinds/:kindId",
    {
      auth: true,
      params: kindParams,
      body: updateKindBody,
      detail: { tags: ["Task kinds"], summary: "Rename task kind" },
    },
    async ({ auth, params, body }) =>
      updateTaskKind(auth, { kindId: params.kindId, name: body.name }),
  )
  .delete(
    "/v1/task-kinds/:kindId",
    {
      auth: true,
      params: kindParams,
      detail: { tags: ["Task kinds"], summary: "Delete task kind" },
    },
    async ({ auth, params }) => {
      await deleteTaskKind(auth, params.kindId);
      return status(204);
    },
  )
  .get(
    "/v1/api-keys",
    { auth: true, detail: { tags: ["API keys"], summary: "List API keys" } },
    async ({ auth }) => listApiKeys(auth),
  )
  .post(
    "/v1/api-keys",
    {
      auth: true,
      body: createApiKeyBody,
      detail: { tags: ["API keys"], summary: "Create API key" },
    },
    async ({ auth, body }) =>
      status(
        201,
        await createApiKey(auth, {
          name: body.name,
          expiresAt: body.expiresAt ?? null,
        }),
      ),
  )
  .delete(
    "/v1/api-keys/:keyId",
    {
      auth: true,
      params: apiKeyParams,
      detail: { tags: ["API keys"], summary: "Revoke API key" },
    },
    async ({ auth, params }) => {
      await revokeApiKey(auth, params.keyId);
      return status(204);
    },
  );
