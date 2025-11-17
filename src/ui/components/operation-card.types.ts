import type { MessageInfo } from '../../types'

export interface OperationParameterData {
  name: string
  type?: string
  required: boolean
  description?: string
}

export interface OperationTabData {
  key: string
  name: string
  type: 'message' | 'reply'
  description?: string
  parameters: OperationParameterData[]
  example?: unknown
  loadPayload?: unknown
  messageRef?: MessageInfo
}

export interface OperationCardRenderData {
  id: string
  title: string
  summary?: string
  description?: string
  tags: string[]
  direction: 'publish' | 'subscribe'
  channelName: string
  channelHref?: string
  tabs: OperationTabData[]
}
