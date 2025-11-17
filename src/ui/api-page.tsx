import type {
  AsyncAPIPageProps,
  AsyncAPIDocument,
  AsyncAPIServer,
  AsyncCreatePageOptions,
  AsyncRenderContext,
  AsyncAPIPageClientOptions,
  ChannelInfo,
  CodeSample,
  MessageInfo,
  OperationInfo,
  ProcessedAsyncDocument,
  ResolvedSchema,
  Awaitable,
  AsyncComponents,
} from '../types'
import { processDocument } from '../server/create/process-document'
import type { Parser as AsyncAPIParser } from '@asyncapi/parser'
import { WSClientProvider, WSSidebar } from '../components/ws-client'
import type { ServerOption } from '../components/ws-client'
import { OperationBadge } from './components/operation-badge'
import type { ReactNode, JSX } from 'react'

type OperationActionsComponent = typeof import('./components/operation-actions.client').OperationActions

let cachedOperationActions: OperationActionsComponent | null = null

async function getOperationActions(): Promise<OperationActionsComponent> {
  if (!cachedOperationActions) {
    cachedOperationActions = (await import('./components/operation-actions.client')).OperationActions
  }
  return cachedOperationActions
}

interface OperationMessageBlock {
  message: MessageInfo
  generatedSchema?: string | false
}

interface OperationBlock {
  channel: ChannelInfo
  operation: OperationInfo
  messages: OperationMessageBlock[]
  codeSamples: CodeSample[]
}

interface ChannelBlock {
  channel: ChannelInfo
  operations: OperationBlock[]
}

export function createAsyncAPIPage(
  server: AsyncAPIServer,
  options: AsyncCreatePageOptions = {}
) {
  const AsyncAPIPage = async (props: AsyncAPIPageProps) => {
    const processed = await resolveDocument(server, props.document)
    const renderCtx = createRenderContext(processed)
    const channelBlocks = await buildChannelBlocks(processed, options, props)

    if (channelBlocks.length === 0) {
      return (
        <div className="asyncapi-page space-y-4 rounded border border-dashed border-border p-6 text-sm text-muted-foreground">
          <p>No operations found for this AsyncAPI document.</p>
          <p>Try adjusting your filters or verify the document content.</p>
        </div>
      )
    }

    const pageLayout = await renderPageLayout(
      processed,
      channelBlocks,
      renderCtx,
      options
    )

    const clientOptions: AsyncAPIPageClientOptions = options.client ?? {}
    if (clientOptions.enabled === false) {
      return pageLayout
    }

    const sidebarServers = await resolveSidebarServers(
      clientOptions,
      processed,
      renderCtx
    )
    const sidebar = await renderClientSidebar(clientOptions, sidebarServers, renderCtx)

    if (!sidebar) {
      return pageLayout
    }

    const layout = await renderClientLayout(
      clientOptions,
      pageLayout,
      sidebar,
      renderCtx,
      sidebarServers
    )

    return renderClientProvider(clientOptions, layout, renderCtx, sidebarServers)
  }

  return AsyncAPIPage
}

async function renderPageLayout(
  processed: ProcessedAsyncDocument,
  channelBlocks: ChannelBlock[],
  ctx: AsyncRenderContext,
  options: AsyncCreatePageOptions
) {
  const channelSlots = await Promise.all(
    channelBlocks.map(async (block) => ({
      item: block.channel,
      children: await renderChannelBlock(block, ctx, options),
    }))
  )
  const componentsSection = renderComponentsOverview(processed.components)

  if (options.content?.renderPageLayout) {
    return await options.content.renderPageLayout({ channels: channelSlots }, ctx)
  }

  return (
    <div className="asyncapi-page flex flex-col gap-16 text-sm">
      {channelSlots.map((slot, index) => (
        <section
          key={slot.item.name ?? index}
          id={`channel-${slot.item.name}`}
          className="asyncapi-channel flex flex-col gap-6"
        >
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold">{slot.item.name}</h2>
            {slot.item.description && (
              <p className="text-base text-muted-foreground">{slot.item.description}</p>
            )}
          </div>
          <div className="flex flex-col gap-6">{slot.children}</div>
        </section>
      ))}
      {componentsSection}
    </div>
  )
}

async function renderChannelBlock(
  block: ChannelBlock,
  ctx: AsyncRenderContext,
  options: AsyncCreatePageOptions
) {
  const operations = await Promise.all(
    block.operations.map((operationBlock) =>
      renderOperationBlock(operationBlock, ctx, options)
    )
  )

  return <div className="flex flex-col gap-6">{operations}</div>
}

async function renderOperationBlock(
  block: OperationBlock,
  ctx: AsyncRenderContext,
  options: AsyncCreatePageOptions
) {
  const [schemaSection, descriptionNode, replySection] = await Promise.all([
    renderSchemaSection(block, ctx, options),
    block.operation.description
      ? resolveNode(ctx.renderMarkdown(block.operation.description))
      : Promise.resolve(null),
    renderReplySection(block, ctx, options),
  ])
  const examplesSection = await renderExamplesSection(block)
  const codeSamplesSection = renderCodeSamples(block)
  const bindingsSection = renderBindings(block)
  const playgroundContent =
    options.playground?.enabled === false
      ? null
      : options.playground?.render
      ? await options.playground.render({ op: block.operation, ctx })
      : null
  const playgroundSection = playgroundContent ? (
    <SectionCard title="Playground">{playgroundContent}</SectionCard>
  ) : null

  const tags = Array.from(
    new Set([...(block.channel.tags ?? []), ...(block.operation.tags ?? [])])
  )

  const header = (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-[6px] text-[11px] uppercase tracking-wide text-muted-foreground">
        <OperationBadge direction={block.operation.direction} />
        <span className="font-mono text-xs text-muted-foreground">
          {block.channel.name}
        </span>
        {tags.map((tag) => (
          <TagPill key={tag} label={tag} />
        ))}
      </div>
      <div className="min-w-0 space-y-1">
        <h3 className="text-xl font-semibold leading-tight">
          {getOperationTitle(block.operation)}
        </h3>
        {descriptionNode && (
          <div className="prose prose-sm text-muted-foreground">
            {descriptionNode}
          </div>
        )}
      </div>
    </div>
  )

  const leftSections = [playgroundSection, schemaSection, replySection, bindingsSection].filter(
    Boolean
  ) as ReactNode[]
  const secondarySections = [examplesSection, codeSamplesSection].filter(Boolean) as ReactNode[]

  if (leftSections.length === 0) {
    leftSections.push(
      <SectionCard key="details" title="Details">
        <p className="text-sm text-muted-foreground">
          No structured schema or bindings are available for this operation.
        </p>
      </SectionCard>
    )
  }

  const sections = [...leftSections, ...secondarySections]

  if (options.content?.renderOperationLayout) {
    return await options.content.renderOperationLayout(
      {
        header,
        messageSchema: schemaSection,
        examples: examplesSection,
        codeSamples: codeSamplesSection,
        bindings: bindingsSection,
        playground: playgroundSection,
      },
      ctx,
      block.operation
    )
  }

  return (
    <article className="asyncapi-operation space-y-6 rounded-2xl border border-border/60 bg-card/50 p-5 text-sm shadow-sm">
      {header}
      <div className="flex flex-col gap-4">{sections}</div>
    </article>
  )
}

async function buildChannelBlocks(
  processed: ProcessedAsyncDocument,
  options: AsyncCreatePageOptions,
  props: AsyncAPIPageProps
): Promise<ChannelBlock[]> {
  const blocks: ChannelBlock[] = []

  for (const channel of processed.channels) {
    const operations = []
    for (const operation of channel.operations) {
      if (!matchesFilters(operation, channel, props)) continue

      const codeSamples = options.generateCodeSamples
        ? await Promise.resolve(options.generateCodeSamples(operation))
        : []

      const messageBlocks: OperationMessageBlock[] = await Promise.all(
        operation.messages.map(async (message) => ({
          message,
          generatedSchema:
            options.generateTypeScriptSchema && message
              ? await Promise.resolve(
                  options.generateTypeScriptSchema(message, operation.direction)
                )
              : undefined,
        }))
      )

      operations.push({
        channel,
        operation,
        messages: messageBlocks,
        codeSamples: codeSamples ?? [],
      })
    }

    if (operations.length > 0) {
      blocks.push({
        channel,
        operations,
      })
    }
  }

  return blocks
}

function matchesFilters(
  operation: OperationInfo,
  channel: ChannelInfo,
  props: AsyncAPIPageProps
) {
  const channelFilters = normalizeFilterArray(props.channel)
  if (channelFilters.length > 0) {
    const candidates = new Set(getChannelFilterCandidates(channel, operation))
    const hasChannelMatch = channelFilters.some((filter) => candidates.has(filter))
    if (!hasChannelMatch) {
      return false
    }
  }

  const tagFilters = normalizeFilterArray(props.tags)
  if (tagFilters.length > 0) {
    const operationTags = new Set(
      (operation.tags ?? []).map((tag) => normalizeFilterValue(tag)).filter(Boolean)
    )
    const hasTagMatch = tagFilters.some((tag) => operationTags.has(tag))
    if (!hasTagMatch) {
      return false
    }
  }

  if (props.direction && props.direction !== operation.direction) {
    return false
  }

  if (props.operationId) {
    const id = operation.operationId ?? operation.id
    if (!id || id !== props.operationId) {
      return false
    }
  }

  return true
}

function getChannelFilterCandidates(channel: ChannelInfo, operation: OperationInfo): string[] {
  const values = [
    operation.channel,
    channel?.name,
    ...(channel?.tags ?? []),
    ...(operation.tags ?? []),
  ]

  return values
    .map((candidate) => normalizeFilterValue(candidate))
    .filter((candidate): candidate is string => Boolean(candidate))
}

function normalizeFilterArray(value?: string | string[]): string[] {
  if (!value) return []
  const values = Array.isArray(value) ? value : [value]
  return values
    .map((item) => normalizeFilterValue(item))
    .filter((item): item is string => Boolean(item))
}

function normalizeFilterValue(value?: string): string {
  if (!value) return ''
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

async function resolveDocument(
  server: AsyncAPIServer,
  documentInput: AsyncAPIPageProps['document']
): Promise<ProcessedAsyncDocument> {
  if (documentInput instanceof Promise) {
    return resolveDocument(server, await documentInput)
  }

  if (typeof documentInput === 'string') {
    const serverResult = await tryResolveServerDocument(server, documentInput)
    if (serverResult?.resolved) {
      return serverResult.resolved
    }

    const inlineSource = await tryLoadInlineSource(documentInput)
    if (inlineSource) {
      return parseAsyncAPISource(inlineSource.source, inlineSource.sourceName)
    }

    if (serverResult) {
      const available = serverResult.availableKeys.length
        ? `Available keys: ${serverResult.availableKeys.join(', ')}`
        : 'No AsyncAPI schemas are currently loaded.'
      throw new Error(`AsyncAPI document "${documentInput}" not found. ${available}`)
    }

    throw new Error(
      `Unable to resolve AsyncAPI document from string input. Provide a registered key or inline AsyncAPI schema content.`
    )
  }

  if (isProcessedDocument(documentInput)) {
    return documentInput
  }

  if (isAsyncAPIDocumentLike(documentInput)) {
    return processDocument(documentInput)
  }

  throw new Error('Unsupported AsyncAPI document type. Pass a key, schema string, AsyncAPIDocument, or processed document.')
}

interface ServerResolutionResult {
  resolved?: ProcessedAsyncDocument
  availableKeys: string[]
}

async function tryResolveServerDocument(
  server: AsyncAPIServer,
  key: string
): Promise<ServerResolutionResult | undefined> {
  if (!server || typeof server.getSchemas !== 'function') return undefined
  try {
    const schemas = await server.getSchemas()
    return {
      resolved: schemas[key],
      availableKeys: Object.keys(schemas),
    }
  } catch {
    return undefined
  }
}

interface InlineSourceResult {
  source: string
  sourceName: string
}

async function tryLoadInlineSource(value: string): Promise<InlineSourceResult | undefined> {
  const trimmed = value.trim()
  if (!trimmed) return undefined

  if (looksLikeInlineSpec(trimmed)) {
    return { source: value, sourceName: 'inline-asyncapi' }
  }

  if (isLikelyUrl(trimmed) && typeof fetch === 'function') {
    const response = await fetch(trimmed)
    if (!response.ok) {
      throw new Error(
        `Failed to fetch AsyncAPI document from "${trimmed}": ${response.status} ${response.statusText}`
      )
    }
    return { source: await response.text(), sourceName: trimmed }
  }

  return undefined
}

const PARSER_CONFIGURATION = {
  ruleset: {
    core: false,
    recommended: false,
    extends: [],
  },
} as const

let browserParserCtorPromise: Promise<typeof AsyncAPIParser> | null = null

async function getBrowserParserCtor(): Promise<typeof AsyncAPIParser> {
  if (!browserParserCtorPromise) {
    browserParserCtorPromise = import('@asyncapi/parser/browser').then((mod) => {
      const ctor = (mod as { default?: typeof AsyncAPIParser }).default ??
        (mod as { Parser?: typeof AsyncAPIParser }).Parser
      if (!ctor) {
        throw new Error('AsyncAPI parser (browser) bundle did not expose a constructor.')
      }
      return ctor
    })
  }
  return browserParserCtorPromise
}

async function parseAsyncAPISource(
  source: string,
  sourceName: string
): Promise<ProcessedAsyncDocument> {
  const ParserCtor = await getBrowserParserCtor()
  const parser = new ParserCtor(PARSER_CONFIGURATION)
  const { document, diagnostics } = await parser.parse(source, {
    source: sourceName,
    applyTraits: true,
  })

  const criticalDiagnostics = (diagnostics ?? []).filter((diag) => diag.severity === 0)
  if (criticalDiagnostics.length > 0) {
    const formatted = formatDiagnostics(criticalDiagnostics)
    throw new Error(`Failed to parse AsyncAPI document "${sourceName}":\n${formatted}`)
  }

  if (!document) {
    throw new Error(`AsyncAPI parser did not return a document for "${sourceName}".`)
  }

  return processDocument(document)
}

function formatDiagnostics(
  diagnostics: Array<{ message: string; path?: Array<string | number> }>
): string {
  return diagnostics
    .map((diag) => {
      const path = diag.path?.length ? diag.path.map(String).join('.') : undefined
      return `${diag.message}${path ? ` at ${path}` : ''}`
    })
    .join('\n')
}

function isProcessedDocument(value: unknown): value is ProcessedAsyncDocument {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as ProcessedAsyncDocument).operations)
  )
}

function isAsyncAPIDocumentLike(value: unknown): value is AsyncAPIDocument {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as AsyncAPIDocument).allChannels === 'function'
  )
}

function looksLikeInlineSpec(value: string): boolean {
  if (!value) return false
  return value.startsWith('{') || value.startsWith('asyncapi:') || value.includes('\n')
}

function isLikelyUrl(value: string): boolean {
  return value.startsWith('http://') || value.startsWith('https://')
}

function createRenderContext(processed: ProcessedAsyncDocument): AsyncRenderContext {
  return {
    document: processed.document,
    channels: processed.channels,
    getServerUrl(serverName?: string) {
      if (!serverName) return processed.servers[0]?.url
      return processed.servers.find((server) => server.name === serverName)?.url
    },
    renderHeading(depth: number, text: string) {
      const Heading = (`h${Math.min(depth, 6)}` as keyof JSX.IntrinsicElements)
      return <Heading>{text}</Heading>
    },
    renderMarkdown(text: string) {
      return <p>{text}</p>
    },
    renderCodeBlock(_lang: string, code: string) {
      return (
        <pre className="overflow-auto rounded bg-muted p-3 text-xs">
          <code>{code}</code>
        </pre>
      )
    },
  }
}

async function renderSchemaSection(
  block: OperationBlock,
  ctx: AsyncRenderContext,
  options: AsyncCreatePageOptions
) {
  if (!block.messages.length) {
    return (
      <SectionCard title="Message Schema">
        <p className="text-sm text-muted-foreground">
          No message schema available for this operation.
        </p>
      </SectionCard>
    )
  }

  const OperationActions = await getOperationActions()
  const cards = await Promise.all(
    block.messages.map(async ({ message, generatedSchema }, index) => {
      const label = formatMessageLabel(message, index, block.messages.length)
      const schemaNode = await renderSchemaContentForMessage(
        message,
        label,
        ctx,
        options,
        generatedSchema
      )

      return (
        <div
          key={`${label}-${index}`}
          className="space-y-3 rounded-lg border border-border/50 bg-card/40 p-4"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-semibold leading-tight">{label}</p>
              {message.description && (
                <p className="text-xs text-muted-foreground">{message.description}</p>
              )}
            </div>
            <OperationActions
              operation={block.operation}
              message={message}
              className="w-auto whitespace-nowrap"
            />
          </div>
          {schemaNode}
        </div>
      )
    })
  )

  return (
    <SectionCard title={block.messages.length > 1 ? 'Message Schemas' : 'Message Schema'}>
      <div className="space-y-4">{cards}</div>
    </SectionCard>
  )
}

async function renderExamplesSection(block: OperationBlock) {
  const entries = block.messages
    .map(({ message }, index) => ({ message, index }))
    .filter(({ message }) => message.examples && message.examples.length)

  if (!entries.length) return null

  return (
    <SectionCard title="Examples">
      <div className="space-y-4">
        {entries.map(({ message, index }) => (
          <div key={`${formatMessageLabel(message, index, block.messages.length)}-examples`} className="space-y-2">
            {block.messages.length > 1 && (
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {formatMessageLabel(message, index, block.messages.length)}
              </p>
            )}
            <div className="flex flex-col gap-3">
              {message.examples?.map((example, exampleIndex) => (
                <pre
                  key={exampleIndex}
                  className="overflow-auto rounded-lg bg-muted/70 p-3 font-mono text-xs"
                >
                  {formatJSON(example)}
                </pre>
              ))}
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  )
}

function renderCodeSamples(block: OperationBlock) {
  if (!block.codeSamples.length) return null

  return (
    <SectionCard title="Code Samples">
      <div className="space-y-3">
        {block.codeSamples.map((sample) => (
          <div key={`${sample.lang}-${sample.label}`} className="space-y-1">
            <p className="text-xs text-muted-foreground">
              {sample.label} · {sample.lang}
            </p>
            <pre className="overflow-auto rounded-lg bg-muted/70 p-3 font-mono text-xs">
              {sample.code}
            </pre>
          </div>
        ))}
      </div>
    </SectionCard>
  )
}

function renderBindings(block: OperationBlock) {
  const sections: ReactNode[] = []

  if (block.operation.bindings) {
    sections.push(
      <div key="operation" className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Operation
        </p>
        <pre className="overflow-auto rounded-lg bg-muted/70 p-3 font-mono text-xs">
          {formatJSON(block.operation.bindings)}
        </pre>
      </div>
    )
  }

  block.messages.forEach(({ message }, index) => {
    if (!message.bindings) return
    sections.push(
      <div key={`message-${index}`} className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {formatMessageLabel(message, index, block.messages.length)}
        </p>
        <pre className="overflow-auto rounded-lg bg-muted/70 p-3 font-mono text-xs">
          {formatJSON(message.bindings)}
        </pre>
      </div>
    )
  })

  if (!sections.length) return null

  return (
    <SectionCard title="Protocol Bindings">
      <div className="space-y-3">{sections}</div>
    </SectionCard>
  )
}

async function renderReplySection(
  block: OperationBlock,
  ctx: AsyncRenderContext,
  options: AsyncCreatePageOptions
) {
  const reply = block.operation.reply
  if (!reply) return null

  const sections: ReactNode[] = []

  if (reply.address) {
    sections.push(
      <div key="reply-address" className="space-y-1 text-sm text-muted-foreground">
        <p className="text-xs font-semibold uppercase tracking-wide">Reply Address</p>
        <p className="font-mono text-xs sm:text-sm">{reply.address.location}</p>
        {reply.address.description && <p className="text-xs">{reply.address.description}</p>}
      </div>
    )
  }

  if (reply.channel) {
    sections.push(
      <div key="reply-channel" className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Reply Channel
        </p>
        <div className="space-y-1 text-sm text-muted-foreground">
          {(reply.channel.name || reply.channel.id) && (
            <p className="font-medium text-foreground">
              {reply.channel.name ?? reply.channel.id}
            </p>
          )}
          {reply.channel.address && (
            <p>
              Address: <span className="font-mono text-xs">{reply.channel.address}</span>
            </p>
          )}
          {reply.channel.description && <p>{reply.channel.description}</p>}
        </div>
        {reply.channel.bindings && (
          <pre className="overflow-auto rounded-lg bg-muted/70 p-3 font-mono text-xs">
            {formatJSON(reply.channel.bindings)}
          </pre>
        )}
      </div>
    )
  }

  if (reply.bindings) {
    sections.push(
      <div key="reply-bindings" className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Reply Bindings
        </p>
        <pre className="overflow-auto rounded-lg bg-muted/70 p-3 font-mono text-xs">
          {formatJSON(reply.bindings)}
        </pre>
      </div>
    )
  }

  if (reply.messages.length) {
    const replyMessages = await Promise.all(
      reply.messages.map(async (message, index) => {
        const label = formatMessageLabel(message, index, reply.messages.length)
        const schemaNode = await renderSchemaContentForMessage(message, label, ctx, options)

        return (
          <div
            key={`${label}-${index}`}
            className="space-y-3 rounded-lg border border-border/40 bg-background/50 p-4"
          >
            <div className="space-y-1">
              <p className="text-sm font-semibold leading-tight">{label}</p>
              {message.description && (
                <p className="text-xs text-muted-foreground">{message.description}</p>
              )}
            </div>
            {schemaNode}
          </div>
        )
      })
    )

    sections.push(
      <div key="reply-messages" className="space-y-3">
        <p className="text-sm font-semibold text-muted-foreground">Expected Reply Messages</p>
        <div className="space-y-3">{replyMessages}</div>
      </div>
    )
  }

  if (!sections.length) return null

  return (
    <SectionCard title="Reply Details">
      <div className="space-y-4">{sections}</div>
    </SectionCard>
  )
}

async function renderSchemaContentForMessage(
  message: MessageInfo,
  label: string,
  ctx: AsyncRenderContext,
  options: AsyncCreatePageOptions,
  generatedSchema?: string | false
): Promise<ReactNode> {
  const schemaContent = message.schema ?? message.payload
  let schemaNode: ReactNode | null = null
  const schemaEntries =
    schemaContent && typeof schemaContent === 'object'
      ? buildSchemaEntries(schemaContent)
      : []

  if (options.schemaUI?.render && schemaContent) {
    const resolvedSchema: ResolvedSchema = { schema: schemaContent }
    schemaNode = await options.schemaUI.render({ root: resolvedSchema }, ctx)
  } else if (schemaEntries.length > 0) {
    schemaNode = <SchemaFields entries={schemaEntries} />
  } else if (schemaContent) {
    schemaNode = (
      <pre className="overflow-auto rounded-lg bg-muted/70 p-3 font-mono text-xs">
        {formatJSON(schemaContent)}
      </pre>
    )
  }

  const tsNode =
    typeof generatedSchema === 'string' ? (
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          TypeScript
        </p>
        <pre className="overflow-auto rounded-lg bg-muted/70 p-3 font-mono text-xs">
          {generatedSchema}
        </pre>
      </div>
    ) : null

  if (!schemaNode && !tsNode) {
    schemaNode = (
      <p className="text-sm text-muted-foreground">
        Schema details are not provided for {label.toLowerCase()}.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {schemaNode}
      {tsNode}
    </div>
  )
}

function formatMessageLabel(message: MessageInfo, index: number, total: number) {
  if (message.title) return message.title
  if (message.name) return message.name
  if (total > 1) return `Message ${index + 1}`
  return 'Message'
}

function renderComponentsOverview(components?: AsyncComponents) {
  if (!components) return null
  const entries = Object.entries(components).filter(([, value]) => hasComponentEntries(value))
  if (entries.length === 0) return null

  return (
    <section className="asyncapi-components flex flex-col gap-6" id="asyncapi-components">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">Components</h2>
        <p className="text-base text-muted-foreground">
          Reusable schemas, messages, bindings, and traits shared across channels.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {entries.map(([group, value]) => (
          <SectionCard key={group} title={formatComponentTitle(group)}>
            <ComponentEntries value={value} />
          </SectionCard>
        ))}
      </div>
    </section>
  )
}

function SchemaFields({ entries }: { entries: SchemaFieldEntry[] }) {
  return (
    <div className="space-y-3">
      {entries.map((entry) => (
        <div
          key={entry.path}
          className="rounded-lg border border-border/70 bg-background/70 p-3 text-sm shadow-sm"
        >
          <div className="flex items-baseline justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1 font-mono text-sm font-semibold">
              <span>{entry.label}</span>
              {!entry.required && <span className="text-xs text-muted-foreground">?</span>}
            </div>
            <span className="text-xs text-muted-foreground">{entry.type}</span>
          </div>
          {entry.description && (
            <p className="mt-1 text-sm text-muted-foreground">{entry.description}</p>
          )}
          {entry.children && entry.children.length > 0 && (
            <div className="mt-3 space-y-3 border-l border-border/60 pl-3">
              <SchemaFields entries={entry.children} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function ComponentEntries({ value }: { value: unknown }) {
  if (!value || typeof value !== 'object') {
    return (
      <pre className="overflow-auto rounded bg-muted/70 p-3 font-mono text-xs">
        {formatJSON(value)}
      </pre>
    )
  }

  const record = value as Record<string, unknown>
  const entries = Object.entries(record)
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">No entries defined.</p>
  }

  return (
    <div className="space-y-3">
      {entries.map(([name, definition]) => (
        <div key={name} className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {name}
          </p>
          <pre className="overflow-auto rounded bg-muted/70 p-3 font-mono text-xs">
            {formatJSON(definition)}
          </pre>
        </div>
      ))}
    </div>
  )
}

function hasComponentEntries(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (typeof value !== 'object') return true
  return Object.keys(value as Record<string, unknown>).length > 0
}

function formatComponentTitle(key: string): string {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!spaced) return 'Component'
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

interface SchemaFieldEntry {
  label: string
  type: string
  description?: string
  required?: boolean
  children?: SchemaFieldEntry[]
  path: string
}

function buildSchemaEntries(schema: unknown, path = 'payload'): SchemaFieldEntry[] {
  if (!isSchemaObject(schema)) {
    return []
  }

  const schemaObject = normalizeSchema(schema)

  if (schemaObject.properties && typeof schemaObject.properties === 'object') {
    const required = Array.isArray(schemaObject.required) ? schemaObject.required : []
    return Object.entries(schemaObject.properties).map(([name, definition]) => {
      const defObject = normalizeSchema(definition)
      const entryPath = `${path}.${name}`
      return {
        label: name,
        type: describeSchemaType(defObject),
        description: getSchemaDescription(defObject),
        required: required.includes(name),
        children: collectChildEntries(defObject, entryPath),
        path: entryPath,
      }
    })
  }

  if (isArraySchema(schemaObject)) {
    const child = normalizeSchema(schemaObject.items)
    const entryPath = `${path}[]`
    const label = typeof schemaObject.title === 'string' ? schemaObject.title : path
    return [
      {
        label,
        type: `${describeSchemaType(child)}[]`,
        description: getSchemaDescription(schemaObject),
        required: true,
        children: collectChildEntries(child, entryPath),
        path: entryPath,
      },
    ]
  }

  if (path === 'payload') {
    const label = typeof schemaObject.title === 'string' ? schemaObject.title : path
    return [
      {
        label,
        type: describeSchemaType(schemaObject),
        description: getSchemaDescription(schemaObject),
        required: true,
        path,
      },
    ]
  }

  return []
}

function collectChildEntries(schema: Record<string, unknown>, path: string): SchemaFieldEntry[] | undefined {
  if (schema.properties || schema.type === 'object') {
    const entries = buildSchemaEntries(schema, path)
    return entries.length > 0 ? entries : undefined
  }

  if (isArraySchema(schema)) {
    const child = normalizeSchema(schema.items)
    const entries = buildSchemaEntries(child, `${path}[]`)
    return entries.length > 0 ? entries : undefined
  }

  return undefined
}

function normalizeSchema(value: unknown): Record<string, unknown> {
  return (value ?? {}) as Record<string, unknown>
}

function isArraySchema(schema: Record<string, unknown>): schema is Record<string, unknown> & { items?: unknown } {
  return schema.type === 'array' && typeof schema.items !== 'undefined'
}

function isSchemaObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function describeSchemaType(schema: Record<string, unknown>): string {
  const type = schema.type
  if (type === 'array') {
    const inner = normalizeSchema(schema.items)
    return `${describeSchemaType(inner)}[]`
  }

  if (type === 'object' || schema.properties) {
    return 'object'
  }

  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    return schema.enum.map((value) => JSON.stringify(value)).join(' | ')
  }

  if (Array.isArray(schema.anyOf) && schema.anyOf.length > 0) {
    return schema.anyOf
      .map((sub) => describeSchemaType(normalizeSchema(sub)))
      .join(' | ')
  }

  if (typeof type === 'string') return type
  return 'value'
}

function getSchemaDescription(schema: Record<string, unknown>): string | undefined {
  if (typeof schema.description === 'string') return schema.description
  if (typeof schema.summary === 'string') return schema.summary
  return undefined
}

function getOperationTitle(operation: OperationInfo) {
  if (operation.summary) return operation.summary
  if (operation.operationId) return operation.operationId
  const action = operation.direction === 'publish' ? 'Publish' : 'Subscribe'
  return `${action} ${operation.channel}`
}

function formatJSON(value: unknown) {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function resolveNode<T>(value: Awaitable<T>): Promise<T> {
  return Promise.resolve(value)
}

function TagPill({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      {label}
    </span>
  )
}

interface SectionCardProps {
  title: string
  children?: ReactNode
  className?: string
  titleSuffix?: ReactNode
}

function SectionCard({ title, children, className, titleSuffix }: SectionCardProps) {
  if (isEmptyNode(children)) return null

  return (
    <section
      className={cn(
        'rounded-xl border border-border bg-card/40 p-4 backdrop-blur supports-[backdrop-filter]:bg-card/30',
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </p>
        {titleSuffix}
      </div>
      <div className="mt-3 text-sm text-foreground">{children}</div>
    </section>
  )
}

function isEmptyNode(node: ReactNode | null | undefined): boolean {
  if (node === null || node === undefined || node === false) return true
  if (Array.isArray(node)) {
    return node.every((child) => isEmptyNode(child))
  }
  return false
}

function cn(...classes: Array<string | undefined | null | false>) {
  return classes.filter(Boolean).join(' ')
}

async function resolveSidebarServers(
  clientOptions: AsyncAPIPageClientOptions,
  processed: ProcessedAsyncDocument,
  ctx: AsyncRenderContext
): Promise<ServerOption[]> {
  if (Array.isArray(clientOptions.servers)) {
    return clientOptions.servers
  }

  if (typeof clientOptions.servers === 'function') {
    const result = await clientOptions.servers({ document: processed })
    return Array.isArray(result) ? result : []
  }

  return mapDocumentServers(processed, ctx)
}

function mapDocumentServers(
  processed: ProcessedAsyncDocument,
  ctx: AsyncRenderContext
): ServerOption[] {
  if (!processed.servers?.length) return []

  return processed.servers
    .map((server) => {
      const url = server.url ?? ctx.getServerUrl(server.name)
      if (!url) return null
      return {
        name: server.name ?? server.url ?? server.protocol ?? 'Server',
        url,
      }
    })
    .filter((server): server is ServerOption => server !== null)
}

async function renderClientSidebar(
  clientOptions: AsyncAPIPageClientOptions,
  servers: ServerOption[],
  ctx: AsyncRenderContext
): Promise<ReactNode | null> {
  if (clientOptions.renderSidebar) {
    const custom = await clientOptions.renderSidebar({ servers, ctx })
    if (custom !== undefined) {
      return custom
    }
  }

  return <WSSidebar title={clientOptions.title ?? 'WebSocket Client'} servers={servers} />
}

async function renderClientLayout(
  clientOptions: AsyncAPIPageClientOptions,
  content: ReactNode,
  sidebar: ReactNode,
  ctx: AsyncRenderContext,
  servers: ServerOption[]
): Promise<ReactNode> {
  if (clientOptions.renderLayout) {
    return clientOptions.renderLayout({ content, sidebar, ctx, servers })
  }

  return (
    <div className="asyncapi-shell flex flex-col gap-8 xl:grid xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start xl:gap-10">
      <div className="asyncapi-shell-content min-w-0 flex-1">{content}</div>
      <aside className="asyncapi-shell-sidebar w-full xl:max-w-sm xl:justify-self-end xl:self-stretch">
        <div className="h-full">{sidebar}</div>
      </aside>
    </div>
  )
}

async function renderClientProvider(
  clientOptions: AsyncAPIPageClientOptions,
  children: ReactNode,
  ctx: AsyncRenderContext,
  servers: ServerOption[]
): Promise<ReactNode> {
  if (clientOptions.renderProvider) {
    return clientOptions.renderProvider({ children, ctx, servers })
  }

  return <WSClientProvider>{children}</WSClientProvider>
}
