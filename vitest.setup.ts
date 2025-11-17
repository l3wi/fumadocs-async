import { vi } from 'vitest'

if (typeof globalThis.crypto === 'undefined') {
  // Minimal crypto polyfill for tests
  globalThis.crypto = {
    randomUUID: () => Math.random().toString(36).slice(2),
    getRandomValues: (array: ArrayBufferView) => {
      const bytes = new Uint8Array(array.buffer)
      for (let i = 0; i < bytes.length; i += 1) {
        bytes[i] = Math.floor(Math.random() * 256)
      }
      return array
    },
  } as Crypto
}

vi.stubGlobal('fetch', async () => ({
  ok: true,
  text: async () => '',
}))
