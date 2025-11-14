'use client'

import type { MessageInfo, OperationInfo } from '../../types'
import { useOptionalWSClient } from '../../components/ws-client'

interface OperationActionsProps {
  operation: OperationInfo
  message?: MessageInfo
  payload?: unknown
  className?: string
}

export function OperationActions({
  operation,
  message,
  payload,
  className,
}: OperationActionsProps) {
  const client = useOptionalWSClient()

  if (!client) return null

  const handleLoadDraft = () => {
    const payloadValue =
      payload ?? message?.examples?.[0] ?? message?.schema ?? message?.payload ?? {}
    client.pushDraft({
      channel: operation.channel,
      payload: payloadValue,
    })
  }

  return (
    <button
      type="button"
      onClick={handleLoadDraft}
      className={`inline-flex items-center justify-center rounded-md border border-border/70 bg-background/80 px-2.5 py-1 text-xs font-medium text-foreground shadow-sm transition hover:bg-muted ${className ?? ''}`}
    >
      Load
    </button>
  )
}
