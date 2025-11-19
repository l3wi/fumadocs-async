# Repository Guidelines

## Project Structure & Module Organization
`src/` contains the AsyncAPI parsing utilities, React UI components, and Next.js server helpers compiled into `dist/` via tsup. `docs/` holds contributor references, while `example/` demonstrates how to consume the published package. Tests and fixtures live under `test/`, and helper scripts reside in `scripts/`. Generated CSS presets reside in `src/styles/` and are copied to `dist/css/` during the build.

## Build, Test, and Development Commands
- `bun run dev` — watches `src/` with tsup for rapid library iteration.
- `bun run build` — runs `build:lib`, validates client entry points, and copies Tailwind presets to `dist/css/`.
- `bun run lint` / `bun run format` — ESLint + Prettier sweeps over `.ts`/`.tsx`.
- `bun run typecheck` — strict TypeScript compilation without emitting files.
- `bun run test` — executes Vitest (jsdom) for both unit and component suites.

## Coding Style & Naming Conventions
Stick to TypeScript modules with named exports; reserve default exports for package entry points. Prettier enforces two-space indentation, single quotes, and trailing commas, so let it resolve stylistic debates. React components and hooks follow `PascalCase` and `useCamelCase` files (for example, `src/client/useWebSocket.ts`). Server-only helpers belong in `src/server/` and must avoid browser APIs; UI pieces belong under `src/ui/` and include `"use client"` when necessary.

## Testing Guidelines
Vitest and `@testing-library/react` back tests stored in `test/**/*.test.ts` (or colocated `*.test.tsx`). Favor deterministic fixtures for AsyncAPI payloads and mock WebSocket clients to avoid live connections. Run `bun run test` before submitting changes and leverage coverage output to ensure new parsers, hooks, and components are exercised. Snapshot tests are acceptable for serialized AsyncAPI output, but pair them with behavioral assertions.

## Commit & Pull Request Guidelines
Use Conventional Commits (`feat(parser): handle schemas — add array support`) and keep messages scoped to one logical change. Branches should follow `feat/…`, `fix/…`, or `chore/…`. Pull requests must link any relevant issues, describe schema or UI impacts, and include screenshots or terminal output when behavior changes. Ensure `bun run lint`, `bun run typecheck`, and `bun run test` pass locally before requesting review.

## Security & Configuration Tips
Never commit real AsyncAPI documents; sanitize examples before placing them in `docs/` or `example/`. Environment-specific secrets belong in `.env.local` files ignored by git. When integrating with Next.js apps, remind consumers to install peer dependencies (`next`, `zod`, `buffer`) and to import the CSS preset via `import 'fumadocs-async/css/preset.css';` in their app entry point.
