import type {
  AsyncAPIPageProps,
  AsyncAPIDocument,
  AsyncAPIServer,
  AsyncCreatePageOptions,
  AsyncRenderContext,
  ChannelInfo,
  CodeSample,
  MessageInfo,
  OperationInfo,
  ProcessedAsyncDocument,
  ResolvedSchema,
  Awaitable,
} from '../types'
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

interface OperationBlock {
  channel: ChannelInfo
  operation: OperationInfo
  message?: MessageInfo
  codeSamples: CodeSample[]
  generatedSchema?: string | false
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

    return pageLayout
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

  if (options.content?.renderPageLayout) {
    return await options.content.renderPageLayout({ channels: channelSlots }, ctx)
  }

  return (
    <div className="asyncapi-page flex flex-col gap-24 text-sm">
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
          <div className="flex flex-col gap-8">{slot.children}</div>
        </section>
      ))}
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

  return <div className="flex flex-col gap-8">{operations}</div>
}

async function renderOperationBlock(
  block: OperationBlock,
  ctx: AsyncRenderContext,
  options: AsyncCreatePageOptions
) {
  const [schemaSection, descriptionNode] = await Promise.all([
    renderSchemaSection(block, ctx, options),
    block.operation.description
      ? resolveNode(ctx.renderMarkdown(block.operation.description))
      : Promise.resolve(null),
  ])
  const examplesSection = renderExamplesSection(block)
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

  const OperationActions = await getOperationActions()

  const header = (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
        <OperationBadge direction={block.operation.direction} />
        <span className="font-mono text-xs text-muted-foreground">
          {block.channel.name}
        </span>
        {tags.map((tag) => (
          <TagPill key={tag} label={tag} />
        ))}
      </div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <h3 className="text-xl font-semibold leading-tight">
            {getOperationTitle(block.operation)}
          </h3>
          {descriptionNode && (
            <div className="prose prose-sm text-muted-foreground">
              {descriptionNode}
            </div>
          )}
        </div>
        <OperationActions operation={block.operation} message={block.message} />
      </div>
    </div>
  )

  const leftSections = [playgroundSection, schemaSection, bindingsSection].filter(
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

  const leftColumn = (
    <div className="min-w-0 flex-1 space-y-4">{leftSections}</div>
  )

  const columns =
    secondarySections.length > 0 ? (
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:gap-8">
        {leftColumn}
        <div className="min-w-0 space-y-4 xl:w-80">{secondarySections}</div>
      </div>
    ) : (
      leftColumn
    )

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
      {columns}
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
      if (!matchesFilters(operation, props)) continue

      const message = operation.messages[0]
      const codeSamples = options.generateCodeSamples
        ? await Promise.resolve(options.generateCodeSamples(operation))
        : []

      const generatedSchema =
        options.generateTypeScriptSchema && message
          ? await Promise.resolve(
              options.generateTypeScriptSchema(message, operation.direction)
            )
          : undefined

      operations.push({
        channel,
        operation,
        message,
        codeSamples: codeSamples ?? [],
        generatedSchema,
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

function matchesFilters(operation: OperationInfo, props: AsyncAPIPageProps) {
  if (props.channel && props.channel !== operation.channel) {
    return false
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

async function resolveDocument(
  server: AsyncAPIServer,
  documentInput: AsyncAPIPageProps['document']
): Promise<ProcessedAsyncDocument> {
  if (typeof documentInput === 'string') {
    const schemas = await server.getSchemas()
    const resolved = schemas[documentInput]
    if (!resolved) {
      throw new Error(`AsyncAPI document "${documentInput}" not found.`)
    }
    return resolved
  }

  if (documentInput instanceof Promise) {
    return resolveDocument(server, await documentInput)
  }

  if (
    typeof documentInput === 'object' &&
    documentInput !== null &&
    Array.isArray((documentInput as ProcessedAsyncDocument).operations)
  ) {
    return documentInput as ProcessedAsyncDocument
  }

  if (
    typeof documentInput === 'object' &&
    documentInput !== null &&
    'allChannels' in (documentInput as AsyncAPIDocument)
  ) {
    throw new Error(
      'AsyncAPIPage cannot process raw AsyncAPI documents on the client. Preprocess the document on the server (e.g. via createAsyncAPI) and pass the resulting schema instead.'
    )
  }

  throw new Error('Invalid AsyncAPI document provided to <AsyncAPIPage />.')
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
  if (!block.message) {
    return (
      <SectionCard title="Message Schema">
        <p className="text-sm text-muted-foreground">
          No message schema available for this operation.
        </p>
      </SectionCard>
    )
  }

  const schemaContent = block.message.schema ?? block.message.payload
  let schemaNode: ReactNode | null = null

  if (options.schemaUI?.render && schemaContent) {
    const resolvedSchema: ResolvedSchema = { schema: schemaContent }
    schemaNode = await options.schemaUI.render({ root: resolvedSchema }, ctx)
  } else if (schemaContent) {
    schemaNode = (
      <pre className="overflow-auto rounded-lg bg-muted/70 p-3 font-mono text-xs">
        {formatJSON(schemaContent)}
      </pre>
    )
  }

  const tsNode =
    typeof block.generatedSchema === 'string' ? (
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          TypeScript
        </p>
        <pre className="overflow-auto rounded-lg bg-muted/70 p-3 font-mono text-xs">
          {block.generatedSchema}
        </pre>
      </div>
    ) : null

  if (!schemaNode && !tsNode) {
    schemaNode = (
      <p className="text-sm text-muted-foreground">
        Schema details are not provided for this message.
      </p>
    )
  }

  return (
    <SectionCard title="Message Schema">
      <div className="space-y-4">
        {schemaNode}
        {tsNode}
      </div>
    </SectionCard>
  )
}

function renderExamplesSection(block: OperationBlock) {
  if (!block.message?.examples?.length) return null

  return (
    <SectionCard title="Examples">
      <div className="flex flex-col gap-3">
        {block.message.examples.map((example, index) => (
          <pre
            key={index}
            className="overflow-auto rounded-lg bg-muted/70 p-3 font-mono text-xs"
          >
            {formatJSON(example)}
          </pre>
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
  if (!block.operation.bindings) return null

  return (
    <SectionCard title="Protocol Bindings">
      <pre className="overflow-auto rounded-lg bg-muted/70 p-3 font-mono text-xs">
        {formatJSON(block.operation.bindings)}
      </pre>
    </SectionCard>
  )
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
}

function SectionCard({ title, children, className }: SectionCardProps) {
  if (isEmptyNode(children)) return null

  return (
    <section
      className={cn(
        'rounded-xl border border-border bg-card/40 p-4 backdrop-blur supports-[backdrop-filter]:bg-card/30',
        className
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
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
