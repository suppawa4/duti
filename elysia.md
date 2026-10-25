# Quick start

Elysia is a TypeScript backend framework optimized for Bun. You can also run it on Node.js or any runtime that supports Web Standard Request.

<!--astro:end-->

## Bun

Install Bun using the command for your operating system.

<!--astro:end-->

Terminal window

```bash
curl -fsSL https://bun.com/install | bash
```

Terminal window

```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

Open a new terminal and check the installation:

Terminal window

```bash
bun --version
```

<!--astro:end-->

### Automatic installation

You can create a project using `bun create elysia`.

The template use `latest` but we want to use the `rc` version of Elysia v2 instead.

Terminal window

```bash
bun create elysia
cd app
bun add elysia@rc
```

Start the server:

Terminal window

```bash
bun run dev
```

Open [localhost:3000](http://localhost:3000). You should see `Hello Elysia`.

Keep the server running

The `--watch` flag restarts your server when files change. `dev` is a script you add to the project; it isn’t a command supplied by the Elysia package itself.

### Manual installation

If you’d rather start with your own files, create an empty project and install Elysia:

Terminal window

```bash
mkdir app
cd app
bun init -y
bun add elysia@rc
bun add -d @types/bun typescript
```

Create `src/index.ts`:

```ts
import { Elysia } from 'elysia'

new Elysia()
    .get('/', () => 'Hello Elysia')
    .listen(3000, ({ hostname, port }) => {
        console.log(`Elysia is running at ${hostname}:${port}`)
    })
```

Merge these scripts into your `package.json`:

```json
{
    "scripts": {
        "dev": "bun --watch src/index.ts",
        "build": "bun build src/index.ts --target bun --outdir ./dist",
        "start": "NODE_ENV=production bun dist/index.js",
        "test": "bun test"
    }
}
```

| Script          | What it does                                        |
| --------------- | --------------------------------------------------- |
| `bun run dev`   | Starts the server and reloads it when code changes. |
| `bun run build` | Bundles the server for production.                  |
| `bun run start` | Runs the previously built bundle.                   |
| `bun run test`  | Runs tests with Bun’s test runner.                  |

Keep `strict` enabled in `tsconfig.json` so Elysia can infer your types correctly:

```json
{
    "compilerOptions": {
        "strict": true
    }
}
```

Merge this option into the configuration created by `bun init`; keep its other settings. Run `bun run dev` and open [localhost:3000](http://localhost:3000).

## Node.js

Use a supported Node.js release with the Node adapter. Elysia 2 requires Node `22.18` or later; choose a maintained LTS release from the [Node.js downloads page](https://nodejs.org/en/download).

If you already use a system package manager, these are the corresponding installation commands:

<!--astro:end-->

Terminal window

```bash
brew install node
```

Terminal window

```powershell
choco install nodejs
```

Terminal window

```bash
sudo apt install nodejs npm
```

Terminal window

```bash
sudo pacman -S nodejs npm
```

Check `node --version` afterward. A distribution’s default package may be older than Elysia’s requirement; use an installer for a supported release if needed.

<!--astro:end-->

### TypeScript setup

Start in a new project directory with a `package.json` (for example, run `npm init -y`). Choose the commands for your package manager:

<!--astro:end-->

Terminal window

```bash
bun add elysia@rc @elysia/node@rc
bun add -d tsx @types/node typescript
```

Terminal window

```bash
pnpm add elysia@rc @elysia/node@rc typebox exact-mirror openapi-types
pnpm add -D tsx @types/node typescript
```

Terminal window

```bash
npm install elysia@rc @elysia/node@rc
npm install --save-dev tsx @types/node typescript
```

Terminal window

```bash
yarn add elysia@rc @elysia/node@rc typebox exact-mirror openapi-types
yarn add -D tsx @types/node typescript
```

The pnpm and Yarn commands list Elysia’s required runtime peers explicitly, so they also work when automatic peer installation is disabled. Elysia v2 uses `typebox`, not `@sinclair/typebox`.

`tsx` runs TypeScript during development and provides watch mode. TypeScript itself checks your types and creates the production JavaScript.

Create `src/index.ts`:

```ts
import { Elysia } from 'elysia'
import { node } from '@elysia/node'

new Elysia({ adapter: node() })
    .get('/', () => 'Hello Elysia')
    .listen(3000, ({ hostname, port }) => {
        console.log(`Elysia is running at ${hostname}:${port}`)
    })
```

Set the package to use ES modules and add these scripts:

```json
{
    "type": "module",
    "scripts": {
        "dev": "tsx watch src/index.ts",
        "build": "tsc -p tsconfig.json",
        "start": "node dist/index.js"
    }
}
```

Create a TypeScript configuration with `npx tsc --init`, then configure these options in `tsconfig.json`:

```json
{
    "compilerOptions": {
        "target": "ES2022",
        "module": "NodeNext",
        "moduleResolution": "NodeNext",
        "lib": ["ESNext", "DOM", "DOM.Iterable"],
        "types": ["node"],
        "rootDir": "src",
        "outDir": "dist",
        "strict": true,
        "skipLibCheck": true
    },
    "include": ["src/**/*.ts"]
}
```

The build script reads this configuration, including `strict` and the output directory. Use `.js` extensions when importing your own modules with NodeNext, even from TypeScript source files.

Run the development server:

Terminal window

```bash
npm run dev
```

You can use `bun run dev`, `pnpm dev`, or `yarn dev` instead. Open [localhost:3000](http://localhost:3000) to see `Hello Elysia`.

| Script  | What it does                                        |
| ------- | --------------------------------------------------- |
| `dev`   | Runs TypeScript with automatic restarts on changes. |
| `build` | Checks types and emits JavaScript into `dist`.      |
| `start` | Runs the built JavaScript with Node.js.             |

Set `NODE_ENV=production` in your deployment environment before running `start`. On a POSIX shell, you can use `NODE_ENV=production npm run start`; in PowerShell, set `$env:NODE_ENV = 'production'` first.

### JavaScript setup

You can use JavaScript too. The request handling is the same; TypeScript adds schema inference and end-to-end type checking while you’re writing code.

Choose your package manager:

**Bun**

Terminal window

```bash
bun add elysia@rc @elysia/node@rc
```

**pnpm**

Terminal window

```bash
pnpm add elysia@rc @elysia/node@rc typebox exact-mirror openapi-types
```

**npm**

Terminal window

```bash
npm install elysia@rc @elysia/node@rc
```

**Yarn**

Terminal window

```bash
yarn add elysia@rc @elysia/node@rc typebox exact-mirror openapi-types
```

Create `src/index.js`:

```js
import { Elysia } from 'elysia'
import { node } from '@elysia/node'

new Elysia({ adapter: node() })
    .get('/', () => 'Hello Elysia')
    .listen(3000, ({ hostname, port }) => {
        console.log(`Elysia is running at ${hostname}:${port}`)
    })
```

Add ES module support and the following scripts to `package.json`:

```json
{
    "type": "module",
    "scripts": {
        "dev": "node --watch src/index.js",
        "start": "node src/index.js"
    }
}
```

Run `npm run dev` to develop with automatic restarts. Use `npm run start` in production with `NODE_ENV=production` set in the environment.

You can add types later

JavaScript works without a compile step. If you want stronger editor checks, start with the TypeScript setup above; both examples expose the same route.

## Web Standard

Elysia exposes a request handler that takes a Web Standard `Request` and produces a `Response`. Use it with a compatible framework or server runtime instead of opening a separate listener.

Install Elysia with your package manager:

<!--astro:end-->

Terminal window

```bash
bun add elysia@rc
```

Terminal window

```bash
pnpm add elysia@rc typebox exact-mirror openapi-types
```

Terminal window

```bash
npm install elysia@rc
```

Terminal window

```bash
yarn add elysia@rc typebox exact-mirror openapi-types
```

Choose an integration to see how its runtime connects to Elysia:

### [Cloudflare Workers](/integrations/cloudflare-worker)

[Run an Elysia API on Cloudflare Workers.](/integrations/cloudflare-worker)

### [Next.js](/integrations/nextjs)

[Use Elysia in Next.js route handlers.](/integrations/nextjs)

### [Expo](/integrations/expo)

[Use Elysia in Expo API routes.](/integrations/expo)

### [Astro](/integrations/astro)

[Use Elysia in Astro API routes.](/integrations/astro)

### [Nuxt](/integrations/nuxt)

[Use Elysia in Nuxt server routes.](/integrations/nuxt)

### [SvelteKit](/integrations/sveltekit)

[Use Elysia in SvelteKit API routes.](/integrations/sveltekit)

### [TanStack Start](/integrations/tanstack-start)

[Use Elysia in TanStack Start server routes.](/integrations/tanstack-start)

### Not on the list?

Export `app.fetch` and pass incoming requests to it using your runtime’s server API:

```ts
import { Elysia } from 'elysia'

const app = new Elysia()
    .get('/', () => 'Hello Elysia')

export default app.fetch
```

Don’t call `.listen()` when the host framework owns the server. A direct request to this handler returns the same greeting:

```ts
const response = await app.fetch(new Request('http://localhost/'))
console.log(await response.text()) // Hello Elysia
```

Request and response compatibility is the starting point; use the integration guide for runtime-specific setup and supported features.

# Integration with Next.js

With Next.js App Router, we can run Elysia on Next.js routes.

1. Create **app/api/\[\[…slugs]]/route.ts**
2. Define an Elysia server
3. Export **Elysia.fetch** with the name of the HTTP methods you want to use

app/api/\[\[...slugs]]/route.ts

```typescript
import { Elysia, t } from 'elysia'

const app = new Elysia({ prefix: '/api' })
    .get('/', 'Hello Nextjs')
    .post('/', {
        body: t.Object({
            name: t.String()
        })
    }, ({ body }) => body)

export const GET = app.fetch
export const POST = app.fetch
```

Elysia will work normally because of WinterTC compliance.

You can treat the Elysia server as a normal Next.js API route.

With this approach, you can have co-location of both frontend and backend in a single repository and have [End-to-end type safety with Eden](/eden) in both client-side code and server actions.

### pnpm

If your pnpm configuration does not install peer dependencies, add the peers required by Elysia v2 explicitly:

Terminal window

```bash
pnpm add typebox exact-mirror openapi-types
```

## Prefix

Because our Elysia server is not in the root directory of the app router, you need to annotate the prefix on the Elysia server.

For example, if you place the Elysia server in **app/user/\[\[…slugs]]/route.ts**, you need to annotate the prefix as **/user** on the Elysia server.

app/user/\[\[...slugs]]/route.ts

```typescript
import { Elysia, t } from 'elysia'

const app = new Elysia({ prefix: '/user' })
  .get('/', 'Hello Nextjs')
    .post('/', {
        body: t.Object({
            name: t.String()
        })
    }, ({ body }) => body)

export const GET = app.fetch
export const POST = app.fetch
```

This will ensure that Elysia routing works properly wherever you place it.

## Eden

We can add [Eden](/eden) for **end-to-end type safety** similar to tRPC.

In this approach, we will use the isomorphic fetch pattern to allow Elysia to:

1. On Server: directly call Elysia without going through the network layer
2. On Client: call Elysia through the network layer

To start, we need to do the following steps:

1. Export the Elysia instance

lib/server.ts

```typescript
import { Elysia, t } from 'elysia'

export const app = new Elysia({ prefix: '/api' })
  .get('/', 'Hello Nextjs')
  .post(
    '/user',
    {
      body: t.Object({
        name: t.String()
      })
    }, ({ body }) => body
  )
```

Keep the route file limited to Next.js route exports:

app/api/\[\[...slugs]]/route.ts

```typescript
import { app } from '../../../lib/server'

export const GET = app.fetch
export const POST = app.fetch
```

2. Create separate server and browser clients

The server client can call the Elysia instance directly. Keep its runtime import out of the browser bundle:

lib/eden.server.ts

```typescript
import 'server-only'
import { treaty } from '@elysia/eden'
import { app } from './server'

export const api = treaty(app).api
```

The browser client imports only the app’s type and makes an HTTP request:

lib/eden.ts

```typescript
import { treaty } from '@elysia/eden'
import type { app } from './server'

export const api = treaty<typeof app>('http://localhost:3000').api
```

Use your deployed origin in production. This makes the server/client boundary explicit without depending on a bundled `process` global.

3. Use the client in both server and client components

app/page.tsx

```tsx
import { api } from '../lib/eden.server'

export default async function Page() {
  const { data: message } = await api.get()

  return <h1>Hello, {message}</h1>
}
```

This allows you to have type safety from the frontend to the backend with minimal effort and works with both server and client components, as well as with Incremental Static Regeneration (ISR).

## React Query

We can also use React Query to interact with the Elysia server on the client.

app/client.tsx

```tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/eden'

export default function App() {
  const { data: response } = useQuery({
    queryKey: ['get'],
    queryFn: () => api.get()
  })

  return response?.data
}
```

Place this client component under your `QueryClientProvider`. You can use React Query features like caching, pagination, and infinite queries.

***

Please refer to [Next.js Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers#static-route-handlers) for more information.
