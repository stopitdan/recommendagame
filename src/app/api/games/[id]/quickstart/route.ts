/**
 * GET /api/games/[id]/quickstart
 *
 * Generates an AI-powered "how to play" quick-start summary.
 * Heavily grounded in the game's actual metadata to minimize hallucination.
 * Cached in Redis for 30 days (game rules don't change).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import type { GameRow } from '@/types/supabase';
import { rowToGame, GAME_SELECT_COLUMNS } from '@/lib/supabase/games';
import { redisCache } from '@/lib/redis';
import { shouldSkipCache, jsonWithCacheHeader } from '@/lib/cache-bypass';
import { MODELS } from '@/lib/llm/models';

const CACHE_TTL = 2592000; // 30 days

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: gameId } = await params;
  const cacheKey = `quickstart:${gameId}`;
  const skipCache = shouldSkipCache(request);

  // Check cache first
  if (!skipCache) {
    const cached = await redisCache.get<{ summary: string }>(cacheKey);
    if (cached) return jsonWithCacheHeader(cached, true);
  }

  // Fetch game data
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const apiKey = process.env.OPENAI_API_KEY;

  if (!url || !key || !apiKey) {
    return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  }

  const supabase = createClient(url, key);
  const { data } = await supabase
    .from('games')
    .select(GAME_SELECT_COLUMNS)
    .eq('id', gameId)
    .single();

  if (!data) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  }

  const game = rowToGame(data as GameRow);

  // Quality gate: only generate for games with enough metadata
  const descLen = game.description?.length ?? 0;
  if (descLen < 100 || game.mechanics.length < 1) {
    return NextResponse.json(
      { error: 'Not enough game data to generate a reliable summary' },
      { status: 422 },
    );
  }

  // Build a heavily grounded prompt
  const gameContext = [
    `Game: ${game.name}`,
    game.yearPublished ? `Year: ${game.yearPublished}` : '',
    game.playerCount ? `Players: ${game.playerCount.min}-${game.playerCount.max}` : '',
    game.playTime?.average ? `Play time: ~${game.playTime.average} minutes` : '',
    game.complexity ? `Complexity: ${game.complexity.toFixed(1)}/5` : '',
    game.categories.length > 0 ? `Categories: ${game.categories.join(', ')}` : '',
    game.mechanics.length > 0 ? `Mechanics: ${game.mechanics.join(', ')}` : '',
    `Description: ${game.description?.slice(0, 1500) ?? 'No description available'}`,
  ].filter(Boolean).join('\n');

  const prompt = `You are writing a concise "2-minute how to play" summary for the board game described below.

CRITICAL RULES:
- ONLY use information from the game data provided below. Do NOT add rules, mechanics, or details that aren't supported by the description and mechanics listed.
- If you're unsure about a specific rule detail, say "Check the rulebook for specifics" rather than guessing.
- Keep it practical: someone should be able to read this and start playing (with the rulebook nearby for edge cases).

${gameContext}

Write a summary with these exact sections (use markdown headers):

## Overview
2-3 sentences: what is this game about and why is it fun?

## Setup
Brief setup instructions based on what you can infer from the description and player count.

## How to Play
Step-by-step basics of a typical turn or round. Focus on the core loop.

## How to Win
What's the win condition?

## Pro Tips
2-3 beginner-friendly tips.

Keep the total under 400 words. Be conversational, not robotic.`;

  try {
    const openai = new OpenAI({ apiKey, timeout: 15000 });
    const completion = await openai.chat.completions.create({
      model: MODELS.quickstart,
      temperature: 0.3,
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    });

    const summary = completion.choices[0]?.message?.content;
    if (!summary) {
      return NextResponse.json({ error: 'Generation failed' }, { status: 500 });
    }

    const response = { summary };
    await redisCache.set(cacheKey, response, CACHE_TTL);

    return NextResponse.json(response);
  } catch (err) {
    console.error('[Quickstart] Generation error:', err);
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 });
  }
}
