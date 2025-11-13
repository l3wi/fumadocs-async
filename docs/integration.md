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

```ts
// components/asyncapi-page.tsx
import { asyncapi } from '@/lib/asyncapi'
import { createAsyncAPIPage } from 'fumadocs-asyncapi'

export const AsyncAPIPage = createAsyncAPIPage(asyncapi, {
  generateCodeSamples: async op => [],
})
```

Wrap your app layout with the WebSocket provider and mount the sidebar:

```tsx
import { WSClientProvider, WSSidebar } from 'fumadocs-asyncapi'

export default function RootLayout({ children }) {
  return (
    <WSClientProvider>
      <div className="flex">
        <main className="flex-1">{children}</main>
        <aside className="w-80">
          <WSSidebar servers={[{ name: 'Prod', url: 'wss://api.example.com' }]} />
        </aside>
      </div>
    </WSClientProvider>
  )
}
```

Operations rendered by `<AsyncAPIPage />` automatically expose “Load into WebSocket client” buttons that push example payloads to the sidebar.

## 5. Optional hooks

- `generateTypeScriptSchema` to emit TypeScript definitions alongside schemas.
- `schemaUI.render` for custom JSON schema components.
- `playground.render` to embed an inline playground instead of the global sidebar.

That’s it—run `bun run build` (or your preferred command), and your AsyncAPI reference should match the OpenAPI UX already provided by Fumadocs, complete with live WebSocket testing.\*\*\*
