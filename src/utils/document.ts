import type {
  AsyncAPIPageProps,
  AsyncAPIDocument,
  AsyncAPIServer,
  ProcessedAsyncDocument,
} from '../types'
import { createAsyncAPI } from '../server/create'
import { processDocument } from '../server/create/process-document'

export async function resolveAsyncAPIDocument(
  documentInput: ProcessedAsyncDocument | string | AsyncAPIDocument | Promise<AsyncAPIDocument>,
  server?: AsyncAPIServer
): Promise<ProcessedAsyncDocument> {
  if (documentInput instanceof Promise) {
    return resolveAsyncAPIDocument(await documentInput, server)
  }

  if (typeof documentInput === 'string') {
    const trimmed = documentInput.trim()
    const serverResult = server
      ? await tryResolveServerDocument(server, trimmed)
      : undefined
    if (serverResult?.resolved) {
      return serverResult.resolved
    }

    const inlineDocument = await tryLoadDocumentFromSource(trimmed)
    if (inlineDocument) {
      return inlineDocument
    }

    if (serverResult) {
      const available = serverResult.availableKeys.length
        ? `Available keys: ${serverResult.availableKeys.join(', ')}`
        : 'No AsyncAPI schemas are currently loaded.'
      throw new Error(`AsyncAPI document "${trimmed}" not found. ${available}`)
    }

    throw new Error(
      'Unable to resolve AsyncAPI document from string input. Provide a registered key, file path/URL, or inline AsyncAPI schema content.'
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

async function tryLoadDocumentFromSource(
  value: string
): Promise<ProcessedAsyncDocument | undefined> {
  if (!shouldAttemptInlineLoad(value)) {
    return undefined
  }

  const inlineKey = deriveInlineKey(value)
  const inlineServer = createAsyncAPI({
    disableCache: true,
    input: async () => ({ [inlineKey]: value }),
  })

  const schemas = await inlineServer.getSchemas()
  const result = schemas[inlineKey]
  if (!result) {
    throw new Error(`AsyncAPI parser did not return a document for "${inlineKey}".`)
  }

  return result
}

function shouldAttemptInlineLoad(value: string): boolean {
  if (!value) return false
  const trimmed = value.trim()
  if (!trimmed) return false
  return looksLikeInlineSpec(trimmed) || isLikelyUrl(trimmed) || looksLikeFileReference(trimmed)
}

function deriveInlineKey(value: string): string {
  if (isLikelyUrl(value) || looksLikeFileReference(value)) {
    return value
  }
  return 'inline-asyncapi'
}

function looksLikeInlineSpec(value: string): boolean {
  if (!value) return false
  return value.startsWith('{') || value.startsWith('asyncapi:') || value.includes('\n')
}

function isLikelyUrl(value: string): boolean {
  return value.startsWith('http://') || value.startsWith('https://') || value.startsWith('file:')
}

function looksLikeFileReference(value: string): boolean {
  return /[\\/]/.test(value) || /\.(ya?ml|json)$/i.test(value)
}
