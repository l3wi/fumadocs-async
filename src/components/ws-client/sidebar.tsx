'use client'

import { useMemo, useState } from 'react'
import { useWSClient } from './provider'
import type { ServerOption } from './types'

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
  } = useWSClient()

  const [selectedServer, setSelectedServer] = useState<string>(
    servers[0]?.url ?? ''
  )
  const [customUrl, setCustomUrl] = useState<string>(url ?? '')

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

  const statusLabel = connected ? 'Connected' : 'Disconnected'
  const activeUrl = url ?? customUrl ?? selectedServer ?? ''
  const showUrlInput = servers.length === 0 || selectedServer === ''

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
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${connected ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200' : 'bg-muted text-muted-foreground'}`}
            >
              {statusLabel}
            </span>
          </div>

          {connected ? (
            <div className="mt-4 flex flex-col gap-0">
              <span className="text-xs font-medium text-muted-foreground">Server</span>
              <p className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground break-all">
                {activeUrl || 'Unknown'}
              </p>
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
                <label className="mt-4 flex flex-col gap-1">
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
          className="rounded-2xl border border-border/70 bg-card/70 p-4 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/40 xl:sticky xl:top-24"
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

          <div className="mt-5 flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Activity Log
            </p>
            <button
              className="text-xs font-medium text-muted-foreground hover:underline"
              type="button"
              onClick={clearLog}
            >
              Clear
            </button>
          </div>

          <div className="asyncapi-sidebar-log mt-2 max-h-72 space-y-2 overflow-auto rounded-lg border border-border/70 bg-background/80 p-3">
            {messages.length === 0 && (
              <p className="text-xs text-muted-foreground">No messages yet.</p>
            )}

            {messages.map((message) => {
              const directionLabel = message.direction === 'out' ? 'Sent' : 'Received'
              const timestamp = new Date(message.timestamp)
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
                  {message.payload !== undefined && message.payload !== null && (
                    <pre className="asyncapi-sidebar-entry__payload">
                      {formatPayload(message.payload)}
                    </pre>
                  )}
                </article>
              )
            })}
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
