'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type {
  WSClientContextValue,
  WSClientDraft,
  WSClientState,
  WSMessageEntry,
} from './types'
import { useQuery } from '../../utils/use-query'
import type { WSMessage, WSConnectionState, WSFetcher } from './fetcher'

const INITIAL_DRAFT: WSClientDraft = {
  payloadText: '{}',
}

const WSClientContext = getOrCreateWSClientContext()

type WSContextInstance = ReturnType<typeof createContext<WSClientContextValue | null>>

function getOrCreateWSClientContext(): WSContextInstance {
  const globalRef = getGlobalObject()
  const contextKey = Symbol.for('fumadocs-asyncapi.ws-client-context')

  if (globalRef) {
    const existing = globalRef[contextKey]
    if (existing) {
      return existing as WSContextInstance
    }
    const created: WSContextInstance = createContext<WSClientContextValue | null>(null)
    globalRef[contextKey] = created
    return created
  }

  return createContext<WSClientContextValue | null>(null)
}

function getGlobalObject(): Record<PropertyKey, unknown> | null {
  if (typeof globalThis !== 'undefined') {
    return globalThis as Record<PropertyKey, unknown>
  }
  return null
}

interface WSClientProviderProps {
  children: ReactNode
  fetcherFactory?: () => Promise<WSFetcher>
}

const defaultFetcherFactory = async () => {
  const { createWebSocketFetcher } = await import('./fetcher')
  return createWebSocketFetcher()
}

export function WSClientProvider({
  children,
  fetcherFactory = defaultFetcherFactory,
}: WSClientProviderProps) {
  const [state, setState] = useState<WSClientState>({
    connected: false,
    messages: [],
    draft: INITIAL_DRAFT,
    errorSource: undefined,
    connectionError: undefined,
  })

  const connectQuery = useQuery(async (url: string) => {
    const fetcher = await fetcherFactory()

    // Set up message handling
    fetcher.onMessage((message: WSMessage) => {
      const entry: WSMessageEntry = {
        id: createMessageId(),
        direction: message.direction,
        channel: undefined,
        payload: message.data,
        timestamp: message.timestamp,
      }
      setState((prev) => ({
        ...prev,
        messages: [entry, ...prev.messages].slice(0, 100),
      }))
    })

    fetcher.onStateChange((connectionState: WSConnectionState) => {
      setState((prev) => {
        const isConnectionError =
          Boolean(connectionState.error) && connectionState.errorType === 'connection'
        const isMessageError =
          Boolean(connectionState.error) && connectionState.errorType === 'message'
        const hasNoError = !connectionState.error

        const nextState = {
          ...prev,
          connected: connectionState.connected,
        }

        if (isConnectionError && connectionState.error) {
          nextState.connectionError = {
            message: connectionState.error,
            at: Date.now(),
          }
        } else if (connectionState.connected) {
          nextState.connectionError = undefined
        }

        if (isMessageError && connectionState.error) {
          nextState.error = connectionState.error
          nextState.errorSource = 'fetcher'
        } else if (hasNoError && prev.errorSource === 'fetcher') {
          nextState.error = undefined
          nextState.errorSource = undefined
        }

        return nextState
      })
    })

    await fetcher.connect({ url })
    return fetcher
  })

  const sendQuery = useQuery(async (data: { fetcher: WSFetcher; payload: string }) => {
    await data.fetcher.send({ data: data.payload })
  })

  const connect = useCallback(
    (url: string, serverName?: string) => {
      if (!url) {
        setState((prev) => ({ ...prev, error: 'WebSocket URL is required', errorSource: 'manual' }))
        return
      }

      setState((prev) => ({
        ...prev,
        url,
        serverName,
        connected: false,
        error: undefined,
        errorSource: undefined,
        connectionError: undefined,
      }))

      connectQuery.start(url)
    },
    [connectQuery]
  )

  const disconnect = useCallback(() => {
    if (connectQuery.data) {
      connectQuery.data.disconnect()
      setState((prev) => ({
        ...prev,
        connected: false,
        connectionError: undefined,
      }))
    }
  }, [connectQuery.data])

  const send = useCallback(() => {
    const payloadText = state.draft.payloadText?.trim()
    if (!payloadText) {
      setState((prev) => ({ ...prev, error: 'Payload cannot be empty', errorSource: 'manual' }))
      return
    }

    if (!connectQuery.data) {
      setState((prev) => ({ ...prev, error: 'Connect to a server before sending messages', errorSource: 'manual' }))
      return
    }

    setState((prev) => ({ ...prev, error: undefined, errorSource: undefined }))

    sendQuery.start({
      fetcher: connectQuery.data,
      payload: payloadText,
    })
  }, [connectQuery.data, state.draft, sendQuery])

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

interface WSClientBoundaryProps extends Partial<Omit<WSClientProviderProps, 'children'>> {
  children: ReactNode
}

export function WSClientBoundary({ children, fetcherFactory }: WSClientBoundaryProps) {
  const parentClient = useContext(WSClientContext)
  if (parentClient) {
    return <>{children}</>
  }

  return (
    <WSClientProvider fetcherFactory={fetcherFactory}>
      {children}
    </WSClientProvider>
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
