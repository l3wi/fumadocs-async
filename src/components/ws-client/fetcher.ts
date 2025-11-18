export interface WSConnectionOptions {
  url: string;
  protocols?: string[];
}

export interface WSSendOptions {
  data: string;
}

export interface WSMessage {
  data: unknown;
  raw?: string;
  timestamp: number;
  direction: 'in' | 'out';
}

export type WSErrorType = 'connection' | 'message';

export interface WSConnectionState {
  connected: boolean;
  error?: string;
  errorType?: WSErrorType;
}

export interface WSFetcher {
  connect: (options: WSConnectionOptions) => Promise<void>;
  disconnect: () => void;
  send: (options: WSSendOptions) => Promise<void>;
  onMessage: (callback: (message: WSMessage) => void) => void;
  onStateChange: (callback: (state: WSConnectionState) => void) => void;
  getState: () => WSConnectionState;
}

export function createWebSocketFetcher(): WSFetcher {
  let socket: WebSocket | null = null;
  let messageCallback: ((message: WSMessage) => void) | null = null;
  let stateCallback: ((state: WSConnectionState) => void) | null = null;
  let currentState: WSConnectionState = { connected: false };

  const updateState = (newState: Partial<WSConnectionState>) => {
    currentState = { ...currentState, ...newState };
    stateCallback?.(currentState);
  };

  const handleMessage = (event: MessageEvent) => {
    const raw = typeof event.data === 'string' ? event.data : undefined;
    let parsed: unknown = raw;
    
    if (raw) {
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = raw;
      }
    }

    const message: WSMessage = {
      data: parsed ?? raw,
      raw,
      timestamp: Date.now(),
      direction: 'in',
    };

    messageCallback?.(message);
  };

  return {
    async connect(options) {
      if (!options.url) {
        updateState({ error: 'WebSocket URL is required', errorType: 'connection' });
        return;
      }

      this.disconnect();

      try {
        socket = new WebSocket(options.url, options.protocols);
        updateState({ connected: false, error: undefined, errorType: undefined });

        socket.addEventListener('open', () => {
          updateState({ connected: true, error: undefined, errorType: undefined });
        });

        socket.addEventListener('close', () => {
          updateState({ connected: false, error: undefined, errorType: undefined });
        });

        socket.addEventListener('error', () => {
          updateState({ error: 'Failed to connect to server', errorType: 'connection' });
        });

        socket.addEventListener('message', handleMessage);
      } catch (error) {
        updateState({ 
          error: error instanceof Error ? error.message : 'Connection error',
          errorType: 'connection',
        });
      }
    },

    disconnect() {
      if (socket) {
        socket.close();
        socket = null;
      }
      updateState({ connected: false, error: undefined, errorType: undefined });
    },

    async send(options) {
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        updateState({ error: 'Connect to a server before sending messages', errorType: 'message' });
        return;
      }

      if (!options.data?.trim()) {
        updateState({ error: 'Payload cannot be empty', errorType: 'message' });
        return;
      }

      try {
        socket.send(options.data);
        
        let parsed: unknown = options.data;
        try {
          parsed = JSON.parse(options.data);
        } catch {
          parsed = options.data;
        }

        const message: WSMessage = {
          data: parsed,
          timestamp: Date.now(),
          direction: 'out',
        };

        messageCallback?.(message);
        updateState({ error: undefined, errorType: undefined });
      } catch (error) {
        updateState({ 
          error: error instanceof Error ? error.message : 'Failed to send message',
          errorType: 'message',
        });
      }
    },

    onMessage(callback) {
      messageCallback = callback;
    },

    onStateChange(callback) {
      stateCallback = callback;
      callback(currentState);
    },

    getState() {
      return currentState;
    },
  };
}
