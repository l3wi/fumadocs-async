import type {
  AsyncAPIPageClientOptions,
  AsyncAPIPageProps,
  AsyncAPIServer,
  OperationInfo,
  ProcessedAsyncDocument,
} from '../types'
import { resolveAsyncAPIDocument } from '../utils/document'
import { createMessageTabData } from '../ui/utils/message-tab'
import type {
  OperationCardRenderData,
  OperationTabData,
} from '../ui/components/operation-card.types'
import type { ServerOption } from '../components/ws-client/types'

type AsyncAPIMessagesClientComponent = typeof import('./asyncapi-messages.client').AsyncAPIMessagesClient

let cachedMessagesClient: AsyncAPIMessagesClientComponent | null = null

async function getAsyncAPIMessagesClient(): Promise<AsyncAPIMessagesClientComponent> {
  if (!cachedMessagesClient) {
    cachedMessagesClient = (await import('./asyncapi-messages.client')).AsyncAPIMessagesClient
  }
  return cachedMessagesClient
}

type AsyncAPIMessagesClientOptions = Pick<
  AsyncAPIPageClientOptions,
  'enabled' | 'title' | 'servers'
>

interface AsyncAPIMessagesPageProps {
  document: AsyncAPIPageProps['document']
  server?: AsyncAPIServer
  channelHref?: (operation: OperationInfo) => string | undefined
  tagHref?: (tag: string) => string | undefined
  client?: AsyncAPIMessagesClientOptions
}

export async function AsyncAPIMessagesPage({
  document,
  server,
  channelHref,
  tagHref,
  client,
}: AsyncAPIMessagesPageProps) {
  const processed = await resolveAsyncAPIDocument(document, server)
  const operations = processed.operations ?? []

  const relevant = operations.filter(
    (op) => (op.messages?.length ?? 0) > 0 || (op.reply?.messages?.length ?? 0) > 0
  )

  if (relevant.length === 0) {
    return (
      <div className="rounded border border-dashed border-border p-6 text-sm text-muted-foreground">
        No message payloads were detected for this AsyncAPI document.
      </div>
    )
  }

  const operationsData = relevant.map((operation) =>
    buildOperationCardData(operation, channelHref)
  )

  const wsClient = await resolveMessagesClientConfig(processed, client)
  const MessagesClient = await getAsyncAPIMessagesClient()

  return <MessagesClient operations={operationsData} client={wsClient ?? undefined} />
}

function buildOperationCardData(
  operation: OperationInfo,
  channelHref?: (operation: OperationInfo) => string | undefined
): OperationCardRenderData {
  const tags = operation.tags ?? []

  return {
    id: operation.operationId ?? operation.id ?? operation.channel,
    title: operation.summary || operation.operationId || operation.id || 'Operation',
    summary: operation.summary,
    description: operation.description,
    tags,
    direction: operation.direction,
    channelName: operation.channel,
    channelHref: channelHref?.(operation),
    tabs: buildOperationTabs(operation),
  }
}

function buildOperationTabs(operation: OperationInfo): OperationTabData[] {
  const tabs: OperationTabData[] = []

  const messages = operation.messages ?? []
  messages.forEach((message, index) => {
    tabs.push(createMessageTabData(message, 'message', index))
  })

  const replies = operation.reply?.messages ?? []
  replies.forEach((message, index) => {
    tabs.push(createMessageTabData(message, 'reply', index))
  })

  return tabs
}

interface MessagesClientConfig {
  title?: string
  servers: ServerOption[]
}

async function resolveMessagesClientConfig(
  processed: ProcessedAsyncDocument,
  client?: AsyncAPIMessagesClientOptions
): Promise<MessagesClientConfig | null> {
  const enabled = client?.enabled ?? true
  if (!enabled) {
    return null
  }

  const servers = await resolveClientServers(processed, client?.servers)
  return {
    title: client?.title,
    servers,
  }
}

async function resolveClientServers(
  processed: ProcessedAsyncDocument,
  option?: AsyncAPIPageClientOptions['servers']
): Promise<ServerOption[]> {
  if (Array.isArray(option)) {
    return option
  }

  if (typeof option === 'function') {
    const result = await option({ document: processed })
    return Array.isArray(result) ? result : []
  }

  return mapDocumentServers(processed)
}

function mapDocumentServers(processed: ProcessedAsyncDocument): ServerOption[] {
  if (!processed.servers?.length) return []

  return processed.servers
    .map((server) => {
      const url = server.url ?? getServerUrl(processed, server.name)
      if (!url) return null
      return {
        name: server.name ?? server.url ?? server.protocol ?? 'Server',
        url,
      }
    })
    .filter((server): server is ServerOption => Boolean(server))
}

function getServerUrl(processed: ProcessedAsyncDocument, serverName?: string) {
  if (!serverName) return processed.servers[0]?.url
  return processed.servers.find((server) => server.name === serverName)?.url
}

