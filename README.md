# Duti

Duti is a private, Jira-style project manager for one person. Each Google
account gets one isolated workspace with multiple projects, a board per project,
configurable stacks and task kinds, rich-text task descriptions, and
workspace-scoped API keys for agents.

Duti is intentionally small: there are no teams, assignees, comments,
notifications, or complex permissions. One workspace per account, one board per
project, one place for the work.

The authoritative product and implementation plan is
[`duti_build_plan.md`](./duti_build_plan.md). Backend architecture rules live in
[`agent.md`](./agent.md).

## Features

- One personal workspace per Supabase user
- Multiple projects with immutable project keys and generated task IDs
- One board per project, with reorderable stacks
- Tasks with title, rich-text description, priority, kind, due date, and
  `PROJECTKEY-NUMBER` IDs
- Whole-card drag-and-drop between stacks
- Click-to-view task dialog with an explicit edit mode
- Board search over title and description, plus priority, kind, and stack filters
- Database-backed, workspace-defined task kinds
- Settings for appearance, task kinds, and API keys
- Light, dark, and system themes under **Settings → Appearance**
- API keys for external agents, with one-time secret display and revocation
- Generated OpenAPI documentation and a Scalar API reference
- Branded favicons, web manifest, and OpenGraph/Twitter preview images

## Stack

- Next.js 16 App Router, React 19, TypeScript, Bun
- Elysia 2 running on the Node runtime inside the Next.js catch-all route
- Hosted Supabase: Postgres, Auth, and Row Level Security
- shadcn/ui with the React Aria base and Tailwind CSS
- Tiptap rich text, `@dnd-kit` drag-and-drop, and `next-themes`
- Scalar API reference served through `@elysia/openapi`

No Docker or local Supabase stack is required. The recommended workflow uses a
hosted Supabase project.

## Architecture

```text
Browser
  └─ Next.js App Router (Server Components + Server Actions)
       └─ /api/[[...slugs]] → Elysia /api/v1
            └─ Supabase (user JWT + RLS)

Agent
  └─ /api/v1 with Authorization: Bearer duti_live_...
       └─ Elysia auth macro
            └─ Supabase service role, explicitly scoped to the key's workspace
```

The API is Elysia, not Next.js Route Handlers. Add routes in
[`lib/server.ts`](./lib/server.ts); do not split the backend into per-feature
`app/api/*/route.ts` files.

## Getting started

### Prerequisites

- Node.js 22.18+ (Elysia requirement)
- Bun 1.4.3+ (the repository uses Bun for installs and scripts)
- A hosted Supabase project
- Supabase CLI for migrations and generated types

### 1. Install dependencies

```bash
bun install
```

### 2. Configure environment variables

Copy `.env.example` to `.env`:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
SUPABASE_SERVICE_ROLE_KEY=
API_KEY_PEPPER=
```

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Supabase publishable/anon key |
| `NEXT_PUBLIC_APP_URL` | Yes | Public origin used for redirects, the browser Eden client, and absolute OpenGraph URLs |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-only. Used for API-key requests. Never expose it to the browser |
| `API_KEY_PEPPER` | Yes | Server-only. Used to HMAC-hash API keys |

`SUPABASE_SERVICE_ROLE_KEY` and `API_KEY_PEPPER` must never be committed or
shipped to the client.

Generate the API-key pepper with:

```bash
node -e "process.stdout.write(require('crypto').randomBytes(48).toString('base64url'))"
```

### 3. Apply the database schema

Link the hosted project, push the migrations, and regenerate the TypeScript
types:

```bash
bunx supabase login
bunx supabase link --project-ref <project-ref>
bun run db:push
bun run db:types
```

The migrations create the profiles, workspaces, projects, boards, stacks, task
kinds, tasks, and API-key tables, along with RLS policies, triggers, and RPCs for
project creation, task creation, stack reordering, task movement, and stack
deletion.

### 4. Start the app

```bash
bun run dev
```

Open <http://localhost:3000>.

### Google OAuth

Google sign-in is wired through Supabase Auth. Enable the Google provider in the
hosted Supabase project and allowlist these callback URLs:

```text
http://localhost:3000/auth/callback
https://<your-production-domain>/auth/callback
```

Until the provider is enabled, use an admin-created test user for local UI
verification.

## Using Duti

1. Sign in with Google.
2. Create a project from the home page. A board and four default stacks
   (`Backlog`, `In Progress`, `Review`, `Done`) are created automatically.
3. Open the project board and create tasks.
4. Drag a whole task card between stacks, or use the card menu to move it.
5. Click a card to open the read-only task view. Choose **Edit task** to enable
   the fields.
6. Use the board search and filters to find work by text, priority, kind, or
   stack.
7. Manage themes, task kinds, and API keys under **Settings**.

Project IDs are validated before database access. Malformed, missing, and
cross-workspace project IDs render the project not-found page.

## API

### Documentation

The generated API reference is available at:

```text
http://localhost:3000/api/docs
```

The OpenAPI document is at:

```text
http://localhost:3000/api/openapi.json
```

The docs and OpenAPI document are public. API operations require a bearer token.
The Scalar reference includes both auth modes and the current route schemas.

### Authentication

There are two supported auth modes:

| Client | Credential | Behavior |
|---|---|---|
| Web app | Supabase user JWT | Passed server-side as `Authorization: Bearer <jwt>`; RLS is the database boundary |
| External agent | Duti API key | `Authorization: Bearer duti_live_...`; verified with a peppered HMAC; queries use a workspace-scoped service client |

Only `GET /api/v1/health`, `GET /api/docs`, and `GET /api/openapi.json` are
unauthenticated. Every other `/api/v1` route accepts either a user JWT or a
Duti API key.

API keys are created in **Settings → API keys**. The raw secret is shown once;
only a hash is stored. Revoke a key when it is no longer needed.

> API keys currently have full workspace access. Scopes and per-key rate limits
> are not implemented yet. Use a dedicated key for each agent or automation and
> revoke it when finished.

### Endpoint summary

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/v1/health` | Public health check |
| `GET` | `/api/v1/me` | Current user, workspace, auth mode, and default task kind |
| `GET` | `/api/v1/projects` | List projects |
| `POST` | `/api/v1/projects` | Create a project, board, and default stacks |
| `GET` | `/api/v1/projects/:projectId` | Read a project |
| `PATCH` | `/api/v1/projects/:projectId` | Rename/update a project; project key is immutable |
| `DELETE` | `/api/v1/projects/:projectId` | Delete a project and its board/tasks |
| `GET` | `/api/v1/projects/:projectId/board` | Board with stacks and tasks; supports `q`, `priority`, `kind`, `stack` |
| `GET` | `/api/v1/projects/:projectId/tasks` | List project tasks with the same filters |
| `POST` | `/api/v1/projects/:projectId/tasks` | Create a task; supports `Idempotency-Key` |
| `GET` | `/api/v1/tasks/by-key/:key` | Read a task by workspace-unique key, e.g. `DUTI-5` |
| `GET` | `/api/v1/tasks/:taskId` | Read a task by UUID |
| `PATCH` | `/api/v1/tasks/:taskId` | Update task fields |
| `DELETE` | `/api/v1/tasks/:taskId` | Delete a task |
| `POST` | `/api/v1/tasks/:taskId/move` | Move a task to a stack |
| `POST` | `/api/v1/projects/:projectId/stacks` | Create a stack |
| `PATCH` | `/api/v1/stacks/:stackId` | Rename a stack |
| `DELETE` | `/api/v1/stacks/:stackId` | Delete a stack; non-empty stacks require `moveTasksTo` |
| `POST` | `/api/v1/projects/:projectId/stacks/reorder` | Reorder stacks |
| `GET` | `/api/v1/task-kinds` | List task kinds |
| `POST` | `/api/v1/task-kinds` | Create a task kind |
| `PATCH` | `/api/v1/task-kinds/:kindId` | Rename a task kind |
| `DELETE` | `/api/v1/task-kinds/:kindId` | Delete an unused, non-default kind |
| `GET` | `/api/v1/api-keys` | List API-key metadata |
| `POST` | `/api/v1/api-keys` | Create an API key; raw secret returned once |
| `DELETE` | `/api/v1/api-keys/:keyId` | Revoke an API key |

### Task lookup by key

Task keys are unique per workspace (`PROJECTKEY-NUMBER`). Look one up directly:

```bash
curl "$DUTI_BASE_URL/api/v1/tasks/by-key/DUTI-5" \
  -H "Authorization: Bearer $DUTI_API_KEY"
```

Lookup is case-insensitive. Missing, malformed, and cross-workspace keys return
`404 NOT_FOUND`.

### Create a task

```bash
curl -X POST "$DUTI_BASE_URL/api/v1/projects/<project-id>/tasks" \
  -H "Authorization: Bearer $DUTI_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: agent-run-42" \
  -d '{
    "title": "Create API documentation with Scalar",
    "description": {
      "type": "doc",
      "content": [
        {
          "type": "paragraph",
          "content": [
            { "type": "text", "text": "Document the current /api/v1 routes." }
          ]
        }
      ]
    },
    "kind": "task",
    "priority": "medium",
    "dueDate": null,
    "stackId": "<stack-id>"
  }'
```

Required fields are `title`, `kind`, and `priority`. `kind` must be an existing
workspace kind key. `priority` is one of `low`, `medium`, `high`, or `critical`.
`description` is a TipTap-compatible JSON document. `dueDate` is `YYYY-MM-DD` or
`null`. If `stackId` is omitted, Duti uses the project's first stack.

Reuse the same `Idempotency-Key` for retries of the same operation. Do not reuse
it for a different task.

### Error envelope

API errors use a consistent shape:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Task not found."
  }
}
```

Validation errors may include `details` with field paths and messages.

## Agent integration

The repository includes a Duti agent skill at
[`.agents/skills/duti/SKILL.md`](./.agents/skills/duti/SKILL.md). It describes how
to discover projects, stacks, and task kinds, create well-written tasks, look up
tasks by key, summarize them, and update or move them safely.

Configure the agent with:

```text
DUTI_BASE_URL=http://localhost:3000
DUTI_API_KEY=duti_live_...
```

Keep `DUTI_API_KEY` in a secure environment variable or the agent's secret store.
Never put it in a prompt, source file, task description, or shell output.

Typical agent flow for a request such as “create a task in the Friday Project
backlog”:

1. `GET /api/v1/me` for the workspace default kind.
2. `GET /api/v1/projects` and match the project by name or key.
3. `GET /api/v1/projects/:projectId/board` to resolve the `Backlog` stack.
4. `POST /api/v1/projects/:projectId/tasks` with `stackId`.
5. Report the returned task key, such as `FRI-7`.

The API is documented live at `/api/docs`; if the skill and the live spec differ,
trust the live spec.

## Project structure

```text
app/
  (app)/                         Protected UI: home, board, settings
  api/[[...slugs]]/route.ts      Next.js catch-all → Elysia
  auth/                          Login and OAuth callback
  layout.tsx                     Root metadata, icons, OpenGraph, theme provider
  opengraph-image.tsx            Generated 1200×630 social preview
lib/
  server.ts                      Elysia app and /api/v1 routes
  server/auth.ts                 JWT/API-key auth macro
  server/board.ts                Board, task, and stack services
  server/projects.ts             Project services
  server/api-keys.ts             Key generation, HMAC hashing, verification
  server/validation.ts           Shared request validation
  supabase/                      Browser, server, proxy, and admin clients
  api/types.ts                   Shared API types
components/
  app/                           App shell and navigation
  board/                         Board, columns, cards, dialogs
  projects/                      Project cards and dialogs
  settings/                      Appearance, task kinds, API keys
  ui/                            shadcn/ui React Aria components
supabase/migrations/             Schema, RLS, triggers, and RPCs
.agents/skills/duti/SKILL.md     Agent operating instructions
```

## Scripts

| Command | Description |
|---|---|
| `bun run dev` | Start the Next.js dev server |
| `bun run build` | Production build |
| `bun run start` | Start the production server |
| `bun run typecheck` | Run `tsc --noEmit` |
| `bun run lint` | Run ESLint |
| `bun run db:push` | Push Supabase migrations |
| `bun run db:types` | Regenerate `lib/supabase/database.types.ts` |
| `bun run supabase:start` | Start local Supabase (optional; hosted is the default) |
| `bun run supabase:stop` | Stop local Supabase |
| `bun run supabase:status` | Show local Supabase status |

## Checks

```bash
bun run typecheck
bun run lint
bun run build
```

There is no automated test runner configured yet. See the build plan for the
current manual verification notes and follow-ups.

## Deployment

Deploy the single Next.js app to Vercel or another Node host. Keep the
`/api/[[...slugs]]` route on the Node runtime.

Before deploying dependent code:

1. Apply the Supabase migrations to the hosted project.
2. Set all environment variables in the host, including the service-role key and
   API-key pepper.
3. Set `NEXT_PUBLIC_APP_URL` to the production origin.
4. Add the production `/auth/callback` URL to Supabase Auth.
5. Verify `/api/v1/health`, `/api/docs`, and an API-key request against the
   deployed origin.

## Known limitations

- Google OAuth requires the hosted Supabase Google provider and callback
  allowlist to be configured.
- API keys have full workspace access; scopes and rate limiting are follow-ups.
- The protected app shell streams, so a project not-found page renders correctly
  but may return HTTP `200` instead of `404`.
- Automated tests and CI are not set up yet.

## More documentation

- [`duti_build_plan.md`](./duti_build_plan.md) — product plan, data model, API
  contract, verification notes, and follow-ups
- [`agent.md`](./agent.md) — backend architecture and Elysia rules
- [`elysia.md`](./elysia.md) — Elysia v2 reference material
- [`AGENTS.md`](./AGENTS.md) — repository instructions for coding agents
