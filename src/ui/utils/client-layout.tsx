import type {
  AsyncAPIPageClientOptions,
  AsyncRenderContext,
} from '../../types'
import type { ReactNode } from 'react'
import { WSClientProvider, WSSidebar } from '../../components/ws-client'
import type { ServerOption } from '../../components/ws-client'

export async function renderClientSidebar(
  clientOptions: AsyncAPIPageClientOptions,
  servers: ServerOption[],
  ctx: AsyncRenderContext
): Promise<ReactNode | null> {
  if (clientOptions.renderSidebar) {
    const custom = await clientOptions.renderSidebar({ servers, ctx })
    if (custom !== undefined) {
      return custom
    }
  }

  return <WSSidebar title={clientOptions.title ?? 'WebSocket Client'} servers={servers} />
}

export async function renderClientLayout(
  clientOptions: AsyncAPIPageClientOptions,
  content: ReactNode,
  sidebar: ReactNode,
  ctx: AsyncRenderContext,
  servers: ServerOption[]
): Promise<ReactNode> {
  if (clientOptions.renderLayout) {
    return clientOptions.renderLayout({ content, sidebar, ctx, servers })
  }

  return (
    <div className="asyncapi-shell flex flex-col gap-8 xl:grid xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start xl:gap-10">
      <div className="asyncapi-shell-content min-w-0 flex-1">{content}</div>
      <aside className="asyncapi-shell-sidebar w-full xl:max-w-sm xl:justify-self-end xl:self-stretch">
        <div className="h-full">{sidebar}</div>
      </aside>
    </div>
  )
}

export async function renderClientProvider(
  clientOptions: AsyncAPIPageClientOptions,
  children: ReactNode,
  ctx: AsyncRenderContext,
  servers: ServerOption[]
): Promise<ReactNode> {
  if (clientOptions.renderProvider) {
    return clientOptions.renderProvider({ children, ctx, servers })
  }

  return <WSClientProvider>{children}</WSClientProvider>
}
