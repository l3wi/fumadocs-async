'use client'

import { useMemo } from 'react'
import type { SVGProps } from 'react'
import type { BundledLanguage } from 'shiki'
import type { OperationMessageData } from './operation-card.types'
import { useOptionalWSClient } from '../../components/ws-client'
import { useMessagePayloadTransformer } from '../state/message-payload-transformer'
import { runDraftPayloadTransformer } from '../utils/payload-transformer'
import { useShiki } from 'fumadocs-core/highlight/client'

const asyncThemes = {
  light: 'github-light',
  dark: 'github-dark',
}

const FALLBACK_LANGUAGE = 'plaintext' as BundledLanguage

interface MessageDefinitionProps {
  message: OperationMessageData
  channelName?: string
  allowLoad?: boolean
  operationId?: string
  operationName?: string
  operationDirection?: 'publish' | 'subscribe'
  anchorId?: string
}

export function MessageDefinitionPanel({
  message,
  channelName,
  allowLoad,
  operationId,
  operationName,
  operationDirection,
  anchorId,
}: MessageDefinitionProps) {
  const client = useOptionalWSClient()
  const payloadTransformer = useMessagePayloadTransformer()
  const exampleString = formatJSON(message.example ?? {})
  const enableLoad = allowLoad ?? message.type === 'message'
  const highlighted = useShiki(
    exampleString,
    {
      lang: 'json',
      themes: asyncThemes,
      fallbackLanguage: FALLBACK_LANGUAGE,
    },
    useMemo(() => [message.key, exampleString], [message.key, exampleString])
  )

  const handleLoad = async () => {
    if (!enableLoad || !client || message.type !== 'message') return
    const payload = message.loadPayload ?? message.example ?? {}
    const meta = {
      source: 'message-definition' as const,
      channelName,
      operationId,
      operationName,
      operationDirection,
      messageKey: message.key,
      messageName: message.name,
      messageType: message.type,
    }
    const resolvedPayload = await runDraftPayloadTransformer(payloadTransformer, payload, meta)
    client.pushDraft({ channel: channelName, payload: resolvedPayload })
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(exampleString)
    } catch {
      // ignore clipboard errors
    }
  }

  return (
    <div
      id={anchorId}
      className="space-y-4 rounded-lg border border-border/60 bg-card/50 p-4 text-sm"
    >
      <div className="space-y-1">
        <div className="flex items-center gap-2 not-prose">
          <p className="font-semibold">
            {anchorId ? (
              <a
                href={`#${anchorId}`}
                className="group inline-flex items-center gap-1 text-foreground no-underline transition hover:text-primary"
              >
                {message.name}
                <span className="text-muted-foreground opacity-0 transition group-hover:opacity-100">
                  #
                </span>
              </a>
            ) : (
              message.name
            )}
          </p>
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
              message.type === 'message'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-400'
            }`}
          >
            {message.type === 'message' ? 'MESSAGE' : 'REPLY'}
          </span>
        </div>
        {message.description && (
          <p className="text-sm text-muted-foreground">{message.description}</p>
        )}
      </div>

      {message.parameters.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Parameters
          </p>
          <div className="space-y-3">
            {message.parameters.map(param => (
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

      <div className="flex flex-col overflow-hidden rounded-xl border border-border/80 bg-secondary/60 not-prose">
        <div className="flex items-center justify-between px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Payload</span>
          {enableLoad && message.type === 'message' && client && (
            <button
              type="button"
              onClick={handleLoad}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-primary transition hover:text-primary/80"
            >
              Load into Client <span aria-hidden>→</span>
            </button>
          )}
        </div>

        <div className="relative border-t border-border bg-card">
          <button
            type="button"
            onClick={handleCopy}
            className="absolute top-3 right-3 inline-flex items-center justify-center rounded-lg border border-border/70 bg-background/80 p-1 text-muted-foreground transition hover:text-foreground"
            aria-label="Copy payload"
          >
            <CopyIcon className="h-4 w-4" />
          </button>

          <div className="max-h-[360px] overflow-auto px-4 py-4 text-xs">
            {highlighted ? (
              <div className="not-prose">{highlighted}</div>
            ) : (
              <pre className="min-w-full  bg-muted/80 p-4 text-xs">
                <code>{exampleString}</code>
              </pre>
            )}
          </div>
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

function CopyIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      {...props}
    >
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    </svg>
  )
}
