import type {
  AsyncPageContext,
  AsyncSchemaToPagesOptions,
  ChannelInfo,
  OperationInfo,
  ProcessedAsyncDocument,
} from '../../types'

type AsyncPageFrontmatter = Record<string, unknown> & {
  _asyncapi?: {
    document: string
    channel?: string
    direction?: 'publish' | 'subscribe'
    operationId?: string
    tags?: string[]
  }
}

export interface AsyncPageEntry {
  document: ProcessedAsyncDocument
  channel?: ChannelInfo
  operation?: OperationInfo
  documentKey: string
  title: string
  description?: string
  frontmatter: AsyncPageFrontmatter
  slug: string
  groupSlug?: string
  tags?: string[]
}

export function buildPageEntries(
  documentKey: string,
  document: ProcessedAsyncDocument,
  options: AsyncSchemaToPagesOptions
): AsyncPageEntry[] {
  const per = options.per ?? 'channel'
  if (per === 'tag') {
    return buildTagEntries(documentKey, document, options)
  }

  if (per !== 'channel' && per !== 'operation') {
    throw new Error(
      `Unsupported "per" option "${per}". Supported values are "channel", "operation", and "tag".`
    )
  }

  const entries: AsyncPageEntry[] = []
  for (const channel of document.channels) {
    if (per === 'channel') {
      entries.push(
        createEntry({
          documentKey,
          document,
          channel,
          options,
        })
      )
      continue
    }

    for (const operation of channel.operations) {
      entries.push(
        createEntry({
          documentKey,
          document,
          channel,
          operation,
          options,
        })
      )
    }
  }

  return entries
}

function createEntry({
  documentKey,
  document,
  channel,
  operation,
  options,
}: {
  documentKey: string
  document: ProcessedAsyncDocument
  channel: ChannelInfo
  operation?: OperationInfo
  options: AsyncSchemaToPagesOptions
}): AsyncPageEntry {
  const ctx: AsyncPageContext = { document, channel, operation }
  const title = options.name ? options.name(ctx) : getDefaultTitle(channel, operation)
  const defaultDescription =
    operation?.summary ?? channel.description ?? operation?.description
  const description = options.description
    ? options.description(ctx)
    : defaultDescription

  const frontmatter: AsyncPageFrontmatter = {
    title,
    ...(description ? { description } : {}),
    full: true,
    _asyncapi: {
      document: documentKey,
      channel: channel.name,
      direction: operation?.direction,
      operationId: operation?.operationId ?? operation?.id,
    },
    ...(options.frontmatter ? options.frontmatter(ctx) : {}),
  }

  return {
    document,
    channel,
    operation,
    documentKey,
    title,
    description,
    frontmatter,
    slug: slugify(
      operation ? `${channel.name}-${operation.direction}` : channel.name
    ),
    groupSlug: resolveGroupSlug(channel, operation, options.groupBy),
  }
}

function buildTagEntries(
  documentKey: string,
  document: ProcessedAsyncDocument,
  options: AsyncSchemaToPagesOptions
): AsyncPageEntry[] {
  const tagSet = new Set<string>()

  for (const channel of document.channels) {
    for (const operation of channel.operations) {
      for (const tag of operation.tags ?? []) {
        const normalized = normalizeTagName(tag)
        if (normalized) {
          tagSet.add(normalized)
        }
      }
    }
  }

  const entries: AsyncPageEntry[] = []

  for (const tag of tagSet) {
    const syntheticChannel = createTagChannel(tag)
    const entry = createEntry({
      documentKey,
      document,
      channel: syntheticChannel,
      options,
    })

    entry.tags = [tag]
    const meta = entry.frontmatter._asyncapi ?? {}
    meta.tags = entry.tags
    entry.frontmatter._asyncapi = meta

    entries.push(entry)
  }

  return entries
}

function createTagChannel(tag: string): ChannelInfo {
  return {
    name: tag,
    description: `Operations tagged "${tag}"`,
    tags: [tag],
    operations: [],
  }
}

function normalizeTagName(value?: string): string | undefined {
  if (!value) return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function resolveGroupSlug(
  channel: ChannelInfo,
  operation: OperationInfo | undefined,
  groupBy: AsyncSchemaToPagesOptions['groupBy']
): string | undefined {
  if (!groupBy || groupBy === 'none') return undefined

  if (groupBy === 'server') {
    const server = operation?.servers?.[0]
    return server ? slugify(server) : undefined
  }

  if (groupBy === 'tag') {
    const tag = operation?.tags?.[0] ?? channel.tags?.[0]
    return tag ? slugify(tag) : undefined
  }

  return undefined
}

function getDefaultTitle(channel: ChannelInfo, operation?: OperationInfo): string {
  if (!operation) return channel.name
  const action = operation.direction === 'publish' ? 'Publish' : ''
  return action ? `${action}: ${channel.name}` : channel.name
}

export function extractDocumentName(documentKey: string): string {
  try {
    const url = new URL(documentKey)
    return url.hostname || 'asyncapi'
  } catch {
    const normalized = documentKey.replace(/\\/g, '/')
    const segments = normalized.split('/')
    const last = segments[segments.length - 1] ?? 'asyncapi'
    const dotIndex = last.lastIndexOf('.')
    return dotIndex > 0 ? last.slice(0, dotIndex) : last || 'asyncapi'
  }
}

export function slugify(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return normalized || 'asyncapi'
}
