Here’s how Fumadocs’ OpenAPI integration works under the hood, and a concrete plan to build an AsyncAPI equivalent plus a WebSocket sidebar client.

---

## 1. How `fumadocs-openapi` operates

### 1.1. Server-side core (`createOpenAPI`)

The OpenAPI package is structured around a **server instance** created by `createOpenAPI` in `fumadocs-openapi/server`. That instance:

- Accepts an `input` option: an array of file paths / URLs, or a function that returns a map of schemas. ([Fumadocs][1])
- Exposes methods like:

  - `getSchemas(): Promise<ProcessedSchemaMap>` – parses & dereferences all OpenAPI docs. ([jsDelivr][2])
  - `createProxy()` – builds a Next.js route handler that proxies HTTP requests to the target API server, to avoid CORS for the **playground**. ([Fumadocs][3])

- Carries `options` such as:

  - `input?: string[] | () => SchemaMap | Promise<SchemaMap>`
  - `disableCache?: boolean`
  - `proxyUrl?: string` ([jsDelivr][2])

So **`createOpenAPI` is the single “source of truth”**: parsing, caching, proxying, and feeding both static file generation and runtime page rendering.

### 1.2. Static file generator (`generateFiles`)

`generateFiles` (from the root `fumadocs-openapi` export) takes:

- `input: OpenAPIServer` – the server instance created by `createOpenAPI`.
- `output: string` – folder for MDX content.
- Options like `per`, `groupBy`, `index`, `imports`, `name`, `frontmatter`, `addGeneratedComment`, etc. ([Fumadocs][4])

The pipeline roughly is:

1. **Resolve schemas** via `input.getSchemas()`.
2. **Extract operations/webhooks** via `SchemaToPagesOptions` (operation/tag/file/custom). ([Fumadocs][4])
3. **Build “output entries”** listing:

   - what type it is (`operation`/`webhook`),
   - which schema it came from,
   - human-friendly title/description.

4. **Write MDX files**:

   - Render a tiny MDX that:

     - sets frontmatter (`title`, `description`, `full: true`, `_openapi` metadata), ([Fumadocs][4])
     - embeds `<APIPage />` (or uses a Source plugin that injects props).

5. Optionally create **index pages** with cards linking into generated pages. ([Fumadocs][4])

The generator **does _not_ render the whole API UI**; that’s done later by the `<APIPage />` component. It just decides how operations/webhooks map to pages and paths. ([Fumadocs][4])

### 1.3. Fumadocs Source integration (`openapiPlugin`, `openapiSource`)

There’s a Source API integration in `dist/server/source-api.d.ts`: ([jsDelivr][5])

- `openapiPlugin(): LoaderPlugin`

  - Extends `PageData` to include an `_openapi` field (e.g. method info).
  - Adds badges / metadata to page tree.

- `openapiSource(openapi: OpenAPIServer, options?: SchemaToPagesOptions & { baseDir?: string })`

  - Generates **virtual pages** for Source API instead of writing MDX, and injects:

    - `getAPIPageProps: () => ApiPageProps` onto `PageData` so the UI can feed `<APIPage />`.

This is how you can build a docs site where the tree is generated from OpenAPI but you don’t pre-generate MDX files; Fumadocs’ `loader()` just sees a dynamic source. ([jsDelivr][5])

### 1.4. UI layer (`createAPIPage`, `<APIPage />`)

The UI entry point is `createAPIPage` from `fumadocs-openapi/ui/api-page`. ([Fumadocs][6])

Types show:

- `createAPIPage(server: OpenAPIServer, options?: CreateAPIPageOptions): FC<ApiPageProps>` ([jsDelivr][7])
- `ApiPageProps`:

  - `document: Promise<Document> | string | ProcessedDocument`
  - `operations?: OperationItem[]`
  - `webhooks?: WebhookItem[]` (with `path`, `method`, etc.) ([jsDelivr][7])

`CreateAPIPageOptions` lets you customise:

- Schema-related features:

  - `generateTypeScriptSchema` (per response + status code).
  - `schemaUI.render` and `schemaUI.showExample`. ([jsDelivr][7])

- Code examples:

  - `generateCodeSamples(method: MethodInformation)` (ties into `MethodInformation` from `types.d.ts`). ([Fumadocs][6])

- Page layout & slots:

  - `content.renderPageLayout`, `renderOperationLayout`, `renderAPIExampleLayout`, `renderResponseTabs`, etc., all receiving a `RenderContext`. ([jsDelivr][7])

- Playground:

  - `playground.enabled` and `playground.render(...)` to swap out the interactive client (e.g. for Scalar). ([jsDelivr][7])

- Client config:

  - `client?: APIPageClientOptions` to wire a `*.client.tsx` bundle. ([Fumadocs][6])

So the **architecture** is:

> OpenAPI specs → `createOpenAPI` (server) → `generateFiles` / `openapiSource` (page mapping) → `<APIPage />` (render operations) → optional playground / proxy.

That’s what we want to mirror for AsyncAPI.

---

## 2. Plan: AsyncAPI reference package for Fumadocs

Goal: Build a `fumadocs-asyncapi` style package that:

- Takes AsyncAPI YAML/JSON files.
- Produces docs pages (MDX or Source virtual pages).
- Renders a `<AsyncAPIPage />` component similar to `<APIPage />`.
- Integrates with the WebSocket sidebar client.

### 2.1. Core types & parser

Use the official JS parser: `@asyncapi/parser` which parses & validates AsyncAPI documents for both Node and browser. ([AsyncAPI][8])

AsyncAPI structure:

- `channels` map (topic/queue/WS channel) → operations (publish / subscribe). ([AsyncAPI][9])
- `components.messages` and `components.schemas` for reusable messages & payloads. ([AsyncAPI][10])
- `servers` map (e.g. WebSocket endpoints). ([AsyncAPI][9])

Define our own types module, similar to `dist/types.d.ts` in fumadocs-openapi: ([jsDelivr][11])

- `AsyncAPIDocument` (from parser’s interface).
- `ChannelInfo` – channel name + description + tags.
- `OperationInfo` – `{ channel, direction: 'publish' | 'subscribe', summary, description, messages[], bindings }`.
- `ServerInfo` – endpoint URL, protocol, bindings (e.g. websockets, kafka).

Also define a `RenderContextAsync` similar to `RenderContext`, but for AsyncAPI:

```ts
export interface AsyncRenderContext {
  document: AsyncAPIDocument;
  channels: ChannelInfo[];
  getServerUrl(serverName?: string): string | undefined;
  renderHeading(depth: number, text: string): ReactNode;
  renderMarkdown(text: string): ReactNode;
  renderCodeBlock(lang: string, code: string): ReactNode;
  // plus any WebSocket client hooks later, e.g. sendToSidebar(...)
}
```

### 2.2. Server instance: `createAsyncAPI`

Inspired by `createOpenAPI` in `dist/server/create.d.ts`, we build: ([jsDelivr][2])

```ts
// fumadocs-asyncapi/server
export interface AsyncAPIOptions {
  input?:
    | string[]
    | (() =>
        | Record<string, string | AsyncAPIDocument>
        | Promise<Record<string, string | AsyncAPIDocument>>);
  disableCache?: boolean;
  defaultServer?: string; // default AsyncAPI server name
}

export interface AsyncAPIServer {
  getSchemas(): Promise<Record<string, ProcessedAsyncDocument>>;
  readonly options: AsyncAPIOptions;
}

export function createAsyncAPI(options?: AsyncAPIOptions): AsyncAPIServer;
```

Implementation outline:

1. **Input resolution**

   - Resolve `input`:

     - If strings → load file/URL, detect YAML vs JSON.
     - If function → await and use its returned map.

2. **Parsing & validation**

   - Use `Parser.parse()` or `Parser.validate()` from `@asyncapi/parser`. ([GitHub][12])

3. **Processing**

   - Build `ProcessedAsyncDocument` with:

     - Flattened channels & operations.
     - Derived message examples & payload schemas.
     - Mapping from `(channel, direction)` → message definitions.

4. **Caching**

   - Key by file URL/path; skip re-parsing unless `disableCache` is `true`.

This server instance becomes the single entry point for everything else.

### 2.3. File generator: `generateAsyncFiles`

Mirror `generateFiles` from `fumadocs-openapi`, but for AsyncAPI. ([Fumadocs][4])

```ts
// fumadocs-asyncapi
export interface AsyncSchemaToPagesOptions {
  // similar to SchemaToPagesOptions, but for channels/operations
  per?: 'channel' | 'operation' | 'tag' | 'custom';
  groupBy?: 'server' | 'tag' | 'none';
  // extended for Async needs
}

export interface AsyncGenerateFilesConfig {
  input: AsyncAPIServer;
  output: string;
  index?: AsyncIndexConfig;
  beforeWrite?: (ctx: AsyncHookContext, files: OutputFile[]) => void | Promise<void>;
}

export type AsyncConfig = AsyncSchemaToPagesOptions & AsyncGenerateFilesConfig;

export async function generateAsyncFiles(options: AsyncConfig): Promise<void>;
export async function generateAsyncFilesOnly(...): Promise<...>;
```

Core logic:

1. For each `ProcessedAsyncDocument`:

   - Extract operations:

     - e.g. `(channel: "chat/{room}", direction: 'publish' | 'subscribe')`.

   - Build `OperationOutput` objects similar to `OperationOutput` in openapi. ([Fumadocs][4])

2. Apply `per`:

   - `per: 'channel'` → one MDX per channel (include both publish & subscribe).
   - `per: 'operation'` → one MDX per `(channel, direction)`.
   - `per: 'tag'` → group by tags attached to channels/operations.
   - `per: 'custom'` → callback receives extracted items and can create arbitrary pages.

3. Apply `groupBy`:

   - `server` → group pages by AsyncAPI server name.
   - `tag` → nested folder per tag.

4. Write MDX:

   - Frontmatter includes:

     ```yaml
     title: Chat: publish to /room
     description: Send chat messages
     full: true
     _asyncapi:
       channel: chat/{room}
       direction: publish
       server: production
     ```

   - Body typically just renders `<AsyncAPIPage />` or uses Source plugin (below).

Same extra features as OpenAPI’s generator:

- `index` to auto-generate landing pages with cards. ([Fumadocs][4])
- `imports` to inject shared imports (e.g. constants, helper components). ([Fumadocs][4])
- `name`, `frontmatter`, `addGeneratedComment`, etc.

### 2.4. Fumadocs Source plugin: `asyncapiPlugin` / `asyncapiSource`

Mirror `openapiPlugin` and `openapiSource` from `server/source-api.d.ts`. ([jsDelivr][5])

```ts
// fumadocs-asyncapi/server/source-api.ts
declare module "fumadocs-core/source" {
  interface PageData {
    _asyncapi?: {
      channel?: string;
      direction?: "publish" | "subscribe";
      server?: string;
    };
  }
}

export function asyncapiPlugin(): LoaderPlugin;

interface AsyncAPIPageData extends PageData {
  getAsyncAPIPageProps: () => AsyncAPIPageProps;
}

export async function asyncapiSource(
  asyncapi: AsyncAPIServer,
  options?: AsyncSchemaToPagesOptions & { baseDir?: string }
): Promise<AsyncAPIPageData[]>;
```

- `asyncapiPlugin`:

  - Adds `_asyncapi` metadata for badges in the tree (e.g. “WS publish”, “WS subscribe”).

- `asyncapiSource`:

  - Generates in-memory page entries and attaches `getAsyncAPIPageProps`, analogous to `getAPIPageProps` for OpenAPI. ([jsDelivr][5])

This allows:

- A dynamic docs tree purely generated from AsyncAPI.
- Or mixing AsyncAPI pages with other MDX/MD docs.

### 2.5. UI: `createAsyncAPIPage` + `<AsyncAPIPage />`

Mirror `createAPIPage` in `ui/api-page.d.ts`, but adapted to channels/messages. ([jsDelivr][7])

```ts
// fumadocs-asyncapi/ui/api-page.tsx
export interface AsyncCreatePageOptions {
  // message TypeScript types generation
  generateTypeScriptSchema?: (
    msg: AsyncMessageInfo,
    direction: "publish" | "subscribe"
  ) => Promise<string> | string | false;

  // code samples for message producers/consumers
  generateCodeSamples?: (
    op: AsyncOperationInfo
  ) => Promise<CodeSample[]> | CodeSample[];

  schemaUI?: {
    render?: (
      options: { root: ResolvedSchema },
      ctx: AsyncRenderContext
    ) => ReactNode | Promise<ReactNode>;
    showExample?: boolean;
  };

  content?: {
    renderPageLayout?: (
      slots: {
        channels?: { item: ChannelInfo; children: ReactNode }[];
      },
      ctx: AsyncRenderContext
    ) => ReactNode | Promise<ReactNode>;

    renderOperationLayout?: (
      slots: {
        header: ReactNode;
        messageSchema: ReactNode;
        examples: ReactNode;
        bindings: ReactNode;
        playground: ReactNode;
      },
      ctx: AsyncRenderContext,
      op: AsyncOperationInfo
    ) => ReactNode | Promise<ReactNode>;
  };

  playground?: {
    enabled?: boolean;
    // For embedding a central WebSocket playground instead of per-message
    render?: (props: {
      op: AsyncOperationInfo;
      ctx: AsyncRenderContext;
    }) => ReactNode | Promise<ReactNode>;
  };

  client?: AsyncAPIPageClientOptions; // for client-side hooks
}

export interface AsyncAPIPageProps {
  document: Promise<AsyncAPIDocument> | string | ProcessedAsyncDocument;
  operations?: AsyncOperationInfo[];
}

export function createAsyncAPIPage(
  server: AsyncAPIServer,
  options?: AsyncCreatePageOptions
): FC<AsyncAPIPageProps>;
```

Usage in a Fumadocs app mirrors OpenAPI docs: ([Fumadocs][1])

```ts
// lib/asyncapi.ts
import { createAsyncAPI } from "fumadocs-asyncapi/server";

export const asyncapi = createAsyncAPI({
  input: ["./asyncapi.yaml"],
  defaultServer: "production",
});

// components/asyncapi-page.tsx
import { asyncapi } from "@/lib/asyncapi";
import { createAsyncAPIPage } from "fumadocs-asyncapi/ui";
import client from "./asyncapi-page.client";

export const AsyncAPIPage = createAsyncAPIPage(asyncapi, {
  client,
  // custom layouts / code samples here
});
```

Add to MDX components the same way `<APIPage />` is added today.

---

## 3. WebSocket sidebar client design

Now the fun part: a **browser-side sidebar client** that talks to WebSocket servers described in the AsyncAPI file, and accepts messages “pushed” from each AsyncAPI reference page.

### 3.1. Desired UX

- Persistent **sidebar panel** (right or left) across all docs pages:

  - Connection section:

    - Select AsyncAPI server (from `servers` map).
    - Override URL if needed (env-specific).
    - Connect / disconnect button.
    - Connection status indicator.

  - Channel/message section:

    - Shows selected channel + operation (publish/subscribe).
    - A JSON editor with the current “draft message”.
    - “Send” / “Subscribe” buttons as appropriate.

  - Log section:

    - Outgoing messages (timestamp, channel, payload).
    - Incoming messages (channel, payload).

- On each AsyncAPI reference page:

  - “Open in WebSocket client” button.
  - Possibly a “Send example to client” button for each example payload.

### 3.2. Core architecture

**A. Global client context**

Use a React context/provider that lives in the docs layout, outside page content, so it persists across navigation:

```ts
interface WSMessage {
  id: string;
  direction: 'out' | 'in';
  channel: string;
  payload: unknown;
  timestamp: number;
}

interface WSClientState {
  url?: string;
  serverName?: string;
  connected: boolean;
  messages: WSMessage[];
  draft: { channel?: string; payload?: unknown };
}

interface WSClientApi {
  connect: (url: string) => void;
  disconnect: () => void;
  send: (channel: string, payload: unknown) => void;
  pushDraft: (draft: Partial<WSClientState['draft']>) => void;
  clearLog: () => void;
}

const WSClientContext = createContext<WSClientState & WSClientApi>(...);
```

Implementation uses the browser’s `WebSocket` API. On `message` events, append to `messages`. On `open`/`close`/`error`, update `connected` and maybe log meta-events.

**B. Sidebar UI component**

```tsx
// components/asyncapi-ws-sidebar.client.tsx
function AsyncAPIWSSidebar() {
  const {
    url,
    connected,
    serverName,
    messages,
    draft,
    connect,
    disconnect,
    send,
    pushDraft,
  } = useWSClient();

  // UI: URL select (from AsyncAPIServerInfo), Connect button, JSON editor, log list, etc.
}
```

This component is mounted in the docs layout (e.g. a Fumadocs layout slot).

**C. Bridge from docs pages to client**

Your `<AsyncAPIPage />` server component can:

- Pass down minimal metadata (channel, direction, default payload) into the client bundle.
- In the `*.client.tsx` side, call `pushDraft` when users click a “use in client” button.

Example client hook inside `asyncapi-page.client.tsx`:

```tsx
import { useWSClient } from "@/components/ws-client-context";

export default function AsyncAPIPageClientBridge(props: {
  op: AsyncOperationInfo;
}) {
  const { pushDraft } = useWSClient();

  const handleUseInClient = () => {
    pushDraft({
      channel: props.op.channel,
      payload: props.op.examplePayload ?? {},
    });
  };

  return (
    <button onClick={handleUseInClient}>Load into WebSocket client</button>
  );
}
```

Then wire this bridge via `AsyncCreatePageOptions.content` (e.g. include the button in `renderOperationLayout`).

### 3.3. Connecting to the right URL from AsyncAPI

AsyncAPI defines `servers` with URLs and protocols. ([AsyncAPI][9])

Plan:

1. When building `ProcessedAsyncDocument`, compute a list of candidate WebSocket servers:

   - Filter `servers` where protocol is `ws` or `wss` (and possibly protocols bound via WS bindings).

2. Expose from `AsyncAPIServer` a helper:

   ```ts
   getWebSocketServers(): ServerInfo[];
   ```

3. In the docs layout (server component), pass these into the client via props or a small JSON.
4. In the sidebar, show a `<select>` of servers:

   - Default to `options.defaultServer` or first available.
   - Allow overriding URL manually.

5. When user hits “Connect”, call `connect(selectedUrl)`.

If you want to enforce environment-specific URLs (e.g. staging vs prod), you can implement a mapping on the server side instead of using the literal URL from AsyncAPI.

### 3.4. Pushing messages from reference pages

Each operation page can define **template messages**:

- From AsyncAPI `examples` on `message.payload`. ([AsyncAPI][10])
- From custom `x-codeSamples`-like extensions, if you want symmetrical behaviour with OpenAPI. ([Fumadocs][6])

Implementation details:

- In `ProcessedAsyncDocument`, for each `(channel, direction)`:

  - Extract example payloads.
  - Optionally synthesise a default payload from the schema.

- In `<AsyncAPIPage />`, show:

  - “Example 1 JSON” (pretty-printed).
  - “Send to sidebar” button that calls `pushDraft({ channel, payload })`.

In the sidebar:

- When `draft.channel` / `draft.payload` change, update a JSON editor.
- Use `send(draft.channel, parsedDraftPayload)` when the user clicks Send.

On the wire, a basic WebSocket server typically doesn’t know about “channels”; you might embed `channel` in the message format. That mapping is up to your backend/protocol – the docs UI just gives you a consistent UI and uses AsyncAPI’s channel name to label messages.

### 3.5. Variants / options

Two main UX options:

1. **Sidebar-only client** (described above)

   - Pros: persistent, global log, single connection.
   - Cons: indirect (“send to sidebar” indirection).

2. **Inline-per-page playground**

   - Similar to OpenAPI’s `playground` option (e.g. `renderer.APIPlayground` pattern). ([jsDelivr][7])
   - AsyncAPIPage’s `playground.render` could render a scoped WebSocket client right under that operation.
   - Pros: super focused; each page has its own client.
   - Cons: multiple connections; no global view.

You can also support both: inline testers plus the global sidebar.

---

## 4. Implementation roadmap

A concrete step-by-step sequence:

### Phase 1 – AsyncAPI core

1. Add `fumadocs-asyncapi` package (mirroring repo structure of `openapi`).
2. Implement `createAsyncAPI` and its `AsyncAPIServer` interface using `@asyncapi/parser`. ([AsyncAPI][8])
3. Implement `ProcessedAsyncDocument` builder to:

   - Normalize channels, operations, messages, servers.
   - Extract examples and tags.

### Phase 2 – Docs integration

4. Implement `generateAsyncFiles` & `generateAsyncFilesOnly`, copying the general pattern from `generateFiles` (same config shape where possible). ([Fumadocs][4])
5. Implement `asyncapiPlugin` and `asyncapiSource` for Fumadocs Source API. ([jsDelivr][5])
6. Build `createAsyncAPIPage` + `<AsyncAPIPage />` UI:

   - Start with a simple layout (channels list + operations list + schema view).
   - Wire in `schemaUI`, `content`, `playground` extension points modelled after `CreateAPIPageOptions`. ([jsDelivr][7])

### Phase 3 – WebSocket client

7. Implement `WSClientContext` provider and sidebar UI.
8. Add bridging from `<AsyncAPIPage />` to the sidebar:

   - Provide a `useWSClient()` hook in client bundle.
   - Add “Send to client” buttons in `renderOperationLayout`.

9. Map AsyncAPI servers to WebSocket URLs and feed them into the sidebar.

### Phase 4 – Polishing & extras

10. Add:

    - Code sample generation hooks (SDK usage, CLI, etc.).
    - TypeScript payload generation from message schemas.
    - Better channel/tag grouping and index pages.

11. Integrate with existing Fumadocs styling (Tailwind preset) similar to `fumadocs-openapi/css/preset.css`. ([Fumadocs][1])

---

If you’d like, next step can be to sketch actual TypeScript/React code for:

- `createAsyncAPI` implementation (with `@asyncapi/parser`).
- A minimal `AsyncAPIPage` renderer for a simple AsyncAPI YAML.
- The WebSocket sidebar’s React components + context.

[1]: https://fumadocs.dev/docs/ui/openapi "OpenAPI | Fumadocs"
[2]: https://cdn.jsdelivr.net/npm/fumadocs-openapi%4010.0.6/dist/server/create.d.ts "cdn.jsdelivr.net"
[3]: https://fumadocs.dev/docs/ui/openapi/server?utm_source=chatgpt.com "createOpenAPI()"
[4]: https://fumadocs.dev/docs/ui/openapi/generate-files "generateFiles() | Fumadocs"
[5]: https://cdn.jsdelivr.net/npm/fumadocs-openapi%4010.0.6/dist/server/source-api.d.ts "cdn.jsdelivr.net"
[6]: https://fumadocs.dev/docs/ui/openapi/api-page "<APIPage /> | Fumadocs"
[7]: https://cdn.jsdelivr.net/npm/fumadocs-openapi%4010.0.6/dist/ui/api-page.d.ts "cdn.jsdelivr.net"
[8]: https://www.asyncapi.com/docs/tools/generator/parser?utm_source=chatgpt.com "Parser | AsyncAPI Initiative for event-driven APIs"
[9]: https://www.asyncapi.com/docs/concepts/asyncapi-document/structure?utm_source=chatgpt.com "AsyncAPI document structure"
[10]: https://www.asyncapi.com/docs/concepts/asyncapi-document/adding-messages?utm_source=chatgpt.com "Adding messages | AsyncAPI Initiative for event-driven APIs"
[11]: https://cdn.jsdelivr.net/npm/fumadocs-openapi%4010.0.6/dist/types.d.ts "cdn.jsdelivr.net"
[12]: https://github.com/asyncapi/parser-js?utm_source=chatgpt.com "AsyncAPI parser for Javascript (browser-compatible too)."
