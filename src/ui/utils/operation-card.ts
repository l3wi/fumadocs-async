import type {
  ChannelInfo,
  OperationInfo,
  AsyncCreatePageOptions,
} from '../../types'
import type {
  OperationCardRenderData,
  OperationTabData,
} from '../components/operation-card.types'
import { createMessageTabData } from './message-tab'

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
    tabs: buildOperationTabs(operation),
  }
}

export function buildOperationTabs(operation: OperationInfo): OperationTabData[] {
  const tabs: OperationTabData[] = []

  const messages = operation.messages ?? []
  messages.forEach((message, index) => {
    tabs.push(createMessageTabData(message, 'message', index))
  })

  const replies = operation.reply?.messages ?? []
  replies.forEach((message, index) => {
    tabs.push(createMessageTabData(message, 'reply', index))
  })

  return tabs
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
