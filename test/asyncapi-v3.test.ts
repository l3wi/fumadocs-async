import { describe, it, expect } from 'vitest';
import { createAsyncAPI } from '../src/server/create';
import { buildPageEntries } from '../src/server/utils/page-context';
import path from 'node:path';

describe('AsyncAPI v3', () => {
  it('generates pages from example/asyncapi-v3.yaml', async () => {
    const examplePath = path.resolve(process.cwd(), 'example/asyncapi-v3.yaml');
    
    const generator = createAsyncAPI({
      input: [examplePath],
    });

    const schemas = await generator.getSchemas();
    expect(Object.keys(schemas)).toHaveLength(1);

    const documentKey = Object.keys(schemas)[0];
    const processed = schemas[documentKey];

    expect(processed).toBeDefined();
    expect(processed.document).toBeDefined();
    
    // Verify channels
    expect(processed.channels).toHaveLength(2); // ordersTopic, newOrderNotification (operation channel)
    
    // Verify operations
    expect(processed.operations).toHaveLength(1); // newOrderNotification

    // Generate page entries
    const entries = buildPageEntries(documentKey, processed, {
      per: 'operation',
    });

    expect(entries.length).toBeGreaterThan(0);

    // Check for specific operation page
    const operationPage = entries.find(e => e.operation?.operationId === 'newOrderNotification' || e.operation?.id === 'newOrderNotification');
    expect(operationPage).toBeDefined();
    expect(operationPage?.title).toBe('New order notification');
    expect(operationPage?.slug).toBe('orders-topic-receive'); // Check slug generation logic if this fails
    
    // Check tags
    const tagEntries = buildPageEntries(documentKey, processed, {
        per: 'tag'
    });
    
    expect(tagEntries.length).toBeGreaterThan(0);
    const ordersTag = tagEntries.find(e => e.tags?.includes('orders'));
    expect(ordersTag).toBeDefined();
  });
});
