import type {
  AsyncAPIPageProps,
  AsyncAPIDocument,
  AsyncAPIServer,
  ProcessedAsyncDocument,
} from '../types'
import { processDocument } from '../server/create/process-document'

export async function resolveAsyncAPIDocument(
  documentInput: AsyncAPIPageProps['document'],
  server?: AsyncAPIServer
): Promise<ProcessedAsyncDocument> {
  if (documentInput instanceof Promise) {
    return resolveAsyncAPIDocument(await documentInput, server)
  }

  if (typeof documentInput === 'string') {
    const serverResult = server ? await tryResolveServerDocument(server, documentInput) : undefined
    if (serverResult?.resolved) {
      return serverResult.resolved
    }

    const inlineSource = await tryLoadInlineSource(documentInput)
    if (inlineSource) {
      return parseAsyncAPISource(inlineSource.source, inlineSource.sourceName)
    }

    if (serverResult) {
      const available = serverResult.availableKeys.length
        ? `Available keys: ${serverResult.availableKeys.join(', ')}`
        : 'No AsyncAPI schemas are currently loaded.'
      throw new Error(`AsyncAPI document "${documentInput}" not found. ${available}`)
    }

    throw new Error(
      'Unable to resolve AsyncAPI document from string input. Provide a registered key or inline AsyncAPI schema content.'
    )
  }

  if (isProcessedDocument(documentInput)) {
    return documentInput
  }

  if (isAsyncAPIDocument(documentInput)) {
    return processDocument(documentInput)
  }

  throw new Error('Unsupported AsyncAPI document type. Pass a schema key string, AsyncAPIDocument, or processed document.')
}

export function toSerializableProcessedDocument(
  document: ProcessedAsyncDocument
): ProcessedAsyncDocument {
  if (!document?.document) {
    return document
  }

  const plainDocument =
    typeof document.document === 'object' &&
    document.document !== null &&
    'json' in document.document &&
    typeof (document.document as AsyncAPIDocument).json === 'function'
      ? ((document.document as AsyncAPIDocument).json() as AsyncAPIDocument)
      : undefined

  return {
    ...document,
    document: plainDocument as typeof document.document,
  }
}

interface ServerResolutionResult {
  resolved?: ProcessedAsyncDocument
  availableKeys: string[]
}

async function tryResolveServerDocument(
  server: AsyncAPIServer,
  key: string
): Promise<ServerResolutionResult | undefined> {
  if (!server || typeof server.getSchemas !== 'function') return undefined
  try {
    const schemas = await server.getSchemas()
    return {
      resolved: schemas[key],
      availableKeys: Object.keys(schemas),
    }
  } catch {
    return undefined
  }
}

interface InlineSourceResult {
  source: string
  sourceName: string
}

async function tryLoadInlineSource(value: string): Promise<InlineSourceResult | undefined> {
  const trimmed = value.trim()
  if (!trimmed) return undefined

  if (looksLikeInlineSpec(trimmed)) {
    return { source: value, sourceName: 'inline-asyncapi' }
  }

  if (isLikelyUrl(trimmed) && typeof fetch === 'function') {
    const response = await fetch(trimmed)
    if (!response.ok) {
      throw new Error(
        `Failed to fetch AsyncAPI document from "${trimmed}": ${response.status} ${response.statusText}`
      )
    }
    return { source: await response.text(), sourceName: trimmed }
  }

  // Try to load as a file path (Node.js environment only)
  if (typeof process !== 'undefined' && process.versions?.node) {
    try {
      const fs = await import('fs/promises')
      const path = await import('path')
      
      // Resolve relative paths from the current working directory
      const resolvedPath = path.isAbsolute(trimmed) 
        ? trimmed 
        : path.resolve(process.cwd(), trimmed)
      
      const source = await fs.readFile(resolvedPath, 'utf-8')
      return { source, sourceName: resolvedPath }
    } catch (error) {
      // File not found or can't be read, continue to other options
      console.debug(`Failed to load AsyncAPI file from path "${trimmed}":`, error)
    }
  }

  return undefined
}

async function parseAsyncAPISource(
  source: string,
  sourceName: string
): Promise<ProcessedAsyncDocument> {
  // Ensure we're in a server environment
  if (typeof window !== 'undefined') {
    throw new Error('AsyncAPI parsing can only be performed on the server side')
  }

  // Polyfill global object for @asyncapi parser if needed
  if (typeof (globalThis as any).global === 'undefined') {
    (globalThis as any).global = globalThis
  }

  // Dynamic import to avoid SSR issues
  const { Parser } = await import('@asyncapi/parser')
  const parser = new Parser()
  const { document, diagnostics } = await parser.parse(source, {
    source: sourceName,
    applyTraits: true,
  })

  const criticalDiagnostics = (diagnostics ?? []).filter((diag) => diag.severity === 0)
  const errorDiagnostics = (diagnostics ?? []).filter((diag) => diag.severity <= 1) // Include errors and warnings
  
  if (criticalDiagnostics.length > 0) {
    const formatted = formatDiagnostics(errorDiagnostics)
    console.warn(`AsyncAPI document "${sourceName}" has validation issues:\n${formatted}`)
    // Don't throw error for now, just log warnings to see if parsing works
  }

  if (!document) {
    throw new Error(`AsyncAPI parser did not return a document for "${sourceName}".`)
  }

  return processDocument(document)
}

function formatDiagnostics(
  diagnostics: Array<{ message: string; path?: Array<string | number> }>
): string {
  return diagnostics
    .map((diag) => {
      const path = diag.path?.length ? diag.path.map(String).join('.') : undefined
      return `${diag.message}${path ? ` at ${path}` : ''}`
    })
    .join('\n')
}



function isProcessedDocument(value: unknown): value is ProcessedAsyncDocument {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as ProcessedAsyncDocument).operations)
  )
}

function isAsyncAPIDocument(value: unknown): value is AsyncAPIDocument {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as AsyncAPIDocument).allChannels === 'function'
  )
}

function looksLikeInlineSpec(value: string): boolean {
  if (!value) return false
  return value.startsWith('{') || value.startsWith('asyncapi:') || value.includes('\n')
}

function isLikelyUrl(value: string): boolean {
  return value.startsWith('http://') || value.startsWith('https://')
}
