import type {
  ChannelInfo,
  OperationInfo,
  AsyncCreatePageOptions,
} from '../../types'
import type {
  OperationCardRenderData,
  OperationMessageData,
} from '../components/operation-card.types'
import { createOperationMessageData } from './message-tab'

export interface OperationCardBuilderOptions {
  channelHref?: AsyncCreatePageOptions['channelHref']
}

export function buildOperationCardRenderData(
  channel: ChannelInfo,
  operation: OperationInfo,
  options: OperationCardBuilderOptions = {}
): OperationCardRenderData {
  const id = resolveOperationId(channel, operation)
  const tags = Array.from(
    new Set([...(channel.tags ?? []), ...(operation.tags ?? [])])
  )

  return {
    id,
    title: getOperationTitle(operation),
    summary: operation.summary,
    description: operation.description ?? channel.description,
    tags,
    direction: operation.direction,
    channelName: channel.name,
    channelHref: options.channelHref
      ? options.channelHref(channel, operation)
      : undefined,
    messages: buildOperationMessages(operation),
    replies: buildOperationReplies(operation),
  }
}

function buildOperationMessages(operation: OperationInfo): OperationMessageData[] {
  const messages = operation.messages ?? []
  return messages.map((message, index) =>
    createOperationMessageData(message, 'message', index)
  )
}

function buildOperationReplies(operation: OperationInfo): OperationMessageData[] {
  const replies = operation.reply?.messages ?? []
  return replies.map((message, index) =>
    createOperationMessageData(message, 'reply', index)
  )
}

export function getOperationTitle(operation: OperationInfo): string {
  return (
    operation.summary ||
    operation.operationId ||
    operation.id ||
    `Operation (${operation.direction})`
  )
}

function resolveOperationId(channel: ChannelInfo, operation: OperationInfo): string {
  if (operation.operationId) return operation.operationId
  if (operation.id) return operation.id
  // Direction ensures each channel's publish/subscribe operations get distinct anchors.
  return `${channel.name}-${operation.direction}`
}
