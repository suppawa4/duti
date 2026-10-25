# Backend architecture: Elysia, not Next.js Route Handlers

## TL;DR

This project does **not** implement its backend as Next.js route handlers. The backend is a single Elysia application mounted through one catch-all Next.js route. All API work happens in Elysia.

```text
Browser / Server Component
        │
        ├── getAccessToken() -> createApi(token) ──► Elysia app (direct call, no network)
        └── lib/eden.ts ───────────────────────────► HTTP ──► Next catch-all route ──► Elysia app
```

## Why this shape

- **One backend, one place.** Routing, validation, status codes, error handling, and response shaping live in Elysia (`lib/server.ts`) instead of being spread across many `app/api/**/route.ts` files.
- **End-to-end types.** Eden derives the client API from the Elysia app type, so server and browser code get the same route, body, and response types.
- **Validation is centralized.** Elysia's `t` schemas produce consistent `422` responses without repeating parsing code per endpoint.
- **Next.js stays the frontend.** Next.js owns rendering, caching, and the HTTP server; Elysia owns the API surface.

## Request flow

1. Next.js matches every `/api/*` request with `app/api/[[...slugs]]/route.ts`.
2. That file re-exports `app.fetch` for each supported HTTP method.
3. Elysia receives the Web Standard `Request`, matches the route (with `prefix: "/api"`), validates input, and returns a Web Standard `Response`.

```text
app/api/[[...slugs]]/route.ts  ->  lib/server.ts       Elysia app (prefix "/api")
lib/eden.server.ts             ->  lib/server.ts       server-only Eden client, direct call
lib/eden.ts                    ->  NEXT_PUBLIC_APP_URL browser Eden client over HTTP
```

## Authentication modes

| Caller | Credential | Enforcement |
| --- | --- | --- |
| Web UI page request | Supabase session cookie | `proxy.ts` refreshes the session and redirects unauthenticated `GET`/`HEAD` page requests to `/auth/login?continue=<path>`. The protected `app/(app)/layout.tsx` calls `requireUser()` as a second check. |
| Web UI API call | Supabase access token as `Authorization: Bearer <jwt>` | Elysia's `auth` macro verifies the token with `supabase.auth.getClaims(token)` and creates a user-scoped Supabase client. RLS is the database boundary. |
| External agent | `Authorization: Bearer duti_live_...` | Elysia detects the prefix, looks up the key by its short prefix, verifies the peppered HMAC in constant time, checks expiry/revocation, and creates a service-role client scoped to the key's `workspace_id`. Every service query filters by that workspace. |

`/api/*` is excluded from the proxy matcher so API-key agents can reach Elysia without a browser session. `/auth/*` is public so login and callback work. `/icons/*`, `/opengraph-image`, and `/twitter-image` are public branding and social-preview assets. Only `/api/v1/health` is unauthenticated; every other Elysia route opts into `{ auth: true }` and accepts either a user JWT or an API key. JWT mode requires a verified `sub` and `role === "authenticated"`; a raw JWT is never accepted as an API key, and an API key is never accepted as a session. API keys have full workspace access for the MVP; scopes are out of scope.

Server Actions must verify auth themselves (`requireUser()` or `createApi(token)`); the proxy intentionally does not redirect non-GET requests because that would replace a Server Action response with a page navigation.

## File map

| Path | Responsibility |
| --- | --- |
| `lib/server.ts` | The Elysia app. Add every endpoint here. |
| `lib/server/auth.ts` | Elysia `auth` macro: bearer-token parsing, JWT claims, API-key resolution, and the correct Supabase client. |
| `lib/server/api-keys.ts` | API-key generation, peppered HMAC hashing, prefix lookup, expiry/revocation, and `last_used_at`. |
| `lib/supabase/admin.ts` | Server-only cached service-role client used only for verified API-key requests. |
| `lib/server/errors.ts` | Stable API error envelope (`apiError`). |
| `app/api/[[...slugs]]/route.ts` | Forwards `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS` to `app.fetch`. |
| `lib/eden.server.ts` | `server-only` access-token reader and request-scoped Eden factory. |
| `lib/eden.ts` | Browser Eden client using `NEXT_PUBLIC_APP_URL`. |
| `lib/auth/continue.ts` | Safe relative `continue` path and login URL helpers. |
| `lib/auth/server.ts` | `getCurrentUser()` and `requireUser()` for Server Components. |
| `lib/auth/actions.ts` | `signOut` Server Action. |
| `lib/supabase/proxy.ts` | Session refresh, claims read, and `x-duti-pathname` request header. |
| `proxy.ts` | Page-request auth gate. |
| `app/auth/login/page.tsx` | Google sign-in page. |
| `app/auth/callback/route.ts` | PKCE code exchange and safe redirect. |
| `app/(app)/layout.tsx` | Protected app shell and sign-out control. |
| `components/auth/*` | Client auth-state listener and Google sign-in button. |
| `elysia.md` | Elysia v2 reference material, not project instructions. |

## Rules

- Add or change endpoints in `lib/server.ts`. Do not create per-feature handlers such as `app/api/todos/route.ts`.
- All routes live under `/api/v1`. Elysia keeps `prefix: "/api"`, so declare `"/v1/health"`, `"/v1/projects"`, and so on.
- `@elysia/openapi` serves the generated Scalar reference at `/api/docs` and the OpenAPI JSON at `/api/openapi.json`. Keep each route's `detail` tags and summary current so the docs stay useful.
- Do not call `.listen()`. Next.js owns the server; the catch-all route forwards `app.fetch`.
- Keep every required verb exported from `app/api/[[...slugs]]/route.ts`. If Elysia defines `PATCH` but the route file does not export it, Next.js answers `405`.
- Use Elysia's `t` for body, query, and params schemas. Validation failures return `422` automatically.
- Validate project IDs before database lookups. Malformed, missing, and cross-workspace project IDs all return `404 NOT_FOUND` so the UI can render `notFound()` consistently.
- Task keys are unique per workspace (`tasks_workspace_key_unique`). `GET /api/v1/tasks/by-key/:key` resolves a key such as `DUTI-5` in one request; use the normal UUID route when you already have a task ID.
- Return plain values or Web Standard `Response` objects. Do not use `NextRequest`/`NextResponse` inside Elysia handlers.
- The runtime is Node.js through Next.js, not Bun. Elysia requires Node `>= 22.18`; do not use `Bun.*` or `bun:*` APIs in backend code.
- The catch-all route is dynamic by design (`ƒ /api/[[...slugs]]`). Do not add `export const dynamic = "force-static"` expecting Elysia routes to prerender.
- `.listen()`, WebSocket support, and Bun-only plugins are unavailable through this adapter. WebSockets or a long-lived standalone server need a separate Elysia entrypoint.
- A more specific `app/api/<segment>/route.ts` would bypass Elysia and split the backend. Avoid it.
- Return expected auth failures as `status(401, apiError("UNAUTHORIZED", "..."))`. Do not throw `new Error("Unauthorized")`; that becomes a 500 and disappears from the Eden return type.
- Do not `await` or return the Eden API proxy from an async function. The proxy is thenable, so Promise resolution can hang. Use `getAccessToken()` and then `createApi(token)`.
- Server Components that read the session must stay inside a `<Suspense>` boundary with `cacheComponents`. Call `connection()` before `cookies()`/`searchParams` so the static shell does not evaluate runtime code.
- With `cacheComponents: true`, authenticated pages are dynamic. Use Suspense boundaries and explicit loading/empty/error states; do not force-static a user-specific page.

## Adding an endpoint

```ts
// lib/server.ts
export const app = new Elysia({ prefix: "/api" })
  .use(auth)
  .get("/v1/health", () => ({ ok: true }))
  .get("/v1/me", { auth: true }, async ({ auth, status }) => {
    const { data: workspace, error } = await auth.supabase
      .from("workspaces")
      .select("id, name")
      .eq("owner_id", auth.user.id)
      .single();

    if (error) {
      return status(404, apiError("NOT_FOUND", "Workspace not found."));
    }

    return { user: auth.user, workspace };
  });
```

The `auth` macro currently exposes `auth.user` and `auth.supabase`. When the API-key path lands, it should also resolve the workspace ID for both modes so route handlers do not repeat the owner lookup.

## Consuming the API

- Server Components / Server Actions:

  ```ts
  const accessToken = await getAccessToken();
  const api = createApi(accessToken);
  const { data, error } = await api.v1.me.get();
  ```

- Unauthenticated endpoints: `import { publicApi } from "@/lib/eden.server"` and call `publicApi.v1.health.get()`.
- Client Components: `import { api } from "@/lib/eden"` and call the same typed methods. The browser does not call `/api/v1` directly in the MVP.
- Plain HTTP: `GET /api/v1/health`.

## Verifying backend changes

- `bun run dev`, then request `http://localhost:3000/api/v1/health` and `http://localhost:3000/api/v1/me` (the latter must return `401` without a token).
- `bun run build` must list `ƒ /api/[[...slugs]]`.
- Run `bun run typecheck` and `bun run lint`.

## Related setup

- Supabase clients live in `lib/supabase/`; session refresh and the `x-duti-pathname` header run in `lib/supabase/proxy.ts`.
- Google OAuth must be enabled in the hosted Supabase project, with `http://localhost:3000/auth/callback` (and the production callback) in the redirect allowlist.
- Read the bundled Next.js docs in `node_modules/next/dist/docs/` before changing Next.js code or config.
