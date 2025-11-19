import { z } from 'zod'

export const asyncapiSchema = z.object({
  _asyncapi: z
    .object({
      channel: z.string().optional(),
      direction: z.string().optional(),
      operationId: z.string().optional(),
      tags: z.array(z.string()).optional(),
    })
    .optional(),
})
