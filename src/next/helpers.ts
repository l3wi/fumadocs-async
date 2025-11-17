import type { ChannelInfo } from '../types'

type OperationAnchorInput = {
  operationId?: string | null
  id?: string | null
  summary?: string | null
  title?: string | null
  channel?: string | null
  channelName?: string | null
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .trim()
}

export function getChannelAnchorId(name: string): string {
  const slug = slugify(name)
  return slug ? `channel-${slug}` : 'channel'
}

export function buildChannelHref(
  basePath: string,
  channel: ChannelInfo
): string {
  const anchor = getChannelAnchorId(channel.name)
  const normalized = basePath.replace(/\/$/, '')
  return `${normalized}#${anchor}`
}

export function getOperationAnchorId(operation: OperationAnchorInput): string {
  const base =
    operation.operationId ||
    operation.id ||
    operation.summary ||
    operation.title ||
    operation.channel ||
    operation.channelName ||
    'operation'

  const slug = slugify(base)
  return slug ? `operation-${slug}` : 'operation'
}
