'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SVGProps } from 'react'
import { useWSClient } from './provider'
import type { ServerOption, WSMessageEntry } from './types'

interface SidebarProps {
  title?: string
  servers?: ServerOption[]
}

export function WSSidebar({ title = 'WebSocket Client', servers = [] }: SidebarProps) {
  const {
    connected,
    url,
    serverName,
    connect,
    disconnect,
    send,
    draft,
    pushDraft,
    messages,
    clearLog,
    error,
    connectionError,
  } = useWSClient()

  const [selectedServer, setSelectedServer] = useState<string>(
    servers[0]?.url ?? ''
  )
  const [customUrl, setCustomUrl] = useState<string>(url ?? '')
  const [copiedEntryId, setCopiedEntryId] = useState<string | null>(null)
  const [statusOverride, setStatusOverride] = useState<'failed' | null>(null)

  useEffect(() => {
    if (!copiedEntryId) return
    const timeout = window.setTimeout(() => setCopiedEntryId(null), 1600)
    return () => window.clearTimeout(timeout)
  }, [copiedEntryId])

  useEffect(() => {
    if (!connectionError || connected) return
    setStatusOverride('failed')
    const timeout = window.setTimeout(() => setStatusOverride(null), 3000)
    return () => window.clearTimeout(timeout)
  }, [connectionError, connected])

  useEffect(() => {
    if (connected) {
      setStatusOverride(null)
    }
  }, [connected])

  const currentServerName = useMemo(
    () =>
      servers.find((server) => server.url === selectedServer)?.name ??
      serverName ??
      'Custom',
    [selectedServer, serverName, servers]
  )

  const handleConnect = () => {
    connect(customUrl || selectedServer, currentServerName)
  }

  const statusMode = statusOverride ?? (connected ? 'connected' : 'disconnected')
  const statusLabel =
    statusMode === 'failed'
      ? 'Connection Failed'
      : statusMode === 'connected'
        ? 'Connected'
        : 'Disconnected'
  const badgeTone =
    statusMode === 'failed'
      ? 'border-red-200/70 bg-red-100 text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200'
      : statusMode === 'connected'
        ? 'border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200'
        : 'border-transparent bg-muted text-muted-foreground'
  const activeUrl = url ?? customUrl ?? selectedServer ?? ''
  const showUrlInput = servers.length === 0 || selectedServer === ''

  const copyEntry = useCallback(async (entry: WSMessageEntry) => {
    const text = buildEntryCopyText(entry)
    if (!text) return

    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.top = '-1000px'
      document.body.appendChild(textarea)
      textarea.focus()
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }

    setCopiedEntryId(entry.id)
  }, [])

  return (
    <aside className="asyncapi-sidebar h-full text-sm">
      <div className="flex h-full flex-col gap-6">
        <section
          data-panel="connection"
          className="rounded-2xl border border-border/70 bg-card/70 p-4 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/40"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {title}
            </p>
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${badgeTone}`}
            >
              {statusLabel}
            </span>
          </div>

          {connected ? (
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">Server</span>
                <p className="mt-0 mb-0 break-all rounded-lg border border-border bg-background px-2 py-1 text-sm leading-[19px] text-foreground">
                  {activeUrl || 'Unknown'}
                </p>
              </div>
              <button
                type="button"
                className="w-full rounded-lg border border-border/70 bg-background px-3 py-1.5 text-sm font-semibold text-foreground shadow-sm transition hover:bg-muted"
                onClick={disconnect}
              >
                Disconnect
              </button>
            </div>
          ) : (
            <>
              {servers.length > 0 && (
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground">Server</span>
                  <select
                    className="rounded-lg border border-border bg-background px-2 py-1"
                    value={selectedServer}
                    onChange={(event) => {
                      const value = event.target.value
                      setSelectedServer(value)
                      if (value) {
                        setCustomUrl(value)
                      }
                    }}
                  >
                    {servers.map((server) => (
                      <option key={server.name} value={server.url}>
                        {server.name}
                      </option>
                    ))}
                    <option value="">Custom</option>
                  </select>
                </label>
              )}

              {showUrlInput && (
                <label className="mt-4 flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground">WebSocket URL</span>
                  <input
                    className="rounded-lg border border-border bg-background px-2 py-1"
                    value={customUrl}
                    onChange={(event) => setCustomUrl(event.target.value)}
                    placeholder="wss://example.com/socket"
                  />
                </label>
              )}

              <button
                type="button"
                className="mt-4 w-full rounded-lg border border-border/70 bg-background px-3 py-1.5 text-sm font-semibold text-foreground shadow-sm transition hover:bg-muted"
                onClick={handleConnect}
              >
                Connect
              </button>
            </>
          )}
        </section>

        <section
          data-panel="messages"
          className="rounded-2xl border border-border/70 bg-card/70 p-4 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/40 xl:sticky xl:top-5 xl:h-[calc(100vh-2.5rem)] xl:min-h-0 xl:flex xl:flex-col"
        >
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Channel</span>
            <input
              className="rounded-lg border border-border bg-background px-2 py-1"
              value={draft.channel ?? ''}
              onChange={(event) => pushDraft({ channel: event.target.value })}
              placeholder="chat/messages"
            />
          </label>

          <label className="mt-4 flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Payload</span>
            <textarea
              className="min-h-[140px] rounded-lg border border-border bg-background px-2 py-2 font-mono text-xs"
              value={draft.payloadText}
              onChange={(event) => pushDraft({ payloadText: event.target.value })}
            />
          </label>

          <button
            type="button"
            className="mt-4 w-full rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500"
            onClick={send}
          >
            Send Message
          </button>

          {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

          <div className="mt-5 flex flex-col xl:flex-1 xl:min-h-0">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Activity Log
              </span>
              <button
                className="text-xs font-medium text-muted-foreground hover:underline"
                type="button"
                onClick={clearLog}
              >
                Clear
              </button>
            </div>

            <div className="asyncapi-sidebar-log mt-2 max-h-72 space-y-2 overflow-auto rounded-lg border border-border/70 bg-background/80 p-2 xl:flex-1 xl:max-h-none xl:min-h-0 xl:h-full">
              {messages.length === 0 && (
                <p className="text-xs text-muted-foreground">No messages yet.</p>
              )}

              {messages.map((message) => {
                const directionLabel = message.direction === 'out' ? 'Sent' : 'Received'
                const timestamp = new Date(message.timestamp)
                const hasPayload = message.payload !== undefined && message.payload !== null
                const formattedPayload = hasPayload ? formatPayload(message.payload) : ''
                const isCopied = copiedEntryId === message.id
                const headerClass = [
                  'asyncapi-sidebar-entry',
                  message.direction === 'out'
                    ? 'asyncapi-sidebar-entry--out'
                    : 'asyncapi-sidebar-entry--in',
                ].join(' ')

                return (
                  <article key={message.id} className={headerClass}>
                    <div className="asyncapi-sidebar-entry__header">
                      <span className="asyncapi-sidebar-entry__pill">{directionLabel}</span>
                      <time
                        dateTime={timestamp.toISOString()}
                        className="asyncapi-sidebar-entry__meta"
                      >
                        {timestamp.toLocaleTimeString()}
                      </time>
                    </div>
                    {message.channel && (
                      <code className="asyncapi-sidebar-entry__channel">{message.channel}</code>
                    )}
                    {hasPayload && (
                      <div className="asyncapi-sidebar-entry__payload">
                        <pre className="asyncapi-sidebar-entry__payload-text relative">
                          <button
                            type="button"
                            className={`asyncapi-sidebar-entry__copy${isCopied ? ' asyncapi-sidebar-entry__copy--active' : ''}`}
                            aria-label={isCopied ? 'Copied entry' : 'Copy entry'}
                            onClick={() => copyEntry(message)}
                          >
                            {isCopied ? <CheckIcon /> : <CopyIcon />}
                          </button>
                          <code className="asyncapi-sidebar-entry__payload-content not-prose">
                            {formattedPayload}
                          </code>
                        </pre>
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          </div>
        </section>
      </div>
    </aside>
  )
}

function formatPayload(payload: unknown): string {
  if (typeof payload === 'string') return payload
  try {
    return JSON.stringify(payload, null, 2)
  } catch {
    return String(payload)
  }
}

function buildEntryCopyText(entry: WSMessageEntry): string {
  const lines: string[] = []
  const directionLabel = entry.direction === 'out' ? 'Sent' : 'Received'
  lines.push(`${directionLabel} @ ${new Date(entry.timestamp).toISOString()}`)

  if (entry.channel) {
    lines.push(`Channel: ${entry.channel}`)
  }

  if (entry.payload !== undefined && entry.payload !== null) {
    lines.push(formatPayload(entry.payload))
  }

  return lines.join('\n').trim()
}

function CopyIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    </svg>
  )
}

function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}
