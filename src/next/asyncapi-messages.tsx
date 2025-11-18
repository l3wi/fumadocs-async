import type {
  AsyncAPIPageClientOptions,
  AsyncAPIPageProps,
  AsyncAPIServer,
  OperationInfo,
  ProcessedAsyncDocument,
  ChannelInfo,
} from '../types'
import { resolveAsyncAPIDocument } from '../utils/document'
import type { OperationCardRenderData } from '../ui/components/operation-card.types'
import type { ServerOption } from '../components/ws-client/types'
import { buildOperationCardRenderData } from '../ui/utils/operation-card'
import { resolveClientServers } from '../ui/utils/ws-client'

type AsyncAPIMessagesClientComponent = typeof import('../client').AsyncAPIMessagesClient

let cachedMessagesClient: AsyncAPIMessagesClientComponent | null = null

async function getAsyncAPIMessagesClient(): Promise<AsyncAPIMessagesClientComponent> {
  if (!cachedMessagesClient) {
    const { AsyncAPIMessagesClient } = await import('../client')
    cachedMessagesClient = AsyncAPIMessagesClient
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

  const channelMap = buildChannelLookup(processed.channels ?? [])
  const operationsData = relevant.map((operation) => {
    const channel = channelMap.get(operation.channel) ?? createFallbackChannel(operation)
    return buildOperationCardRenderData(channel, operation, {
      channelHref: channelHref
        ? () => channelHref(operation)
        : undefined,
    })
  })

  const wsClient = await resolveMessagesClientConfig(processed, client)
  const MessagesClient = await getAsyncAPIMessagesClient()

  return <MessagesClient operations={operationsData} client={wsClient ?? undefined} />
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

  const servers = await resolveClientServers(
    processed,
    client?.servers ?? undefined
  )
  return {
    title: client?.title,
    servers,
  }
}

function buildChannelLookup(channels: ChannelInfo[]): Map<string, ChannelInfo> {
  return new Map(channels.map((channel) => [channel.name, channel]))
}

function createFallbackChannel(operation: OperationInfo): ChannelInfo {
  return {
    name: operation.channel,
    description: undefined,
    tags: operation.tags,
    operations: [],
  }
}
