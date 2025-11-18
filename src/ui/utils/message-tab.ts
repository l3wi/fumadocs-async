import type { MessageInfo } from '../../types'
import type { OperationParameterData, OperationMessageData } from '../components/operation-card.types'

export function createOperationMessageData(
  message: MessageInfo,
  type: OperationMessageData['type'],
  index: number
): OperationMessageData {
  const example = resolveMessageExample(message)
  return {
    key: `${type}-${message.name ?? message.title ?? index}`,
    name: message.title ?? message.name ?? defaultTabLabel(type, index),
    type,
    description: message.description,
    parameters: extractParametersFromMessage(message),
    example,
    loadPayload: type === 'message' ? resolveDraftPayload(message, example) : undefined,
    messageRef: message,
  }
}

function defaultTabLabel(type: OperationMessageData['type'], index: number): string {
  const ordinal = index + 1
  return type === 'message' ? `Message ${ordinal}` : `Reply ${ordinal}`
}

function resolveMessageExample(message: MessageInfo): unknown {
  const sample = message.examples?.[0]
  if (sample && typeof sample === 'object' && sample !== null && 'payload' in sample) {
    const payload = (sample as { payload?: unknown }).payload
    if (payload !== undefined) {
      return payload
    }
  }
  return sample ?? message.payload ?? message.schema
}

function resolveDraftPayload(message: MessageInfo, example: unknown): unknown {
  if (example !== undefined) return example
  if (message.examples && message.examples.length > 0) return message.examples[0]
  if (message.payload) return createSkeletonFromSchema(message.payload)
  if (message.schema) return createSkeletonFromSchema(message.schema)
  return {}
}

function extractParametersFromMessage(message: MessageInfo): OperationParameterData[] {
  const schema = message.payload ?? message.schema
  const resolved = resolveParameterSchema(schema)
  if (!resolved) return []

  const props = isRecord(resolved.properties) ? resolved.properties : undefined
  if (!props) return []

  const required = new Set(
    Array.isArray(resolved.required) ? (resolved.required as string[]) : []
  )

  return Object.entries(props).map(([name, definition]) => ({
    name,
    type: inferSchemaType(definition),
    required: required.has(name),
    description: typeof (definition as { description?: string }).description === 'string'
      ? (definition as { description?: string }).description
      : undefined,
  }))
}

function resolveParameterSchema(schema: unknown):
  | { properties?: Record<string, unknown>; required?: string[] }
  | undefined {
  if (!isRecord(schema)) return undefined
  const properties = isRecord(schema.properties) ? schema.properties : undefined
  if (!properties) return undefined

  const candidates = ['params', 'result', 'data']
  for (const key of candidates) {
    const candidate = properties[key]
    if (isRecord(candidate) && isRecord(candidate.properties)) {
      return candidate as { properties?: Record<string, unknown>; required?: string[] }
    }
  }

  return schema as { properties?: Record<string, unknown>; required?: string[] }
}

function createSkeletonFromSchema(schema: unknown): unknown {
  if (!isRecord(schema)) return {}
  const properties = isRecord(schema.properties) ? schema.properties : undefined
  if (!properties) return {}
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(properties)) {
    result[key] = inferPlaceholder(value)
  }
  return result
}

function inferPlaceholder(schema: unknown): unknown {
  if (!isRecord(schema)) return null
  const type = schema.type
  if (type === 'string') return schema.default ?? ''
  if (type === 'number' || type === 'integer') return schema.default ?? 0
  if (type === 'boolean') return schema.default ?? false
  if (type === 'array') {
    const first = Array.isArray(schema.items) ? schema.items[0] : schema.items
    return first ? [inferPlaceholder(first)] : []
  }
  if (type === 'object' || isRecord(schema.properties)) {
    return createSkeletonFromSchema(schema)
  }
  return null
}

function inferSchemaType(schema: unknown): string | undefined {
  if (!isRecord(schema)) return undefined
  if (typeof schema.type === 'string') return schema.type
  if (Array.isArray(schema.type)) return schema.type.join(' | ')
  if (schema.enum && Array.isArray(schema.enum)) {
    return `enum(${schema.enum.length})`
  }
  if (schema.anyOf && Array.isArray(schema.anyOf)) {
    return schema.anyOf.map((item) => inferSchemaType(item) ?? 'unknown').join(' | ')
  }
  if (schema.oneOf && Array.isArray(schema.oneOf)) {
    return schema.oneOf.map((item) => inferSchemaType(item) ?? 'unknown').join(' | ')
  }
  return schema.type as string | undefined
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
