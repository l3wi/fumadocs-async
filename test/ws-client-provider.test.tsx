import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, act, waitFor, cleanup } from '@testing-library/react'
import { WSClientProvider, WSClientBoundary, useWSClient } from '../src/components/ws-client/provider'
import type { WSFetcher, WSConnectionOptions, WSSendOptions, WSMessage } from '../src/components/ws-client/fetcher'
import type { WSClientContextValue } from '../src/components/ws-client/types'
import { useEffect } from 'react'

class StubFetcher implements WSFetcher {
  private messageCallback: ((message: WSMessage) => void) | null = null
  private stateCallback: ((state: { connected: boolean; error?: string }) => void) | null = null
  private state = { connected: false, error: undefined as string | undefined }
  public connectCalls = 0
  public sendCalls: string[] = []

  async connect(options: WSConnectionOptions): Promise<void> {
    this.connectCalls += 1
    this.state.connected = true
    this.stateCallback?.({ connected: true })
  }

  disconnect(): void {
    this.state.connected = false
    this.stateCallback?.({ connected: false })
  }

  async send(options: WSSendOptions): Promise<void> {
    this.sendCalls.push(options.data)
  }

  onMessage(callback: (message: WSMessage) => void): void {
    this.messageCallback = callback
  }

  onStateChange(callback: (state: { connected: boolean; error?: string }) => void): void {
    this.stateCallback = callback
    callback(this.state)
  }

  getState() {
    return this.state
  }

  emitMessage(payload: unknown) {
    this.messageCallback?.({
      data: payload,
      timestamp: Date.now(),
      direction: 'in',
    })
  }

  emitError(error: string) {
    this.state.error = error
    this.stateCallback?.({ connected: this.state.connected, error })
  }
}

let latestClient: WSClientContextValue | null = null

function TestHarness() {
  const client = useWSClient()
  latestClient = client
  useEffect(() => {
    latestClient = client
  }, [client])
  return null
}

function renderWithFetcher(fetcher: StubFetcher) {
  latestClient = null
  render(
    <WSClientProvider fetcherFactory={async () => fetcher}>
      <TestHarness />
    </WSClientProvider>
  )
}

describe('WSClientProvider', () => {
  beforeEach(() => {
    cleanup()
    latestClient = null
  })

  it('connects and updates state', async () => {
    const fetcher = new StubFetcher()
    renderWithFetcher(fetcher)

    await waitFor(() => expect(latestClient).not.toBeNull())

    await act(async () => {
      latestClient!.connect('wss://example.com', 'Primary')
    })

    await waitFor(() => expect(latestClient!.connected).toBe(true))
    expect(fetcher.connectCalls).toBe(1)
    expect(latestClient!.serverName).toBe('Primary')
  })

  it('sends draft payloads and logs messages', async () => {
    const fetcher = new StubFetcher()
    renderWithFetcher(fetcher)
    await waitFor(() => expect(latestClient).not.toBeNull())

    await act(async () => {
      latestClient!.connect('wss://example.com')
    })
    await waitFor(() => expect(latestClient!.connected).toBe(true))

    await act(async () => {
      latestClient!.pushDraft({ payloadText: '{"hello":"world"}', channel: 'chat' })
    })

    await act(async () => {
      latestClient!.send()
    })

    await waitFor(() => expect(latestClient!.messages.length).toBe(1))
    const [entry] = latestClient!.messages
    expect(entry.direction).toBe('out')
    expect(entry.channel).toBe('chat')
    expect(fetcher.sendCalls).toEqual(['{"hello":"world"}'])
  })

  it('captures incoming messages from fetcher', async () => {
    const fetcher = new StubFetcher()
    renderWithFetcher(fetcher)
    await waitFor(() => expect(latestClient).not.toBeNull())

    await act(async () => {
      latestClient!.connect('wss://example.com')
    })
    await waitFor(() => expect(latestClient!.connected).toBe(true))

    act(() => {
      fetcher.emitMessage({ ping: true })
    })

    await waitFor(() => expect(latestClient!.messages.length).toBe(1))
    expect(latestClient!.messages[0].direction).toBe('in')
  })

  it('sets error when sending without connection', async () => {
    const fetcher = new StubFetcher()
    renderWithFetcher(fetcher)
    await waitFor(() => expect(latestClient).not.toBeNull())

    await act(async () => {
      latestClient!.send()
    })

    expect(latestClient!.error).toBe('Connect to a server before sending messages')
  })
})

describe('WSClientBoundary', () => {
  beforeEach(() => {
    cleanup()
    latestClient = null
  })

  it('creates a provider when no parent exists', async () => {
    const fetcher = new StubFetcher()

    render(
      <WSClientBoundary fetcherFactory={async () => fetcher}>
        <TestHarness />
      </WSClientBoundary>
    )

    await waitFor(() => expect(latestClient).not.toBeNull())

    await act(async () => {
      latestClient!.connect('wss://example.com')
    })

    await waitFor(() => expect(fetcher.connectCalls).toBe(1))
  })

  it('reuses an ancestor provider if present', async () => {
    const parentFetcher = new StubFetcher()
    const fallbackFactory = vi.fn(async () => new StubFetcher())

    render(
      <WSClientProvider fetcherFactory={async () => parentFetcher}>
        <WSClientBoundary fetcherFactory={fallbackFactory}>
          <TestHarness />
        </WSClientBoundary>
      </WSClientProvider>
    )

    await waitFor(() => expect(latestClient).not.toBeNull())

    await act(async () => {
      latestClient!.connect('wss://example.com')
    })

    await waitFor(() => expect(parentFetcher.connectCalls).toBe(1))
    expect(fallbackFactory).not.toHaveBeenCalled()
  })
})
