# Session 4 Handoff (March 29-30, 2026)

## What We Did This Session

### Recommendation Engine Quality (major focus)
1. **LLM Reranking** - GPT-4o reranks top 25 (or all for small collections) candidates after rule-based scoring
2. **LLM Query Expansion** - Creative intent understanding runs in parallel with candidate fetch
3. **BGG Mechanic Alias Map** - 25+ mappings from common terms to BGG taxonomy ("Deck Building" -> "Deck, Bag, and Pool Building")
4. **Genre Expansion Map** - 120+ entries mapping user vocabulary to BGG categories (dungeon crawler, tv show, zombie, etc.)
5. **Direct Mechanic Search** - New candidate source that queries mechanics column directly with `.contains()`
6. **Hard Filters** - Time, player count, complexity, game type applied BEFORE scoring. Negative preferences (excludedGenres/excludedMechanics)
7. **Expansion Removal** - Games with ":" removed when base game exists (ratio-based: keeps popular standalones like Zombicide: Black Plague)
8. **Bayesian Quality Scoring** - Uses BGG's `bayes_avg_rating` instead of raw rating
9. **BGG Rank/Ownership in Scoring** - `rank_overall`, `num_owned` now factored into popularity score with tier bonuses
10. **Scoring Rebalance** - Popularity 20%, genreMatch 20%, freeTextMatch 14%, quality only 3%
11. **Enhanced LLM Parsing** - GPT-4o (upgraded from mini), negative preferences, exact time extraction with strictness, auto-detect board game from mechanics
12. **"Why did you dislike this?" popover** - Quick-select reasons + free text on thumbs-down
13. **Cache reduced to 2 min** + `_nocache` body param for testing

### "My Collection" Feature
- **New table:** `user_owned_games` (migration 022) - separate from favorites
- **OwnedButton component** - Package icon toggle on game detail pages
- **BGG sync writes to user_owned_games** alongside bgg_collection
- **Collection-only mode** - Completely separate code path at TOP of recommend handler. Fetches all owned games directly, scores them, LLM reranks ALL of them.
- **Service role key** for owned games query (bypasses RLS since recommend route uses anon client)
- **My Collection tab** in Profile showing full game cards with BGG/Manual source badges
- **Auto-sync** - Checks if BGG sync is 24h+ stale on results page visit
- **@ stripping** from BGG username input

### Eval Suite
- **run-evals.ts** - 19 hardcoded test cases + loads from eval-cases.json
- **generate-eval-cases.ts** - GPT-4o generates ~1000 diverse test cases across 22 categories
- **Baseline: 15% pass rate (112/743)** - Most failures are "well-known game X not in top 10"
- Categories: mechanics, themes, player counts, time, complexity, moods, occasions, comparisons, video game refs, vague queries, specific queries, sarcastic, nonsense, negative prefs, ESL, typos, text-speak, multi-constraint

### Site Polish
- **Roadmap page updated** - All phases reflect current reality, "Suggest a Feature" button
- **Landing page polish** - Feature cards with stat callouts, colored icon backgrounds, gradient tints. Stats expanded to 5 with subtitles. How It Works connecting line.
- **Game detail improvements** - BGG rank badge, ownership count, designers, publishers
- **Easter eggs** - Triple-click logo spin, hidden footer message
- **Beta badge** in header
- **Feedback button** - Sends via Resend to Gmail (bottom of results + browse pages)
- **Lucide icons everywhere** - 100+ emoji replacements
- **Dice Gallery removed from nav** - Accessible from Roll the Dice page instead
- **Keystroke lag fix** - Results search box changed to uncontrolled input
- **Mobile header** - "BG.lol" instead of "RAG"

### Infrastructure
- Cloudflare DNS (non-www primary)
- Resend for feedback emails
- BGG API Bearer token auth (they changed it July 2025)
- All env vars synced to Vercel

## Current State of Recommendation Engine

### Pipeline (when collectionOnly=false)
1. LLM Parse (GPT-4o) - extracts structured preferences from free text
2. LLM Query Expansion (GPT-4o-mini) - creative search term generation
3. Hybrid candidate fetch (5 sources in parallel):
   - 125 by rating + 125 by rating_count (blended)
   - Vector similarity (250)
   - Direct mechanic search (50 per mechanic, sorted by rating_count)
   - Tag-based GIN search (categories/mechanics/themes)
   - Text search (name + description)
4. Query expansion results merged
5. Hard filters (time, players, complexity, type, excluded genres, expansions)
6. Rule-based scoring (10 dimensions, genre 20% + popularity 20% dominant)
7. Collaborative filtering boost (15% for users with feedback history)
8. Rejection learning penalties
9. LLM Reranking (GPT-4o, top 25 candidates)
10. Diversity reranking (MMR)

### Pipeline (when collectionOnly=true)
1. Fetch all owned game IDs from user_owned_games (service role, bypasses RLS)
2. Fetch full game data for those IDs
3. Score them with rule-based engine
4. LLM Rerank ALL of them (no 25-game limit for small collections)
5. Return

### Key Numbers
- ~81k games in DB (after trimming <10 ratings)
- Eval baseline: 15% pass rate on 743 test cases
- Cache TTL: 2 min (memory + Redis)
- LLM costs: ~$0.003/recommendation (GPT-4o reranker) + ~$0.003 (GPT-4o parser) + ~$0.0003 (GPT-4o-mini query expansion)

## What Needs Work Next

### Critical: Recommendation Quality (15% -> target 60%+)
The #1 problem: well-known games don't surface. Dominion, Ticket to Ride, Pandemic, Codenames etc. should appear for obvious queries but often don't. The eval suite proves this systematically.

Root causes to investigate:
1. **Candidate pool too narrow** - 250 by rating + 250 by popularity may not include the right games
2. **LLM reranker getting bad inputs** - If the candidate pool doesn't contain Dominion, GPT-4o can't pick it
3. **Genre/mechanic matching still too loose** - Even with 120+ genre expansions, the scoring engine may not be matching correctly
4. **Semantic embeddings at 0% coverage** - Hash-based embeddings have collision issues. OpenAI semantic embeddings would dramatically improve vector search quality.

### Pending Phases from Rec Quality Plan
- Phase 5: Fix semantic embeddings batch script (0% coverage, script times out)
- Phase 7: Semantic mood alignment (replace hardcoded rules)
- Seed users script needs to be run

### Pending Migrations
- 017: Game collections (might be run, check)
- 021: Trim low-engagement games (< 10 ratings) - might be run

### Other
- Collections UI needs more work (the owned games query fetches game_id only, profile shows cards but compare/browse don't have "I Own This" yet)
- GameCard doesn't have OwnedButton yet (only game detail page has it)
- Blog auto-generates daily but quality hasn't been checked
- Product Hunt account should be old enough to post now
- Reddit account was shadowbanned, need new one
- Google AdSense not yet applied for

## Key Files
- `src/app/api/recommend/route.ts` - Main recommendation orchestrator
- `src/lib/recommendation/scoring.ts` - 10-dimension scoring + 120+ genre expansion map
- `src/lib/recommendation/llm-rerank.ts` - GPT-4o reranker
- `src/lib/recommendation/llm-query-expand.ts` - Creative query expansion
- `src/lib/llm/parse-preferences.ts` - GPT-4o preference extraction
- `src/app/api/recommend/route.ts` lines ~140-200 - Collection-only code path
- `scripts/run-evals.ts` - Eval runner
- `scripts/generate-eval-cases.ts` - Eval case generator
- `scripts/eval-cases.json` - Generated test cases (~728 cases)
