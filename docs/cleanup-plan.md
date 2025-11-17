# AsyncAPI Cleanup & Refactor Plan

## Phase 1 – Parser & Server Parity
- [x] Collapse all AsyncAPI parsing and caching into `createAsyncAPI`, aligning `src/server/create.ts` with the reference OpenAPI server flow.
- [x] Remove duplicate parser logic from `src/utils/document.ts`, turning it into a thin helper that always defers to the shared server instance.
- [x] Introduce a cached `processDocument` helper (similar to `processDocumentCached` in the OpenAPI reference) so every consumer shares identical memoization behaviour.

## Phase 2 – Schema→Page Mapping Consistency
- [x] Restructure `src/server/utils/page-context.ts` to mirror `reference/openapi/src/utils/pages/builder.ts`, ensuring all `per`/`groupBy` modes run through a single set of helpers.
- [x] Update `generateAsyncFiles` and `asyncapiSource` to consume the unified builder output, eliminating redundant relative-path and slug logic.
- [ ] Decide the fate of `AsyncConfig.index` and other currently unused options—either remove them or implement parity with the OpenAPI generator.

## Phase 3 – UI Modularisation
- [ ] Break down `src/ui/api-page.tsx` into smaller context/render modules, matching the structure of `reference/openapi/src/ui`, so shared components power both the generic page and Next.js wrappers.
- [ ] Refactor `src/next/asyncapi-*.tsx` to reuse the shared UI modules (badges, channel headers, operation cards) instead of duplicating markup.
- [x] Remove empty/legacy directories (e.g. `src/ui/api-page/`) and rename files to align with their OpenAPI counterparts for easier future diffs.

## Phase 4 – WebSocket Client Rationalisation
- [x] Pick a single WebSocket client surface: either fold the standalone `WSPlayground` into the sidebar experience or remove it entirely if unused.
- [ ] Consolidate `useQuery` and related hooks with the reference implementation to avoid divergent behaviour.
- [ ] Expand unit coverage (beyond `test/fetcher.test.ts`) to include client state transitions, message buffering, and error handling.

## Phase 5 – Next.js Helpers & Docs
- [ ] Keep `AsyncAPIChannelsPage`/`AsyncAPIMessagesPage` as thin wrappers that delegate to shared builders and UI components.
- [ ] Align `src/next/index.ts` exports and helper responsibilities with the OpenAPI reference, dropping duplicate slug utilities unless strictly Next-specific.
- [ ] Update `README.md` and `docs/plan.md` once the refactor lands to describe the new architecture, then run `bun run lint`, `bun run typecheck`, and relevant tests to verify the cleaned-up code.
