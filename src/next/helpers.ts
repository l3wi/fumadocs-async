import type { ChannelInfo } from '../types'

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
