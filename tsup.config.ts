import { defineConfig } from 'tsup'

export default defineConfig([
  // Main entry point
  {
    entry: {
      index: 'src/index.ts',
    },
    format: ['esm'],
    dts: true,
    clean: true,
    external: [
      'react',
      'react-dom',
      'next',
      '@asyncapi/parser',
      'fumadocs-core',
    ],
    splitting: true,
    sourcemap: true,
    minify: false,
  },
  // Server-side entry point
  {
    entry: {
      'server/index': 'src/server/index.ts',
    },
    format: ['esm'],
    dts: true,
    clean: false, // Don't clean dist between builds
    external: [
      'react',
      'react-dom',
      'next',
      '@asyncapi/parser',
      'fumadocs-core',
    ],
    splitting: true,
    sourcemap: true,
    minify: false,
  },
  // UI entry point
  {
    entry: {
      'ui/index': 'src/ui/index.ts',
    },
    format: ['esm'],
    dts: true,
    clean: false,
    external: [
      'react',
      'react-dom',
      'next',
      '@asyncapi/parser',
      'fumadocs-core',
    ],
    splitting: true,
    sourcemap: true,
    minify: false,
  },
  // Next-specific helpers
  {
    entry: {
      'next/index': 'src/next/index.ts',
    },
    format: ['esm'],
    dts: true,
    clean: false,
    external: [
      'react',
      'react-dom',
      'next',
      '@asyncapi/parser',
      'fumadocs-core',
    ],
    splitting: true,
    sourcemap: true,
    minify: false,
  },
  // Client-only widgets (WebSocket UI, hooks, etc.)
  {
    entry: {
      'client/index': 'src/client.ts',
    },
    format: ['esm'],
    dts: true,
    clean: false,
    external: [
      'react',
      'react-dom',
      'next',
      '@asyncapi/parser',
      'fumadocs-core',
    ],
    splitting: true,
    sourcemap: true,
    minify: false,
  },
])
