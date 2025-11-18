'use client'

import type { MessageInfo, OperationInfo } from '../../types'
import { useOptionalWSClient } from '../../components/ws-client'
import { useMessagePayloadTransformer } from '../state/message-payload-transformer'
import { runDraftPayloadTransformer } from '../utils/payload-transformer'

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
  const payloadTransformer = useMessagePayloadTransformer()

  if (!client) return null

  const handleLoadDraft = async () => {
    const payloadValue =
      payload ?? message?.examples?.[0] ?? message?.schema ?? message?.payload ?? {}
    const meta = {
      source: 'operation-actions' as const,
      channelName: operation.channel,
      operationId: operation.operationId ?? operation.id,
      operationName: operation.summary ?? operation.operationId ?? operation.id,
      operationDirection: operation.direction,
      messageName: message?.title ?? message?.name,
      messageType: 'message' as const,
    }
    const resolvedPayload = await runDraftPayloadTransformer(
      payloadTransformer,
      payloadValue,
      meta
    )
    client.pushDraft({
      channel: operation.channel,
      payload: resolvedPayload,
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
