---
name: duti
description: Use Duti to create and manage tasks, turn rough notes or bug reports into clear task titles and descriptions, and retrieve or summarize existing tasks. Trigger when the user asks to file/log/create a Duti task, turn work into a task, look up a task by key, or summarize task status/details.
---

# Duti Task Operations

Use this skill when the user asks to create a Duti task, improve task wording, retrieve a task, or summarize one.

## Safety and operating principles

- Treat creating, updating, moving, and deleting tasks as real actions in the user's workspace. Create or modify tasks only when the user asks for that action.
- Never claim a task was created or updated until the API returns success. Report its returned human-readable key (for example, `ABC-12`) and title.
- Never invent project IDs, task-kind keys, stack IDs, task keys, API response fields, or task details. Discover them from the API.
- Do not ask the user for information that can be retrieved from Duti, such as their projects, task kinds, or board stacks.
- If the project cannot be determined unambiguously from the request or existing context, list the available projects and ask one concise question.
- If the task kind is unclear, use the workspace default kind from `GET /api/v1/me` when present; otherwise inspect task kinds and choose the closest existing kind. Ask if multiple choices materially change meaning.
- If a required field is unknown and cannot be discovered, ask rather than guessing.
- Do not include credentials in task titles, descriptions, logs, or summaries. Redact secrets and personal data from task content.
- A task summary is a summary of the retrieved task, not a claim that work has been completed. Clearly distinguish task requirements from implementation status.

## API connection

Duti API routes are served under `/api`. The documented endpoint for task creation is:

`POST {DUTI_BASE_URL}/api/v1/projects/{projectId}/tasks`

Configure these values in the agent's secure environment or connected tool settings:

- `DUTI_BASE_URL`: origin of the Duti deployment, e.g. `http://localhost:3000` for local development. Do not assume local development if a configured deployment exists.
- `DUTI_API_KEY`: a Duti API key beginning with `duti_live_`. Keep it in a secret/environment variable; never print it or commit it.

Send authenticated requests with:

```http
Authorization: Bearer <DUTI_API_KEY>
Content-Type: application/json
```

For example:

```bash
curl --fail-with-body \
  -H "Authorization: Bearer $DUTI_API_KEY" \
  -H "Content-Type: application/json" \
  "$DUTI_BASE_URL/api/v1/me"
```

Use the API key only through secure environment interpolation. Never put a real key in prompts, skill files, source code, shell history, or output. If the agent has no secure credential configured, explain how to configure one and stop before attempting protected actions.

For current API documentation, use Scalar at `{DUTI_BASE_URL}/api/docs` and the OpenAPI JSON at `{DUTI_BASE_URL}/api/openapi.json`. If the live spec differs from this skill, trust the live spec and current API response, then update your understanding rather than inventing unsupported behavior.

## Required discovery before creating a task

1. Check connectivity with `GET /api/v1/health`.
2. Call `GET /api/v1/me` to confirm authentication and discover the workspace's default task kind. This endpoint returns user/workspace context and may return `defaultKind`.
3. Call `GET /api/v1/projects`. Match the intended project by name/key. Do not select the first project blindly.
4. Call `GET /api/v1/task-kinds`. Use a real task kind `key`; task kinds are workspace-defined, not a hard-coded list such as `bug`, `feat`, or `task`.
5. If the user names a stack/column or wants the task placed somewhere specific, call `GET /api/v1/projects/{projectId}/board` and select a real stack `id`. Otherwise omit `stackId` so Duti can apply its default behavior.
6. If the user may be referring to a duplicate task, search first using `GET /api/v1/projects/{projectId}/tasks?q={encoded search terms}` or `GET /api/v1/tasks/by-key/{key}` when a key is known. Do not create a duplicate if the user is asking to summarize or follow up on an existing task.

## Create a task

Endpoint: `POST /api/v1/projects/{projectId}/tasks`

Required JSON fields:

- `title`: non-empty string, max 500 characters.
- `kind`: an existing task-kind key from `GET /api/v1/task-kinds`.
- `priority`: exactly one of `low`, `medium`, `high`, `critical`.

Optional fields:

- `description`: Duti rich-text document JSON (schema below).
- `dueDate`: date in `YYYY-MM-DD` format, or `null`.
- `stackId`: existing stack ID belonging to this project's board, or `null`.

You may send an `Idempotency-Key` header (maximum 200 characters) to avoid accidental duplicate creation when retrying a request. Reuse the same key for retries of the same intended operation; do not reuse it for a different task.

Example request (replace discovered IDs and values; never copy these example IDs as real values):

```bash
curl --fail-with-body -X POST \
  -H "Authorization: Bearer $DUTI_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: <unique-operation-id>" \
  "$DUTI_BASE_URL/api/v1/projects/<PROJECT_ID>/tasks" \
  -d '{
    "title": "Prevent duplicate task creation after retry",
    "kind": "<EXISTING_TASK_KIND_KEY>",
    "priority": "high",
    "description": {
      "type": "doc",
      "content": [
        {
          "type": "heading",
          "attrs": { "level": 2 },
          "content": [{ "type": "text", "text": "Summary" }]
        },
        {
          "type": "paragraph",
          "content": [{ "type": "text", "text": "Retrying a timed-out request may create duplicate tasks." }]
        },
        {
          "type": "heading",
          "attrs": { "level": 2 },
          "content": [{ "type": "text", "text": "Acceptance criteria" }]
        },
        {
          "type": "bulletList",
          "content": [
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [{ "type": "text", "text": "Retrying the same operation does not create a duplicate task." }]
                }
              ]
            },
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [{ "type": "text", "text": "A new operation can still create a separate task." }]
                }
              ]
            }
          ]
        }
      ]
    }
  }'
```

This is an illustrative example, not a real request. Replace the project ID, task-kind key, and idempotency key with values appropriate to the current operation.

A successful create returns HTTP `201` with the created task. Read the response to capture its actual `key`, `id`, `title`, `priority`, `kind`, and other returned fields. On validation or authentication errors, explain the actual API error and fix the request; do not report success.

## Writing a useful task

Convert the user's rough notes into a clear, actionable issue without inventing facts.

### Title

- Lead with a specific action or observable problem.
- Keep it concise and scannable.
- Bug title: describe the failure and relevant context, e.g. `Prevent duplicate tasks when a create request is retried`.
- Feature title: describe the user-visible outcome, e.g. `Allow agents to search tasks by project and priority`.
- Avoid vague titles such as `Fix bug`, `Improve API`, or `Work on dashboard`.
- Do not put speculative root causes in the title as if confirmed.

### Description structure

Use only sections relevant to the task; omit sections for which there is no useful information.

- **Summary** — one or two sentences describing the problem or desired outcome.
- **Context** — what prompted the task, where it occurs, and who/what is affected. Preserve the user's facts.
- **Expected behavior** — what should happen.
- **Actual behavior** — what happens now; include only if known and relevant.
- **Steps to reproduce** — numbered, concrete steps for a bug when available.
- **Acceptance criteria** — observable, testable outcomes, preferably a short checklist.
- **Technical notes** — known files, endpoints, logs, constraints, or suggested approach. Label hypotheses as hypotheses.
- **References** — related task keys, links, or error messages, if provided.

Prefer behavior-based acceptance criteria. Keep scope realistic and avoid prescribing implementation details unless the user asks or the technical constraint is known. Do not fabricate reproduction steps, impact, root cause, estimates, deadlines, or completed work.

### Rich-text description format

Duti expects a TipTap-like JSON document, not Markdown text. Use this shape:

```json
{
  "type": "doc",
  "content": [
    {
      "type": "heading",
      "attrs": { "level": 2 },
      "content": [{ "type": "text", "text": "Summary" }]
    },
    {
      "type": "paragraph",
      "content": [{ "type": "text", "text": "Describe the issue or outcome here." }]
    },
    {
      "type": "heading",
      "attrs": { "level": 2 },
      "content": [{ "type": "text", "text": "Acceptance criteria" }]
    },
    {
      "type": "bulletList",
      "content": [
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [{ "type": "text", "text": "A testable condition is satisfied." }]
            }
          ]
        }
      ]
    }
  ]
}
```

Allowed nodes include `doc`, `paragraph`, `heading`, `bulletList`, `orderedList`, `listItem`, `blockquote`, `codeBlock`, `hardBreak`, `horizontalRule`, and `text`. Allowed text marks are `bold`, `italic`, `strike`, and `code`. For headings use `attrs.level` 1, 2, or 3 (Duti normalizes other values to level 2). Keep descriptions concise, useful, and below the API's size limits.

## Retrieve and summarize a task

- If the user provides a task key (e.g. `ABC-12`), call `GET /api/v1/tasks/by-key/{key}`. The key is workspace-scoped.
- If the user provides a task UUID, call `GET /api/v1/tasks/{taskId}`.
- To find candidates by project/search, first call `GET /api/v1/projects`, then `GET /api/v1/projects/{projectId}/tasks?q={URL-encoded query}`. Supported filters are `q`, `priority`, `kind`, and `stack`.
- Use the actual returned task data. Do not assume fields or status values not present in the response.

A useful concise summary normally contains:

1. **Key and title**
2. **Purpose** — what problem or outcome the task describes
3. **Type and priority**
4. **Requirements / acceptance criteria** — the key actionable items
5. **Due date and current stack** — only when returned and relevant
6. **Open questions / missing information** — note gaps that materially affect execution

Distinguish between a task's requested outcome and its implementation status. Duti tasks do not necessarily prove that work has started or finished. If a field is missing, say it is not specified instead of inferring it.

## Update an existing task

Only update when the user asks to change it. Use `PATCH /api/v1/tasks/{taskId}` with one or more of `title`, `description`, `kind`, `priority`, and `dueDate`. Retrieve the task first, preserve existing information that should remain, and send only intended changes. `description` must use the rich-text JSON format above.

To move a task, use `POST /api/v1/tasks/{taskId}/move` with `{"stackId":"<REAL_STACK_ID>" }`; discover the destination stack from the project's board first. Do not move tasks just because a summary suggests a different status.

## Final response after an operation

After successful creation, give a compact confirmation with the returned task key/title, project, priority, and a short description of what was filed. Link to the task only if a real Duti URL pattern is known; do not invent a deep link.

After a summary, provide the task key/title and the concise summary, with uncertainties clearly labeled.

After failure, report the HTTP/API error in plain language and the next step. Never echo the API key or other secrets.
