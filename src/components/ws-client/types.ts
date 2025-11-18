export interface WSMessageEntry {
  id: string
  direction: 'in' | 'out'
  channel?: string
  payload?: unknown
  timestamp: number
}

export interface WSConnectionError {
  message: string
  at: number
}

export type WSClientErrorSource = 'manual' | 'fetcher'

export interface WSClientDraft {
  channel?: string
  payloadText: string
}

export interface WSClientState {
  connected: boolean
  url?: string
  serverName?: string
  messages: WSMessageEntry[]
  draft: WSClientDraft
  error?: string
  errorSource?: WSClientErrorSource
  connectionError?: WSConnectionError
}

export interface WSClientContextValue extends WSClientState {
  connect: (url: string, serverName?: string) => void
  disconnect: () => void
  send: () => void
  pushDraft: (draft: Partial<WSClientDraft> & { payload?: unknown }) => void
  clearLog: () => void
}

export interface ServerOption {
  name: string
  url: string
}
