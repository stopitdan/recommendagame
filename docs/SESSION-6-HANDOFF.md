# Session 6 Handoff: Recommendation Engine Overhaul

**Date:** 2026-04-01
**Scope:** Research-driven recommendation engine improvements across 4 phases
**Commits:** 10 commits to main, all pushed to remote

---

## What Prompted This

Users on the BGG forum thread (thread 3685387) reported that recommendations didn't match their input:
- "Thematic solo games" returned The Crew (min 2 players)
- "90 minutes, 4 players" returned Brass: Birmingham (way over 90 min) and Through the Ages
- "A game designed by Stefan Feld" returned only Castles of Burgundy, no other Feld games
- "Seems to ignore everything I put in the text description and give me a list of random popular games"
- Poker appeared as #2 result for "thematic euro, 1 hour, pub-friendly"

We did a deep research pass against academic literature, then implemented proven fixes.

---

## Research Foundation

Read and analyzed in full:
1. **Raza et al. (2024)** "A Comprehensive Review of Recommender Systems" (arXiv 2407.13699) -- 287 papers surveyed
2. **Koch (2022)** "Building a Recommendation Engine from Scratch" -- 6 years at Criteo
3. **Forrester (2023)** "Recommended Recommenders" -- Industry analyst framework
4. **hongleizhang/RSPapers** -- 300+ curated academic papers
5. **Game-specific studies** -- BGG, Steam, cold-start game recommendation research
6. **LLM+RecSys papers (2024-2025)** -- Industry consensus on LLM role in recommendations

Full research document: `docs/RECOMMENDATION-ENGINE-RESEARCH.md`

---

## Phase 0: Evaluation Framework (built from scratch)

The existing eval suite was fundamentally flawed -- binary presence testing ("is Dominion somewhere in top 10?") with LLM-generated ground truth. We replaced it.

### What We Built

| File | Purpose |
|------|---------|
| `scripts/validate-eval-cases.ts` | Checked 351 games against DB: 29 don't exist, 37 eval cases (5%) always fail |
| `scripts/eval-metrics.ts` | NDCG@K, MAP@K, MRR, Precision, Recall, ILD (diversity), Novelty, Coverage -- 29 unit tests |
| `scripts/eval-metrics.test.ts` | Mathematical correctness tests for every metric formula |
| `scripts/golden-eval-cases.json` | 48 hand-curated queries with graded relevance (0-3), 8 real BGG user failure cases |
| `scripts/annotate-eval.ts` | Runs queries, collects top-20 results, auto-detects constraint violations, outputs annotation worksheet |
| `scripts/baselines.ts` | Random, popularity-only, keyword-match baselines for comparison |
| `scripts/run-golden-evals.ts` | New eval runner with NDCG/MAP/MRR, per-category breakdown, worst-query report, baseline modes |
| `scripts/eval-validation-report.json` | Full report of which eval games exist/don't exist in DB |

### Key Metrics Now Available

```
NDCG@10     -- Rank-aware quality (primary metric, industry standard)
MAP@10      -- Binary precision accounting for position
MRR         -- How fast users find first good result
HitRate@5   -- Sanity check: did we get at least one?
ILD@10      -- Intra-list diversity via Jaccard distance
Novelty@10  -- Long-tail discovery measurement
Coverage    -- What % of 81k catalog gets recommended
Constraint violation rate -- % of results violating stated player count/time/complexity
```

### How to Use

```bash
# Run golden evals against your engine
npx tsx scripts/run-golden-evals.ts

# Compare against popularity baseline
npx tsx scripts/run-golden-evals.ts --baseline=popularity

# Run annotation helper to grade results
npx tsx scripts/annotate-eval.ts
```

---

## Phase 1: Foundation Fixes

### 1A. Semantic Embedding Coverage: 23% -> 100%

**Before:** Only 18.5k of 81k games had semantic embeddings (text-embedding-3-small, 1536-dim). The other 77% used hash-based 768-dim vectors with zero semantic understanding.

**After:** All 81,039 games now have semantic embeddings. The YouTube study found hash embeddings perform worse than random IDs -- this fallback is no longer needed.

**Cost:** ~$0.40 total for all embeddings.

**How it works:** `scripts/generate-semantic-embeddings.ts` processes games in batches of 100-500, calls OpenAI embeddings API, upserts into `game_embeddings.semantic_embedding`. Resumable (skips already-embedded games).

### 1B. Scoring Weight Rebalance

**Before:**
```
genreMatch:      0.20  (tied for highest with popularity)
popularitySignal: 0.20  (tied for highest with genre)
freeTextMatch:   0.14
```

**After:**
```
genreMatch:      0.24  (+0.04)  -- User taste is the primary signal
freeTextMatch:   0.18  (+0.04)  -- User's exact words are high-intent
popularitySignal: 0.12  (-0.08)  -- Still meaningful, no longer dominant
```

**Why:** Popularity at 20% meant a game with 100k ratings and 60% genre match would outscore a game with 500 ratings and 95% genre match. Koch (Criteo) explicitly warns this is the #1 failure mode.

**File:** `src/lib/recommendation/scoring.ts` lines 65-76

### 1C. Similar-To Attribute Bootstrapping

**Before:** "Like Catan" extracted Catan's tags (Strategy, Economic, Trading) and merged them into genres. Didn't use Catan's complexity, player count, or time.

**After:** Fetches Catan's full profile and:
- Inherits complexity range (Catan's 2.3 +/- 0.75)
- Inherits player count (3-4, relaxed to 3-5)
- Double-boosts Catan's core mechanics in genre list (1.5x effective)
- Result: games that *play like* Catan, not just games tagged "Strategy"

**How it works:**
1. `resolveSimilarToGames()` now returns full `GameRow[]` objects, not just tags
2. New `bootstrapFromSimilarGames()` function enriches the preference state
3. Only bootstraps constraints the user didn't explicitly set (respects user input)

**File:** `src/app/api/recommend/route.ts` -- `resolveSimilarToGames()` and `bootstrapFromSimilarGames()`

---

## Phase 2: Quality Improvements

### 2A. Query-Adaptive Weight Profiles

**Before:** 3 static weight profiles (default, hidden gems, high-intent). A query about "best 2-player game" used the same weights as "quick party game for 8."

**After:** Weights are dynamically amplified based on what the user emphasized:

| Condition | Weight Multiplier |
|-----------|------------------|
| Tight player count (range <= 1) | playerCountFit *= 2.0 |
| Moderate player count (range <= 3) | playerCountFit *= 1.5 |
| Hard time constraint ("under 90 min") | timeFit *= 2.5 |
| Any time constraint (presets or maxMinutes) | timeFit *= 1.5 |
| Narrow complexity (range <= 1) | complexityFit *= 2.0 |
| Multiple moods specified | moodAlignment *= 1.5 |

All weights renormalized to sum 1.0 after amplification.

**Why this matters:** BGG user @fortyfive asked for "90 minutes, 4 players" and got Brass: Birmingham (way over 90 min). With adaptive weights, timeFit gets 2.5x boost for hard time constraints, making it ~17% of total weight instead of 7%.

**File:** `src/lib/recommendation/scoring.ts` -- `computeAdaptiveWeights()` function

### 2B. Intent Structure Preservation

**Before:** "Must have deck building, would be nice if cooperative" flattened to `{mechanics: ["Deck Building"], moods: ["cooperative"]}` -- both treated equally.

**After:** New `ParsedPreferences` fields preserve priority:

```typescript
intentModifiers: {
  mustHave: string[];    // "must have", "need", "has to be"
  niceToHave: string[];  // "ideally", "bonus if", "preferably"
  avoid: string[];       // "not too", "less", "avoid"
  emphasize: string[];   // "really", "very", "extremely"
}
comparisonBase: {
  game: string;          // "like Catan"
  keepAttributes: string[];   // "the trading part"
  changeAttributes: string[]; // "less random", "more strategic"
}
```

**Scoring impact:**
- mustHave match: +0.3 bonus, missing: -0.2 penalty
- avoid match: -0.25 penalty
- emphasize match: +0.15 bonus
- niceToHave match: +0.1 bonus (no penalty for missing)

**Files:**
- `src/lib/llm/types.ts` -- Extended ParsedPreferences interface
- `src/lib/llm/parse-preferences.ts` -- Updated LLM system prompt with 6 new extraction examples
- `src/lib/recommendation/scoring.ts` -- `scoreFreeTextLLM()` applies intent multipliers

### 2C. LLM Metadata Enrichment Infrastructure

**What:** Batch script to enrich all 81k games with GPT-4o-mini-generated metadata:
- Mood/vibe tags (chill, competitive, brain-teaser, social, etc.)
- Target audience (families, couples, solo-players, strategy-enthusiasts)
- Vibe keywords (cozy, epic, portable, replayable, etc.)
- Similar game references
- Plain-English mechanic descriptions

**Scoring integration:** `scoreMoodAlignment()` now checks enriched mood tags FIRST (high confidence). Falls through to heuristic tag matching as supplement.

**Files:**
- `supabase/migrations/026_enriched_metadata.sql` -- JSONB column + GIN index
- `scripts/enrich-game-metadata.ts` -- Batch script (~$5-10 for 81k games)
- `src/types/game.ts` -- `enrichedMetadata` field
- `src/lib/supabase/games.ts` -- Column mapping + SELECT columns
- `src/lib/recommendation/scoring.ts` -- Enriched mood scoring

**To activate:** Run migration, then run the enrichment script.

---

## Phase 3: Infrastructure

### 3A. BPR Collaborative Filtering

**What:** Full TypeScript implementation of Bayesian Personalized Ranking (Rendle et al., UAI 2009) -- THE algorithm for implicit feedback.

**How it works:**
1. Learns 64-dimensional latent factor vectors for each user and game
2. Training: SGD on (user, liked_game, disliked_game) triples
3. Negative sampling: 50% from explicit dislikes, 50% random unrated
4. Inference: `score = dot(user_vector, game_vector)`
5. Higher dot product = stronger predicted preference

**Why better than our frequency counting:** Frequency counting ("3 similar users liked this game") misses latent structure. BPR learns that users who like Catan and Ticket to Ride might also like Concordia, even if no one explicitly rated all three. It captures the *pattern* of taste, not just co-occurrence counts.

**Files:**
- `src/lib/recommendation/bpr.ts` -- BPRModel class (train, predict, recommend, serialize/deserialize)
- `src/lib/recommendation/bpr.test.ts` -- 7 tests (convergence, ranking correctness, serialization)
- `scripts/train-bpr.ts` -- Training script (fetch feedback from Supabase, train, save model)

**To activate:** Run `npx tsx scripts/train-bpr.ts` (needs user feedback data in `user_game_feedback` table). Integrate trained model's `predict()` into `collaborative.ts` scoring.

### 3B. Semantic Tag Embeddings

**What:** Pre-compute embeddings for all ~500 unique game tags (categories, mechanics, themes). At query time, match user genre terms by cosine similarity instead of static alias table.

**Why:** "Roguelike" currently maps to `['adventure', 'variable player powers', 'modular board']` -- a BGG taxonomy mapping, not what users mean. With semantic matching, "roguelike" would match "Dungeon Crawler" and "Permadeath" with high cosine similarity, naturally capturing the concept.

**File:** `scripts/generate-tag-embeddings.ts` -- Output: `scripts/tag-embeddings.json`

**To activate:** Run the script (~$0.001), then integrate the tag embeddings into `scoreGenreMatch()` as a supplement to the static GENRE_EXPANSION map.

### 3C. A/B Testing Framework

**What:** Deterministic experiment group assignment + event logging + analysis script.

**Groups (Koch's recommended split):**
- Control (5%): Popularity-only baseline
- Production (50%): Current best weights
- Experimental (45%): New variant being tested

**Files:**
- `src/lib/recommendation/experiment.ts` -- Group assignment, weight selection, event creation
- `scripts/analyze-experiments.ts` -- Per-group metrics analysis

**To activate:** Read experiment group in `route.ts`, select weights via `getWeightsForGroup()`, log events to `experiment_logs` table.

---

## Activation Checklist

These items need manual action to fully activate:

- [ ] Run Supabase migration: `supabase migration up` (for `enriched_metadata` column)
- [ ] Run enrichment script: `npx tsx scripts/enrich-game-metadata.ts` (~$5-10, ~2-4 hours)
- [ ] Run tag embedding generator: `npx tsx scripts/generate-tag-embeddings.ts` (~$0.001)
- [ ] Annotate golden eval dataset: `npx tsx scripts/annotate-eval.ts`, review worksheet
- [ ] Run golden evals to establish baseline: `npx tsx scripts/run-golden-evals.ts`
- [ ] Train BPR model (when enough feedback exists): `npx tsx scripts/train-bpr.ts`
- [ ] Integrate A/B testing into route.ts (read group, select weights, log events)
- [ ] Create `experiment_logs` Supabase table (schema in `scripts/analyze-experiments.ts`)
- [ ] Deploy and collect real user feedback to validate improvements

---

## Test Status

- **Unit tests:** 420 passing (same as before session, 2 pre-existing failures in profile route mock)
- **New tests added:** 36 (29 eval metrics + 7 BPR)
- **Scoring tests:** 49 passing (4 assertions updated for weight change + formula corrections)
- **Semantic embeddings:** 100% coverage (81,039/81,039 games)

---

## Architecture After Changes

```
User Input (free text + questionnaire)
    |
    v
[LLM PARSING] GPT-4o-mini -> ParsedPreferences
  NOW INCLUDES: intentModifiers, comparisonBase          <-- NEW (2B)
    |
    v
[SIMILAR-TO BOOTSTRAPPING]                               <-- NEW (1C)
  Fetch full game profile, inherit complexity/time/players
  Boost core mechanics 1.5x
    |
    v
[CANDIDATE GENERATION] 6 parallel retrieval strategies
  Vector search now uses 100% semantic embeddings         <-- IMPROVED (1A)
    |
    v
[HARD CONSTRAINT FILTERING]
    |
    v
[ADAPTIVE WEIGHT COMPUTATION]                            <-- NEW (2A)
  Amplify weights based on query emphasis
  (tight player count -> 2x, hard time -> 2.5x)
    |
    v
[RULE-BASED SCORING] 10 weighted dimensions
  Rebalanced: genre 0.24, freeText 0.18, popularity 0.12 <-- CHANGED (1B)
  Uses enriched mood tags when available                  <-- NEW (2C)
  Intent modifiers: mustHave +0.3, avoid -0.25            <-- NEW (2B)
    |
    v
[SIMILARITY RE-RANKING]
    |
    v
[COLLABORATIVE FILTERING]
  BPR model available for latent factor scoring           <-- NEW (3A)
    |
    v
[REJECTION LEARNING + LLM RE-RANKING + DIVERSITY]
    |
    v
Output with NDCG/MAP/MRR measurable via golden evals     <-- NEW (Phase 0)
```

---

## Research Documents

| Document | Location |
|----------|----------|
| Full research paper (7 failure modes, 10 improvements) | `docs/RECOMMENDATION-ENGINE-RESEARCH.md` |
| BGG user feedback analysis (8 failure cases) | `tmp/bgg-user-eval-cases.md` |
| Raw BGG forum thread | `tmp/bgg-feedback.txt` |
| Eval validation report | `scripts/eval-validation-report.json` |
| Implementation plan | `.claude/plans/cheerful-bouncing-rivest.md` |
