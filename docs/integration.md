# Fumadocs AsyncAPI – Quick Integration Guide

Follow these steps to bring AsyncAPI references and the WebSocket client into your Fumadocs project.

## 1. Install

```bash
bun add fumadocs-asyncapi
```

Ensure your project already uses `fumadocs-core` / `fumadocs-ui` as usual.

## 2. Create the AsyncAPI server instance

```ts
// lib/asyncapi.ts
import { createAsyncAPI } from 'fumadocs-asyncapi/server'

export const asyncapi = createAsyncAPI({
  input: ['./asyncapi.yaml'], // JSON/YAML paths or URLs
  defaultServer: 'production',
  disableCache: process.env.NODE_ENV === 'development',
})
```

You can also supply `input` as an async function returning a map of already parsed `AsyncAPIDocument`s if you prefer custom loading.

## 3. Render pages (choose one)

### A. Generate MDX files

```ts
// scripts/generate-asyncapi.ts
import { asyncapi } from '../lib/asyncapi'
import { generateAsyncFiles } from 'fumadocs-asyncapi/server'

await generateAsyncFiles({
  input: asyncapi,
  output: './docs/asyncapi',
  groupBy: 'server',
  component: 'AsyncAPIPage',
})
```

Each MDX file simply renders `<AsyncAPIPage />` with the right document metadata.

### B. Use the Source API (virtual pages)

```ts
// source.asyncapi.ts
import { asyncapi } from '../lib/asyncapi'
import { asyncapiSource, asyncapiPlugin } from 'fumadocs-asyncapi/server'

export const AsyncAPISource = await asyncapiSource(asyncapi, {
  per: 'channel',
})

// inside your loader config
loader({
  source: AsyncAPISource,
  plugins: [asyncapiPlugin()],
})
```

The plugin injects direction badges (Publish/Subscribe) into the tree.

## 4. Client UI + WebSocket sidebar

`createAsyncAPIPage` now embeds the `WSClientProvider` and sidebar **per page**, so the WebSocket client only appears where the AsyncAPI reference is rendered.

```ts
// components/asyncapi-page.tsx
import { asyncapi } from '@/lib/asyncapi'
import { createAsyncAPIPage } from 'fumadocs-asyncapi'

export const AsyncAPIPage = createAsyncAPIPage(asyncapi, {
  generateCodeSamples: async (op) => [],
  client: {
    title: 'WebSocket Client',
    servers: async ({ document }) =>
      document.servers.map((server) => ({
        name: server.name,
        url: server.url,
      })),
  },
})
```

Use the `client` options to customise the WebSocket UI:

- `enabled` – disable the sidebar entirely.
- `servers` – provide a list or async factory for server targets.
- `renderSidebar`, `renderLayout`, `renderProvider` – override any part of the default UI while keeping it scoped to the AsyncAPI page.

> Tip: each page automatically provides a local `WSClientProvider`, but it only mounts when no ancestor provider is detected. Wrap your docs layout with `WSClientProvider` (exported from `fumadocs-asyncapi`) to keep the WebSocket connection alive across pages without touching the page configuration.

Operations rendered by `<AsyncAPIPage />` automatically expose “Load into WebSocket client” buttons that push example payloads to the sidebar.

### Persisting the WebSocket client across pages

By default, every AsyncAPI page renders its own provider through a `WSClientBoundary`. If your host app renders multiple AsyncAPI pages (for example, different routes under `/docs/asyncapi/*`), wrap the entire surface with `WSClientProvider` so the sidebar keeps the same connection and message log while navigating.

```tsx
// app/docs/asyncapi/layout.tsx (Next.js App Router example)
'use client'

import type { ReactNode } from 'react'
import { WSClientProvider } from 'fumadocs-asyncapi/client'

export default function AsyncAPIDocsLayout({ children }: { children: ReactNode }) {
  return <WSClientProvider>{children}</WSClientProvider>
}
```

If you already have a provider higher in the tree (for example, to feed your own WebSocket UI), the boundary detects it and skips mounting a second provider, so both single-page and shared layouts work without extra configuration.

## 5. Tailwind preset (no global CSS overrides)

Import the preset from your Tailwind entry so the host build can discover the component classes without pulling in another copy of Tailwind’s base styles:

```css
@import 'fumadocs-asyncapi/css/preset.css';
```

This file only registers the AsyncAPI sources via `@source`—it does not ship any resets or utilities, keeping your docs site’s CSS untouched.

## 6. Optional hooks

- `generateTypeScriptSchema` to emit TypeScript definitions alongside schemas.
- `schemaUI.render` for custom JSON schema components.
- `playground.render` to embed an inline playground instead of the global sidebar.

That’s it—run `bun run build` (or your preferred command), and your AsyncAPI reference should match the OpenAPI UX already provided by Fumadocs, complete with live WebSocket testing.\*\*\*
