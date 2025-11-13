'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type {
  WSClientContextValue,
  WSClientDraft,
  WSClientState,
  WSMessageEntry,
} from './types'

const INITIAL_DRAFT: WSClientDraft = {
  payloadText: '{}',
}

const WSClientContext = createContext<WSClientContextValue | null>(null)

export function WSClientProvider({ children }: { children: ReactNode }) {
  const socketRef = useRef<WebSocket | null>(null)
  const [state, setState] = useState<WSClientState>({
    connected: false,
    messages: [],
    draft: INITIAL_DRAFT,
  })

  const appendMessage = useCallback((entry: WSMessageEntry) => {
    setState((prev) => ({
      ...prev,
      messages: [entry, ...prev.messages].slice(0, 100),
    }))
  }, [])

  const setError = useCallback((message?: string) => {
    setState((prev) => ({ ...prev, error: message }))
  }, [])

  const disconnect = useCallback(() => {
    const socket = socketRef.current
    if (socket) {
      socket.close()
      socketRef.current = null
    }
    setState((prev) => ({
      ...prev,
      connected: false,
    }))
  }, [])

  const handleIncomingMessage = useCallback(
    (payload: unknown, raw?: string | null) => {
      appendMessage({
        id: createMessageId(),
        direction: 'in',
        channel: undefined,
        payload: payload ?? raw,
        timestamp: Date.now(),
      })
    },
    [appendMessage]
  )

  const connect = useCallback(
    (url: string, serverName?: string) => {
      if (!url) {
        setError('WebSocket URL is required')
        return
      }

      disconnect()

      try {
        const socket = new WebSocket(url)
        socketRef.current = socket
        setState((prev) => ({
          ...prev,
          url,
          serverName,
          connected: false,
          error: undefined,
        }))

        socket.addEventListener('open', () =>
          setState((prev) => ({ ...prev, connected: true, error: undefined }))
        )
        socket.addEventListener('close', () =>
          setState((prev) => ({ ...prev, connected: false }))
        )
        socket.addEventListener('error', () =>
          setError('Failed to connect to server')
        )
        socket.addEventListener('message', (event) => {
          const raw = typeof event.data === 'string' ? event.data : null
          let parsed: unknown = raw
          if (raw) {
            try {
              parsed = JSON.parse(raw)
            } catch {
              parsed = raw
            }
          }

          handleIncomingMessage(parsed, raw)
        })
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Connection error')
      }
    },
    [disconnect, handleIncomingMessage, setError]
  )

  const send = useCallback(() => {
    const socket = socketRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setError('Connect to a server before sending messages')
      return
    }

    const payloadText = state.draft.payloadText?.trim()
    if (!payloadText) {
      setError('Payload cannot be empty')
      return
    }

    try {
      socket.send(payloadText)
      let parsed: unknown = payloadText
      try {
        parsed = JSON.parse(payloadText)
      } catch {
        parsed = payloadText
      }

      appendMessage({
        id: createMessageId(),
        direction: 'out',
        channel: state.draft.channel,
        payload: parsed,
        timestamp: Date.now(),
      })
      setError(undefined)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to send message')
    }
  }, [appendMessage, setError, state.draft, socketRef])

  const pushDraft = useCallback(
    (draft: Partial<WSClientDraft> & { payload?: unknown }) => {
      setState((prev) => ({
        ...prev,
        draft: {
          channel: draft.channel ?? prev.draft.channel,
          payloadText:
            draft.payloadText ??
            (draft.payload !== undefined
              ? formatPayload(draft.payload)
              : prev.draft.payloadText),
        },
      }))
    },
    []
  )

  const clearLog = useCallback(() => {
    setState((prev) => ({
      ...prev,
      messages: [],
    }))
  }, [])

  const value = useMemo<WSClientContextValue>(
    () => ({
      ...state,
      connect,
      disconnect,
      send,
      pushDraft,
      clearLog,
    }),
    [clearLog, connect, disconnect, pushDraft, send, state]
  )

  return (
    <WSClientContext.Provider value={value}>
      {children}
    </WSClientContext.Provider>
  )
}

export function useWSClient(): WSClientContextValue {
  const ctx = useContext(WSClientContext)
  if (!ctx) {
    throw new Error('useWSClient must be used inside a WSClientProvider')
  }
  return ctx
}

export function useOptionalWSClient(): WSClientContextValue | null {
  return useContext(WSClientContext)
}

function createMessageId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2)
}

function formatPayload(payload: unknown): string {
  if (typeof payload === 'string') return payload
  try {
    return JSON.stringify(payload ?? {}, null, 2)
  } catch {
    return JSON.stringify(String(payload))
  }
}
