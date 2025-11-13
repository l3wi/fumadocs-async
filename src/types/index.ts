// Core types for fumadocs-asyncapi
import type { AsyncAPIDocumentInterface } from '@asyncapi/parser'
import type { ReactNode } from 'react'

// Re-export the parser's document type
export type AsyncAPIDocument = AsyncAPIDocumentInterface

// Server instance types
export interface AsyncAPIOptions {
  input?:
    | string[]
    | (() =>
        | Record<string, string | AsyncAPIDocument>
        | Promise<Record<string, string | AsyncAPIDocument>>)
  disableCache?: boolean
  defaultServer?: string
}

export interface AsyncAPIServer {
  getSchemas(): Promise<Record<string, ProcessedAsyncDocument>>
  readonly options: AsyncAPIOptions
}

// Processed document types
export interface ProcessedAsyncDocument {
  document: AsyncAPIDocument
  channels: ChannelInfo[]
  operations: OperationInfo[]
  servers: ServerInfo[]
}

export interface ChannelInfo {
  name: string
  description?: string
  tags?: string[]
  operations: OperationInfo[]
}

export interface OperationInfo {
  channel: string
  direction: 'publish' | 'subscribe'
  id?: string
  operationId?: string
  summary?: string
  description?: string
  messages: MessageInfo[]
  bindings?: Record<string, unknown>
  tags?: string[]
  servers?: string[]
}

export interface MessageInfo {
  name?: string
  title?: string
  description?: string
  payload?: unknown
  examples?: unknown[]
  schema?: unknown
}

export interface ServerInfo {
  name: string
  url: string
  protocol: string
  description?: string
  bindings?: Record<string, unknown>
}

// File generation types
export interface AsyncPageContext {
  document: ProcessedAsyncDocument
  channel: ChannelInfo
  operation?: OperationInfo
}

export interface AsyncSchemaToPagesOptions {
  per?: 'channel' | 'operation' | 'tag' | 'custom'
  groupBy?: 'server' | 'tag' | 'none'
  /**
   * Customise the page title.
   */
  name?: (ctx: AsyncPageContext) => string
  /**
   * Customise the page description.
   */
  description?: (ctx: AsyncPageContext) => string | undefined
  /**
   * Extend or override the generated frontmatter.
   */
  frontmatter?: (ctx: AsyncPageContext) => Record<string, unknown> | undefined
  /**
   * Extra imports appended to every generated file.
   */
  imports?: string | string[]
  /**
   * Name of the AsyncAPI page component rendered inside the MDX file.
   *
   * @defaultValue `AsyncAPIPage`
   */
  component?: string
  /**
   * Whether to include the "generated file" comment header.
   *
   * @defaultValue `true`
   */
  addGeneratedComment?: boolean
}

export interface AsyncGenerateFilesConfig {
  input: AsyncAPIServer
  output: string
  index?: AsyncIndexConfig
  beforeWrite?: (ctx: AsyncHookContext, files: OutputFile[]) => void | Promise<void>
}

export interface AsyncIndexConfig {
  /**
   * Generate index pages for each group
   */
  perGroup?: boolean
  /**
   * Generate a root index page
   */
  root?: boolean
}

export interface AsyncHookContext {
  document: ProcessedAsyncDocument
  operations: OperationInfo[]
}

export interface OutputFile {
  path: string
  content: string
}

export type AsyncConfig = AsyncSchemaToPagesOptions & AsyncGenerateFilesConfig

// UI types
export type Awaitable<T> = T | Promise<T>

export interface AsyncRenderContext {
  document: AsyncAPIDocument
  channels: ChannelInfo[]
  getServerUrl(serverName?: string): string | undefined
  renderHeading(depth: number, text: string): ReactNode
  renderMarkdown(text: string): Awaitable<ReactNode>
  renderCodeBlock(lang: string, code: string): Awaitable<ReactNode>
}

export interface AsyncAPIPageProps {
  document:
    | Promise<AsyncAPIDocument>
    | AsyncAPIDocument
    | string
    | ProcessedAsyncDocument
  operations?: OperationInfo[]
  channel?: string
  direction?: 'publish' | 'subscribe'
  operationId?: string
}

export interface AsyncCreatePageOptions {
  generateTypeScriptSchema?: (
    msg: MessageInfo,
    direction: 'publish' | 'subscribe'
  ) => Promise<string> | string | false

  generateCodeSamples?: (op: OperationInfo) => Promise<CodeSample[]> | CodeSample[]

  schemaUI?: {
    render?: (
      options: { root: ResolvedSchema },
      ctx: AsyncRenderContext
    ) => ReactNode | Promise<ReactNode>
    showExample?: boolean
  }

  content?: {
    renderPageLayout?: (
      slots: {
        channels?: { item: ChannelInfo; children: ReactNode }[]
      },
      ctx: AsyncRenderContext
    ) => ReactNode | Promise<ReactNode>

    renderOperationLayout?: (
      slots: {
        header: ReactNode
        messageSchema: ReactNode
        examples: ReactNode
        codeSamples: ReactNode
        bindings: ReactNode
        playground: ReactNode
      },
      ctx: AsyncRenderContext,
      op: OperationInfo
    ) => ReactNode | Promise<ReactNode>
  }

  playground?: {
    enabled?: boolean
    render?: (props: {
      op: OperationInfo
      ctx: AsyncRenderContext
    }) => ReactNode | Promise<ReactNode>
  }

  client?: AsyncAPIPageClientOptions
}

export interface AsyncAPIPageClientOptions {
  // Client-side configuration options
}

export interface CodeSample {
  lang: string
  label: string
  code: string
}

export interface ResolvedSchema {
  schema?: unknown
}
