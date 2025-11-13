import { Parser } from '@asyncapi/parser'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type {
  AsyncAPIDocument,
  AsyncAPIOptions,
  AsyncAPIServer,
  ProcessedAsyncDocument,
} from '../types'
import { processDocument } from './create/process-document'

const parser = new Parser()

type InputResolver =
  | {
      key: string
      source: string
      fingerprint: string
    }
  | {
      key: string
      document: AsyncAPIDocument
      fingerprint: string
    }

export function createAsyncAPI(options: AsyncAPIOptions = {}): AsyncAPIServer {
  const cache = new Map<string, ProcessedAsyncDocument>()
  const fingerprints = new Map<string, string>()

  return {
    options,
    async getSchemas() {
      const entries = await resolveInputEntries(options.input)

      if (entries.length === 0) {
        throw new Error('createAsyncAPI: no AsyncAPI inputs provided.')
      }

      const result: Record<string, ProcessedAsyncDocument> = {}
      const seenKeys = new Set<string>()

      for (const entry of entries) {
        seenKeys.add(entry.key)
        const cachedFingerprint = fingerprints.get(entry.key)

        if (
          !options.disableCache &&
          cachedFingerprint &&
          cachedFingerprint === entry.fingerprint &&
          cache.has(entry.key)
        ) {
          result[entry.key] = cache.get(entry.key)!
          continue
        }

        const processed =
          'document' in entry
            ? processDocument(entry.document)
            : await parseAndProcess(entry.key, entry.source)

        cache.set(entry.key, processed)
        fingerprints.set(entry.key, entry.fingerprint)
        result[entry.key] = processed
      }

      for (const key of Array.from(cache.keys())) {
        if (!seenKeys.has(key)) {
          cache.delete(key)
          fingerprints.delete(key)
        }
      }

      return result
    },
  }
}

async function parseAndProcess(
  key: string,
  source: string
): Promise<ProcessedAsyncDocument> {
  const { document, diagnostics } = await parser.parse(source, {
    source: key,
    applyTraits: true,
  })

  const criticalDiagnostics = diagnostics.filter((diag) => diag.severity === 0)
  if (criticalDiagnostics.length > 0) {
    const formatted = criticalDiagnostics
      .map((diag) => `${diag.message} at ${diag.path?.join('.') ?? 'unknown'}`)
      .join('\n')
    throw new Error(
      `Failed to parse AsyncAPI document "${key}":\n${formatted}`
    )
  }

  if (!document) {
    throw new Error(`AsyncAPI parser did not return a document for "${key}".`)
  }

  return processDocument(document)
}

async function resolveInputEntries(
  input: AsyncAPIOptions['input']
): Promise<InputResolver[]> {
  if (!input) return []

  if (Array.isArray(input)) {
    const entries = await Promise.all(
      input.map(async (target) => {
        const loaded = await loadExternalSource(target)
        return {
          key: loaded.key,
          source: loaded.source,
          fingerprint: fingerprint(loaded.source),
        } as InputResolver
      })
    )
    return entries
  }

  const record = await input()
  if (!record) return []

  const entries: InputResolver[] = []

  for (const [key, value] of Object.entries(record)) {
    if (typeof value === 'string') {
      entries.push({
        key,
        source: value,
        fingerprint: fingerprint(value),
      })
    } else if (value) {
      const json = value.json()
      entries.push({
        key,
        document: value,
        fingerprint: fingerprint(JSON.stringify(json)),
      })
    }
  }

  return entries
}

async function loadExternalSource(target: string): Promise<{
  key: string
  source: string
}> {
  if (isUrl(target)) {
    const url = new URL(target)
    if (url.protocol === 'file:') {
      const filePath = fileURLToPath(url)
      return {
        key: target,
        source: await readFile(filePath, 'utf8'),
      }
    }

    const response = await fetch(target)
    if (!response.ok) {
      throw new Error(
        `Failed to fetch AsyncAPI document from "${target}": ${response.status} ${response.statusText}`
      )
    }

    return {
      key: target,
      source: await response.text(),
    }
  }

  const absolutePath = path.isAbsolute(target)
    ? target
    : path.resolve(process.cwd(), target)

  return {
    key: absolutePath,
    source: await readFile(absolutePath, 'utf8'),
  }
}

function fingerprint(value: string): string {
  return createHash('sha1').update(value).digest('hex')
}

function isUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'file:'
  } catch {
    return false
  }
}
