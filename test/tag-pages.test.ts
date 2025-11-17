import { describe, it, expect } from 'vitest';
import { buildPageEntries } from '../src/server/utils/page-context';
import { buildChannelBlocks } from '../src/ui/utils/channel-blocks';
import type {
  ProcessedAsyncDocument,
  ChannelInfo,
  OperationInfo,
  AsyncCreatePageOptions,
  AsyncAPIPageProps,
} from '../src/types';

describe('tag pages', () => {
  it('omit channel filters when generating tag entries', () => {
    const processed = createProcessedDocument('Payments');
    const entries = buildPageEntries('schemas/orders.yaml', processed, { per: 'tag' });

    expect(entries).toHaveLength(1);

    const entry = entries[0];
    expect(entry.channel).toBeUndefined();
    expect(entry.tags).toEqual(['Payments']);
    expect(entry.frontmatter._asyncapi?.channel).toBeUndefined();
    expect(entry.frontmatter._asyncapi?.tags).toEqual(['Payments']);
  });

  it('renders operations for tags regardless of case', async () => {
    const processed = createProcessedDocument('Payments');
    const options: AsyncCreatePageOptions = {};
    const props: AsyncAPIPageProps = {
      document: processed.document,
      tags: 'payments',
    };

    const channelBlocks = await buildChannelBlocks(processed, options, props);

    expect(channelBlocks).toHaveLength(1);
    expect(channelBlocks[0]?.operations).toHaveLength(1);
  });
});

function createProcessedDocument(tagName: string): ProcessedAsyncDocument {
  const operation: OperationInfo = {
    channel: 'orders.created',
    direction: 'publish',
    messages: [],
    tags: [tagName],
  };

  const channel: ChannelInfo = {
    name: 'orders.created',
    operations: [operation],
  };

  return {
    document: {} as any,
    channels: [channel],
    operations: [operation],
    servers: [],
  };
}
