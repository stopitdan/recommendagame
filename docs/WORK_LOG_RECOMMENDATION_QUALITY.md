# Recommendation Quality — Work Log

Tracking every iteration of recommendation engine improvements. Based on published research from Netflix, Spotify, Steam, YouTube, and academic papers.

## Problem Statement

The recommendation engine returns 0 results for normal queries and irrelevant results when it does return. With 100k+ games, this should never happen.

## Root Causes Identified

| # | Cause | Severity | Status |
|---|-------|----------|--------|
| 1 | Vector search silently fails (wrong Supabase client/key on Vercel) | CRITICAL | Identified |
| 2 | All fallback functions filter `rating IS NOT NULL` — games without ratings invisible | CRITICAL | Identified |
| 3 | No tag-based candidate retrieval — LLM extracts "Deck Building" but never queries for it | HIGH | Identified |
| 4 | Text search only matches game names, not descriptions | HIGH | Identified |
| 5 | Hash-based embeddings aren't semantic — can't match "build your deck" to "Deck Building" tag | HIGH | Identified |
| 6 | No pre-computed fallback lists — cold start has no safety net | MEDIUM | Identified |
| 7 | Embeddings may be incomplete (generation script was timing out) | MEDIUM | Needs verification |

## Research Sources

### Production Systems
- **Netflix**: Multi-pass ranking pipeline (candidate generation → scoring → re-ranking). Pre-computes per-user recommendation lists daily.
- **Spotify**: Collaborative filtering + content-based hybrid. Uses audio features as embeddings. Explore/exploit via multi-armed bandit.
- **Steam**: Tag-based matching + collaborative filtering. Pre-computes "More Like This" for every game.
- **YouTube**: Deep neural collaborative filtering. 3-pass pipeline: fast ANN retrieval → lightweight ranker → deep ranker.
- **Instagram**: Candidate generation (embeddings) → first-pass ranking → second-pass ranking with full features.

### Academic Papers & Techniques
- **HyReC Framework** (Scientific Reports 2025): Domain-adaptive RoBERTa embeddings + collaborative signals
- **ZeroMat** (arxiv 2112.03084): Context-based recommendations with zero user input
- **Fairness survey** (ACM TIST 2024): Diversity re-ranking, provider fairness, serendipity injection
- **pgvector best practices**: HNSW indexing, filtered vector search, hybrid BM25+vector

### Key Techniques (Ranked by Impact × Feasibility)

| Technique | Impact | Effort | Needs ML? | Status |
|-----------|--------|--------|-----------|--------|
| Tiered fallback (never 0 results) | CRITICAL | Low | No | Phase 1 |
| Tag-based candidate retrieval | HIGH | Low | No | Phase 2 |
| Pre-computed popularity lists | HIGH | Low | No | Phase 3 |
| OpenAI semantic embeddings | HIGH | Medium | No (API) | Phase 4 |
| Hybrid BM25 + vector search | MEDIUM | Medium | No | Phase 5 |
| Description full-text search | MEDIUM | Low | No | Phase 2 |
| Daily batch pre-computation | MEDIUM | Low | No | Phase 3 |
| Deep neural CF (NCF) | HIGH | High | Yes | Future |
| Multi-armed bandit exploration | MEDIUM | Medium | No | Future |
| Community clustering | MEDIUM | Medium | Partial | Future |
| User-user CF with pgvector | MEDIUM | Low | No | Exists |
| Meta-learning cold start | MEDIUM | High | Yes | Future |

## Current State

- **Database**: ~100k games (BGG + RAWG + IGDB), pgvector enabled, HNSW index
- **Embeddings**: 768-dim hash-based one-hot vectors (NOT semantic)
- **Scoring**: 10-dimension rule-based engine with weights
- **Vector search**: pgvector `match_games` RPC with 0.15 similarity threshold
- **Caching**: Upstash Redis (2min recommend, 5min browse, 10min detail)
- **LLM**: GPT-4o-mini for free text parsing (mechanics, genres, keywords extraction)
- **Feedback**: "Not This" button → rejection learning, reviews → preference vector updates

## Iteration Log

| # | Date | Changes | Test Query | Before | After | Notes |
|---|------|---------|-----------|--------|-------|-------|
| 0 | 2026-03-26 | Baseline | "fun easy 2 players" | 0 results | — | Completely broken |
| 1 | — | Phase 1: Fix fallbacks | — | — | — | Pending |
| 2 | — | Phase 2: Tag search | — | — | — | Pending |
| 3 | — | Phase 3: Popularity cache | — | — | — | Pending |
| 4 | — | Phase 4: Semantic embeddings | — | — | — | Pending |

## Test Queries (use these to benchmark every iteration)

1. `"something fun and easy for 2 players"` — should return light 2-player games
2. `"roguelike deck builder"` — should return Slay the Spire, Monster Train, etc.
3. `"party game for 8 people"` — should return Codenames, Dixit, Wavelength, etc.
4. `"a metroidvania about bugs"` — should return Hollow Knight
5. `"chill solo game"` — should return Stardew Valley, puzzle games, etc.
6. `(empty query, no preferences)` — should return popular games across types
7. `"something like Catan but more complex"` — should return heavy euro games
8. `"horror board game for 4 players"` — should return Betrayal, Arkham Horror, etc.

## Architecture After All Phases

```
User Input → LLM Parse (GPT-4o-mini)
  ↓
Candidate Generation (all in parallel):
  ├── Rating-based (top 250 by rating, filtered by player count)
  ├── Vector similarity (pgvector semantic embeddings, top 250)
  ├── Tag-based (GIN index lookup on mechanics/categories/themes)
  ├── Text search (full-text on name + description)
  └── Popularity cache (Redis pre-computed lists, instant fallback)
  ↓
Deduplicate → Score (10 dimensions) → Rejection penalties
  ↓
Diversity re-rank (MMR) → Top N results → Client
```

No path through this pipeline can produce 0 results.
