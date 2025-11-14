declare module '@asyncapi/parser/browser' {
  import type { Parser } from '@asyncapi/parser'

  const ParserConstructor: typeof Parser
  export default ParserConstructor
}
