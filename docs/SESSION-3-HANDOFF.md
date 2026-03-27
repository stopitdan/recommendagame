# Session 3 Handoff — 2026-03-27

## What We Built This Session

### Recommendation Engine Overhaul (Phases 1-5)
1. **Hybrid candidate fetching** — 250 vector + 250 rating + tag-based + text search, all parallel
2. **Tag-based retrieval** — direct GIN index lookup by category/mechanic/theme (NEW)
3. **Description text search** — searches descriptions, not just game names (NEW)
4. **Pre-computed popularity cache** — 38 Redis lists, 1,390 games cached as fallback (NEW)
5. **OpenAI semantic embeddings** — module + migration + script ready (not yet generated)
6. **Emergency fallback chain** — 6 tiers deep, impossible to return 0 results
7. **Diversity re-ranking** — MMR algorithm prevents homogeneous results
8. **Recency scoring** — 10th scoring dimension, boosts newer games
9. **Rejection learning** — "Not This" feedback penalizes similar games
10. **"Not This" / "More Like This" buttons** — on every game card in results
11. **Color theme picker** — in Settings, all 6 presets
12. **Match percentage badges** — on result cards
13. **Health check endpoint** — /api/health/recommend
14. **IGDB integration** — 20k games with rich metadata, 13k RAWG dupes removed

### Database Changes Applied
- Migration 010: semantic_embedding column + HNSW index + match_games_semantic RPC
- Rewrote match_games RPC to remove WHERE clause (was defeating HNSW index)
- Rewrote match_games_semantic RPC (same fix)
- Added index: `idx_games_rating_count_desc`
- Added index: `idx_games_rating_desc`
- Increased statement_timeout to 120s for all roles
- Restarted Supabase project

### Data State
- **178,632 games** total (90k BGG, 67k RAWG, 20k IGDB, 47 local)
- **101,796 games** with ratings
- **76,909 games** with NULL ratings
- **30,986 hash embeddings** (17% coverage — script keeps timing out)
- **0 semantic embeddings** (script not run yet)
- **1,390 games** in Redis popularity cache (38 lists)

---

## THE #1 PROBLEM: Everything Is Too Slow

### Symptoms
- Browse search for "Hollow Knight": **102 seconds** (should be <1s)
- Recommend endpoint: **times out** on Vercel (>60s)
- Hash embedding generation: **times out** even at batch size 10
- Popularity cache queries: many timed out before index fixes
- Health check: game count queries time out

### Root Cause: Supabase + 178k rows + complex queries
The database has 178k games. Queries that combine:
- `ORDER BY rating DESC` (even with index)
- `contains('types', [...])` (GIN index scan)
- `.not('rating', 'is', null)`
- `.textSearch('name', ...)`
- `.gte('rating_count', N)`

...produce query plans that Postgres can't optimize well. The HNSW vector index works (1s for similarity search) but everything else is slow.

### What's NOT the problem
- The HNSW vector index works (confirmed via EXPLAIN ANALYZE)
- Redis is connected and fast
- The code logic is correct
- The data is there (178k games confirmed)

---

## Options to Fix Performance (Research Needed)

### Option A: Better Supabase Configuration
- **Connection pooling** — Supabase Pro supports pgBouncer, may help with concurrent connections from Vercel
- **Larger compute** — Upgrade from Pro ($25/mo) to Team ($599/mo) for more CPU/RAM
- **Read replicas** — Offload read queries to a replica
- **Materialized views** — Pre-compute common queries as materialized views, refresh daily

### Option B: Add a Search Layer
- **Meilisearch** ($30/mo on Meilisearch Cloud) — instant full-text search, typo tolerant, faceted filtering. Import game data, use for browse/search, keep Supabase for auth/reviews/embeddings.
- **Typesense** (free self-hosted or $30/mo cloud) — similar to Meilisearch
- **Algolia** ($0-50/mo) — hosted search as a service
- **Elasticsearch** (heavier, $50+/mo) — overkill for this use case

### Option C: Optimize Current Stack
- **Partial indexes** — create indexes only for rated games: `CREATE INDEX ... WHERE rating IS NOT NULL`
- **Materialized views** — `CREATE MATERIALIZED VIEW popular_games AS SELECT ... ORDER BY rating DESC LIMIT 5000`
- **Denormalized search table** — smaller table with just search-relevant columns
- **Pre-compute and cache everything** — use Redis as the primary read layer, Supabase only for writes
- **Reduce dataset** — do we need 76k unrated games? Deleting games with NULL rating AND rating_count=0 would cut DB in half

### Option D: Switch Database
- **Supabase with pgvectorscale** — Timescale's pgvector extension, claimed 28x faster
- **Neon** — serverless Postgres, may have better cold-start performance
- **PlanetScale** — MySQL-based, very fast, but no pgvector
- **Turso** — SQLite-based, extremely fast reads, but no vector support

### My Recommendation
**Option B (Meilisearch) + Option C (optimize Supabase)** is probably the best path:
1. Add Meilisearch for browse/search (instant results, typo tolerant, faceted)
2. Keep Supabase for: auth, user data, reviews, embeddings, vector search
3. Optimize Supabase queries: partial indexes, materialized views, trim unrated games
4. This splits the workload: Meilisearch handles the fast search/browse, Supabase handles the smart recommendation

---

## Scripts Status

| Script | Status | Notes |
|--------|--------|-------|
| `scripts/populate-popularity-cache.ts` | DONE | 38 lists, 1,390 games |
| `scripts/generate-embeddings.ts` | STUCK | Keeps timing out even at batch 10. Needs single-row upserts (code updated but not tested after Supabase restart) |
| `scripts/generate-semantic-embeddings.ts` | NOT RUN | Needs embeddings script to work first, then this |
| `scripts/crawl-bgg-api.ts` | RUNNING | Still ingesting 400k BGG IDs |
| `scripts/check-embeddings.ts` | READY | Diagnostic tool |

## Env Vars on Vercel
All set: SUPABASE_URL, ANON_KEY, SERVICE_ROLE_KEY, RAWG_API_KEY, BGG_API_KEY, OPENAI_API_KEY, IGDB_CLIENT_ID, IGDB_CLIENT_SECRET, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN

## What To Do When You Get Home

1. **Re-run embeddings script** (after Supabase restart + timeout increase):
   ```bash
   source .env.local && npx tsx scripts/generate-embeddings.ts 50
   ```

2. **Research + decide on search layer** (Meilisearch vs Typesense vs optimize-in-place)

3. **Consider trimming unrated games**:
   ```sql
   -- How many games have NO rating AND no rating count?
   SELECT COUNT(*) FROM games WHERE rating IS NULL AND (rating_count IS NULL OR rating_count = 0);
   ```
   If it's 70k+, deleting them would cut query times in half.

4. **Test the recommendation endpoint** after embeddings complete

## Git State
- Latest commit: `902adc5` — Fix browse search timeout + popularity cache improvements
- All pushed to `origin/main`
- 285 tests passing, clean build
