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
    servers[0]?.url ?? url ?? ''
  )
  const [customUrl, setCustomUrl] = useState<string>(servers[0]?.url ?? url ?? '')

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

  return (
    <aside className="asyncapi-sidebar flex w-full flex-col gap-4 rounded-lg border border-border bg-card p-4 text-sm shadow-sm">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {title}
        </p>
        <p className="text-xs text-muted-foreground">
          {connected ? `Connected to ${currentServerName}` : 'Disconnected'}
        </p>
      </div>

      {servers.length > 0 && (
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Server</span>
          <select
            className="rounded border border-border bg-background px-2 py-1"
            value={selectedServer}
            onChange={(event) => {
              const value = event.target.value
              setSelectedServer(value)
              setCustomUrl(value)
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

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">
          WebSocket URL
        </span>
        <input
          className="rounded border border-border bg-background px-2 py-1"
          value={customUrl}
          onChange={(event) => setCustomUrl(event.target.value)}
          placeholder="wss://example.com/socket"
        />
      </label>

      <div className="flex gap-2">
        <button
          type="button"
          className="flex-1 rounded bg-primary/90 px-3 py-1 text-sm font-medium text-primary-foreground hover:bg-primary"
          onClick={handleConnect}
        >
          {connected ? 'Reconnect' : 'Connect'}
        </button>
        <button
          type="button"
          className="rounded border border-border px-3 py-1 text-sm"
          onClick={disconnect}
          disabled={!connected}
        >
          Disconnect
        </button>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">Channel</span>
        <input
          className="rounded border border-border bg-background px-2 py-1"
          value={draft.channel ?? ''}
          onChange={(event) => pushDraft({ channel: event.target.value })}
          placeholder="chat/messages"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">Payload</span>
        <textarea
          className="min-h-[120px] rounded border border-border bg-background px-2 py-1 font-mono text-xs"
          value={draft.payloadText}
          onChange={(event) => pushDraft({ payloadText: event.target.value })}
        />
      </label>

      <button
        type="button"
        className="rounded bg-emerald-600/90 px-3 py-1 text-sm font-medium text-white hover:bg-emerald-600"
        onClick={send}
      >
        Send Message
      </button>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">Activity Log</p>
        <button
          className="text-xs text-muted-foreground hover:underline"
          type="button"
          onClick={clearLog}
        >
          Clear
        </button>
      </div>

      <div className="max-h-64 space-y-2 overflow-auto rounded border border-border bg-background p-2">
        {messages.length === 0 && (
          <p className="text-xs text-muted-foreground">No messages yet.</p>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className="rounded border border-border/60 bg-muted/40 p-2"
          >
            <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-muted-foreground">
              <span>{message.direction === 'out' ? 'sent' : 'received'}</span>
              <span>{new Date(message.timestamp).toLocaleTimeString()}</span>
            </div>
            {message.channel && (
              <p className="text-xs text-muted-foreground">Channel: {message.channel}</p>
            )}
            {message.payload !== undefined && message.payload !== null && (
              <pre className="mt-1 overflow-auto rounded bg-background/70 p-2 text-xs">
                {formatPayload(message.payload)}
              </pre>
            )}
          </div>
        ))}
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
