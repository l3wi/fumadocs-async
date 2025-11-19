import type {
  AsyncAPIPageProps,
  AsyncAPIDocument,
  AsyncCreatePageOptions,
  AsyncRenderContext,
  AsyncAPIPageClientOptions,
  ChannelInfo,
  MessageInfo,
  OperationInfo,
  ProcessedAsyncDocument,
  ResolvedSchema,
  Awaitable,
} from '../types'
import type { ServerOption } from '../components/ws-client'
import { OperationBadge } from './components/operation-badge'
import type { OperationCardRenderData } from './components/operation-card.types'
import {
  buildOperationCardRenderData,
  getOperationTitle,
} from './utils/operation-card'
import {
  buildChannelBlocks,
  type ChannelBlock,
  type OperationBlock,
  type OperationMessageBlock,
} from './utils/channel-blocks'
import {
  renderClientLayout,
  renderClientProvider,
  renderClientSidebar,
} from './utils/client-layout'
import { resolveClientServers } from './utils/ws-client'
import { getOperationAnchorId } from '../utils/anchors'
import { Fragment } from 'react'
import type { ReactNode, JSX } from 'react'
import { SectionCard } from './components/section-card'

type OperationCardComponent = typeof import('./components/operation-card.client').OperationCard
type OperationActionsComponent = typeof import('./components/operation-actions.client').OperationActions

let cachedOperationCard: OperationCardComponent | null = null
let cachedOperationActions: OperationActionsComponent | null = null

async function getOperationCard(): Promise<OperationCardComponent> {
  if (!cachedOperationCard) {
    cachedOperationCard = (await import('./components/operation-card.client')).OperationCard
  }
  return cachedOperationCard
}

async function getOperationActions(): Promise<OperationActionsComponent> {
  if (!cachedOperationActions) {
    cachedOperationActions = (await import('./components/operation-actions.client')).OperationActions
  }
  return cachedOperationActions
}

export function createAsyncAPIPage(
  options: AsyncCreatePageOptions = {}
) {
  const AsyncAPIPage = async (props: AsyncAPIPageProps) => {
    const processed = props.document
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

    const sidebarServers = await resolveClientServers(
      processed,
      clientOptions.servers,
      { getServerUrl: renderCtx.getServerUrl }
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

  if (options.content?.renderPageLayout) {
    return await options.content.renderPageLayout({ channels: channelSlots }, ctx)
  }

  return (
    <div className="asyncapi-page flex flex-col gap-16 text-sm">
      {channelSlots.map((slot, index) => (
        <div
          key={slot.item.name ?? index}
          id={`channel-${slot.item.name}`}
          className="asyncapi-channel flex flex-col gap-6"
        >
          <div className="flex flex-col gap-6">{slot.children}</div>
        </div>
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

  return (
    <div className="flex flex-col gap-6">
      {operations.map((operationNode, index) => {
        const source = block.operations[index]?.operation
        const operationKey =
          source?.operationId ??
          source?.id ??
          `${block.channel.name}-${source?.direction ?? 'unknown'}-${index}`

        return <Fragment key={operationKey}>{operationNode}</Fragment>
      })}
    </div>
  )
}

async function renderOperationBlock(
  block: OperationBlock,
  ctx: AsyncRenderContext,
  options: AsyncCreatePageOptions
) {
  if (options.content?.renderOperationLayout) {
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
            {renderChannelReference(block.channel, block.operation, options.channelHref)}
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

  const cardData = buildOperationCardRenderData(block.channel, block.operation, {
    channelHref: options.channelHref,
  })

  if (!cardData.messages.length && !cardData.replies.length) {
    return (
      <SectionCard title="Operation Details">
        <p className="text-sm text-muted-foreground">
          This operation does not define any messages or replies yet.
        </p>
      </SectionCard>
    )
  }

  const OperationCard = await getOperationCard()
  const operationAnchorId = getOperationAnchorId({
    operationId: block.operation.operationId ?? block.operation.id ?? cardData.id,
    id: cardData.id,
    title: cardData.title,
    channelName: cardData.channelName,
  })

  return <OperationCard operation={cardData} anchorId={operationAnchorId} />
}

function renderChannelReference(
  channel: ChannelInfo,
  operation: OperationInfo | undefined,
  resolver: AsyncCreatePageOptions['channelHref'] | undefined
): ReactNode {
  const label = channel?.name ?? 'Channel'
  if (!resolver) return label

  try {
    const href = resolver(channel, operation)
    if (!href) return label
    return (
      <a href={href} className="text-foreground transition hover:text-primary hover:underline">
        {label}
      </a>
    )
  } catch {
    return label
  }
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
