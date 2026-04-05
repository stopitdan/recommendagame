---
name: enhance-evals
description: Improve the eval system quality -- add better cases, fix broken cases, improve the LLM judge, add new metrics, or refine pass/fail criteria based on eval run data. Use when the user wants to make the eval system itself better.
disable-model-invocation: true
argument-hint: [area to improve]
allowed-tools: Bash Read Write Edit Glob Grep Agent
effort: high
---

# Enhance the Eval System

You are improving the boredgame.lol recommendation engine evaluation system. The user wants the eval system itself to be better -- more accurate tests, better failure detection, smarter judging, more useful output.

## Full Context You MUST Know

### System Architecture
- `evals/runner.ts` (626 lines) - Core runner: parallel execution, LLM judge, constraint checker, regression tracking, persistent logging
- `evals/types.ts` (218 lines) - Type definitions for cases, results, runs, metrics
- `evals/metrics.ts` (109 lines) - NDCG@K, Precision@K, MRR, Hit Rate calculations
- `evals/llm-judge.ts` (105 lines) - GPT-4o-mini rates overall result quality 0-10
- `evals/constraint-checker.ts` (110 lines) - Detects player count, time, complexity, game type violations
- `evals/compare-runs.ts` (139 lines) - Side-by-side run comparison with regression detection
- `evals/summary.ts` (109 lines) - Run summary viewer with history mode
- `evals/analyze-failures.ts` (254 lines) - Failure pattern categorization + most-missing-game tracking
- `evals/generate-cases.ts` - 130 hand-curated base cases
- `evals/generate-expanded-cases.ts` - +177 systematic variations
- `evals/generate-massive.ts` - LLM-generated thousands (GPT-4o-mini, batched)
- `evals/cases.json` - Currently ~3,028 cases across 16 categories

### Known Weaknesses in the Eval System

1. **Pass/fail criteria may be too strict**: A case fails if ANY ideal game (relevance >= 2) is missing. But the results might be excellent games the eval case didn't anticipate. The LLM judge catches this (7.14/10 average vs 68.4% pass rate means many "failing" cases have good results).

2. **idealGames are sometimes wrong**: Some generated cases reference games that don't exist in the DB, or use slightly wrong names (e.g., "Castles of Burgundy" vs "The Castles of Burgundy").

3. **LLM judge uses 0-10 scale**: Research (arxiv 2411.15594) shows 0-2 scales with per-dimension scoring are more reliable. Current judge gives a single holistic score.

4. **No serendipity metric**: Research shows users want accuracy + novelty. We don't measure whether recommendations include unexpected-but-delightful games.

5. **No familiarity balance metric**: Optimal is 20-30% recognizable games, 70-80% discovery. We don't track this.

6. **Catalog coverage is only 0.5%**: Only ~400-500 unique games appear across all recommendations. Could indicate test cases are too similar or engine has narrow candidate fetching.

7. **Generated cases may have quality issues**: LLM-generated cases (GPT-4o-mini at temp 0.9) may include unrealistic queries, wrong game names, or contradictory constraints.

8. **No confidence intervals**: We report point estimates without standard errors. With 3,000+ cases we should use statistical significance testing.

### Research-Backed Improvements to Consider

From `docs/research/recommendation-eval-methodology.md` and `evals/RECOMMENDATIONS.md`:

- **Pairwise LLM comparison** instead of absolute scoring (more reliable)
- **Per-dimension scoring**: Rate mechanic match, theme match, constraint satisfaction separately
- **Chain-of-thought reasoning** in LLM judge (explain BEFORE scoring)
- **Trust buster detection**: Flag obviously-wrong individual results (Chess for party game query)
- **Constraint violation breakdown** by type (time vs player count vs complexity)
- **Serendipity@K**: relevant AND dissimilar to obvious matches
- **Familiarity-discovery ratio**: % of results that are well-known vs obscure

### The 16 Categories and Their Current Performance

| Category | Cases | Pass Rate | Notes |
|----------|-------|-----------|-------|
| mechanic-focused | 530 | ~32% | Weakest. BGG mechanic alias gap is the root cause. |
| multi-constraint | 384 | ~36% | Combined constraints are hard to satisfy. |
| theme-focused | 356 | ~86% | Strong. Theme matching works well. |
| video-game | 262 | ~100% | Perfect. No cross-contamination. |
| similar-to | 212 | ~83% | Good. "Like X" queries work. |
| mood-vibe | 189 | ~29% | Weak. Missing Patchwork, Jaipur for chill. |
| player-count | 177 | ~60% | Moderate. Some constraint violations. |
| time-constraint | 164 | ~50% | Moderate. Time violations persist. |
| free-text-intent | 159 | ~73% | Good. Natural language decent. |
| edge-case | 153 | ~100% | Perfect. Handles garbage gracefully. |
| negative-preference | 123 | ~73% | Good. Respects exclusions. |
| designer-search | 116 | ~42% | Weak. Non-designer games mixed in. |
| complexity | 112 | ~44% | Moderate. Misses gateway games. |
| real-user-feedback | 78 | ~33% | Weak. BGG user issues persist. |
| regression | 9 | ~89% | Good. Past bugs mostly fixed. |
| party-game | 4 | ~50% | Too few cases. |

## What To Do

Based on what the user asks (or $ARGUMENTS), pick the right enhancement:

### If they want to fix broken/inaccurate test cases:
1. Read `evals/cases.json` and look for cases with wrong game names, unrealistic queries, or contradictory constraints
2. Cross-reference idealGames against the actual database (query Supabase or use the validate script from `scripts/validate-eval-cases.ts`)
3. Fix the cases in the appropriate generator (`generate-cases.ts`, `generate-expanded-cases.ts`, or `generate-massive.ts`) and regenerate

### If they want better metrics:
1. Read `evals/metrics.ts` and `evals/types.ts`
2. Add new metric calculations (serendipity, familiarity balance, catalog coverage per run)
3. Update `computeCaseMetrics()` and `computeAggregateMetrics()` in the runner
4. Update the report formatter to display new metrics

### If they want a better LLM judge:
1. Read `evals/llm-judge.ts`
2. Implement per-dimension scoring (mechanic match, theme match, constraint satisfaction as separate 0-2 scores)
3. Add chain-of-thought reasoning requirement
4. Consider pairwise comparison mode for A/B testing system versions

### If they want more/better test cases:
1. Identify which categories are underrepresented (party-game has only 4 cases!)
2. Add hand-curated cases in `generate-cases.ts` for the weakest categories
3. Run `npm run eval:generate-massive` to fill gaps with LLM-generated cases
4. Validate new cases against the database

### If they want better reporting/visualization:
1. Read `evals/summary.ts`, `evals/compare-runs.ts`, `evals/analyze-failures.ts`
2. Add new views (e.g., trend over time, per-game analysis, category drill-down)
3. Consider adding an HTML report generator for richer visualization

## Important Rules

- READ the relevant files thoroughly before making changes
- ALWAYS regenerate cases.json after modifying generators (run the appropriate generate script)
- ALWAYS run a quick eval after changes to verify nothing broke: `source .env.local && npx tsx evals/runner.ts --quick --no-judge`
- Document what you changed in `evals/EVAL-WORKLOG.md`
- Do NOT change engine code -- this skill is about the eval system only
