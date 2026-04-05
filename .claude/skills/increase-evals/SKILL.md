---
name: increase-evals
description: Generate more eval test cases to expand coverage. Targets 5,000+ total cases. Use when the user wants more test cases for the recommendation engine evaluation suite.
disable-model-invocation: true
argument-hint: [count | category]
allowed-tools: Bash Read Write Edit Glob Grep
---

# Increase Eval Test Cases

You are expanding the boredgame.lol recommendation engine eval suite. The goal is to have 5,000+ diverse, high-quality test cases that cover every conceivable query a real user might type.

## Current State

- **3,028 cases** currently in `evals/cases.json`
- Target: **5,000** cases minimum
- Gap: ~1,972 more needed

### Current Category Distribution

| Category | Count | Notes |
|----------|-------|-------|
| mechanic-focused | 530 | Good coverage |
| multi-constraint | 384 | Good |
| theme-focused | 356 | Good |
| video-game | 262 | Good |
| similar-to | 212 | Good |
| mood-vibe | 189 | Could use more |
| player-count | 177 | Good |
| time-constraint | 164 | Good |
| free-text-intent | 159 | Could use more |
| edge-case | 153 | Good |
| negative-preference | 123 | Could use more |
| designer-search | 116 | Could use more |
| complexity | 112 | Could use more |
| real-user-feedback | 78 | NEEDS MORE -- these are the most valuable |
| regression | 9 | NEEDS MORE -- known failure probes |
| party-game | 4 | NEEDS MUCH MORE |

## What To Do

### Option 1: Run the LLM generator (fastest way to add ~2,000 cases)

The `generate-massive.ts` script has 7 additional batch definitions (batches 24-30) that haven't been run yet. These target:
- Mechanic combo queries (150)
- Theme + mechanic combos (150)
- Known failure mode probes / regression tests (100)
- Party and social scenarios (100)
- Specific video game queries (150)
- Diverse natural language (150)
- Final diverse fill (200)

```bash
source .env.local && npx tsx evals/generate-massive.ts
```

This loads the existing 3,028 cases and adds new batches on top. It uses GPT-4o-mini with 120s timeout and batch size 30.

**After generation, verify the count:**
```bash
node -e "console.log(JSON.parse(require('fs').readFileSync('evals/cases.json')).length)"
```

### Option 2: Add hand-curated cases for weak categories

The most impactful categories to expand:
1. **party-game** (only 4 cases!) -- Add 50+ cases covering different group sizes, settings, audiences
2. **regression** (only 9 cases) -- Add 50+ cases probing every known failure mode
3. **real-user-feedback** (78 cases) -- Add more messy, real-world style queries
4. **designer-search** (116 cases) -- Add more designers, varied phrasings

Edit `evals/generate-cases.ts` to add cases with the `addCase()` function, then regenerate:
```bash
npx tsx evals/generate-cases.ts
```

### Option 3: User specifies a count or category

If the user said `/increase-evals 500` or `/increase-evals party-game`:
- For a number: generate that many additional cases via `generate-massive.ts` (adjust batch counts)
- For a category: focus generation on that specific category

## Quality Rules for New Cases

1. **Queries must feel like real humans typed them** -- messy, informal, with personality. Not "Please recommend a worker placement game with medium complexity" but "whats a good WP game thats not too brainy"
2. **shouldInclude max 2 games** -- only the absolute most obvious matches. Most cases should have 0-1.
3. **Use exact BGG game names** -- "7 Wonders Duel" not "7 wonders duel"
4. **shouldNotInclude should be clearly wrong** -- UNO for strategy, Chess for party games, Twilight Imperium for quick games
5. **~20% of queries should have typos/casual language** -- "dekc biulder", "workar playsment", "somthing chill"
6. **Every query must be unique** -- no duplicates or trivial rephrasing
7. **Include constraints where natural** -- "for 2 players", "under 30 minutes", "not too complex"

## After Adding Cases

1. **Verify case count**: `node -e "console.log(JSON.parse(require('fs').readFileSync('evals/cases.json')).length)"`
2. **Run a quick eval to check**: `source .env.local && npx tsx evals/runner.ts --quick --no-judge`
3. **Update the worklog**: Add a note to `evals/EVAL-WORKLOG.md` about what was added and why
4. **Tell the user** exactly how many cases were added and the new total
