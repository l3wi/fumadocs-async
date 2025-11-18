'use client'

import { useSyncExternalStore } from 'react'

export type DraftPayloadTransformSource =
  | 'operation-card'
  | 'message-definition'
  | 'operation-actions'

export interface DraftPayloadTransformMeta {
  source: DraftPayloadTransformSource
  channelName?: string
  operationId?: string
  operationName?: string
  operationDirection?: 'publish' | 'subscribe'
  tabKey?: string
  tabName?: string
  tabType?: 'message' | 'reply'
}

export type DraftPayloadTransformer = (
  payload: unknown,
  meta: DraftPayloadTransformMeta
) => unknown | Promise<unknown>

type Listener = () => void

let currentTransformer: DraftPayloadTransformer | null = null
const listeners = new Set<Listener>()

function emit() {
  for (const listener of listeners) {
    listener()
  }
}

function subscribe(listener: Listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): DraftPayloadTransformer | null {
  return currentTransformer
}

export function useMessagePayloadTransformer(): DraftPayloadTransformer | null {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export function setMessagePayloadTransformer(transformer: DraftPayloadTransformer | null) {
  currentTransformer = transformer
  emit()
}

export function clearMessagePayloadTransformer() {
  if (!currentTransformer) return
  currentTransformer = null
  emit()
}

export function getMessagePayloadTransformer(): DraftPayloadTransformer | null {
  return currentTransformer
}
