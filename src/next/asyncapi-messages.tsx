import type { AsyncAPIPageProps, AsyncAPIServer, OperationInfo, MessageInfo } from '../types'
import { resolveAsyncAPIDocument } from '../utils/document'
import { createMessageTabData } from '../ui/utils/message-tab'
import type { OperationTabData } from '../ui/components/operation-card.types'
import { ChannelTag } from '../ui/components/channel-tag'
import { getChannelAnchorId } from './helpers'
import { TagBadge } from './tag-badge'

interface AsyncAPIMessagesPageProps {
  document: AsyncAPIPageProps['document']
  server?: AsyncAPIServer
  channelHref?: (operation: OperationInfo) => string | undefined
  tagHref?: (tag: string) => string | undefined
}

export async function AsyncAPIMessagesPage({
  document,
  server,
  channelHref,
  tagHref,
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

  return (
    <div className="space-y-12">
      {relevant.map((operation) => (
        <OperationMessages
          key={operation.operationId ?? operation.id ?? operation.channel}
          operation={operation}
          channelHref={channelHref}
          tagHref={tagHref}
        />
      ))}
    </div>
  )
}

function OperationMessages({
  operation,
  channelHref,
  tagHref,
}: {
  operation: OperationInfo
  channelHref?: (operation: OperationInfo) => string | undefined
  tagHref?: (tag: string) => string | undefined
}) {
  const requestMessages = operation.messages ?? []
  const replyMessages = operation.reply?.messages ?? []
  const channelLink = channelHref?.(operation)

  return (
    <div className="space-y-4 rounded-2xl border border-border/60 bg-card/50 p-6">
      <div className="space-y-3">
        <div className="space-y-2">
          {operation.direction === 'publish' && (
            <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                Publish
              </span>
            </div>
          )}
          <div>
            <h2 className="text-xl font-semibold">
              {operation.summary || operation.operationId || operation.id || 'Operation'}
            </h2>
            {operation.description && (
              <p className="text-sm text-muted-foreground">{operation.description}</p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="font-semibold uppercase tracking-wide">Channel:</span>
            <ChannelTag channelName={operation.channel} href={channelLink || `#${getChannelAnchorId(operation.channel)}`} />
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

      <div className="space-y-6">
        <MessageGroup title="Messages" messages={requestMessages} type="message" />
        <MessageGroup title="Replies" messages={replyMessages} type="reply" />
      </div>
    </div>
  )
}

function MessageGroup({
  title,
  messages,
  type,
}: {
  title: string
  messages: MessageInfo[]
  type: OperationTabData['type']
}) {
  if (messages.length === 0) {
    return (
      <div className="space-y-2 text-sm text-muted-foreground">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground/80">{title}</h3>
        <p>No {title.toLowerCase()} defined.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground/80">{title}</h3>
      <div className="space-y-4">
        {messages.map((message, index) => (
          <StandaloneMessageCard key={message.name ?? message.title ?? index} tab={createMessageTabData(message, type, index)} />
        ))}
      </div>
    </div>
  )
}

function StandaloneMessageCard({ tab }: { tab: OperationTabData }) {
  const exampleString = formatJSON(tab.example ?? {})

  return (
    <div className="space-y-4 rounded-lg border border-border/60 bg-card/50 p-4 text-sm">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <p className="font-semibold">{tab.name}</p>
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
              tab.type === 'message'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-400'
            }`}
          >
            {tab.type === 'message' ? 'MESSAGE' : 'REPLY'}
          </span>
        </div>
        {tab.description && <p className="text-sm text-muted-foreground">{tab.description}</p>}
      </div>

      {tab.parameters.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Parameters</p>
          <div className="space-y-3">
            {tab.parameters.map((param) => (
              <div key={param.name} className="space-y-1">
                <div className="flex items-baseline gap-2">
                  <code className="font-mono text-sm text-foreground">
                    {param.name}
                    {!param.required && '?'}
                  </code>
                  {param.type && (
                    <span className="text-xs font-mono text-muted-foreground">{param.type}</span>
                  )}
                </div>
                {param.description && (
                  <p className="text-sm text-muted-foreground">{param.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payload</p>
        <pre className="max-h-[360px] overflow-auto rounded-xl bg-muted/60 p-4 text-xs">
          <code>{exampleString}</code>
        </pre>
      </div>
    </div>
  )
}

function formatJSON(value: unknown) {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}
