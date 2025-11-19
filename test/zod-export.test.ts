import { z } from 'zod';
import { describe, it, expect } from 'vitest';
import { asyncapiSchema } from '../src/server/zod';

describe('asyncapiSchema export', () => {
  it('should accept string for direction', () => {
    const schema = z.object({
      title: z.string(),
    }).merge(asyncapiSchema);

    const input = {
      title: 'Test Page',
      _asyncapi: {
        channel: 'test/channel',
        direction: 'custom-direction', // Should pass now
      },
    };

    const parsed = schema.parse(input);

    expect(parsed._asyncapi).toEqual({
      channel: 'test/channel',
      direction: 'custom-direction',
    });
  });
});
