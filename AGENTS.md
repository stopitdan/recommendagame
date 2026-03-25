<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Testing Requirements

Every new page, API route, component, or utility MUST have corresponding tests. This is non-negotiable.

- **API routes:** Test request validation, response shape, error cases
- **Utility functions:** Test pure input → output with edge cases (null, undefined, empty)
- **Adapters:** Mock `fetch` with `vi.stubGlobal`, test mapping logic
- **Components:** Test rendering and interactions with React Testing Library
- Run `npm run test:run` before committing to verify nothing is broken.

See `docs/playbooks/TESTING.md` for conventions and patterns.

# Git Commit Discipline

- Commit at natural milestones with rich, descriptive multi-line messages
- Split unrelated changes into separate commits
- Always include `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>`
- Push to remote regularly
- Never commit data files, secrets, or `.env.local`

# Design System

All colors MUST use MUI theme tokens (`primary.main`, `secondary.main`, etc.), never hardcoded hex values. See `docs/DESIGN-SYSTEM.md` and `src/theme.ts` for the palette.
