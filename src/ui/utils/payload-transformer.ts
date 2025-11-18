import type {
  DraftPayloadTransformMeta,
  DraftPayloadTransformer,
} from '../state/message-payload-transformer'

export async function runDraftPayloadTransformer(
  transformer: DraftPayloadTransformer | null,
  payload: unknown,
  meta: DraftPayloadTransformMeta
): Promise<unknown> {
  if (!transformer) return payload
  try {
    const result = await transformer(payload, meta)
    return result === undefined ? payload : result
  } catch (error) {
    console.warn('Failed to transform AsyncAPI payload draft:', error)
    return payload
  }
}
