# Duti — Personal Project Management App

I'd build Duti as a lightweight, single-user Jira clone: every Google account gets one isolated personal workspace, multiple projects, and customizable Kanban boards. The key extra feature is a secure API-key system so AI agents can create tasks and file bugs without needing to operate the UI.

The guiding principle: Jira's familiar workflow, without Jira's organizational complexity.

> **Status:** This document is the source of truth for the MVP. The "Locked decisions" section overrides older text in this file or in earlier conversations. If implementation disagrees with it, change this document first.

## 0. Locked decisions (2026-10-23)

These were chosen before implementation. Do not silently reopen them.

| Area | Decision | Consequence |
| --- | --- | --- |
| Backend topology | Elysia 2 embedded in Next.js 16 through one catch-all route, running on Node | One deployment, no separate Bun service, no `.listen()`, no Bun-only APIs |
| Authorization | UI calls use the signed-in user's Supabase JWT so RLS applies; agents use API keys and a service-role client with explicit workspace scoping | Two database access paths, both centralized and tested |
| Task IDs | `PROJECTKEY-NUMBER`, e.g. `DUTI-1` | Counter is per project; kind is display metadata, not part of the ID; project key is immutable |
| UI data flow | Server Components read, Server Actions mutate through the Eden server client, small client islands for drag-and-drop and dialogs | The browser does not call the Elysia API directly in the MVP |
| Workspace provisioning | Postgres trigger on `auth.users`; no app-level email allowlist | Any Google account that completes OAuth gets its own isolated workspace. The app is self-serve, not single-account |
| UI system | shadcn/ui with the `aria` base (React Aria primitives), `@dnd-kit` for board sorting, Tiptap for rich text | One primitive system; record the shadcn preset in `components.json`; do not mix Radix/Base UI components |
| Database workflow | Hosted Supabase project, SQL migrations through the Supabase CLI, generated TypeScript types | No Docker required; no Drizzle runtime |
| Search and filters | Included in the MVP board: title/description search plus priority and kind filters | Full-text index and URL query parameters are part of the schema/API |
| Deployment | One Next.js Node deployment plus hosted Supabase | No separate API host, no CORS in the MVP |

### Superseded from earlier drafts

These points caused ambiguity and are now settled:

- **Separate Bun service → embedded Elysia on Node.** Next.js owns the HTTP server; the catch-all route forwards `app.fetch`.
- **Kind-prefixed IDs (`BUG-001`) → project-prefixed IDs (`DUTI-1`).** `task_kinds.prefix` and `task_kinds.next_number` are removed. A kind is a badge, not an ID namespace.
- **Drizzle/ORM runtime → Supabase JS + SQL migrations.** Migrations live in `supabase/migrations`; types are generated with the Supabase CLI.
- **shadcn + standalone React Aria → shadcn's `aria` base.** React Aria is the primitive layer underneath shadcn; it is not a second component system.
- **Local Docker requirement → hosted Supabase.** `supabase start` is not part of the required workflow.

## 1. Core product structure

```text
Google account
      │
Supabase Auth · Google OAuth · self-serve
      │
Personal workspace (exactly one per account)
      │
      ├── Project A ── one Kanban board
      ├── Project B ── another independent board
      └── Personal API keys (workspace-scoped)
```

There is one owner per workspace and no collaboration. Multiple Google accounts can use the app, but each account sees only its own workspace. Isolation comes from workspace ownership and RLS, not from an email allowlist.

### MVP feature scope

| Area | Requirements |
| --- | --- |
| Authentication | Sign in with Google through Supabase; any account that completes OAuth provisions its own workspace |
| Workspace | Exactly one personal workspace per account |
| Projects | Create, rename, and delete projects |
| Boards | One board per project; create, rename, reorder, and delete stacks |
| Tasks | Create, edit, view, move, search, filter, and delete cards |
| Task metadata | Title, rich-text description, priority, kind, due date, generated ID |
| Configuration | Manage task kinds and API keys |
| Agent API | Authenticate and create or update tasks programmatically |
| Search | Title/description search plus priority and kind filters |

No teams, assignees, email, notifications, comments, or complex permissions in the initial version.

## 2. Board design

The board should feel familiar to anyone who has used Jira, but stay visually lightweight.

```text
Duti / My Project                                      Search…   Priority ▾   Kind ▾
────────────────────────────────────────────────────────────────────────────────────
Backlog (2)              In Progress (1)          Review (1)             Done (1)
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐   ┌──────────────────┐
│ DUTI-1  BUG      │    │ DUTI-3  FEAT     │    │ DUTI-4  TASK     │   │ DUTI-5  BUG      │
│ Login redirect…  │    │ Add API keys     │    │ Polish task…     │   │ Fix board layout │
│ high             │    │ critical         │    │ medium           │   │ low              │
└──────────────────┘    └──────────────────┘    └──────────────────┘   └──────────────────┘
+ Add task               + Add task               + Add task              + Add task
```

Stacks and task cards are configurable; the examples above are illustrative, not persisted data.

### Task fields

| Field | Behavior |
| --- | --- |
| ID | Generated automatically as `PROJECTKEY-NUMBER`, e.g. `DUTI-1`; stable for the life of the task |
| Title | Required plain text |
| Description | Optional rich-text editor, stored as validated Tiptap JSON |
| Priority | `low`, `medium`, `high`, `critical` — hard-coded constants |
| Kind | Configurable types such as `issue`, `bug`, `feat`, `task`; shown as a badge |
| Due date | Optional date (`YYYY-MM-DD`) |
| Stack | Current board status |
| Created / updated | Automatic timestamps |

One important distinction: **the project key owns the task ID; the kind is metadata.** A user-created kind never changes ID generation and never requires application code changes. Store a configurable key such as `bug` and a display name such as `Bug`; display it next to the task ID.

Project key rules:

- Uppercase `[A-Z][A-Z0-9]{1,9}` (2–10 characters).
- Unique within a workspace.
- Immutable after project creation. If the project is renamed, the key stays the same. Existing task keys never change.
- Example: project `Duti` → key `DUTI` → tasks `DUTI-1`, `DUTI-2`, …

## 3. Recommended tech stack

Keep the stack small and avoid unnecessary infrastructure.

**Frontend — Next.js 16 + TypeScript.** App Router, Server Components for reads, Server Actions for mutations, client components only where interaction requires them (board drag-and-drop, dialogs, rich-text editing). The project already runs Next 16.4.2 with `cacheComponents` enabled.

**Backend — Elysia 2 embedded in Next.js on Node.** One Elysia app in `lib/server.ts`, mounted through `app/api/[[...slugs]]/route.ts`. Elysia owns routing, validation, status codes, auth middleware, and response shaping. It runs on Node through Next.js, not Bun: no `.listen()`, no `Bun.*` APIs, no Bun-only plugins. See `agent.md` for the current architecture rules.

**Database and authentication — Supabase (hosted).** PostgreSQL, Google OAuth, session management, and Row Level Security. Use the hosted project already configured in `.env`. No Docker dependency for the MVP. Migrations are SQL files applied with the Supabase CLI; runtime access uses `@supabase/supabase-js` / `@supabase/ssr`, not an ORM.

**UI — shadcn/ui with the `aria` base.** Initialize with the project's package runner:

```bash
bunx --bun shadcn@latest init --base aria
```

The CLI supports `--base base`, `--base radix`, and `--base aria`. The `aria` base uses React Aria primitives, which matches the accessibility goal. Record the chosen preset/style and icon library in `components.json`; use that icon library consistently. Do not mix in Radix or Base UI components for individual screens. If a component is missing from the `aria` registry, compose the React Aria primitive directly rather than switching bases.

Additional choices:

- **Rich text:** Tiptap, storing validated JSON documents in PostgreSQL. Never render arbitrary HTML.
- **Validation:** Elysia's TypeBox-based `t` schemas for HTTP input, plus shared Zod/TypeBox schemas for form-level validation where useful. Keep one canonical schema per request shape.
- **Drag and drop:** `@dnd-kit/core` plus `@dnd-kit/sortable`. It is independent of the component base and supports keyboard sensors. Always provide a non-drag alternative: a "Move to stack…" menu on each card.
- **Forms:** shadcn's field primitives (for example `FieldGroup` / `Field`) built on the `aria` base; use the installed `shadcn` skill's component docs rather than inventing new form markup.
- **Toasts:** `sonner` (the shadcn guidance for React Aria projects).
- **State:** Server Components + Server Actions. Use local React state for transient board interactions and optimistic UI. Do not add TanStack Query in the MVP.
- **API documentation:** Elysia's `@elysia/openapi` integration, publishing the OpenAPI 3 document at `/api/openapi.json` and serving the Scalar reference at `/api/docs`.
- **Rate limiting:** a simple per-API-key limiter in Elysia for the MVP (for example 60 requests/minute). In-memory limits are best-effort and reset on deploy; they are not an authorization boundary.

### Elysia request flow

```text
Server Component / Server Action
        │
        ├── createClient() (Supabase SSR, reads cookies)
        ├── reads session access token
        └── treaty(app, { headers: { Authorization: `Bearer ${token}` } })
                    │
                    └── Elysia app (direct call, no network) ──► Supabase with user JWT (RLS)

External agent
        └── HTTP /api/v1/* ──► Next catch-all ──► Elysia ──► service-role Supabase (explicit workspace scope)
```

`lib/eden.server.ts` now exposes `getAccessToken()` and `createApi(accessToken)` for request-scoped calls, plus a `publicApi` singleton for unauthenticated endpoints such as health. Do not `await` or return the Eden proxy from an async function: the proxy is thenable, so Promise resolution can hang. Read the token first, then build the client.

## 4. Database schema

Model the workspace explicitly, even though there is one per account. It gives API keys, ownership checks, and future expansion a clean foundation.

| Table | Key columns | Constraints and notes |
| --- | --- | --- |
| `profiles` | `id` (PK, FK `auth.users`), `created_at` | One row per auth user; `on delete cascade` |
| `workspaces` | `id`, `owner_id`, `name`, `created_at`, `updated_at` | `owner_id` unique, FK `profiles`; exactly one workspace per account |
| `projects` | `id`, `workspace_id`, `name`, `key`, `description`, `next_task_number`, `created_at`, `updated_at` | `unique (workspace_id, key)`; key uppercase and immutable; `next_task_number >= 1`; unique `(workspace_id, id)` for composite FKs |
| `boards` | `id`, `project_id`, `name` | `project_id` unique (one board per project); unique `(project_id, id)` for composite FKs |
| `stacks` | `id`, `project_id`, `board_id`, `name`, `position` | FK `(project_id, board_id)` → `boards (project_id, id)`; unique `(project_id, id)`; `position >= 0` |
| `task_kinds` | `id`, `workspace_id`, `key`, `name`, `is_default` | `unique (workspace_id, key)`; unique `(workspace_id, id)`; exactly one default per workspace via partial unique index |
| `tasks` | `id`, `workspace_id`, `project_id`, `stack_id`, `kind_id`, `number`, `key`, `title`, `description` (JSONB), `description_text`, `search_vector`, `priority`, `due_date`, `position`, `idempotency_key`, timestamps | `unique (project_id, number)`; `unique (workspace_id, key)`; unique `(workspace_id, idempotency_key)` where not null; composite FKs keep project/stack/kind consistent |
| `api_keys` | `id`, `workspace_id`, `name`, `key_prefix`, `key_hash`, `last_used_at`, `expires_at`, `revoked_at`, `created_at` | `key_prefix` unique; raw secret never stored; index on `workspace_id` |

### Schema rules

**Task IDs.** A task ID is `project.key || '-' || number`, e.g. `DUTI-1`. `projects.next_task_number` is the per-project counter. Creation runs in one transaction/RPC:

1. `UPDATE projects SET next_task_number = next_task_number + 1 WHERE id = $project AND workspace_id = $workspace RETURNING key, next_task_number - 1 AS number`.
2. Insert the task with `key = project.key || '-' || number`.
3. Let the unique constraints `(project_id, number)` and `(workspace_id, key)` be the final guard.

Gaps are acceptable if a request fails after the counter commits; IDs do not need to be contiguous. The counter must never be derived with `max(number) + 1` at request time.

**Kind metadata, not ID prefixes.** `task_kinds` has no `prefix` and no `next_number`. Kinds are seeded as `issue`, `bug`, `feat`, and `task`; `task` is the default. Custom kinds are workspace-scoped records. The default kind cannot be deleted. A kind that is in use cannot be deleted (return `409`); the user must reassign tasks first.

**Composite foreign keys.** Add the composite uniques listed above and use them:

- `tasks (workspace_id, project_id)` → `projects (workspace_id, id)`
- `tasks (project_id, stack_id)` → `stacks (project_id, id)`
- `tasks (workspace_id, kind_id)` → `task_kinds (workspace_id, id)`
- `stacks (project_id, board_id)` → `boards (project_id, id)`

These prevent a task from pointing at a stack in another project or a kind in another workspace. Do not rely on application checks alone.

**Stacks and ordering.** Stacks belong to a board, not to the application. `Backlog`, `In Progress`, `Review`, and `Done` are created as defaults when a project is created, not hard-coded statuses. `position` is an integer; order by `(position, created_at)`. Use gaps (e.g. 1024) and rewrite the affected container's positions in one transaction on reorder. Positions are not unique, so swaps do not need deferrable constraints. Deleting a non-empty stack requires `moveTasksTo`; otherwise return `409`.

**Priorities.** Hard-coded constants, as requested:

```ts
export const TASK_PRIORITIES = [
  "low",
  "medium",
  "high",
  "critical",
] as const;

export type TaskPriority = (typeof TASK_PRIORITIES)[number];
```

Add a database `CHECK (priority IN (...))` as the final guard.

**Search.** `description_text` is extracted from Tiptap JSON on every write and stored separately. `search_vector` is a generated, stored `tsvector` over `title` and `description_text`, with a GIN index. The board query uses `websearch_to_tsquery('simple', $q)`. Search covers titles and descriptions; if extraction fails, the write still succeeds with title-only search. Filters are exact matches on `priority` and `task_kinds.key`. When querying through Supabase JS, pass `{ type: "websearch", config: "simple" }` to `textSearch`; the default `english` config will not match the generated vector.

**Due dates.** Store `date`, not `timestamptz`; a due date has no time or timezone in this app.

**Timestamps.** `created_at` and `updated_at` default to `now()`; an `updated_at` trigger updates the latter.

**Deletes.** Deleting a project cascades to its board, stacks, and tasks. Deleting a workspace cascades to projects/keys (though workspace deletion is not exposed in the MVP UI). Deleting a task is a hard delete in the MVP; there is no archive/trash.

**Auth provisioning.** An `AFTER INSERT` trigger on `auth.users` calls a `SECURITY DEFINER` function with a locked `search_path` that:

1. Inserts `profiles (id)` with `on conflict do nothing`.
2. Inserts one `workspaces` row for the new owner with `on conflict do nothing`.
3. Seeds the four default task kinds for that workspace, with `task` as the default.

The trigger must be idempotent and tested; a failure can block sign-in. Include a backfill statement for any existing `auth.users` without a workspace. Do not create a starter project in the trigger; the UI shows an empty state and the user creates the first project, which then creates its board and default stacks.

**No email allowlist.** Any account that completes Google OAuth provisions a workspace. If the OAuth consent screen is in testing mode, Google restricts who can sign in; that is an OAuth setting, not app code. Do not add an app-level allowlist unless the product changes.

## 5. API design for AI agents

This is one of the most important parts of Duti. An agent should be able to create a bug or task with one HTTP request, using an API key generated from the app. The web UI uses the same routes through a server-side Eden client, so validation and business rules are shared.

### Base path and authentication modes

All routes live under `/api/v1` (`lib/server.ts` keeps `prefix: "/api"` and declares routes like `"/v1/projects"`). The public path is stable even if the backend is later extracted.

| Caller | Header | Verification | Database client |
| --- | --- | --- | --- |
| Web UI (server only) | `Authorization: Bearer <Supabase access token>` | Verify the JWT with `supabase.auth.getClaims(token)`; reject missing/expired tokens | Supabase client created with the publishable key + user JWT; RLS applies |
| External agent | `Authorization: Bearer duti_live_...` | Look up by key prefix, verify the hash in constant time, check `expires_at` and `revoked_at` | Service-role client; every query filters by the key's `workspace_id` |

Elysia selects the mode by the `duti_live_` prefix. A raw Supabase JWT must never be accepted as an API key, and an API key must never be accepted as a user session. The service-role key stays server-only and is never sent to the browser. Only `/api/v1/health`, `/api/docs`, and `/api/openapi.json` are unauthenticated; every other route requires one of the two modes.

The browser does not call these routes directly in the MVP. Server Components and Server Actions read the session with the SSR client and create a request-scoped Eden client with the access token. This avoids exposing tokens to client JavaScript and avoids CORS configuration.

### API key lifecycle

1. Open Settings → API Keys.
2. Generate a key, optionally naming it `Claude Code` or `Codex`.
3. Display the raw key once and let the user copy it. Store only an HMAC-SHA-256 hash (peppered with `API_KEY_PEPPER`) and a short lookup prefix.
4. The agent sends the key in an `Authorization: Bearer ...` header.
5. Elysia verifies the key, checks expiry/revocation, resolves its workspace, and authorizes the operation.
6. The user can revoke the key at any time. `last_used_at` is updated at most once per minute to avoid a write per request.

For the MVP, all keys have full access to the owner's workspace. Do not implement scopes yet.

### Endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/health` | Unauthenticated health check |
| `GET` | `/api/v1/me` | Current user, workspace, and default kind |
| `GET` | `/api/v1/projects` | List projects in the workspace |
| `POST` | `/api/v1/projects` | Create a project (also creates its board and default stacks) |
| `GET` | `/api/v1/projects/:projectId` | Read a project |
| `PATCH` | `/api/v1/projects/:projectId` | Rename/update description; `key` is immutable |
| `DELETE` | `/api/v1/projects/:projectId` | Delete a project and its board/tasks |
| `GET` | `/api/v1/projects/:projectId/board` | Get stacks and tasks; supports `q`, `priority`, `kind`, `stack` |
| `POST` | `/api/v1/projects/:projectId/stacks` | Create a stack |
| `PATCH` | `/api/v1/stacks/:stackId` | Rename a stack |
| `DELETE` | `/api/v1/stacks/:stackId` | Delete a stack; requires `moveTasksTo` when non-empty |
| `POST` | `/api/v1/projects/:projectId/stacks/reorder` | Reorder stacks with an ordered ID list |
| `GET` | `/api/v1/projects/:projectId/tasks` | List tasks with the same filters |
| `POST` | `/api/v1/projects/:projectId/tasks` | Create a task; supports `Idempotency-Key` |
| `GET` | `/api/v1/tasks/:taskId` | Read a task |
| `GET` | `/api/v1/tasks/by-key/:key` | Read a task by workspace-unique key, e.g. `DUTI-5` |
| `PATCH` | `/api/v1/tasks/:taskId` | Update task fields (not `key` or `number`) |
| `DELETE` | `/api/v1/tasks/:taskId` | Delete a task |
| `POST` | `/api/v1/tasks/:taskId/move` | Move to a stack; body `{ stackId, beforeTaskId? }` |
| `GET` | `/api/v1/task-kinds` | List workspace kinds |
| `POST` | `/api/v1/task-kinds` | Create a kind |
| `PATCH` | `/api/v1/task-kinds/:kindId` | Rename a kind |
| `DELETE` | `/api/v1/task-kinds/:kindId` | Delete an unused, non-default kind |
| `GET` | `/api/v1/api-keys` | List key metadata (never hashes) |
| `POST` | `/api/v1/api-keys` | Create a key; raw secret returned once |
| `DELETE` | `/api/v1/api-keys/:keyId` | Revoke a key |
| `GET` | `/api/docs` | Scalar API reference |
| `GET` | `/api/openapi.json` | Generated OpenAPI document |

Delete endpoints return `204`. List endpoints are workspace-scoped; a project/task ID from another workspace returns `404` (not `403`) to avoid leaking existence.

Implemented now: every endpoint in the table, including the Scalar reference and OpenAPI document. The JWT and API-key authentication modes are both active. `lib/server/errors.ts` defines the shared error envelope, and the global handler normalizes validation errors. API-key rate limiting remains a follow-up.

### Error envelope

Every error uses one shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Title is required",
    "details": [{ "path": "title", "message": "Required" }]
  }
}
```

Use stable codes such as `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`, `CONFLICT`, `RATE_LIMITED`, and `INTERNAL_ERROR`. Never include hashes, tokens, SQL, or stack traces. Elysia's default `422` body is normalized through a global error handler.

### Idempotency and limits

- `POST /api/v1/projects/:projectId/tasks` accepts an optional `Idempotency-Key` header. Store it on `tasks.idempotency_key` (unique per workspace) and return the existing task on replay. This lets an agent retry safely.
- Request bodies are size-limited (for example 256 KB) with a small description JSON limit.
- API keys are rate-limited per key. Return `429` with `Retry-After`.
- Add request IDs to logs and error responses (`requestId`) for debugging without exposing internals.

### Example: agent files a bug

Request:

```http
POST /api/v1/projects/8f14e45f-ea4b-4c3a-9f0e-2a6b7c8d9e0f/tasks
Authorization: Bearer duti_live_your_secret
Content-Type: application/json
Idempotency-Key: 3d0f7f9a-6c2e-4b6a-9f1a-2f7c8d9e0f12
```

```json
{
  "kind": "bug",
  "title": "Login redirects to the wrong page",
  "description": {
    "type": "doc",
    "content": [
      {
        "type": "paragraph",
        "content": [
          {
            "type": "text",
            "text": "After login, the app redirects to the home page instead of the project."
          }
        ]
      }
    ]
  },
  "priority": "high",
  "dueDate": "2026-10-30",
  "stackId": null
}
```

Example response (`201`):

```json
{
  "id": "0b6f1c2d-3e4f-5a6b-7c8d-9e0f1a2b3c4d",
  "key": "DUTI-1",
  "number": 1,
  "projectId": "8f14e45f-ea4b-4c3a-9f0e-2a6b7c8d9e0f",
  "stackId": "7a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d",
  "kind": { "id": "…", "key": "bug", "name": "Bug" },
  "title": "Login redirects to the wrong page",
  "description": { "type": "doc", "content": [] },
  "priority": "high",
  "dueDate": "2026-10-30",
  "position": 1024,
  "createdAt": "2026-10-23T10:00:00.000Z",
  "updatedAt": "2026-10-23T10:00:00.000Z"
}
```

The API assigns the default stack when `stackId` is omitted, generates the ID, and sets timestamps. The client cannot submit an arbitrary workspace owner, task key, or number. The description schema is illustrative; validate it against the actual Tiptap document format.

## 6. Authentication and security boundaries

Supabase Google OAuth is for the web UI. API keys are for agents. Keep these authentication paths distinct, but share the task service and validation rules.

- **Browser requests:** The Next server reads the Supabase session from cookies, verifies it, and forwards the access token to Elysia. Elysia verifies it again with `getClaims`, requires a verified `sub` with `role === "authenticated"`, and uses a user-scoped client so RLS is the database boundary.
- **Agent requests:** Elysia verifies the API key, resolves its workspace, and uses the service-role client. Every query must filter by that workspace. Service role bypasses RLS; the explicit scope is the security boundary.
- **Database:** Foreign keys, unique/check constraints, and RLS policies. Do not assume frontend route protection is sufficient.
- **Secrets:** Never expose the Supabase service-role key, the API-key pepper, or raw API keys to client code. Only the publishable key may be public.
- **Rich text:** Store validated JSON, render through the editor's renderer, and never trust arbitrary HTML.
- **API errors:** Consistent codes; no hashes, tokens, SQL, or stack traces.
- **Logging:** Redact `Authorization`, cookies, and key material. Log request IDs, status, latency, and workspace/user IDs (not secrets).
- **CSRF:** Server Actions are same-origin. Supabase session cookies are `SameSite`-scoped. API-key requests are not cookie-authenticated.
- **CORS:** None needed in the MVP because the browser does not call the Elysia API directly. If that changes, allowlist `NEXT_PUBLIC_APP_URL` only.

### Page auth flow

1. `proxy.ts` matches page requests, but not `/api`, `_next`, or static assets. `updateSession()` refreshes cookies, validates the session with `getClaims()`, and sets `x-duti-pathname`.
2. If there is no user and the request is `GET`/`HEAD`, the proxy redirects to `/auth/login?continue=<safe relative path>` and copies any refreshed cookies onto the redirect.
3. `/auth/login` renders the Google button. An already-authenticated visitor is redirected to the safe `continue` path instead of seeing the form.
4. Google returns to `/auth/callback?code=...&continue=...`. The route exchanges the PKCE code, writes the session cookies, and redirects to the safe path. Failures redirect back to login with a stable error code, not raw provider text.
5. `app/(app)/layout.tsx` calls `connection()` and then `requireUser()` inside Suspense. `requireUser()` uses `x-duti-pathname` to preserve the intended path if the proxy was bypassed.
6. The client `AuthProvider` redirects on `SIGNED_OUT`; sign-out is a Server Action that clears the session and returns to login.

### RLS matrix

| Table | UI (user JWT) | Agent (service role) |
| --- | --- | --- |
| `profiles` | Select/update own row | Read the workspace owner |
| `workspaces` | Select/update own workspace | Read the key's workspace |
| `projects`, `boards`, `stacks`, `tasks`, `task_kinds` | CRUD only where the workspace owner is `auth.uid()` | CRUD scoped by the key's workspace; every query filters `workspace_id` |
| `api_keys` | CRUD own workspace's key metadata; never expose `key_hash` | No access |

Write policies need both `USING` and `WITH CHECK`; do not allow a row to move to another workspace. Test with two Google accounts: account B must not read, update, or delete account A's project, task, kind, or key.

### Environment variables

| Variable | Scope | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Hosted project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public | Supabase publishable/anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Never prefix with `NEXT_PUBLIC_`; used only by the agent path |
| `NEXT_PUBLIC_APP_URL` | Public | `http://localhost:3000` locally; production origin for redirects/Eden |
| `API_KEY_PEPPER` | Server only | HMAC pepper for API-key hashes; rotate only with a key-version field |
| `NEXT_PUBLIC_SUPABASE_PROJECT_REF` | Public/optional | Convenience for CLI scripts; not required at runtime |

`.env` has the public URL, publishable key, service-role key, app URL, and API-key pepper. `.env.example` lists every variable with blank values. Never commit `.env`.

### Supabase setup checklist

1. Enable the Google provider in Supabase Auth; add the Google client ID/secret from Google Cloud.
2. Set the site URL and redirect allowlist to `NEXT_PUBLIC_APP_URL` and `/auth/callback`.
3. Create the `auth/callback` route that exchanges the PKCE code for a session, then redirects to the app.
4. Keep `proxy.ts` refreshing sessions on every matched request. Route protection also verifies claims in the app layout/Server Actions; do not rely on the proxy alone.
5. Link the hosted project: `bunx supabase login`, `bunx supabase link --project-ref <ref>`.
6. Apply migrations: `bunx supabase db push`.
7. Generate types: `bunx supabase gen types typescript --linked > lib/supabase/database.types.ts`.

**Auth implementation status (2026-10-23):** Steps 3 and 4 are implemented: login page, callback route, safe `continue` redirect, proxy gate, protected shell, sign-out, Elysia JWT macro, and `/api/v1/me`. Steps 1 and 2 are still outstanding. A direct check of the hosted project's `/auth/v1/authorize?provider=google` endpoint returned `Unsupported provider: provider is not enabled`, so end-to-end Google sign-in cannot pass yet. Add `http://localhost:3000/auth/callback` and the production callback to the redirect allowlist when enabling the provider.

## 7. UI and navigation plan

**Persistent sidebar.** Duti logo, project list, create project, settings at the bottom. On mobile, collapse to a sheet/drawer.

**Board page.** Project breadcrumb, board title, search input, priority/kind filters, stack columns, and create-task action. Search and filters are URL query parameters so the state is shareable and Server Components can read it. Debounce the input; reset to page 1 is unnecessary for the MVP because boards are small.

**Task detail dialog.** Editable title, rich-text description, priority, kind, due date, ID, and current stack. Use a dialog rather than navigating away from the board. Show the kind as a badge; the ID is read-only.

**Settings.** Task kinds (no prefixes), API key creation/revocation, and workspace basics.

### Data flow rules

- Server Components fetch through `createApi(accessToken)` (request-scoped Eden) and pass plain data to client islands. Do not fetch user data from the browser.
- Server Actions validate with the shared schema, call Elysia, then `revalidatePath` the affected board/project. Return typed action results for form errors.
- Client islands own only interaction state: drag preview, dialog open/closed, filter draft, optimistic card position. Reconcile with the server response and surface errors with `sonner`.
- With `cacheComponents: true`, authenticated pages are dynamic. Call `connection()` before runtime reads, use Suspense boundaries, and provide explicit loading/empty/error states; do not force-static a user-specific page.
- Next 16 APIs are async: `cookies()` and `searchParams` are awaited. Follow `node_modules/next/dist/docs/` before changing Next-specific code.

### Components and accessibility

- Initialize shadcn with `--base aria`; use the installed `shadcn` skill for component docs and composition. Do not add a second primitive library.
- Use `FieldGroup`/`Field` patterns for forms, `Dialog`/`Sheet` for task detail and mobile navigation, `Command` for quick search if it is available in the aria registry, and `sonner` for toasts.
- Use semantic color tokens (`bg-background`, `text-muted-foreground`, `bg-primary`) rather than raw palette classes.
- `@dnd-kit` for drag-and-drop, with keyboard sensors and a "Move to stack…" menu on every card. Announce moves with a live region. Drag-and-drop must never be the only way to move a task.
- Tiptap toolbar buttons need labels and keyboard access; the editor content is validated on the server.
- Empty states: no projects, empty board, no search results, no API keys. Loading states: skeletons for board columns and dialogs.

## 8. Implementation roadmap

Build in seven phases (Phase 0 plus six). Each phase leaves a usable, verified application.

### Phase 0 — Decisions and scaffolding

Lock this document. Add the missing environment variables and `.env.example` entries. Initialize shadcn with the `aria` base and commit `components.json`. Link the hosted Supabase project and create the first migration folder. Add shared modules for auth resolution, error envelopes, API-key hashing, and the request-scoped Eden client. The singleton `lib/eden.server.ts` has been replaced with `getAccessToken()` + `createApi(accessToken)`. Add scripts for typecheck, database push, and type generation.

**Acceptance:** `bun run build` succeeds; `bunx shadcn@latest info` reports the `aria` base; `supabase db push` works against the hosted project; `/api/v1/health` returns `200`; `tsc --noEmit` and lint pass.

**Status:** Complete. Database migrations, scripts, auth helpers, error envelope, the request-scoped Eden factory, and shadcn with the `aria` base are in place. `bun run build`, `tsc --noEmit`, and lint pass.

### Phase 1 — Foundation and authentication

Create the schema migration for `profiles`, `workspaces`, default kinds, the `auth.users` trigger, RLS policies, and the auth callback. Add the protected app shell and sign-out. Keep `proxy.ts` refreshing sessions; verify claims in the layout and Server Actions.

**Acceptance:** a Google user can sign in and sees exactly one personal workspace with the four default kinds. A second Google account gets a separate workspace. Neither can see the other's rows.

**Status:** Code complete. A test auth user (created through the admin API, then deleted) provisioned one workspace with four kinds; the authenticated home page rendered through the Eden client, and `/api/v1/me` returned the workspace and default kind. End-to-end Google sign-in is blocked only by the hosted provider/allowlist configuration.

### Phase 2 — Projects and boards

Project CRUD, project-key validation, starter board creation with four default stacks, and stack create/rename/reorder/delete. Deleting a non-empty stack requires a target stack.

**Acceptance:** projects are isolated, each has exactly one board, keys are unique/immutable, and stack order persists across refreshes.

**Status:** Code complete. Project create/rename/delete, starter boards, stack create/rename/reorder/delete, and the project list/settings UI are implemented. API smoke tests covered project and stack CRUD, reorder, and non-empty stack deletion with a move target.

### Phase 3 — Tasks

Task CRUD, the transactional ID RPC, rich-text editing, priorities, custom kinds, due dates, move/reorder, search, and filters.

**Acceptance:** the board works end-to-end; concurrent creates never duplicate `PROJECTKEY-N`; search and priority/kind filters return correct results; moving cards persists.

**Status:** Code complete. Task CRUD, Tiptap rich text, generated `PROJECTKEY-N` IDs, idempotency, move/reorder, search, and priority/kind/stack filters are implemented. The board UI includes URL-backed filters, drag-and-drop, a keyboard/menu "Move to stack…" alternative, and task/stack dialogs. A temporary authenticated UI smoke test rendered the project list, board, filters, settings, and not-found state.

### Phase 4 — Agent API and API keys

Key generation, one-time secret display, peppered hashing, prefix lookup, expiry/revocation, rate limiting, idempotency, the full agent endpoints, OpenAPI, and the error envelope.

**Acceptance:** an external script can create and update a task using only its API key; revoked and expired keys fail with `401`; replaying an `Idempotency-Key` returns the same task; a key from workspace A cannot touch workspace B.

**Status:** Core complete. Key generation, one-time secret display, HMAC-SHA-256 hashing with `API_KEY_PEPPER`, prefix lookup, expiry/revocation, `last_used_at`, the settings UI, and all agent endpoints are implemented. A two-workspace smoke test verified API-key project/task create, task update, task move, idempotency, cross-workspace `404`s, revoked/expired `401`s, and that raw secrets are not stored. Rate limiting remains a follow-up.

### Phase 5 — UI polish

Accessible keyboard interactions, the "Move to stack…" alternative, responsive layouts, empty/loading/error states, toasts, and Jira-inspired styling. Verify the board on a narrow screen.

**Acceptance:** the app is keyboard-operable, looks coherent, and remains usable on mobile widths.

**Status:** Implemented with shadcn/ui React Aria components: responsive app shell, project cards, board columns/cards, URL-backed filters, dialogs, empty/error/loading states, toasts, appearance settings with light/dark/system themes, rich-text editor, task-kind settings, API-key settings, generated favicons/web manifest, and OpenGraph/Twitter preview images. Whole task cards are draggable, and clicking a card opens the read-only task view. Keyboard/mobile manual verification is still recommended before release.

### Phase 6 — Verification and hardening

Test ownership isolation, RLS, task ID concurrency, expired/revoked keys, invalid kinds, malformed rich text, reorder edge cases, and delete behavior. Add CI for typecheck, lint, build, and unit tests.

**Acceptance:** no cross-workspace access; no duplicate IDs under concurrent creation; all critical paths have automated or documented manual coverage.

**Status:** `bun run typecheck`, `bun run lint`, and `bun run build` pass. Temporary hosted integration scripts verified project/task/stack/task-kind CRUD, search, idempotency, two-user isolation, API-key lifecycle, and authenticated page rendering. Automated Vitest/Playwright suites and CI are not yet added.

### Testing notes (no Docker)

`supabase test db` and the local Supabase stack require Docker, which is not installed. Do not make them MVP blockers. Use:

- Unit tests (Vitest) for key formatting, Tiptap JSON validation, error mapping, and API-key hashing.
- Integration tests against a dedicated hosted Supabase test project, using two test users and cleanup scripts. Verify RLS by querying with each user's JWT.
- Playwright for UI smoke tests against `next dev` and the hosted test project. If Google OAuth blocks automation, seed a test session with the Supabase admin API and keep a manual sign-in checklist.
- In CI, run typecheck, lint, build, and unit tests. Run database integration tests only when the test-project secrets are configured. Add Docker-based `supabase test db` later if the environment changes.

## 9. Deployment

Deploy the single Next.js application to Vercel or any Node host; keep the catch-all API route on the Node runtime (do not switch it to Edge). Host Supabase separately. Set all environment variables in the host, with `SUPABASE_SERVICE_ROLE_KEY` and `API_KEY_PEPPER` as server-only secrets.

Production checklist:

- Set `NEXT_PUBLIC_APP_URL` to the production origin.
- Add the production and preview origins to Supabase Auth redirect URLs. Preview deployments need their own allowed URLs or a shared callback strategy.
- Run `supabase db push` before deploying code that depends on new migrations.
- Confirm the Google OAuth consent screen is published if accounts beyond the test users should sign in.
- Smoke-test `/api/v1/health`, sign-in, project creation, task creation via API key, and revocation.
- Verify logs redact authorization headers and key material.

No separate Elysia service, Docker, queue, or background worker is required for the MVP.

## 10. Keep out of scope for now

- Multiple users per workspace, teams, assignees, and roles
- Email, push notifications, and activity feeds
- Sprints, epics, complex workflows, and custom priority systems
- Attachments, comments, and time tracking
- Webhooks and background jobs
- A full agent framework or built-in LLM
- API-key scopes, per-project keys, and key rotation UI
- Local Supabase/Docker workflow

These can be added later without being prerequisites for the core workflow.

## 11. Definition of done

Duti's first version is complete when a user can:

- Sign in with Google and receive exactly one isolated personal workspace.
- Create multiple projects in that workspace, each with one board and customizable stacks.
- Create and edit tasks with rich-text descriptions, priorities, configurable kinds, and due dates.
- Generate IDs such as `PROJECTKEY-1` without collisions under concurrent requests.
- Search tasks by title/description and filter by priority and kind.
- Generate and revoke API keys, and see each key's last-used time.
- Have an AI coding agent create or update tasks through `/api/v1` using only its API key.
- Refresh the page and retain all data.
- Verify that neither browser sessions nor API keys can access another account's workspace.

My recommendation: build the database and authorization model first, then the board, then agent API integration. The API key feature is a core product capability, not an afterthought, so it shares the same task service and validation rules as the web UI.

## 12. Hand-off notes

### Current repository state

At the time of writing:

- Next.js 16.4.2, React 19.3.0, TypeScript, Tailwind v4, `cacheComponents` and `partialPrefetching` enabled.
- Elysia 2.0.0-rc.0 and `@elysia/eden` 2.0.0-rc.0 are installed. `lib/server.ts` exposes `GET /api/v1/health` and authenticated `GET /api/v1/me`; the old demo routes are gone. `lib/server/auth.ts` is the JWT macro and `lib/server/errors.ts` is the shared error envelope.
- `app/api/[[...slugs]]/route.ts` forwards all verbs to `app.fetch`. `lib/eden.server.ts` provides `getAccessToken()` and `createApi(accessToken)` plus a `publicApi` singleton; `lib/eden.ts` is the browser client.
- Supabase packages and CLI are installed. `supabase/config.toml` exists with `auto_expose_new_tables = false`.
- Supabase SSR clients exist in `lib/supabase/client.ts` and `lib/supabase/server.ts`. `proxy.ts` gates page requests; `lib/supabase/proxy.ts` refreshes sessions and sets `x-duti-pathname`. Generated database types are in `lib/supabase/database.types.ts`.
- `.env` has the public Supabase URL, publishable key, `NEXT_PUBLIC_APP_URL=http://localhost:3000`, a generated `API_KEY_PEPPER`, and a validated service-role key. `.env.example` has placeholders for all of them.
- Auth UI is in place: `app/auth/login`, `app/auth/callback`, protected `app/(app)/layout.tsx`, sign-out action, and client auth-state handling. The hosted Google provider is **not enabled yet**, so the login button cannot complete a real OAuth flow until that and the redirect allowlist are configured.
- No shadcn `components.json` yet. The initial schema, RLS, auth trigger, and project/task RPCs are applied to the hosted project. Feature UI (projects, boards, tasks) is not built yet.
- The Supabase CLI is logged in and the hosted project is linked. Docker is not installed.
- The repository is not a git repository yet.

### Migration status

Applied to the hosted project:

| Migration | Purpose |
| --- | --- |
| `20261023143330_initial_schema.sql` | Tables, indexes, identity guards, auth trigger/backfill, ownership helpers, `create_project` / `create_task`, RLS, grants |
| `20261023143500_task_kind_fk_deferrable.sql` | Makes the task-kind FK deferrable so deleting a workspace can cascade tasks and kinds in one transaction |

Verified against the hosted project:

- Creating an auth user provisions exactly one workspace and four kinds, with `task` as the default.
- `create_project` creates one board and the four default stacks in order.
- `create_task` produces `MIG-1`, `MIG-2`, …; replaying the same `Idempotency-Key` returns the same task.
- Full-text search matches both title and description with `config: "simple"`.
- Two authenticated users cannot read or write each other's workspace, projects, or tasks.
- Deleting the test auth users cascaded their workspaces, projects, tasks, and kinds with no leftovers.
- Auth smoke test: an unauthenticated `/` request returns `307` to `/auth/login?continue=%2F`; `/api/v1/me` without a token returns `401` with the `UNAUTHORIZED` envelope; a test session cookie renders the authenticated home page and `/api/v1/me` returns the workspace and default kind; unsafe `continue` values such as `https://evil.example` fall back to `/`. The test user was deleted afterward.
- Hosted Google provider check: `/auth/v1/authorize?provider=google` returns `Unsupported provider: provider is not enabled`. Enable the provider and allowlist `http://localhost:3000/auth/callback` plus the production callback before treating Google sign-in as done.
- UI smoke test: a temporary authenticated user rendered the project list, project card, board with default stacks, search/filter UI, settings tabs, and the not-found page. The user was deleted afterward.
- Browser interaction test: a temporary authenticated user switched to dark mode from Settings → Appearance, clicked a task card to open the read-only view, used Edit task to enable the fields, and dragged the whole card to the next stack. The move persisted, the drag did not open the view dialog, and the user was deleted afterward.
- Project not-found check: malformed, missing, and cross-workspace project IDs return `404 NOT_FOUND` from the project API and render the project not-found UI; the owner board still loads. Because `notFound()` runs inside the streamed app shell, the page response remains HTTP `200`.
- API-key smoke test: a key created through the JWT route authenticated `/me`, created a project and task, moved and updated the task, updated `last_used_at`, was rejected after revocation, and was rejected after an admin-set expiry. A second workspace could not be read, updated, moved, or revoked with that key. The stored value was a 64-character HMAC hex digest, not the raw secret.
- Task-key lookup check: `GET /api/v1/tasks/by-key/DUTI-5` returned the task with API-key auth; lowercase `duti-5` resolved to `DUTI-5`; missing and malformed keys returned `404`; unauthenticated access returned `401`; the existing UUID task route still works.
- Final checks: `bun run typecheck`, `bun run lint`, and `bun run build` pass. Lint reports only two generated-component warnings (`alert-dialog` unused type and `avatar` raw `<img>`).

### Decisions that must not drift

- Add endpoints to `lib/server.ts`, not per-feature Next.js route handlers. See `agent.md`.
- Keep Elysia on Node; do not introduce `.listen()`, Bun-only APIs, WebSockets, or a standalone Bun service.
- Do not use kind-prefixed task IDs. `task_kinds` has no `prefix` or `next_number`.
- Do not add Drizzle or another ORM runtime. Use SQL migrations + generated Supabase types.
- Do not make the browser call `/api/v1` directly in the MVP.
- Validate project IDs before database lookups so malformed, missing, and cross-workspace IDs all return `404` and the board renders `notFound()`.
- Do not add an app-level email allowlist. Workspace isolation is the boundary.
- Do not mix shadcn primitive bases. Use `--base aria` and React Aria primitives.
- Do not commit `.env` or any service-role/pepper secret.
- Page auth redirects must preserve only a safe relative `continue` path; reject absolute and protocol-relative URLs.
- The proxy gates `GET`/`HEAD` page requests only. Every Server Action must call `requireUser()` or use an authenticated Eden client.
- `/api/*` stays outside the proxy so API-key agents can reach Elysia. Only `/api/v1/health` is public.
- Verify user JWTs with `getClaims()`; use `getSession()` only to read the access token forwarded to Elysia.
- Do not `await` or return the Eden API proxy from an async function; it is thenable. Use `getAccessToken()` then `createApi(token)`.
- Keep auth reads inside Suspense and call `connection()` before runtime APIs under `cacheComponents`.

### Commands

```bash
bun install
bunx --bun shadcn@latest init --base aria
bunx supabase login
bunx supabase link --project-ref <project-ref>
bun run db:push
bun run db:types
bun run dev
bun run build
bun run lint
bun run typecheck
```

The `typecheck`, `db:push`, and `db:types` scripts are added to `package.json`. Add `test` when Vitest is installed.

### Known follow-ups

- Enable the Supabase Google provider and add the local/production `/auth/callback` redirect URLs. This is the only blocker to end-to-end sign-in.
- Regenerate `lib/supabase/database.types.ts` with `bun run db:types` after every schema migration.
- Add automated auth tests: safe `continue` cases, proxy redirect, callback failures, authenticated page render, sign-out, and `/api/v1/me` 401/200.
- Decide whether to use a separate hosted Supabase project for tests; production data must never be used for destructive integration tests.
- Add a simple in-memory per-key rate limiter and return `429` with `Retry-After` (the plan's 60 requests/minute MVP limit).
- Add an expiry date field to the API-key creation dialog; the API already accepts `expiresAt`.
- Add Vitest unit tests, Playwright UI tests, and CI. Temporary integration scripts were removed after verification.

### First implementation milestone

Complete. A signed-in user can create a project, see the default board, create `PROJECTKEY-1` with a kind and priority, and load it again after a refresh. The same task service is also reachable with a workspace-scoped API key.
