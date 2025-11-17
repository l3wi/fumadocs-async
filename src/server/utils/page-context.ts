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
  pathSegments: string[]
}

export function buildPageEntries(
  documentKey: string,
  document: ProcessedAsyncDocument,
  options: AsyncSchemaToPagesOptions
): AsyncPageEntry[] {
  const mode = resolvePageMode(options.per)
  const documentSlug = slugify(extractDocumentName(documentKey))

  if (mode === 'tag') {
    return buildTagEntries(documentKey, document, options, documentSlug)
  }

  return buildChannelEntries(documentKey, document, options, mode, documentSlug)
}

function createEntry({
  documentKey,
  document,
  channel,
  operation,
  options,
  documentSlug,
}: {
  documentKey: string
  document: ProcessedAsyncDocument
  channel: ChannelInfo
  operation?: OperationInfo
  options: AsyncSchemaToPagesOptions
  documentSlug: string
}): AsyncPageEntry {
  const ctx: AsyncPageContext = { document, channel, operation }
  const title = options.name ? options.name(ctx) : getDefaultTitle(channel, operation)
  const defaultDescription =
    operation?.summary ?? channel.description ?? operation?.description
  const description = options.description
    ? options.description(ctx)
    : defaultDescription

  const combinedTags = dedupeStrings([
    ...(channel.tags ?? []),
    ...(operation?.tags ?? []),
  ])
  const normalizedTags = combinedTags.length ? combinedTags : undefined

  const frontmatter: AsyncPageFrontmatter = {
    title,
    ...(description ? { description } : {}),
    full: true,
    _asyncapi: {
      document: documentKey,
      channel: channel.name,
      direction: operation?.direction,
      operationId: operation?.operationId ?? operation?.id,
      ...(normalizedTags ? { tags: normalizedTags } : {}),
    },
    ...(options.frontmatter ? options.frontmatter(ctx) : {}),
  }

  const slug = resolveEntrySlug(channel, operation)
  const groupSlug = resolveGroupSlug(channel, operation, options.groupBy)
  const pathSegments = buildPathSegments(documentSlug, groupSlug, slug)

  return {
    document,
    channel,
    operation,
    documentKey,
    title,
    description,
    frontmatter,
    slug,
    groupSlug,
    tags: normalizedTags,
    pathSegments,
  }
}

function buildTagEntries(
  documentKey: string,
  document: ProcessedAsyncDocument,
  options: AsyncSchemaToPagesOptions,
  documentSlug: string
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
      documentSlug,
    })

    entry.tags = [tag]
    entry.channel = undefined

    const meta: AsyncPageFrontmatter['_asyncapi'] = entry.frontmatter._asyncapi ?? {
      document: documentKey,
    }
    delete meta.channel
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

function buildChannelEntries(
  documentKey: string,
  document: ProcessedAsyncDocument,
  options: AsyncSchemaToPagesOptions,
  mode: 'channel' | 'operation',
  documentSlug: string
): AsyncPageEntry[] {
  const entries: AsyncPageEntry[] = []

  for (const channel of document.channels) {
    if (mode === 'channel') {
      entries.push(
        createEntry({
          documentKey,
          document,
          channel,
          options,
          documentSlug,
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
          documentSlug,
        })
      )
    }
  }

  return entries
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

function buildPathSegments(
  documentSlug: string,
  groupSlug: string | undefined,
  entrySlug: string
): string[] {
  const segments = [documentSlug]
  if (groupSlug) segments.push(groupSlug)
  segments.push(entrySlug || 'asyncapi')
  return segments
}

function resolveEntrySlug(channel: ChannelInfo, operation?: OperationInfo): string {
  if (!operation) {
    return slugify(channel.name)
  }

  const operationHint =
    operation.operationId ?? operation.id ?? operation.direction ?? 'operation'
  return slugify(`${channel.name}-${operationHint}`)
}

function resolvePageMode(
  mode: AsyncSchemaToPagesOptions['per']
): 'channel' | 'operation' | 'tag' {
  if (!mode) return 'channel'
  if (mode === 'channel' || mode === 'operation' || mode === 'tag') {
    return mode
  }

  throw new Error(
    `Unsupported "per" option "${mode}". Supported values are "channel", "operation", and "tag".`
  )
}

function dedupeStrings(values: string[]): string[] {
  const filtered = values.map((value) => value?.trim()).filter(Boolean) as string[]
  if (!filtered.length) return []
  return Array.from(new Set(filtered))
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

export function reserveEntryPath(
  entry: AsyncPageEntry,
  usedPaths: Set<string>,
  options: { extension?: string } = {}
): string {
  const extension = options.extension ?? ''
  const uniquePath = ensureUniquePath(entry.pathSegments, usedPaths)
  return `${uniquePath}${extension}`
}

function ensureUniquePath(
  segments: string[],
  usedPaths: Set<string>
): string {
  const baseSegments = [...segments]
  const baseSlug = baseSegments[baseSegments.length - 1] ?? 'asyncapi'

  let candidate = baseSegments.join('/')
  let counter = 1

  while (usedPaths.has(candidate)) {
    const nextSlug = slugify(`${baseSlug}-${counter++}`)
    const nextSegments = [...baseSegments.slice(0, -1), nextSlug]
    candidate = nextSegments.join('/')
  }

  usedPaths.add(candidate)
  return candidate
}
