---
name: run-evals
description: Run the recommendation engine evaluation suite, analyze results, and produce a clear summary with comparisons to previous runs. Use when the user wants to test the recommendation engine quality.
disable-model-invocation: true
argument-hint: [--quick | --category=X | --limit=N]
allowed-tools: Bash Read Glob Grep
---

# Run Recommendation Engine Evals

You are running the boredgame.lol recommendation engine evaluation suite. This is a comprehensive test system with 3,000+ eval cases across 16 categories that tests whether the engine returns the right games for user queries.

## Context You MUST Know

- The eval system lives in `evals/`
- Cases are in `evals/cases.json` (currently ~3,028 cases)
- Results are persisted in `evals/runs/` (JSON) and `evals/logs/` (human-readable)
- Each run automatically compares against the previous run for regression detection
- The LLM judge (GPT-4o-mini) scores each result set 0-10
- A case PASSES if: no ideal games (relevance >= 2) are missing from top 10, no anti-games appear, no constraint violations in top 5, and API returns results

## Current Baseline (from 307-case run on 2026-04-05)

- Pass Rate: 68.4% (210/307)
- LLM Judge: 7.14/10
- NDCG@10: 0.9855
- Constraint Violations: 1.0%
- Weakest categories: mechanic-focused (32%), mood-vibe (29%), designer-search (42%)
- Strongest: edge-case (100%), video-game (100%), theme-focused (86%)
- #1 failure mode: missing famous games (89 of 97 failures)

## What To Do

1. **Ensure dev server is running** on localhost:1337. If not, start it:
   ```bash
   npm run dev
   ```
   Wait for it to be ready before proceeding.

2. **Run the eval suite** based on user args:
   - Default (full suite with judge): `source .env.local && npx tsx evals/runner.ts --concurrency=5`
   - Quick (50 cases, no judge): `source .env.local && npx tsx evals/runner.ts --quick --concurrency=8`
   - Specific category: `source .env.local && npx tsx evals/runner.ts --category=$ARGUMENTS --concurrency=5`
   - With limit: `source .env.local && npx tsx evals/runner.ts $ARGUMENTS`

   If the user passed arguments like `--quick` or `--category=mechanic-focused`, pass them through.

3. **After the run completes**, show the summary:
   ```bash
   source .env.local && npx tsx evals/summary.ts
   ```

4. **Compare with previous run** (if one exists):
   ```bash
   source .env.local && npx tsx evals/compare-runs.ts
   ```

5. **Run failure analysis**:
   ```bash
   source .env.local && npx tsx evals/analyze-failures.ts
   ```

6. **Present results to the user** in a clear, organized format:
   - Overall pass rate and LLM judge score
   - Category breakdown (worst to best)
   - Regression comparison (what improved, what regressed)
   - Top 10 worst cases with details
   - Most commonly missing games
   - Specific constraint violations found
   - Concrete recommendations for what to fix next

## Important Rules

- ALWAYS source .env.local before running eval scripts
- NEVER modify engine code during this skill -- only observe and report
- If the server is not running or requests fail, tell the user to start `npm run dev` first
- If many cases show "api-error", the server is likely overloaded -- suggest reducing concurrency
- The 307-case definitive baseline from 2026-04-05T04-41-09 is the comparison point
- Read `evals/RECOMMENDATIONS.md` if the user asks what to fix
- Read `evals/EVAL-OVERVIEW.md` for the full system documentation
