'use client'

import type { OperationCardRenderData } from '../ui/components/operation-card.types'
import { OperationCard } from '../ui/components/operation-card.client'
import { WSClientProvider, WSSidebar } from '../components/ws-client'
import type { ServerOption } from '../components/ws-client/types'
import { getOperationAnchorId } from './helpers'

interface AsyncAPIMessagesClientProps {
  operations: OperationCardRenderData[]
  client?: {
    title?: string
    servers: ServerOption[]
  }
}

export function AsyncAPIMessagesClient({ operations, client }: AsyncAPIMessagesClientProps) {
  if (!operations.length) {
    return null
  }

  const content = (
    <div className="space-y-12">
      {operations.map((operation) => {
        const anchorId = getOperationAnchorId({
          id: operation.id,
          title: operation.title,
          channelName: operation.channelName,
        })

        return (
          <div key={operation.id} id={anchorId}>
            <OperationCard operation={operation} />
          </div>
        )
      })}
    </div>
  )

  if (!client) {
    return content
  }

  const sidebar = (
    <WSSidebar title={client.title ?? 'WebSocket Client'} servers={client.servers} />
  )

  return (
    <WSClientProvider>
      <div className="asyncapi-shell flex flex-col gap-8 xl:grid xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start xl:gap-10">
        <div className="asyncapi-shell-content min-w-0 flex-1">{content}</div>
        <aside className="asyncapi-shell-sidebar w-full xl:max-w-sm xl:justify-self-end xl:self-stretch">
          <div className="h-full">{sidebar}</div>
        </aside>
      </div>
    </WSClientProvider>
  )
}
