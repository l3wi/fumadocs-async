import type {
  AsyncAPIPageClientOptions,
  ProcessedAsyncDocument,
  AsyncRenderContext,
} from '../../types'
import type { ServerOption } from '../../components/ws-client'

interface ResolveServerOptions {
  getServerUrl?: AsyncRenderContext['getServerUrl']
}

export async function resolveClientServers(
  processed: ProcessedAsyncDocument,
  option: AsyncAPIPageClientOptions['servers'],
  extra: ResolveServerOptions = {}
): Promise<ServerOption[]> {
  if (Array.isArray(option)) {
    return option
  }

  if (typeof option === 'function') {
    const result = await option({ document: processed })
    return Array.isArray(result) ? result : []
  }

  return mapDocumentServers(processed, extra)
}

export function mapDocumentServers(
  processed: ProcessedAsyncDocument,
  extra: ResolveServerOptions = {}
): ServerOption[] {
  if (!processed.servers?.length) return []

  return processed.servers
    .map((server) => {
      const url = server.url ?? extra.getServerUrl?.(server.name)
      if (!url) return null
      return {
        name: server.name ?? server.url ?? server.protocol ?? 'Server',
        url,
      }
    })
    .filter((server): server is ServerOption => server !== null)
}
