/**
 * POST /api/parse-text
 *
 * Parses free-form text into structured game preferences using GPT-4o-mini.
 * Two-tier cache (memory + Supabase) with fuzzy matching avoids redundant calls.
 *
 * Request:  { text: string }
 * Response: { parsed: ParsedPreferences, cached: boolean } or { error: string, parsed: null }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { parsePreferencesWithLLM } from '@/lib/llm/parse-preferences';
import { getCachedParse, setCachedParse } from '@/lib/llm/cache';
import type { ParsedPreferences } from '@/lib/llm/types';
import { rateLimit, LIMITS } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const blocked = await rateLimit(request, LIMITS.expensive);
  if (blocked) return blocked;

  let body: { text?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', parsed: null }, { status: 400 });
  }

  const text = body.text?.trim();
  if (!text || text.length < 3) {
    return NextResponse.json({ error: 'Text too short', parsed: null }, { status: 400 });
  }

  if (text.length > 1000) {
    return NextResponse.json({ error: 'Text too long (max 1000 chars)', parsed: null }, { status: 400 });
  }

  // Check if OPENAI_API_KEY is configured
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: 'LLM not configured', parsed: null },
      { status: 503 },
    );
  }

  try {
    // Check cache first (exact + fuzzy)
    const cached = await getCachedParse(text);
    if (cached) {
      return NextResponse.json({ parsed: cached, cached: true });
    }

    // Cache miss — call LLM
    const parsed = await parsePreferencesWithLLM(text);

    if (!parsed) {
      return NextResponse.json(
        { error: 'Failed to parse text', parsed: null },
        { status: 502 },
      );
    }

    // Enrich with data from "similarTo" games in our DB
    const enriched = await enrichFromSimilarGames(parsed);

    // Store enriched result in cache (both tiers, non-blocking)
    setCachedParse(text, enriched).catch((err) =>
      console.warn('[parse-text] Cache write failed:', err),
    );

    return NextResponse.json({ parsed: enriched, cached: false });
  } catch (error) {
    console.error('[parse-text] Error:', error);
    return NextResponse.json(
      { error: 'Internal error', parsed: null },
      { status: 500 },
    );
  }
}

// ─── Enrich from DB ──────────────────────────────────────────

/**
 * When the LLM identifies "similarTo" game names, look them up in our DB
 * and use their actual data to fill in gaps the LLM couldn't infer.
 *
 * "I want a game like Slay the Spire" → look up Slay the Spire →
 * get its player count (1), complexity (2.7), play time (45 min),
 * categories (Strategy, Adventure), mechanics (Deck Building) →
 * merge into the parsed preferences.
 */
async function enrichFromSimilarGames(
  parsed: ParsedPreferences,
): Promise<ParsedPreferences> {
  if (parsed.similarTo.length === 0) return parsed;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return parsed;

  const supabase = createClient(url, key);
  const enriched = { ...parsed };

  // Look up each similar game using tsvector search (GIN-indexed, fast)
  for (const gameName of parsed.similarTo.slice(0, 3)) {
    const { data: rpcResults } = await supabase
      .rpc('search_games_by_name', { search_query: gameName, result_limit: 1 });

    const data = rpcResults?.[0];
    if (!data) continue;

    // Fill in player count if LLM didn't infer it
    if (!enriched.playerCount && data.min_players && data.max_players) {
      enriched.playerCount = { min: data.min_players, max: data.max_players };
    }

    // Fill in complexity if LLM didn't infer it
    if (!enriched.complexity && data.complexity) {
      // Give a range around the game's complexity (±0.5)
      enriched.complexity = {
        min: Math.max(1, Math.round((data.complexity - 0.5) * 2) / 2),
        max: Math.min(5, Math.round((data.complexity + 0.5) * 2) / 2),
      };
    }

    // Fill in time presets if LLM didn't infer any
    if (enriched.timePresets.length === 0 && data.avg_play_time) {
      const t = data.avg_play_time;
      if (t <= 15) enriched.timePresets = ['quick'];
      else if (t <= 30) enriched.timePresets = ['short'];
      else if (t <= 60) enriched.timePresets = ['medium'];
      else if (t <= 120) enriched.timePresets = ['long'];
      else enriched.timePresets = ['epic'];
    }

    // Fill in game types if LLM didn't infer any
    if (enriched.gameTypes.length === 0 && data.types?.length > 0) {
      enriched.gameTypes = [...new Set([...enriched.gameTypes, ...data.types])];
    }

    // Merge categories into genres (deduplicated)
    if (data.categories?.length > 0) {
      enriched.genres = [...new Set([...enriched.genres, ...data.categories])];
    }

    // Merge mechanics (deduplicated)
    if (data.mechanics?.length > 0) {
      enriched.mechanics = [...new Set([...enriched.mechanics, ...data.mechanics])];
    }

    // Merge themes into keywords
    if (data.themes?.length > 0) {
      enriched.keywords = [...new Set([...enriched.keywords, ...data.themes])];
    }
  }

  return enriched;
}
