import { describe, it, expect, vi } from 'vitest';
import { createWebSocketFetcher } from '../src/components/ws-client/fetcher';

describe('WebSocket Fetcher', () => {
  it('should create a fetcher with required methods', () => {
    const fetcher = createWebSocketFetcher();
    
    expect(typeof fetcher.connect).toBe('function');
    expect(typeof fetcher.disconnect).toBe('function');
    expect(typeof fetcher.send).toBe('function');
    expect(typeof fetcher.onMessage).toBe('function');
    expect(typeof fetcher.onStateChange).toBe('function');
    expect(typeof fetcher.getState).toBe('function');
  });

  it('should return initial disconnected state', () => {
    const fetcher = createWebSocketFetcher();
    const state = fetcher.getState();
    
    expect(state.connected).toBe(false);
    expect(state.error).toBeUndefined();
  });

  it('should handle message callbacks', () => {
    const fetcher = createWebSocketFetcher();
    const onMessage = vi.fn();
    const onStateChange = vi.fn();
    
    fetcher.onMessage(onMessage);
    fetcher.onStateChange(onStateChange);
    
    // Initial state should be reported
    expect(onStateChange).toHaveBeenCalledWith({
      connected: false,
    });
  });

  it('should handle connection errors gracefully', async () => {
    const fetcher = createWebSocketFetcher();
    const onStateChange = vi.fn();
    
    fetcher.onStateChange(onStateChange);
    
    // Try to connect with empty URL
    await fetcher.connect({ url: '' });
    
    const state = fetcher.getState();
    expect(state.connected).toBe(false);
    expect(state.error).toBe('WebSocket URL is required');
  });
});