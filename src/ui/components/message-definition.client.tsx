'use client'

import type { OperationTabData } from './operation-card.types'
import { useOptionalWSClient } from '../../components/ws-client'

interface MessageDefinitionProps {
  tab: OperationTabData
  channelName?: string
  allowLoad?: boolean
}

export function MessageDefinitionPanel({ tab, channelName, allowLoad }: MessageDefinitionProps) {
  const client = useOptionalWSClient()
  const exampleString = formatJSON(tab.example ?? {})

  const handleLoad = () => {
    if (!allowLoad || !client || tab.type !== 'message') return
    const payload = tab.loadPayload ?? tab.example ?? {}
    client.pushDraft({ channel: channelName, payload })
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(exampleString)
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <span className="text-sm font-semibold text-foreground">{tab.name}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            tab.type === 'message'
              ? 'bg-emerald-500/15 text-emerald-400'
              : 'bg-amber-500/15 text-amber-400'
          }`}
        >
          {tab.type === 'message' ? 'MESSAGE' : 'REPLY'}
        </span>
      </div>
      {tab.description && <p className="text-sm text-muted-foreground">{tab.description}</p>}

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
        <pre className="max-h-[360px] overflow-auto rounded-xl bg-muted/60 p-4 text-xs">
          <code>{exampleString}</code>
        </pre>
        <div className="absolute top-3 right-3 flex gap-2">
          {allowLoad && tab.type === 'message' && client && (
            <button
              type="button"
              onClick={handleLoad}
              className="h-7 rounded-md border border-border/70 bg-background/80 px-2 text-[11px] font-medium text-foreground shadow-sm transition hover:bg-muted"
            >
              Load in Tester
            </button>
          )}
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
}

function formatJSON(value: unknown) {
  try {
    return JSON.stringify(value ?? {}, null, 2)
  } catch {
    return String(value ?? '')
  }
}
