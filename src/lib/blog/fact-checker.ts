/**
 * Triple Fact-Check System
 *
 * Check 1: Database accuracy (code-only, no LLM)
 * Check 2: Content-claim verification (LLM cross-references DB data)
 * Check 3: Correction application (LLM fixes errors if any found)
 */

import type OpenAI from 'openai';
import type { BlogDraft, BlogGameRow, FactCheckResult, FactError } from './types';

// ── Check 1: Database Accuracy (pure code) ──────────────────

function checkDatabaseAccuracy(draft: BlogDraft, games: BlogGameRow[]): FactError[] {
  const errors: FactError[] = [];
  const gameMap = new Map(games.map((g) => [g.id, g]));
  // Also map by lowercase name for fuzzy matching
  const nameMap = new Map(games.map((g) => [g.name.toLowerCase(), g]));

  for (const ref of draft.gamesReferenced) {
    const dbGame = gameMap.get(ref.id) ?? nameMap.get(ref.name.toLowerCase());
    if (!dbGame) continue; // Game not in our DB, can't verify

    // Check player count
    if (ref.claimedPlayers) {
      const playerMatch = ref.claimedPlayers.match(/(\d+)\s*-\s*(\d+)/);
      if (playerMatch) {
        const claimedMin = parseInt(playerMatch[1], 10);
        const claimedMax = parseInt(playerMatch[2], 10);
        if (claimedMin !== dbGame.min_players || claimedMax !== dbGame.max_players) {
          errors.push({
            game: dbGame.name,
            field: 'player count',
            claimed: ref.claimedPlayers,
            actual: `${dbGame.min_players}-${dbGame.max_players}`,
          });
        }
      }
    }

    // Check play time (allow 20% tolerance)
    if (ref.claimedTime) {
      const timeMatch = ref.claimedTime.match(/(\d+)/);
      if (timeMatch && dbGame.avg_play_time > 0) {
        const claimed = parseInt(timeMatch[0], 10);
        const tolerance = dbGame.avg_play_time * 0.3;
        if (Math.abs(claimed - dbGame.avg_play_time) > tolerance) {
          errors.push({
            game: dbGame.name,
            field: 'play time',
            claimed: ref.claimedTime,
            actual: `~${dbGame.avg_play_time} minutes`,
          });
        }
      }
    }

    // Check complexity (allow 0.5 tolerance)
    if (ref.claimedComplexity) {
      const compMatch = ref.claimedComplexity.match(/([\d.]+)/);
      if (compMatch && dbGame.complexity > 0) {
        const claimed = parseFloat(compMatch[0]);
        if (Math.abs(claimed - dbGame.complexity) > 0.5) {
          errors.push({
            game: dbGame.name,
            field: 'complexity',
            claimed: ref.claimedComplexity,
            actual: `${dbGame.complexity.toFixed(1)}/5`,
          });
        }
      }
    }
  }

  // Also scan the content for inline stats and cross-reference
  const content = draft.content;
  for (const game of games) {
    const escapedName = game.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const nameRegex = new RegExp(escapedName, 'i');
    if (!nameRegex.test(content)) continue;

    // Look for "X-Y players" near the game name
    const playerPattern = new RegExp(
      `${escapedName}[^.]*?(\\d+)\\s*[-–]\\s*(\\d+)\\s*players`,
      'i',
    );
    const pm = content.match(playerPattern);
    if (pm) {
      const min = parseInt(pm[1], 10);
      const max = parseInt(pm[2], 10);
      if (min !== game.min_players || max !== game.max_players) {
        const already = errors.find((e) => e.game === game.name && e.field === 'player count');
        if (!already) {
          errors.push({
            game: game.name,
            field: 'player count (inline)',
            claimed: `${min}-${max}`,
            actual: `${game.min_players}-${game.max_players}`,
          });
        }
      }
    }
  }

  return errors;
}

// ── Check 2: Content-Claim Verification (LLM) ──────────────

async function verifyContentClaims(
  openai: OpenAI,
  draft: BlogDraft,
  games: BlogGameRow[],
): Promise<FactError[]> {
  const gameData = games
    .filter((g) => draft.content.toLowerCase().includes(g.name.toLowerCase()))
    .map((g) => ({
      name: g.name,
      id: g.id,
      players: `${g.min_players}-${g.max_players}`,
      playTime: g.avg_play_time,
      complexity: g.complexity,
      categories: g.categories,
      mechanics: g.mechanics,
      rating: g.rating,
      yearPublished: g.year_published,
      designers: g.designers,
    }));

  if (gameData.length === 0) return [];

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.2,
    max_tokens: 1500,
    response_format: { type: 'json_object' },
    messages: [{
      role: 'user',
      content: `You are a board game fact-checker. Compare this blog post against verified game data and find factual errors.

## Blog Post
${draft.content}

## Verified Game Data
${JSON.stringify(gameData, null, 2)}

Find any claims in the blog that contradict the verified data. Check:
- Player counts (e.g., saying "2-6 players" when data says 2-4)
- Play times (e.g., saying "20 minutes" when data says 90)
- Complexity ratings
- Game categories/mechanics (e.g., calling a competitive game "cooperative")
- Claims about designers if mentioned
- Claims like "great for large groups" about a 2-player game

Respond with JSON: { "errors": [{ "game": "name", "field": "what's wrong", "claimed": "what the blog says", "actual": "what the data says" }] }

If no errors found, return { "errors": [] }`,
    }],
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) return [];

  try {
    const result = JSON.parse(raw);
    return (result.errors ?? []).map((e: Record<string, string>) => ({
      game: e.game ?? '',
      field: e.field ?? '',
      claimed: e.claimed ?? '',
      actual: e.actual ?? '',
    }));
  } catch {
    return [];
  }
}

// ── Check 3: Apply Corrections (LLM) ───────────────────────

async function applyCorrections(
  openai: OpenAI,
  content: string,
  errors: FactError[],
): Promise<string> {
  if (errors.length === 0) return content;

  const errorList = errors
    .map((e) => `- ${e.game}: ${e.field} says "${e.claimed}" but should be "${e.actual}"`)
    .join('\n');

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.2,
    max_tokens: 4000,
    messages: [{
      role: 'user',
      content: `Fix the factual errors in this blog post. Change ONLY the incorrect values. Do not alter style, tone, structure, or any correct content.

## Errors to fix
${errorList}

## Blog post
${content}

Return the corrected blog post content only. No commentary.`,
    }],
  });

  return response.choices[0]?.message?.content ?? content;
}

// ── Main Export ──────────────────────────────────────────────

export async function factCheck(
  openai: OpenAI,
  draft: BlogDraft,
  games: BlogGameRow[],
): Promise<FactCheckResult> {
  const allErrors: FactError[] = [];

  // Check 1: Database accuracy (code)
  const dbErrors = checkDatabaseAccuracy(draft, games);
  allErrors.push(...dbErrors);

  // Check 2: Content-claim verification (LLM)
  const claimErrors = await verifyContentClaims(openai, draft, games);
  // Deduplicate against check 1
  for (const err of claimErrors) {
    const isDupe = allErrors.some(
      (e) => e.game === err.game && e.field === err.field,
    );
    if (!isDupe) allErrors.push(err);
  }

  // Check 3: Apply corrections if any errors found
  let correctedContent = draft.content;
  if (allErrors.length > 0) {
    correctedContent = await applyCorrections(openai, draft.content, allErrors);
  }

  return {
    content: correctedContent,
    corrections: allErrors,
    passed: allErrors.length === 0,
  };
}
