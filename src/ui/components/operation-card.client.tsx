'use client'

import type { OperationCardRenderData } from './operation-card.types'
import { ChannelTag } from './channel-tag'
import { getOperationAnchorId } from '../../utils/anchors'
import { MessageDefinitionPanel } from './message-definition.client'

interface OperationCardProps {
  operation: OperationCardRenderData
  anchorId?: string
}

export function OperationCard({ operation, anchorId }: OperationCardProps) {
  const messageEntries = [...operation.messages, ...operation.replies]

  if (!messageEntries.length) {
    return null
  }

  const cardAnchorId =
    anchorId ??
    getOperationAnchorId({
      operationId: operation.id,
      title: operation.title,
      channelName: operation.channelName,
    })

  const filteredTags = operation.tags.filter((tag) => {
    const normalized = tag.toLowerCase()
    return normalized !== 'subscribe' && normalized !== 'publish'
  })

  return (
    <div
      id={cardAnchorId}
      className="space-y-5 rounded-2xl border border-border/60 bg-card/50 p-6 text-sm shadow-sm"
    >
      <header className="space-y-3">
        {operation.direction === 'publish' && (
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
              Publish
            </span>
          </div>
        )}
        <div className="space-y-1">
          <h3 className="text-xl font-semibold leading-tight not-prose">
            {cardAnchorId ? (
              <a
                href={`#${cardAnchorId}`}
                className="group inline-flex items-center gap-2 text-foreground no-underline transition hover:text-primary"
              >
                {operation.title}
                <span className="text-muted-foreground opacity-0 transition group-hover:opacity-100">
                  #
                </span>
              </a>
            ) : (
              operation.title
            )}
          </h3>
          {operation.description && (
            <p className="text-sm text-muted-foreground">{operation.description}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="font-semibold uppercase tracking-wide">Channel:</span>
            <ChannelTag
              channelName={operation.channelName}
              href={operation.channelHref || `#channel-${operation.channelName}`}
            />
          </div>
          {filteredTags.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="font-semibold uppercase tracking-wide">
                {filteredTags.length > 1 ? 'Tags:' : 'Tag:'}
              </span>
              <div className="flex flex-wrap gap-2">
                {filteredTags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="space-y-4">
        {messageEntries.map((message) => {
          const messageAnchorId = cardAnchorId ? `${cardAnchorId}-${message.key}` : undefined
          return (
            <MessageDefinitionPanel
              key={message.key}
              message={message}
              channelName={operation.channelName}
              operationId={operation.id}
              operationName={operation.title}
              operationDirection={operation.direction}
              anchorId={messageAnchorId}
              allowLoad={message.type === 'message'}
            />
          )
        })}
      </div>
    </div>
  )
}
