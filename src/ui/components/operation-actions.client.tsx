'use client'

import type { MessageInfo, OperationInfo } from '../../types'
import { useOptionalWSClient } from '../../components/ws-client'

interface OperationActionsProps {
  operation: OperationInfo
  message?: MessageInfo
}

export function OperationActions({ operation, message }: OperationActionsProps) {
  const client = useOptionalWSClient()

  if (!client) return null

  const handleLoadDraft = () => {
    client.pushDraft({
      channel: operation.channel,
      payload: message?.examples?.[0] ?? message?.schema ?? {},
    })
  }

  return (
    <button
      type="button"
      onClick={handleLoadDraft}
      className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-[11px] font-medium text-foreground transition hover:bg-muted"
    >
      Load into WebSocket client
    </button>
  )
}
