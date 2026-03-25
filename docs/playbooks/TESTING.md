# Playbook: Writing and Running Tests

Use this when adding tests for any part of the application.

---

## Setup (one-time, not yet done)

- [ ] Install testing framework (likely Vitest or Jest)
- [ ] Configure test runner in `package.json`
- [ ] Set up test utilities and helpers

*This playbook will be updated once the testing setup is decided.*

---

## Checklist

- [ ] Create test file next to the source file: `<filename>.test.ts`
- [ ] Test the happy path first
- [ ] Test edge cases (empty input, missing data, errors)
- [ ] For API adapters: mock the HTTP responses, test the mapping logic
- [ ] For components: test rendering and user interactions
- [ ] For API routes: test request validation and response shape
- [ ] Run the full test suite before committing

---

## Conventions

- **File naming:** `<source-file>.test.ts` (co-located with source)
- **Describe blocks:** Group by function/feature name
- **Test names:** Should read like a sentence: `it('returns empty array when no results found')`
- **Mocking:** Mock external dependencies (APIs, Firebase), not internal logic
- **No snapshots:** Prefer explicit assertions over snapshot tests
