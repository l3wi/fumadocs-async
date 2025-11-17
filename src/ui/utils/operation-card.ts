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
  const tags = Array.from(
    new Set([...(channel.tags ?? []), ...(operation.tags ?? [])])
  )

  return {
    id: operation.operationId ?? operation.id ?? channel.name,
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
