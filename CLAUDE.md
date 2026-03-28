# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server on port 1337
npm run build        # Production build
npm run lint         # ESLint
npm test             # Vitest in watch mode
npm run test:run     # Vitest single run (use before committing)
npx vitest run src/lib/utils/parsing.test.ts  # Run a single test file
```

## Next.js Version Warning

This project uses **Next.js 16** which has breaking changes from earlier versions. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

## Architecture

**boredgame.lol** is a smart game recommendation engine built with Next.js 16 (App Router), React 19, MUI 7, Supabase (PostgreSQL + pgvector + Auth), Redis, and OpenAI.

### Recommendation Engine (4-layer stack)

The core system lives in `src/lib/recommendation/`:

1. **Rule-based scoring** (`scoring.ts`) — 9 weighted dimensions (type, player count, time, complexity, genre, mood, free-text, quality, popularity) produce a 0-1 score with human-readable reasons
2. **Content-based filtering** (`embeddings.ts`, `similarity.ts`) — Games and user preferences encoded as 768-dim vectors, matched via pgvector HNSW index using `match_games()` RPC
3. **Collaborative filtering** (`collaborative.ts`) — Item-based "users who liked X also liked Y", activates when sufficient feedback exists
4. **Semantic embeddings** (`semantic-embeddings.ts`) — OpenAI text-embedding-3-small (1536-dim) captures meaning from game descriptions and free-text preferences

`POST /api/recommend` orchestrates all layers: fetches 500 candidates (250 by similarity + 250 by rating), scores them rule-based, re-ranks by hybrid score (60% rule + 40% similarity), applies diversity penalties, returns top results.

### Adapter Pattern

Each external game source (`src/lib/adapters/`) implements the `GameAdapter` interface:
- **BGG** — BoardGameGeek XML API2 (board games)
- **RAWG** — REST API with API key (video games)
- **IGDB** — Twitch OAuth (video games, richer metadata)
- **Local** — Curated JSON for word games

All adapters normalize to the unified `Game` type (`src/types/game.ts`).

### Key Data Flow

User questionnaire → LLM parses free-text (`src/lib/llm/parse-preferences.ts`) → structured `QuestionnaireState` → API scores candidates → results displayed → user feedback (thumbs up/down) updates their preference vector via `feedback-loop.ts`.

### Database

Supabase PostgreSQL with pgvector. Migrations in `supabase/migrations/` (numbered sequentially). Key tables: `games`, `game_embeddings`, `user_profiles`, `user_preferences`, `user_game_feedback`, `user_favorites`, `custom_dice_skins`. Row types mirror the schema in `src/types/supabase.ts`.

`rowToGame()` in `src/lib/supabase/games.ts` converts DB rows to `Game` objects.

## Testing Requirements

Every new page, API route, component, or utility MUST have corresponding tests.

- **API routes:** Test request validation, response shape, error cases
- **Utility functions:** Test pure input/output with edge cases (null, undefined, empty)
- **Adapters:** Mock `fetch` with `vi.stubGlobal`, test mapping logic
- **Components:** Test rendering and interactions with React Testing Library
- Run `npm run test:run` before committing to verify nothing is broken

See `docs/playbooks/TESTING.md` for conventions and patterns.

## Design System

All colors MUST use MUI theme tokens (`primary.main`, `secondary.main`, etc.), never hardcoded hex values. The palette is defined in `src/theme.ts` with full documentation in `docs/DESIGN-SYSTEM.md`.

## Git Commit Discipline

- Commit at natural milestones with rich, descriptive multi-line messages
- Split unrelated changes into separate commits
- Always include `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>`
- Push to remote regularly
- Never commit data files, secrets, or `.env.local`

## Documentation

`docs/` contains architecture docs, decision records, a roadmap, and playbooks (`docs/playbooks/`) with step-by-step guides for common tasks like adding pages, API adapters, tests, and Supabase migrations. Check `docs/roadmap-overrides.json` for user-toggled roadmap status changes.
