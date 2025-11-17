import type { AsyncAPIPageProps, AsyncAPIServer, ChannelInfo, OperationInfo } from '../types'
import { resolveAsyncAPIDocument } from '../utils/document'
import { getChannelAnchorId, slugify } from './helpers'
import { TagBadge } from './tag-badge'
import { ChannelTag } from '../ui/components/channel-tag'

interface AsyncAPIChannelsPageProps {
  document: AsyncAPIPageProps['document']
  server?: AsyncAPIServer
  channelHref?: (channel: ChannelInfo) => string | undefined
  tagHref?: (tag: string) => string | undefined
  operationHref?: (operation: OperationInfo) => string | undefined
}

export async function AsyncAPIChannelsPage({
  document,
  server,
  channelHref,
  tagHref,
  operationHref,
}: AsyncAPIChannelsPageProps) {
  const processed = await resolveAsyncAPIDocument(document, server)
  const channels = processed.channels ?? []

  // Provide default tagHref if not supplied
  const defaultTagHref = tagHref || ((tag: string) => `#tag-${slugify(tag)}`)

  if (channels.length === 0) {
    return (
      <div className="rounded border border-dashed border-border p-6 text-sm text-muted-foreground">
        No channels were found in this AsyncAPI document.
      </div>
    )
  }

  return (
    <div className="space-y-12">
      {channels.map((channel) => (
        <div
          key={channel.name}
          id={getChannelAnchorId(channel.name)}
          className="space-y-4 rounded-2xl border border-border/60 bg-card/50 p-6"
        >
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-semibold">
                {renderChannelLink(channel, channelHref)}
              </h2>
              {channel.tags?.map((tag) => (
                <TagBadge key={tag} tag={tag} builder={tagHref} />
              ))}
            </div>
            {channel.description && (
              <p className="text-base text-muted-foreground">{channel.description}</p>
            )}
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Operations
            </h3>
            {channel.operations.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No operations are explicitly attached to this channel.
              </p>
            ) : (
              <ul className="space-y-4">
                {channel.operations.map((operation) => (
                  <li key={operation.operationId ?? operation.id ?? operation.summary}>
                    <div className="space-y-3 rounded-xl border border-border/60 bg-background/50 p-4">
                      <div className="space-y-1">
                        {operation.direction === 'publish' && (
                          <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                              Publish
                            </span>
                          </div>
                        )}
                        {renderOperationLink(operation, operationHref)}
                        {operation.description && (
                          <p className="text-sm text-muted-foreground">{operation.description}</p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold uppercase tracking-wide">Channel:</span>
                          <ChannelTag channelName={channel.name} href={`#${getChannelAnchorId(channel.name)}`} />
                        </div>
                        {operation.tags && operation.tags.length > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="font-semibold uppercase tracking-wide">
                              {operation.tags.length > 1 ? 'Tags:' : 'Tag:'}
                            </span>
                            <div className="flex flex-wrap gap-2">
                              {operation.tags.map((tag) => (
                                <TagBadge key={tag} tag={tag} builder={tagHref} />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function renderChannelLink(channel: ChannelInfo, builder?: (channel: ChannelInfo) => string | undefined) {
  const href = builder?.(channel)
  if (!href) return channel.name
  return (
    <a href={href} className="text-primary hover:underline">
      {channel.name}
    </a>
  )
}

function renderOperationLink(operation: OperationInfo, builder?: (operation: OperationInfo) => string | undefined) {
  const label = operation.summary || operation.operationId || operation.id || 'Operation'
  const href = builder?.(operation)
  if (!href) {
    return <p className="text-base font-semibold">{label}</p>
  }
  return (
    <a href={href} className="text-base font-semibold text-primary hover:underline">
      {label}
    </a>
  )
}
