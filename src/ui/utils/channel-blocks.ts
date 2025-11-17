import type {
  AsyncAPIPageProps,
  AsyncCreatePageOptions,
  ChannelInfo,
  CodeSample,
  MessageInfo,
  OperationInfo,
  ProcessedAsyncDocument,
} from '../../types'

export interface OperationMessageBlock {
  message: MessageInfo
  generatedSchema?: string | false
}

export interface OperationBlock {
  channel: ChannelInfo
  operation: OperationInfo
  messages: OperationMessageBlock[]
  codeSamples: CodeSample[]
}

export interface ChannelBlock {
  channel: ChannelInfo
  operations: OperationBlock[]
}

export async function buildChannelBlocks(
  processed: ProcessedAsyncDocument,
  options: AsyncCreatePageOptions,
  props: AsyncAPIPageProps
): Promise<ChannelBlock[]> {
  const blocks: ChannelBlock[] = []

  for (const channel of processed.channels) {
    const operations: OperationBlock[] = []
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
  if (channelFilters.length && !matchesChannel(channel, channelFilters)) {
    return false
  }

  const directionFilters = normalizeFilterArray(props.direction)
  if (
    directionFilters.length &&
    !directionFilters.includes(operation.direction)
  ) {
    return false
  }

  const operationFilters = normalizeFilterArray(props.operationId)
  if (
    operationFilters.length &&
    !matchesOperation(operation, operationFilters)
  ) {
    return false
  }

  const tagFilters = normalizeFilterArray(props.tags)
  if (tagFilters.length && !matchesTags(channel, operation, tagFilters)) {
    return false
  }

  return true
}

function matchesChannel(channel: ChannelInfo, filters: string[]): boolean {
  return filters.some(
    (filter) => filter === channel.name || filter === slugify(channel.name)
  )
}

function matchesOperation(operation: OperationInfo, filters: string[]): boolean {
  const identifiers = [
    operation.operationId,
    operation.id,
    operation.summary,
  ].filter(Boolean)

  return filters.some((filter) =>
    identifiers.some((identifier) =>
      identifier ? filter === identifier || filter === slugify(identifier) : false
    )
  )
}

function matchesTags(
  channel: ChannelInfo,
  operation: OperationInfo,
  filters: string[]
): boolean {
  const tags = new Set([...(channel.tags ?? []), ...(operation.tags ?? [])])
  if (tags.size === 0) {
    return false
  }

  return filters.some((filter) => tags.has(filter))
}

function normalizeFilterArray(value: string | string[] | undefined): string[] {
  if (!value) return []
  const arr = Array.isArray(value) ? value : [value]
  return arr
    .map((entry) => (entry ? entry.trim() : ''))
    .filter(Boolean)
    .map((entry) => entry.toLowerCase())
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .trim()
}
