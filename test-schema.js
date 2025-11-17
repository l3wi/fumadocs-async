import { parseAsyncAPISource } from '../src/utils/document'

const testSchema = `
asyncapi: 3.0.0
info:
  title: Test API
  version: 1.0.0
channels:
  test:
    address: test
    messages:
      testMessage:
        payload:
          type: object
          properties:
            test:
              type: string
`

async function test() {
  try {
    const result = await parseAsyncAPISource(testSchema, 'test')
    console.log('✅ Schema parsed successfully')
    console.log('Operations:', result.operations?.length)
  } catch (error) {
    console.error('❌ Schema parsing failed:', error.message)
  }
}

test()