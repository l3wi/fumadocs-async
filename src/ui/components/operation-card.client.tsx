'use client'

import type { OperationCardRenderData } from './operation-card.types'
import type { OperationTabData } from './operation-card.types'
import { ChannelTag } from './channel-tag'

interface OperationCardProps {
  operation: OperationCardRenderData
}

export function OperationCard({ operation }: OperationCardProps) {
  const tabs = operation.tabs

  if (!tabs.length) {
    return null
  }

  // Group tabs by type
  const messages = tabs.filter(tab => tab.type === 'message')
  const replies = tabs.filter(tab => tab.type === 'reply')
  
  const filteredTags = operation.tags.filter((tag) => {
    const normalized = tag.toLowerCase()
    return normalized !== 'subscribe' && normalized !== 'publish'
  })

  return (
    <div className="space-y-5 rounded-2xl border border-border/60 bg-card/50 p-6 text-sm shadow-sm">
      <header className="space-y-3">
        {operation.direction === 'publish' && (
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
              Publish
            </span>
          </div>
        )}
        <div className="space-y-1">
          <h3 className="text-xl font-semibold leading-tight">{operation.title}</h3>
          {operation.description && <p className="text-sm text-muted-foreground">{operation.description}</p>}
        </div>
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="font-semibold uppercase tracking-wide">Channel:</span>
            <ChannelTag channelName={operation.channelName} href={operation.channelHref || `#channel-${operation.channelName}`} />
          </div>
          {filteredTags.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="font-semibold uppercase tracking-wide">
                {filteredTags.length > 1 ? 'Tags:' : 'Tag:'}
              </span>
              <div className="flex flex-wrap gap-2">
                {filteredTags.map((tag) => (
                  <span key={tag} className="rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="space-y-6">
        <MessageGroup title="Messages" tabs={messages} channelName={operation.channelName} />
        <MessageGroup title="Replies" tabs={replies} channelName={operation.channelName} />
      </div>
    </div>
  )
}

function MessageGroup({
  title,
  tabs,
  channelName,
}: {
  title: string
  tabs: OperationTabData[]
  channelName: string
}) {
  if (tabs.length === 0) {
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
        {tabs.map((tab) => {
          const exampleString = formatJSON(tab.example ?? {})

          const handleCopy = async () => {
            try {
              await navigator.clipboard.writeText(exampleString)
            } catch {
              // ignore
            }
          }

          return (
            <div key={tab.key} className="space-y-4 rounded-lg border border-border/60 bg-card/50 p-4 text-sm">
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

              <div className="relative">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Payload</p>
                <pre className="max-h-[360px] overflow-auto rounded-xl bg-muted/60 p-4 text-xs">
                  <code>{exampleString}</code>
                </pre>
                <div className="absolute top-3 right-3 flex gap-2">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="h-7 rounded-md border border-border/70 bg-background/80 px-2 text-[11px] font-medium text-foreground shadow-sm transition hover:bg-muted"
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>
          )
        })}
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
