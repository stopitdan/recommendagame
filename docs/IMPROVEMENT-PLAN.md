# Recommendation Engine Improvement Plan

## Instructions

Copy this entire document into a Claude Code prompt. It contains a prioritized list of every issue found through deep code review, eval analysis, and research comparison. Each item has the exact file, the problem, and what to do about it.

Current eval baseline: **76.9% pass rate** on 307 cases (up from 68.4% before this session's changes). Catalog coverage: 3.0% (up from 0.5%).

---

## TIER 1: CRITICAL BUGS (Fix These First)

### 1.1 Cache Key Computed Before LLM Merge
**File:** `src/app/api/recommend/route.ts` lines 70-82 vs 133-156
**Bug:** The cache key is computed from `body` BEFORE LLM-parsed genres/mechanics/gameTypes are merged into `body`. Two identical queries can get different cache hits because the key was computed with empty arrays.
**Fix:** Move the `cacheKey()` call to AFTER line 156 (after all LLM data is merged into body). This is a one-line move.

### 1.2 Denormalize Function Is a No-Op
**File:** `src/lib/recommendation/embeddings.ts` line 238
**Bug:** `denormalize()` just clones the vector (`return [...vec]`). It claims to reverse normalization but doesn't restore original magnitudes. When `enrichedPreferencesToVector()` calls denormalize → add LLM signals → normalize, the original vector values get diluted relative to the new LLM signals.
**Fix:** Either track and restore the pre-normalization magnitude, or redesign enrichment to multiply rather than add.

### 1.3 Genre Match Has 0.4 Floor for Zero Matches
**File:** `src/lib/recommendation/scoring.ts` lines 645-647
**Bug:** The genre scoring formula gives 0.4 base + (matches/total)*0.6. A game with ZERO matching genres still gets 0.4 credit on the genre dimension (26% weight = 0.104 free points).
**Fix:** Change the formula: zero matches should score 0.0, not 0.4. Use `matches === 0 ? 0.0 : 0.4 + (matches/total)*0.6`.

### 1.4 MMR Diversity Assumes Sorted Input
**File:** `src/lib/recommendation/diversity.ts` line 65
**Bug:** `maxScore = candidates[0].score` assumes input is sorted descending. If unsorted, normalization is wrong and scores can invert.
**Fix:** Add `candidates.sort((a, b) => b.score - a.score)` at the start of `mmrRerank()`, or assert sorted input.

### 1.5 Time Fit Falloff Is Cliff-Like
**File:** `src/lib/recommendation/scoring.ts` line 377
**Bug:** The formula `1.0 - (distance / rangeSize) * 0.8` creates a cliff where a 45-minute game scores 0.2 for a 30-minute request, but a 60-minute game scores 0.0. There's no graceful degradation.
**Fix:** Use sigmoid or exponential decay: `Math.exp(-distance / rangeSize * 2)` gives smoother falloff. A 45-min game would score ~0.5 instead of 0.2.

---

## TIER 2: SCORING CALIBRATION (High Impact on Eval Pass Rate)

### 2.1 Mood-Vibe Still at 29% Pass Rate
**Problem:** Mood scoring accumulates without diminishing returns. Multiple chill signals all add up and get clamped to 1.0, removing differentiation between "very chill" and "somewhat chill" games.
**Files:** `src/lib/recommendation/scoring.ts` scoreMoodAlignment function
**Fix:** Cap each sub-signal contribution and use weighted combinations instead of raw addition. Also add more mood signals:
- "Social" should check for `humor`, `communication limits`, `word game` tags
- "Brain-teaser" should also match `abstract strategy`, `spatial`, `logic`
- "Story-driven" should weight `narrative` and `campaign` differently (campaign = long story, narrative = any story)
- Add new moods: "intense", "relaxing", "creative", "educational"

### 2.2 Bayesian Dampening Kills Hidden Gems
**File:** `src/lib/recommendation/scoring.ts` lines 1083-1089
**Problem:** A brilliant game with 50 votes and 8.5 rating gets Bayesian-dampened to 6.56 (nearly the global mean of 6.5). The HIDDEN_GEMS_WEIGHTS give quality 15% weight, but the Bayesian adjustment already killed the signal.
**Fix:** Use a lower confidence threshold for hidden gems mode (100 instead of 1000), or use raw rating when ratingCount > 20.

### 2.3 Quality Signal Weight Too Low (3%)
**Problem:** A game rated 5.0 vs 8.5 has only 0.015 point impact on final score. Quality differences are invisible.
**Fix:** Increase to 5% (take from recency 3% -> 1%). Quality matters more than when a game was published.

### 2.4 Complexity Fit Returns 0.5 for Null
**File:** `src/lib/recommendation/scoring.ts` line 387
**Problem:** Games with missing complexity data get 0.5 (neutral) even when user explicitly set a complexity range. Should be penalized.
**Fix:** Return 0.2 when complexity is null and user specified a range, 0.5 when no range specified.

### 2.5 Free Text Scoring: Designer Queries Get 11% Boost Over Mechanics
**File:** `src/lib/recommendation/scoring.ts` lines 823-843
**Problem:** Designer match contributes +2.0 per check, mechanic match +1.5*1.2=1.8. After dividing by totalChecks, designer queries are arbitrarily 11% higher. No principled reason.
**Fix:** Normalize both to the same range, or use the same multiplier system.

### 2.6 Mechanic Alias: "Social Deduction" Maps to "Voting"
**File:** `src/lib/recommendation/mechanic-aliases.ts`
**Problem:** `'social deduction'` includes `'Voting'` as an alias. But Voting is not social deduction (many games with voting aren't deduction games).
**Fix:** Remove `'Voting'` from social deduction aliases. Add it to `'negotiation'` or `'politics'` instead.

### 2.7 Engine Building Maps to "Income"
**File:** `src/lib/recommendation/mechanic-aliases.ts`
**Problem:** `'engine building'` maps to `['Income', 'Increase Value of Unchosen Resources', 'Engine Building']`. "Income" is a reward mechanism, not an engine-building mechanic.
**Fix:** Remove `'Income'` and `'Increase Value of Unchosen Resources'`. Keep only `'Engine Building'` and add `'Tableau Building'`.

---

## TIER 3: CANDIDATE GENERATION (Medium Impact)

### 3.1 Similarity Threshold 0.15 Is Too Loose
**File:** `src/app/api/recommend/route.ts` (passed to pgvector RPC)
**Problem:** 0.15 cosine similarity means games with only 1-2 matching tags (out of 10-20) enter the candidate pool. Adds noise.
**Fix:** Increase to 0.25-0.30. Test with eval suite to find optimal threshold.

### 3.2 Canonical Games: Case-Sensitive Name Lookup
**File:** `src/app/api/recommend/route.ts` fetchCanonicalGames function
**Problem:** `.in('name', nameList)` is case-sensitive. If the DB stores "dominion" lowercase or "Clank!: A Deck-Building Adventure" (full title), the lookup fails silently.
**Fix:** Use `ilike` matching or fetch by a canonical ID instead of name. Better: pre-compute canonical game IDs at startup and fetch by ID.

### 3.3 Query Expansion: Low ROI vs Added Latency
**File:** `src/lib/recommendation/llm-query-expand.ts`
**Problem:** Adds 1-3 seconds of latency. For queries with strong signals (mechanics, genres), expansion returns games already found by other sources. For vague queries, it adds random noise.
**Fix:** Make it a feature flag. Disable by default, enable for queries where the LLM parser returned few signals (< 2 genres + mechanics).

### 3.4 Designer Search: N+1 Queries
**File:** `src/app/api/recommend/route.ts` fetchDesignerCandidates
**Problem:** Each designer name generates a separate DB query (up to 5 queries for 5 designers).
**Fix:** Combine into a single `.or()` query with all designer names.

### 3.5 Unknown Values Pass Through Hard Filters
**File:** `src/app/api/recommend/route.ts` applyHardFilters
**Problem:** Games with null playerCount, null playTime, null complexity all return `true` (keep). If a user explicitly set constraints, unknown-data games should be penalized or excluded.
**Fix:** When user explicitly set a constraint (not default range), filter out games with null data for that constraint.

---

## TIER 4: LEARNING SYSTEMS (Strategic, High Potential)

### 4.1 Implement BPR Training Pipeline
**File:** `src/lib/recommendation/bpr.ts` (exists but unused)
**Problem:** A complete BPR (Bayesian Personalized Ranking) implementation exists but is never trained or called. This is the academic gold standard for implicit feedback (Rendle et al., 2009).
**Fix:**
1. Create a batch job (cron or manual) that loads all user_game_feedback data
2. Trains a BPR model
3. Serializes to Redis
4. In the recommend route, loads the model and adds BPR scores as a signal (like CF boost)

### 4.2 Collect Implicit Signals
**Problem:** The system only learns from explicit feedback (thumbs up/down). 90% of user behavior data is ignored.
**Signals to collect:**
- Page view duration on game detail pages
- Which recommendation was clicked (position matters)
- Time to first click after seeing results
- Wishlist/save actions
- "Show more" clicks
**Fix:** Add event tracking to the game detail page and results page. Store in a `user_events` table. Convert implicit signals to pseudo-ratings for the preference vector.

### 4.3 Wire Up A/B Testing
**File:** `src/lib/recommendation/experiment.ts` (exists but not wired)
**Problem:** The experiment framework is fully built but never called from the recommend route. No experiment data is collected.
**Fix:** Wire `getExperimentGroup()` into the route handler. Log experiment events to a new `experiment_logs` table. Start with testing the current weights vs alternatives.

### 4.4 Pre-compute User Similarity Graph
**Problem:** collaborative.ts computes user similarity on every request (O(n^2) for n users). This doesn't scale.
**Fix:** Build a nightly batch job that pre-computes the top 100 similar users per user and stores in Redis. Use these pre-computed neighbors for CF instead of scanning.

### 4.5 Add Time Decay to Preference Vectors
**File:** `src/lib/recommendation/feedback-loop.ts`
**Problem:** All feedback is weighted equally regardless of age. A 2-year-old thumbs-up counts the same as yesterday's.
**Fix:** Apply exponential decay: `signal *= Math.exp(-age_days / 365)`. Recent feedback matters more.

---

## TIER 5: CODE QUALITY & MAINTAINABILITY

### 5.1 Extract Genre Expansion to Config File
**File:** `src/lib/recommendation/scoring.ts` GENRE_EXPANSION (240+ lines inline)
**Fix:** Move to `src/lib/recommendation/genre-expansion.ts` or a JSON config file. Add missing entries: "heavy/crunchy", "light/gateway", "educational", "real-time", "simultaneous turns", "narrative (branching)", "sandbox".

### 5.2 Extract Mood Config to Data Structure
**File:** `src/lib/recommendation/scoring.ts` scoreMoodAlignment (100-line switch)
**Fix:** Convert to a config array: `{mood: string, tags: string[], complexityRange?: [min, max], playerRange?: [min, max], scoreFunc}[]`. Easier to tune without touching scoring logic.

### 5.3 Extract Adaptive Weight Multipliers
**File:** `src/lib/recommendation/scoring.ts` computeAdaptiveWeights
**Fix:** Move multipliers (2.0, 1.5, 2.5, 6.0, etc.) to a config object `ADAPTIVE_MULTIPLIERS`.

### 5.4 Add Mechanic Alias Bidirectionality
**File:** `src/lib/recommendation/mechanic-aliases.ts`
**Problem:** `mechanicMatches('Deck, Bag, and Pool Building', 'deck building')` returns FALSE (direction-dependent).
**Fix:** Build a reverse lookup map at module load time. Check both directions.

### 5.5 Improve Error Logging in LLM Reranker
**File:** `src/lib/recommendation/llm-rerank.ts`
**Problem:** When LLM returns invalid IDs or truncated JSON, the code silently falls back to original order. No logging.
**Fix:** Log a warning with the raw LLM response when parsing fails.

---

## TIER 6: RESEARCH-BASED ENHANCEMENTS (Longer Term)

### 6.1 Semantic Genre Matching (Replace Static Expansion)
**Problem:** 70 static genre expansions create false positives ("Strategy" matches too broadly). Missing many user vocabulary terms.
**Fix:** Pre-compute embeddings for all ~500 unique game tags. At query time, embed user's terms and match by cosine similarity > 0.7. Naturally handles synonyms and related concepts.

### 6.2 Contextual Bandits for Exploration
**Problem:** MMR diversity at lambda=0.12 is cosmetic. No principled exploration/exploitation tradeoff.
**Fix:** Implement Thompson Sampling or UCB (Upper Confidence Bound) for the exploration component. Dynamically balance showing relevant results vs. discovering new user preferences.

### 6.3 Learned Ranking Model (Learning-to-Rank)
**Problem:** All 10 scoring dimension weights are hand-tuned. Koch/Criteo recommends a trained meta-learner.
**Fix:** Once you have ~1000+ feedback samples, train a gradient-boosted tree (XGBoost/LightGBM) or shallow neural net to predict user satisfaction from the 10-dimension feature vector. This replaces hand-tuned weights with learned weights. Could be a Python microservice or compiled to WASM.

### 6.4 LightGCN for Graph-Based CF
**Problem:** Current CF uses simple frequency counting. Misses higher-order relationships.
**Fix:** When user base reaches ~10k active users with feedback, implement LightGCN (He et al., SIGIR 2020). Propagates taste signals through the user-item interaction graph.

---

## EVAL-SPECIFIC IMPROVEMENTS

### Current Worst Cases (from 76.9% eval run)

**Mood/Vibe (29%):** Engine doesn't understand moods well. "Chill" heuristic improved but still misses games like Patchwork that lack "family" tags. Need richer mood taxonomy.

**Multi-Constraint (36%):** Combined constraints (2-player + 30 min + medium weight + competitive) are hard to satisfy simultaneously. The adaptive weight system helps but can dilute individual signals when many constraints are active.

**Complexity (44%):** Missing Ticket to Ride for "family game", Brass: Birmingham for "heavy strategy". Complexity scoring treats null complexity as neutral instead of penalizing.

**Time Constraint (57%):** "5 minute game" returns games over 10 minutes. Hard filter buffers are too generous (15 min grace for "hard" time limits). Consider tighter buffers.

**Designer Search (58%):** Improved from 42% but still misses some designers. The case-insensitive fix helps but some designers have multiple name variants in the DB.

### Eval Infrastructure Improvements

1. **Rate Limit Handling:** The eval runner now has retry logic and 2.5s delays, but should also support configurable delay and concurrent request limits.

2. **Full 3,028-Case Run:** Currently takes ~6 hours with rate limits. Consider running evals against a local API (bypassing rate limits) or batching.

3. **LLM Judge Upgrade:** Research shows pairwise comparison ("Is Game A or B better for this query?") is more reliable than pointwise scoring (0-10). Upgrade the judge.

4. **Statistical Significance:** Add confidence intervals and Wilcoxon signed-rank tests when comparing runs.

---

## SUMMARY: WHAT TO DO FIRST

If you can only do 5 things:

1. **Fix the cache key bug** (Tier 1.1) -- takes 5 minutes, prevents serving wrong cached results
2. **Fix genre match 0.4 floor** (Tier 1.3) -- takes 5 minutes, stops giving free points to irrelevant games
3. **Fix time fit cliff** (Tier 1.5) -- takes 15 minutes, makes time scoring graceful instead of binary
4. **Implement BPR training pipeline** (Tier 4.1) -- the code exists, just needs wiring. Biggest potential improvement.
5. **Collect implicit signals** (Tier 4.2) -- 10-100x more data than explicit feedback. Unlocks everything.

If you want to rebuild the engine from scratch, the research says: keep the hybrid architecture (it's correct), but replace hand-tuned weights with a learned model (XGBoost on the 10-dimension feature vector), add BPR collaborative filtering, and collect implicit behavioral signals. The TypeScript stack is fine for everything except the learned ranking model, which could be Python (scikit-learn/XGBoost) behind a simple API endpoint.
