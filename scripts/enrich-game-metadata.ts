/**
 * LLM-Powered Game Metadata Enrichment
 *
 * Uses GPT-4o-mini to generate richer metadata for games, focusing on:
 * - Mood/vibe tags (chill, competitive, brain-teaser, social, etc.)
 * - Refined mechanics descriptions
 * - Target audience keywords
 * - "Similar to" game references
 *
 * This enriched data supplements the raw BGG metadata for better
 * mood alignment scoring and free-text matching.
 *
 * Cost: ~$5-10 for 81k games at GPT-4o-mini pricing.
 * Runtime: ~2-4 hours (rate limited to avoid OpenAI throttling).
 *
 * Usage: npx tsx scripts/enrich-game-metadata.ts [batch-size] [start-offset]
 *
 * Requires: OPENAI_API_KEY in .env.local
 * Stores: enriched data in games.enriched_metadata JSONB column
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const LLM_BATCH_SIZE = parseInt(process.argv[2] ?? '50', 10);
const START_OFFSET = parseInt(process.argv[3] ?? '0', 10);
const MODEL = 'gpt-4o-mini';
const MAX_TAGS_THRESHOLD = 10; // Only enrich games with < 10 total tags
const FETCH_BATCH_SIZE = 500; // Fetch more from DB, filter client-side

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

interface EnrichedMetadata {
  moods: string[];          // competitive, cooperative, chill, brain-teaser, social, story-driven, tense, funny, relaxing
  vibeKeywords: string[];   // cozy, epic, quick, deep, family-friendly, gateway, filler, party, solo-friendly
  targetAudience: string[]; // families, couples, gamers, kids, party-groups, solo-players, strategy-enthusiasts
  similarGames: string[];   // well-known games this plays like
  refinedMechanics: string[]; // more descriptive mechanic labels
}

const SYSTEM_PROMPT = `You are a board game expert. For each game, analyze its name, description, categories, and mechanics to produce enriched metadata.

Return JSON with these fields:
- "moods": array of mood/vibe tags from: "competitive", "cooperative", "chill", "brain-teaser", "social", "story-driven", "tense", "funny", "relaxing", "strategic", "creative", "adventurous"
- "vibeKeywords": array of descriptive keywords: "cozy", "epic", "quick", "deep", "family-friendly", "gateway", "filler", "party", "solo-friendly", "portable", "replayable", "thematic", "abstract", "luck-heavy", "skill-heavy", "negotiation-heavy", "puzzle-like"
- "targetAudience": array from: "families", "couples", "gamers", "kids", "party-groups", "solo-players", "strategy-enthusiasts", "casual-players", "teens", "adults-only"
- "similarGames": 1-3 well-known games this plays like (only games most board gamers would know)
- "refinedMechanics": 1-3 plain-English descriptions of core mechanics (e.g., "build a deck of cards to fight enemies" instead of just "Deck Building")

Be concise. Only include tags that genuinely apply. Max 5 items per array.`;

async function enrichBatch(
  games: { id: string; name: string; description: string; categories: string[]; mechanics: string[]; themes: string[] }[],
): Promise<Map<string, EnrichedMetadata>> {
  const results = new Map<string, EnrichedMetadata>();

  // Build a single prompt with all games in the batch
  const gamesText = games.map((g, i) =>
    `Game ${i + 1}: "${g.name}"
Description: ${(g.description ?? '').slice(0, 300)}
Categories: ${(g.categories ?? []).join(', ')}
Mechanics: ${(g.mechanics ?? []).join(', ')}
Themes: ${(g.themes ?? []).join(', ')}`
  ).join('\n\n');

  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Analyze these ${games.length} games and return a JSON object with keys "game_1", "game_2", etc., each containing the enriched metadata.\n\n${gamesText}` },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return results;

    const parsed = JSON.parse(content);

    for (let i = 0; i < games.length; i++) {
      const key = `game_${i + 1}`;
      const data = parsed[key];
      if (data) {
        results.set(games[i].id, {
          moods: data.moods ?? [],
          vibeKeywords: data.vibeKeywords ?? [],
          targetAudience: data.targetAudience ?? [],
          similarGames: data.similarGames ?? [],
          refinedMechanics: data.refinedMechanics ?? [],
        });
      }
    }
  } catch (err) {
    console.error(`[Enrich] Batch error:`, err instanceof Error ? err.message : err);
  }

  return results;
}

async function main() {
  console.log(`[Enrich] Starting metadata enrichment`);
  console.log(`  Model: ${MODEL}`);
  console.log(`  LLM batch size: ${LLM_BATCH_SIZE}`);
  console.log(`  Tag threshold: < ${MAX_TAGS_THRESHOLD} total tags`);
  console.log(`  Start offset: ${START_OFFSET}\n`);

  // Check if enriched_metadata column exists by trying to select it
  const { error: colCheck } = await supabase
    .from('games')
    .select('enriched_metadata')
    .limit(1);

  if (colCheck) {
    console.error('[Enrich] enriched_metadata column does not exist.');
    console.error('Run this migration first:');
    console.error('  ALTER TABLE games ADD COLUMN enriched_metadata jsonb;');
    process.exit(1);
  }

  let offset = START_OFFSET;
  let totalProcessed = 0;
  let totalEnriched = 0;
  let totalSkipped = 0;
  let totalCost = 0;

  while (true) {
    // Fetch a larger batch of unenriched games, then filter client-side
    // for sparse metadata (PostgREST can't do array_length arithmetic)
    const { data: rows, error } = await supabase
      .from('games')
      .select('id, name, description, categories, mechanics, themes, enriched_metadata')
      .is('enriched_metadata', null)
      .order('rating_count', { ascending: false })
      .range(offset, offset + FETCH_BATCH_SIZE - 1);

    if (error) {
      console.error('[Enrich] Fetch error:', error.message);
      break;
    }

    if (!rows || rows.length === 0) {
      console.log('[Enrich] No more unenriched games');
      break;
    }

    // Filter to games with < MAX_TAGS_THRESHOLD total tags
    const sparse = rows.filter((g: any) => {
      const tagCount = (g.categories ?? []).length + (g.mechanics ?? []).length + (g.themes ?? []).length;
      return tagCount < MAX_TAGS_THRESHOLD;
    });

    const skippedRich = rows.length - sparse.length;
    totalSkipped += skippedRich;

    if (sparse.length === 0) {
      totalProcessed += rows.length;
      offset += FETCH_BATCH_SIZE;
      console.log(`[Enrich] Skipped ${rows.length} games (all have >= ${MAX_TAGS_THRESHOLD} tags) | offset: ${offset}`);
      continue;
    }

    // Process sparse games in LLM-sized chunks
    for (let i = 0; i < sparse.length; i += LLM_BATCH_SIZE) {
      const chunk = sparse.slice(i, i + LLM_BATCH_SIZE);
      const enriched = await enrichBatch(chunk);

      for (const [gameId, metadata] of enriched) {
        const { error: updateError } = await supabase
          .from('games')
          .update({ enriched_metadata: metadata })
          .eq('id', gameId);

        if (updateError) {
          console.error(`[Enrich] Update failed for ${gameId}:`, updateError.message);
        } else {
          totalEnriched++;
        }
      }

      // Estimate cost (GPT-4o-mini: $0.15/1M input, $0.60/1M output)
      const batchInputTokens = chunk.length * 500;
      const batchOutputTokens = chunk.length * 100;
      const batchCost = (batchInputTokens * 0.15 + batchOutputTokens * 0.6) / 1_000_000;
      totalCost += batchCost;

      // Rate limit between LLM calls
      await new Promise((r) => setTimeout(r, 300));
    }

    totalProcessed += rows.length;
    // Advance offset since we're mixing sparse and non-sparse in the fetch
    offset += FETCH_BATCH_SIZE;

    console.log(`[Enrich] Progress: ${totalProcessed} scanned | ${totalEnriched} enriched | ${totalSkipped} skipped (rich) | cost: ~$${totalCost.toFixed(4)}`);
  }

  console.log(`\n[Enrich] Done!`);
  console.log(`  Processed: ${totalProcessed}`);
  console.log(`  Enriched:  ${totalEnriched}`);
  console.log(`  Skipped:   ${totalSkipped}`);
  console.log(`  Est. cost: ~$${totalCost.toFixed(4)}`);
}

main().catch(console.error);
