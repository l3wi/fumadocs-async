# fumadocs-asyncapi

AsyncAPI integration for Fumadocs - generate documentation pages from AsyncAPI specifications with WebSocket client support.

## Installation

```bash
bun add fumadocs-asyncapi
```

## Development

```bash
# Install dependencies
bun install

# Run type checking
bun run typecheck

# Run linting
bun run lint

# Format code
bun run format

# Build the package
bun run build

# Watch mode for development
bun run dev
```

## Project Structure

This package mirrors the structure of `fumadocs-openapi`:

- `src/server/` - Server-side functionality (parsing, file generation)
- `src/ui/` - React components for rendering AsyncAPI docs
- `src/types/` - TypeScript type definitions
- `src/styles/` - CSS styles for the documentation UI

## Status

🚧 **Work in Progress** - This is the initial package setup. Implementation of the core functionality is coming soon based on the detailed plan in `docs/plan.md`.

## License

MIT