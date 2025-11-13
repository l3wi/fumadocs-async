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
  SchemaInterface,
  ServerInterface,
  TagsInterface,
} from '@asyncapi/parser'

/**
 * Convert an AsyncAPI document into the shape used by the rest of the package.
 */
export function processDocument(
  document: AsyncAPIDocument
): ProcessedAsyncDocument {
  const channels: ChannelInfo[] = []
  const operations: OperationInfo[] = []

  const channelCollection = document.allChannels()
  for (const channel of channelCollection.all()) {
    const channelInfo: ChannelInfo = {
      name: channel.id() ?? channel.address() ?? channel.meta().pointer,
      description: channel.description() ?? undefined,
      tags: extractTagNamesFromJson(
        (channel.json() as { tags?: Array<{ name?: string }> }).tags
      ),
      operations: [],
    }

    const channelOperations = channel.operations()
    for (const operation of channelOperations.all()) {
      const operationInfo = mapOperation(operation, channelInfo.name)
      channelInfo.operations.push(operationInfo)
      operations.push(operationInfo)
    }

    channels.push(channelInfo)
  }

  const servers = document
    .allServers()
    .all()
    .map(mapServer)

  return {
    document,
    channels,
    operations,
    servers,
  }
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
