'use client';

import {
  type FC,
  type HTMLAttributes,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from 'react';
import { useQuery } from '../../utils/use-query';
import type { WSMessage, WSConnectionState } from './fetcher';

export interface WSPlaygroundProps extends HTMLAttributes<HTMLDivElement> {
  url: string;
  onMessage?: (message: WSMessage) => void;
  onStateChange?: (state: WSConnectionState) => void;
}

export interface WSPlaygroundState {
  messages: WSMessage[];
  draft: {
    payloadText: string;
    channel?: string;
  };
  connectionState: WSConnectionState;
}

export default function WSPlayground({
  url,
  onMessage,
  onStateChange,
  className,
  ...rest
}: WSPlaygroundProps) {
  const [messages, setMessages] = useState<WSMessage[]>([]);
  const [draft, setDraft] = useState({ payloadText: '{}', channel: '' });
  const [connectionState, setConnectionState] = useState<WSConnectionState>({
    connected: false,
  });

  const connectQuery = useQuery(async (targetUrl: string) => {
    const { createWebSocketFetcher } = await import('./fetcher');
    const fetcher = createWebSocketFetcher();

    // Set up message handling
    fetcher.onMessage((message) => {
      setMessages((prev) => [message, ...prev].slice(0, 100));
      onMessage?.(message);
    });

    fetcher.onStateChange((state) => {
      setConnectionState(state);
      onStateChange?.(state);
    });

    await fetcher.connect({ url: targetUrl });
    return fetcher;
  });

  const sendQuery = useQuery(
    async (data: { fetcher: any; payload: string }) => {
      await data.fetcher.send({ data: data.payload });
    }
  );

  const handleConnect = useCallback(() => {
    if (!url.trim()) {
      setConnectionState({ connected: false, error: 'URL is required' });
      return;
    }
    connectQuery.start(url);
  }, [url, connectQuery]);

  const handleDisconnect = useCallback(() => {
    if (connectQuery.data) {
      connectQuery.data.disconnect();
      setMessages([]);
      setConnectionState({ connected: false });
    }
  }, [connectQuery.data]);

  const handleSend = useCallback(() => {
    if (connectQuery.data && draft.payloadText.trim()) {
      sendQuery.start({
        fetcher: connectQuery.data,
        payload: draft.payloadText,
      });
    }
  }, [connectQuery.data, draft.payloadText, sendQuery]);

  const handleClearLog = useCallback(() => {
    setMessages([]);
  }, []);

  const state: WSPlaygroundState = useMemo(
    () => ({
      messages,
      draft,
      connectionState,
    }),
    [messages, draft, connectionState]
  );

  return (
    <div className={`ws-playground ${className ?? ''}`} {...rest}>
      <div className="space-y-4">
        {/* Connection Status */}
        <div className="flex items-center gap-2 text-sm">
          <div
            className={`w-2 h-2 rounded-full ${
              connectionState.connected ? 'bg-green-500' : 'bg-red-500'
            }`}
          />
          <span>
            {connectionState.connected
              ? 'Connected'
              : connectionState.error || 'Disconnected'}
          </span>
        </div>

        {/* Connection Controls */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleConnect}
            disabled={connectQuery.isLoading || connectionState.connected}
            className="px-3 py-1 text-sm bg-blue-500 text-white rounded disabled:opacity-50"
          >
            {connectQuery.isLoading ? 'Connecting...' : 'Connect'}
          </button>
          <button
            type="button"
            onClick={handleDisconnect}
            disabled={!connectionState.connected}
            className="px-3 py-1 text-sm bg-red-500 text-white rounded disabled:opacity-50"
          >
            Disconnect
          </button>
          <button
            type="button"
            onClick={handleClearLog}
            className="px-3 py-1 text-sm bg-gray-500 text-white rounded"
          >
            Clear Log
          </button>
        </div>

        {/* Message Input */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Message Payload:</label>
          <textarea
            value={draft.payloadText}
            onChange={(e) => setDraft({ ...draft, payloadText: e.target.value })}
            className="w-full h-32 p-2 text-sm font-mono border rounded"
            placeholder="Enter JSON message..."
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!connectionState.connected || sendQuery.isLoading}
            className="px-3 py-1 text-sm bg-green-500 text-white rounded disabled:opacity-50"
          >
            {sendQuery.isLoading ? 'Sending...' : 'Send Message'}
          </button>
        </div>

        {/* Messages Log */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Messages:</h4>
          <div className="h-64 overflow-auto border rounded p-2 bg-gray-50">
            {messages.length === 0 ? (
              <p className="text-sm text-gray-500">No messages yet</p>
            ) : (
              <div className="space-y-2">
                {messages.map((message, index) => (
                  <div
                    key={`${message.timestamp}-${index}`}
                    className={`text-sm p-2 rounded ${
                      message.direction === 'out'
                        ? 'bg-blue-100 ml-4'
                        : 'bg-green-100 mr-4'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-xs font-semibold ${
                          message.direction === 'out' ? 'text-blue-700' : 'text-green-700'
                        }`}
                      >
                        {message.direction === 'out' ? 'SENT' : 'RECEIVED'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <pre className="text-xs font-mono whitespace-pre-wrap">
                      {typeof message.data === 'string'
                        ? message.data
                        : JSON.stringify(message.data, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}