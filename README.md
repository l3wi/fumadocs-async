# fumadocs-asyncapi

AsyncAPI integration for Fumadocs – parse specs once, generate docs, and embed a WebSocket playground inside your docs pages.

## Features

- **Server & Parser** – `createAsyncAPI` loads one or more AsyncAPI YAML/JSON files (or live documents), caches the parsed result, and exposes a uniform `AsyncAPIServer` for the rest of the package.
- **Page Generation** – `generateAsyncFiles` + `asyncapiSource` turn AsyncAPI operations into MDX files or virtual Fumadocs pages. Group pages per channel, per operation, or per tag, and customize frontmatter/imports before writing.
- **UI Components** – `createAsyncAPIPage` renders channels, operations, message schemas, examples, bindings, and code samples. Slots mirror `fumadocs-openapi`, so you can override layouts or inject custom schema renderers and playgrounds.
- **WebSocket Sidebar** – A built-in client (`WSClientProvider` + `<WSSidebar />`) lets readers connect to AsyncAPI servers, push example payloads from docs into the sidebar, and inspect live traffic.
- **Next.js Helpers** – `AsyncAPIChannelsPage` and `AsyncAPIMessagesPage` give App Router projects prebuilt channel/message lists that stay in sync with the core UI utilities.

## Installation

```bash
bun add fumadocs-asyncapi
```

## Usage Overview

1. **Create the server instance**

   ```ts
   // lib/asyncapi.ts
   import { createAsyncAPI } from 'fumadocs-asyncapi/server'

   export const asyncapi = createAsyncAPI({
     input: ['./schemas/chat.yaml', './schemas/orders.yaml'],
     defaultServer: 'production',
   })
   ```

2. **Generate docs (optional)**

   ```ts
   import { generateAsyncFiles } from 'fumadocs-asyncapi/server'

   await generateAsyncFiles({
     input: asyncapi,
     output: './content/docs/asyncapi',
     per: 'operation',
     groupBy: 'server',
     imports: "import { AsyncAPIPage } from '@/components/asyncapi-page'",
   })
   ```

   Or wire the source plugin:

   ```ts
   import { asyncapiSource } from 'fumadocs-asyncapi/server'

   export const source = await asyncapiSource(asyncapi, {
     per: 'channel',
     baseDir: 'asyncapi',
   })
   ```

3. **Render pages**

   ```tsx
   // components/asyncapi-page.tsx
   import { createAsyncAPIPage } from 'fumadocs-asyncapi/ui'
   import { asyncapi } from '@/lib/asyncapi'

   export const AsyncAPIPage = createAsyncAPIPage(asyncapi, {
     client: {
       title: 'WebSocket Tester',
       servers: async ({ document }) =>
         document.servers.map((server) => ({
           name: server.name,
           url: server.url,
         })),
     },
   })
   ```

   Then render `<AsyncAPIPage document="orders" />` in MDX or use the Source plugin.

## Development

```bash
bun install
bun run typecheck
bun run lint
bun run format
bun run build
bun run dev
bun run test   # runs Vitest (AsyncAPI + shared reference suites)
```

> The repo also contains reference copies of `fumadocs-openapi` and asyncapi-react. Those suites run under `bun run test`, so failures there may not originate from this package.

## Repository Layout

- `src/server` – server utilities (`createAsyncAPI`, `generateAsyncFiles`, `asyncapiSource`, page-context helpers).
- `src/ui` – AsyncAPIPage factory, Next.js helpers, WebSocket sidebar components, and shared render utilities.
- `src/components/ws-client` – context/provider + sidebar for the WebSocket playground.
- `src/utils` – document resolution, shared hooks, etc.
- `docs/cleanup-plan.md` – running refactor checklist.

## Status

The core parser/server + UI + WebSocket client are implemented and tracked in `docs/cleanup-plan.md`. Remaining work focuses on modularising the UI further, finishing the WebSocket test suite, and completing docs/examples.

## License

MIT
