# Evaluation System Work Log

Tracking all findings, decisions, and results from the eval system rebuild.

---

## 2026-04-04: Ground-Up Eval Rebuild

### What we had before
- 19 hardcoded smoke tests in `scripts/run-evals.ts` (simple pass/fail substring matching)
- 47 golden eval cases in `scripts/golden-eval-cases.json` (hand-curated, research metrics)
- 1000+ auto-generated cases in `scripts/eval-cases.json` (GPT-4o generated)
- 37 of those auto-generated cases reference games not in DB (always fail)
- Golden dataset annotation still "PENDING"
- No persistent logging, no regression tracking, no parallel execution
- No LLM-as-judge -- only checks "is game X in the list?"

### Problems with old approach
1. **Substring matching is brittle**: Checking if "Dominion" appears in results misses whether the OVERALL results are good
2. **No failure categorization**: A test fails but we don't know WHY (constraint violation? genre mismatch? popularity bias?)
3. **No regression tracking**: Can't compare run-over-run
4. **Sequential execution**: 1000+ cases take forever at ~5s each
5. **No persistent logs**: Results vanish after terminal closes
6. **No LLM judge**: Can't catch "the results are technically not wrong but not what the user wanted"

### New architecture
- `evals/` directory with clean separation of concerns
- `evals/runner.ts` - Core runner with parallel execution (configurable concurrency)
- `evals/types.ts` - Comprehensive type system
- `evals/metrics.ts` - Battle-tested IR metrics (reused from old system)
- `evals/llm-judge.ts` - GPT-4o-mini judges overall result quality (0-10)
- `evals/constraint-checker.ts` - Detects player count, time, complexity violations
- `evals/generate-cases.ts` - 200+ hand-curated cases across 15 categories
- `evals/runs/` - Persistent JSON results for every run
- `evals/logs/` - Human-readable log files for every run
- Regression tracking: compares against previous run automatically

### Architecture notes (from ARCHITECTURE.md review)
The recommendation pipeline has 6 main stages per the architecture doc:
1. Parse & Understand (LLM)
2. Cache Check
3. Relevance-First Candidate Fetching (parallel: vector, tag, text, mechanic, designer, expansion, popularity fallback)
4. Hard Filters (player count, time, complexity, game type, excluded genres)
5. Scoring (10 dimensions totaling 100%)
6. Post-Processing (genre filter, similarity re-rank, CF boost, rejection penalties, LLM re-rank, diversity re-rank)

Key weight distribution: Genre 28%, FreeText 22%, Type 10%, Players 8%, Mood 8%, Time 7%, Complexity 7%, Pop 4%, Quality 3%, Recency 3%

Adaptive weights boost dimensions when user is specific (e.g., tight player count gets 2x).

### Known issues from BGG thread and session handoffs
- Solo constraint violated (The Crew for solo queries)
- Time constraint violated (Brass: Birmingham for 90min queries)
- Designer search incomplete (only 1 Feld game)
- Free text sometimes ignored
- Poker appeared in euro game results (known regression)
- UNO appears in irrelevant queries
- Hidden gems returns popular games
- ALL game type defaults to board games

---

## Run 1: Baseline (in progress)

_Results will be recorded here after first run._
