import type {
  ChannelInfo,
  MessageInfo,
  OperationInfo,
  ProcessedAsyncDocument,
  ServerInfo,
  AsyncAPIDocument,
} from '../../types'
import type {
  ChannelInterface,
  MessageInterface,
  OperationInterface,
  OperationReplyInterface,
  OperationReplyAddressInterface,
  SchemaInterface,
  ServerInterface,
  TagsInterface,
} from '@asyncapi/parser'

const processedCache = new WeakMap<AsyncAPIDocument, ProcessedAsyncDocument>()

/**
 * Convert an AsyncAPI document into the shape used by the rest of the package.
 * Results are memoized per document instance to keep server + inline parsing consistent.
 */
export function processDocument(
  document: AsyncAPIDocument
): ProcessedAsyncDocument {
  const cached = processedCache.get(document)
  if (cached) {
    return cached
  }

  const channels: ChannelInfo[] = []
  const operations: OperationInfo[] = []
  const channelMap = new Map<string, ChannelInfo>()
  const seenOperationPointers = new Set<string>()

  const channelCollection = document.allChannels()
  for (const channel of channelCollection.all()) {
    const channelInfo = resolveChannelInfo(channel, channelMap, channels)
    const channelOperations = channel.operations()
    for (const operation of channelOperations.all()) {
      const pointer = operation.meta().pointer
      if (pointer) {
        seenOperationPointers.add(pointer)
      }
      const operationInfo = mapOperation(operation, channelInfo.name)
      channelInfo.operations.push(operationInfo)
      operations.push(operationInfo)
    }
  }

  const globalOperations = document.allOperations().all()
  for (const operation of globalOperations) {
    const pointer = operation.meta().pointer
    if (pointer && seenOperationPointers.has(pointer)) continue

    const opChannels = operation.channels().all()
    if (opChannels.length === 0) {
      const fallbackChannel = ensureChannelForOperation(
        operation,
        channelMap,
        channels
      )
      const operationInfo = mapOperation(operation, fallbackChannel.name)
      fallbackChannel.operations.push(operationInfo)
      operations.push(operationInfo)
      continue
    }

    for (const opChannel of opChannels) {
      const channelInfo = resolveChannelInfo(opChannel, channelMap, channels)
      const operationInfo = mapOperation(operation, channelInfo.name)
      channelInfo.operations.push(operationInfo)
      operations.push(operationInfo)
    }
  }

  const servers = document
    .allServers()
    .all()
    .map(mapServer)

  const components = mapComponents(document)

  const processed: ProcessedAsyncDocument = {
    document,
    channels,
    operations,
    servers,
    components,
  }

  processedCache.set(document, processed)
  return processed
}

function resolveChannelInfo(
  channel: ChannelInterface,
  map: Map<string, ChannelInfo>,
  list: ChannelInfo[]
): ChannelInfo {
  const name = channel.id() ?? channel.address() ?? channel.meta().pointer
  const existing = map.get(name)
  if (existing) return existing

  const info: ChannelInfo = {
    name,
    description: channel.description() ?? undefined,
    tags: extractTagNamesFromJson(
      (channel.json() as { tags?: Array<{ name?: string }> }).tags
    ),
    operations: [],
  }

  map.set(name, info)
  list.push(info)
  return info
}

function ensureChannelForOperation(
  operation: OperationInterface,
  map: Map<string, ChannelInfo>,
  list: ChannelInfo[]
): ChannelInfo {
  const fallbackName =
    operation.operationId() ??
    operation.id() ??
    `operation-${map.size + 1}`
  const existing = map.get(fallbackName)
  if (existing) return existing

  const info: ChannelInfo = {
    name: fallbackName,
    description: operation.summary() ?? operation.description() ?? undefined,
    tags: undefined,
    operations: [],
  }

  map.set(fallbackName, info)
  list.push(info)
  return info
}

function mapOperation(
  operation: OperationInterface,
  channelName: string
): OperationInfo {
  const summary = operation.summary()
  const description = operation.description()
  const id = operation.id()
  const operationId = operation.operationId()
  const raw = operation.json() as {
    bindings?: Record<string, unknown>
    tags?: Array<{ name?: string }>
  }
  const tags =
    extractTagNames(operation.tags()) ?? extractTagNamesFromJson(raw.tags)
  const servers = operation
    .servers()
    .all()
    .map((server) => server.id())

  const messages = operation
    .messages()
    .all()
    .map(mapMessage)

  const reply = mapOperationReply(operation.reply())

  return {
    channel: channelName,
    direction: mapDirection(operation.action()),
    id,
    operationId,
    summary: summary ?? operationId ?? id,
    description: description ?? undefined,
    messages,
    bindings: raw.bindings,
    tags,
    servers: servers.length ? servers : undefined,
    reply,
  }
}

function mapDirection(action: string): OperationInfo['direction'] {
  switch (action) {
    case 'receive':
    case 'subscribe':
      return 'subscribe'
    case 'send':
    case 'publish':
    default:
      return 'publish'
  }
}

function mapMessage(message: MessageInterface): MessageInfo {
  const schema = message.payload()
  const schemaJson = schema ? safeSchemaJson(schema) : undefined
  const messageJson = message.json() as {
    name?: string
    title?: string
    description?: string
    summary?: string
    examples?: unknown[]
    bindings?: Record<string, unknown>
  }

  const schemaExamples = schema?.examples?.()
  const examples = messageJson.examples ?? schemaExamples ?? undefined

  return {
    name: messageJson.name ?? message.name(),
    title: messageJson.title ?? message.title(),
    description:
      messageJson.description ?? messageJson.summary ?? message.summary(),
    payload: schemaJson,
    examples,
    schema: schemaJson,
    bindings: messageJson.bindings,
  }
}

function mapOperationReply(
  reply?: OperationReplyInterface
): OperationInfo['reply'] {
  if (!reply) return undefined

  const replyJson = reply.json() as { bindings?: Record<string, unknown> }
  const messages = reply
    .messages()
    .all()
    .map(mapMessage)

  const channel = reply.channel()
  const mappedChannel = channel ? mapReplyChannel(channel) : undefined
  const address = reply.address() ? mapReplyAddress(reply.address()) : undefined

  if (!mappedChannel && !address && messages.length === 0 && !replyJson.bindings) {
    return undefined
  }

  return {
    channel: mappedChannel,
    address,
    messages,
    bindings: replyJson.bindings,
  }
}

function mapReplyChannel(channel: ChannelInterface) {
  const raw = channel.json() as { bindings?: Record<string, unknown> }
  return {
    id: channel.id() ?? undefined,
    name: channel.id() ?? channel.address() ?? channel.meta().pointer,
    description: channel.description() ?? undefined,
    address: channel.address() ?? undefined,
    bindings: raw.bindings,
  }
}

function mapReplyAddress(address?: OperationReplyAddressInterface) {
  if (!address) return undefined
  return {
    location: address.location(),
    description: address.description() ?? undefined,
  }
}

function safeSchemaJson(schema: SchemaInterface): unknown {
  try {
    return schema.json()
  } catch {
    // Fall back to the best-effort representation when the schema contains cycles
    return schema.title?.() ?? 'Schema'
  }
}

function mapServer(server: ServerInterface): ServerInfo {
  const raw = server.json() as {
    bindings?: Record<string, unknown>
  }

  return {
    name: server.id(),
    url: server.url(),
    protocol: server.protocol(),
    description: server.description() ?? undefined,
    bindings: raw.bindings,
  }
}

function mapComponents(document: AsyncAPIDocument): Record<string, unknown> | undefined {
  const components = document.components()
  if (!components || components.isEmpty()) return undefined
  return components.json() as Record<string, unknown>
}

function extractTagNames(tags?: TagsInterface): string[] | undefined {
  if (!tags || tags.isEmpty()) return undefined
  const names = tags
    .all()
    .map((tag) => tag.name())
    .filter(Boolean)
  return names.length ? names : undefined
}

function extractTagNamesFromJson(
  tags?: Array<{ name?: string }>
): string[] | undefined {
  if (!tags || tags.length === 0) return undefined
  const names = tags.map((tag) => tag?.name).filter(Boolean) as string[]
  return names.length ? names : undefined
}
