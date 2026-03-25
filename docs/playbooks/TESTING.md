# Playbook: Writing and Running Tests

Use this when adding tests for any part of the application.

---

## Setup (done)

- [x] Vitest + React Testing Library + jsdom
- [x] Config: `vitest.config.mts` with tsconfig paths and jsdom environment
- [x] Scripts: `npm test` (watch mode), `npm run test:run` (single run)

---

## Running Tests

```bash
# Watch mode (re-runs on file changes)
npm test

# Single run (CI / pre-commit)
npm run test:run

# Run specific file
npx vitest run src/lib/utils/parsing.test.ts
```

---

## Checklist

- [ ] Create test file next to the source file: `<filename>.test.ts`
- [ ] Test the happy path first
- [ ] Test edge cases (empty input, missing data, null/undefined, errors)
- [ ] For API adapters: mock `fetch` with `vi.stubGlobal`, test the mapping logic
- [ ] For utility functions: test pure input → output with many cases
- [ ] For components: test rendering and user interactions with Testing Library
- [ ] For API routes: test request validation and response shape
- [ ] Run `npm run test:run` before committing

---

## Conventions

- **File naming:** `<source-file>.test.ts` (co-located with source)
- **Describe blocks:** Group by function/feature name
- **Test names:** Should read like a sentence: `it('returns empty array when no results found')`
- **Mocking:** Use `vi.stubGlobal('fetch', ...)` for HTTP mocks, `vi.stubEnv()` for env vars
- **No snapshots:** Prefer explicit assertions over snapshot tests
- **Globals:** `describe`, `it`, `expect` are available globally (configured in vitest.config.mts)

---

## Architecture

Shared pure logic lives in `src/lib/utils/` and is tested directly.
Adapters import from utils — test adapters by mocking fetch and verifying the full mapping pipeline.

```
src/lib/utils/parsing.ts          ← Pure helpers (stripHtml, ensureArray, etc.)
src/lib/utils/parsing.test.ts     ← Direct unit tests

src/lib/adapters/rawg.ts          ← Imports from utils, adds fetch logic
src/lib/adapters/rawg.test.ts     ← Mocks fetch, tests full mapping

src/lib/supabase/games.ts         ← Game ↔ DB row conversion
src/lib/supabase/games.test.ts    ← Tests conversion and round-trips
```
