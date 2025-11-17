import { Fragment } from 'react'
import type { MetaData, PageData, Source, VirtualFile } from 'fumadocs-core/source'
import type {
  AsyncAPIServer,
  AsyncAPIPageProps,
  AsyncSchemaToPagesOptions,
} from '../types'
import { OperationBadge } from '../ui/components/operation-badge'
import {
  buildPageEntries,
  extractDocumentName,
  slugify,
  type AsyncPageEntry,
} from './utils/page-context'

interface TransformContext {
  storage: {
    read: (path: string) =>
      | { format: 'page'; data: PageData }
      | { format: 'meta'; data: MetaData }
      | undefined
  }
}

interface LoaderPlugin {
  name?: string
  enforce?: 'pre' | 'post'
  transformPageTree?: {
    file?: (this: TransformContext, node: any, filePath?: string) => any
  }
}

declare module 'fumadocs-core/source' {
  interface PageData {
    _asyncapi?: {
      channel?: string
      direction?: 'publish' | 'subscribe'
      operationId?: string
    }
  }
}



export function asyncapiPlugin(): LoaderPlugin {
  return {
    name: 'fumadocs:asyncapi',
    enforce: 'pre',
    transformPageTree: {
      file(this: TransformContext, node, filePath?: string) {
        if (!filePath) return node
        const file = this.storage.read(filePath)
        if (!file || file.format !== 'page') return node
        const data = file.data as PageData | (PageData & { _asyncapi?: Record<string, unknown> })
        const direction =
          data && typeof data === 'object' && '_asyncapi' in data
            ? (data as PageData & { _asyncapi?: { direction?: 'publish' | 'subscribe' } })
                ._asyncapi?.direction
            : undefined

        if (direction) {
          node.name = (
            <Fragment>
              {node.name}{' '}
              <OperationBadge
                className="ms-auto text-nowrap text-[10px]"
                direction={direction}
              />
            </Fragment>
          )
        }

        return node
      },
    },
  }
}

interface AsyncAPISourceOptions extends AsyncSchemaToPagesOptions {
  baseDir?: string
}

export async function asyncapiSource(
  asyncapi: AsyncAPIServer,
  options: AsyncAPISourceOptions = {}
): Promise<Source> {
  const { baseDir = '' } = options
  const schemas = await asyncapi.getSchemas()
  const files: VirtualFile[] = []
  const normalizedBase = normalizeBaseDir(baseDir)

  for (const [key, document] of Object.entries(schemas)) {
    const pageEntries = buildPageEntries(key, document, options)
    const usedPaths = new Set<string>()

    for (const entry of pageEntries) {
      const relativePath = createVirtualPath(entry, key, usedPaths)
      const pathWithBase = [normalizedBase, relativePath]
        .filter(Boolean)
        .join('/')
      const channelName = entry.channel?.name

      files.push({
        type: 'page',
        path: pathWithBase,
        data: {
          title: entry.title,
          description: entry.description,
          _asyncapi: {
            ...(channelName ? { channel: channelName } : {}),
            direction: entry.operation?.direction,
            operationId: entry.operation?.operationId ?? entry.operation?.id,
            ...(entry.tags?.length ? { tags: entry.tags } : {}),
          },
        },
      })
    }
  }

  return {
    files,
  }
}

function createVirtualPath(
  entry: AsyncPageEntry,
  documentKey: string,
  usedPaths: Set<string>
): string {
  const docSlug = slugify(extractDocumentName(documentKey))
  const segments = [docSlug]
  if (entry.groupSlug) segments.push(entry.groupSlug)

  let slug = entry.slug || 'asyncapi'
  let candidate = [...segments, slug].join('/')
  let counter = 1

  while (usedPaths.has(candidate)) {
    slug = `${entry.slug}-${counter++}`
    candidate = [...segments, slug].join('/')
  }

  usedPaths.add(candidate)
  return candidate
}

function normalizeBaseDir(value: string): string {
  return value.replace(/^\//, '').replace(/\/$/, '')
}
