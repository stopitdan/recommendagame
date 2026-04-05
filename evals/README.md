# Evaluation System

Comprehensive evaluation framework for the boredgame.lol recommendation engine.
307+ test cases across 16 categories with LLM-as-judge scoring, parallel execution,
persistent logging, regression tracking, and failure analysis.

---

## Quick Start

```bash
# Prerequisites: dev server running on localhost:1337
npm run dev

# Run full eval suite (307 cases, LLM judge, ~12 min)
npm run eval

# Run quick eval (50 cases, no judge, ~2 min)
npm run eval:quick

# Run with more parallelism
npm run eval:full

# View results
npm run eval:summary          # Latest run summary
npm run eval:history          # All runs history
npm run eval:compare          # Compare last 2 runs
npm run eval:analyze          # Failure analysis of latest run
```

## Directory Structure

```
evals/
  cases.json              # 307+ eval cases (generated, don't edit directly)
  types.ts                # Type definitions for the eval system
  runner.ts               # Core eval runner (parallel, logged, regression-aware)
  metrics.ts              # IR metrics (NDCG, precision, MRR, etc.)
  llm-judge.ts            # GPT-4o-mini judges result quality (0-10)
  constraint-checker.ts   # Detects player count, time, complexity violations
  compare-runs.ts         # Side-by-side run comparison
  summary.ts              # Run summary viewer
  analyze-failures.ts     # Failure pattern analysis
  generate-cases.ts       # Base case generator (130 hand-curated)
  generate-expanded-cases.ts  # Expanded generator (adds 177 more)
  EVAL-WORKLOG.md         # Running log of all findings and decisions
  RECOMMENDATIONS.md      # Engine improvement recommendations from eval data
  runs/                   # JSON results for every eval run
  logs/                   # Human-readable logs and analysis for every run
```

## How the Eval System Works

### 1. Test Cases (`cases.json`)

307+ categorized test cases, each with:
- **query**: What a user would type (e.g., "deck building game")
- **category**: One of 16 categories (mechanic-focused, theme-focused, etc.)
- **idealGames**: Games that SHOULD appear (with relevance grade 0-3)
- **antiGames**: Games that should NEVER appear
- **constraints**: Explicit constraints to check (player count, time, complexity)
- **tags**: For filtering (regression, critical, edge-case, etc.)

### 2. Runner (`runner.ts`)

Executes all cases against the live API with:
- **Parallel execution**: Configurable concurrency (default 8)
- **LLM-as-judge**: GPT-4o-mini rates overall result quality 0-10
- **Constraint checking**: Detects player count, time, complexity violations
- **Persistent logging**: Every run saved as JSON + human-readable log
- **Regression tracking**: Automatically compares with previous run

### 3. Pass/Fail Criteria

A case **passes** if ALL of these are true:
1. No ideal games (relevance >= 2) are missing from top 10
2. No anti-games appear in top 10
3. No constraint violations in top 5
4. API returns results (not empty/error)

### 4. Metrics

For each case:
- **NDCG@10**: Ranking quality (are relevant items near the top?)
- **Precision@10**: What fraction of top 10 is relevant?
- **MRR**: How quickly is the first relevant item found?
- **Hit Rate@5**: Is ANY relevant item in top 5?
- **Constraint Violation Rate**: What fraction of top 10 violates constraints?
- **LLM Judge Score**: GPT-4o-mini's 0-10 rating of overall quality

### 5. Failure Analysis (`analyze-failures.ts`)

Categorizes failures into patterns:
- **missing-famous-game**: Relevant results but canonical game absent
- **constraint-violation**: Time/player/complexity constraints broken
- **anti-game-present**: Forbidden game appears
- **llm-judge-low-score**: Overall quality rated < 5/10
- **empty-or-error**: No results returned

Also tracks most commonly missing games across all failures.

## CLI Options

```bash
npx tsx evals/runner.ts                          # Full run with judge
npx tsx evals/runner.ts --quick                  # 50 cases, no judge
npx tsx evals/runner.ts --no-judge               # All cases, no judge
npx tsx evals/runner.ts --concurrency=15         # More parallel
npx tsx evals/runner.ts --category=mechanic-focused  # Single category
npx tsx evals/runner.ts --tag=regression         # Only regression tests
npx tsx evals/runner.ts --limit=50               # First 50 cases
```

## Interpreting Results

### Pass Rate
- **> 80%**: Excellent. Engine handles most query types well.
- **60-80%**: Good. Some categories need work.
- **40-60%**: Moderate. Significant gaps in coverage.
- **< 40%**: Poor. Fundamental issues with relevance or matching.

### LLM Judge Score
- **8-10**: Results are exactly what the user wanted.
- **6-7**: Results are decent but miss some obvious picks.
- **4-5**: Results are mediocre, mix of relevant and irrelevant.
- **< 4**: Results are poor, mostly wrong.

### NDCG@10
- **> 0.95**: Results are mostly relevant and well-ordered.
- **0.85-0.95**: Decent relevance, some ordering issues.
- **< 0.85**: Significant relevance problems.

## Adding New Test Cases

Edit `evals/generate-cases.ts` or `evals/generate-expanded-cases.ts` to add cases.
Then regenerate:

```bash
npm run eval:generate   # Regenerate base 130 cases
npm run eval:expand     # Regenerate expanded 307+ cases
```

### Case Format

```typescript
addCase('mechanic-focused', 'Deck builder basic', 'deck building game', {
  gameTypes: ['board'],
  idealGames: [
    { name: 'Dominion', relevance: 3, reason: 'THE deck builder' },
  ],
  antiGames: [
    { name: 'UNO', reason: 'Not deck building' },
  ],
  constraints: { maxMinutes: 30, timeStrictness: 'hard' },
  tags: ['regression'],
});
```

## Current Baseline (2026-04-05)

| Metric | Value |
|--------|-------|
| Total Cases | 307 |
| Pass Rate | 68.4% |
| LLM Judge | 7.14/10 |
| NDCG@10 | 0.9855 |
| Constraint Violations | 1.0% |
| Latency p50/p95 | 9.6s / 12.3s |

### Top Weaknesses
1. **mechanic-focused** (32% pass) - Missing famous games like Dominion, Codenames
2. **mood-vibe** (29% pass) - Missing Patchwork, Jaipur for chill queries
3. **designer-search** (42% pass) - Non-designer games mixed in results
4. **multi-constraint** (36% pass) - Combined constraints are hard

### Top Strengths
1. **edge-case** (100% pass) - Handles weird/adversarial queries perfectly
2. **video-game** (100% pass) - Video game queries work great
3. **theme-focused** (86% pass) - Theme matching is strong
4. **similar-to** (83% pass) - "like X" queries work well
