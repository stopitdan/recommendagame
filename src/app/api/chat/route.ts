/**
 * POST /api/chat
 *
 * Board Game Sommelier chat endpoint.
 * Uses GPT-4o with function calling to search our game database.
 * Supports multi-turn conversations.
 *
 * Body: { messages: Array<{ role: 'user' | 'assistant', content: string }> }
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { createClient } from '@supabase/supabase-js';
import type { GameRow } from '@/types/supabase';
import { MODELS } from '@/lib/llm/models';
import { rowToGame, GAME_SELECT_COLUMNS } from '@/lib/supabase/games';
import { SOMMELIER_SYSTEM_PROMPT } from '@/lib/chat/system-prompt';
import { CHAT_TOOLS } from '@/lib/chat/tools';
import { rateLimit, LIMITS } from '@/lib/rate-limit';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// ─── Tool Execution ─────────────────────────────────────

async function executeSearchGames(args: { query: string; type?: string; minPlayers?: number; maxPlayers?: number }) {
  const supabase = getSupabase();
  if (!supabase) return '[]';

  // Text search via name/description
  let query = supabase
    .from('games')
    .select(GAME_SELECT_COLUMNS)
    .eq('is_expansion', false)
    .gte('rating_count', 50)
    .order('rating', { ascending: false })
    .limit(10);

  if (args.type) query = query.contains('types', [args.type]);
  if (args.minPlayers) query = query.gte('max_players', args.minPlayers);
  if (args.maxPlayers) query = query.lte('min_players', args.maxPlayers);

  // Use text search on name
  query = query.ilike('name', `%${args.query.split(' ').slice(0, 3).join('%')}%`);

  const { data } = await query;

  // If name search found nothing, try description text search + popular games
  if (!data || data.length === 0) {
    // Search via the text search RPC if available, otherwise fall back to popular games
    // matching the query terms in description
    let broadQuery = supabase
      .from('games')
      .select(GAME_SELECT_COLUMNS)
      .eq('is_expansion', false)
      .gte('rating_count', 100)
      .order('rating_count', { ascending: false })
      .limit(10);

    if (args.type) broadQuery = broadQuery.contains('types', [args.type]);
    if (args.minPlayers) broadQuery = broadQuery.gte('max_players', args.minPlayers);
    if (args.maxPlayers) broadQuery = broadQuery.lte('min_players', args.maxPlayers);

    // Use description text search with the query words
    const searchTerms = args.query.split(/\s+/).filter((w: string) => w.length > 3).slice(0, 3);
    if (searchTerms.length > 0) {
      // Search descriptions using ilike for each significant word
      for (const term of searchTerms) {
        broadQuery = broadQuery.ilike('description', `%${term}%`);
      }
    }

    const { data: broadData } = await broadQuery;
    const games = ((broadData ?? []) as GameRow[]).map(rowToGame);
    return JSON.stringify(games.map(summarizeGame));
  }

  const games = (data as GameRow[]).map(rowToGame);
  return JSON.stringify(games.map(summarizeGame));
}

async function executeGetGameDetails(args: { name: string }) {
  const supabase = getSupabase();
  if (!supabase) return 'Game not found';

  const { data } = await supabase
    .from('games')
    .select(GAME_SELECT_COLUMNS)
    .ilike('name', args.name)
    .limit(1);

  if (!data || data.length === 0) {
    // Try fuzzy match
    const { data: fuzzy } = await supabase
      .from('games')
      .select(GAME_SELECT_COLUMNS)
      .ilike('name', `%${args.name}%`)
      .order('rating_count', { ascending: false })
      .limit(1);

    if (!fuzzy || fuzzy.length === 0) return `No game found matching "${args.name}"`;
    const game = rowToGame(fuzzy[0] as GameRow);
    return JSON.stringify(detailedSummary(game));
  }

  const game = rowToGame(data[0] as GameRow);
  return JSON.stringify(detailedSummary(game));
}

async function executeFindSimilar(args: { gameName: string }) {
  const supabase = getSupabase();
  if (!supabase) return '[]';

  // Find the source game
  const { data: sourceData } = await supabase
    .from('games')
    .select(GAME_SELECT_COLUMNS)
    .ilike('name', `%${args.gameName}%`)
    .order('rating_count', { ascending: false })
    .limit(1);

  if (!sourceData || sourceData.length === 0) return `No game found matching "${args.gameName}"`;

  const source = sourceData[0] as GameRow;
  const categories = (source.categories as string[]) ?? [];
  const mechanics = (source.mechanics as string[]) ?? [];

  // Find similar games by overlapping categories/mechanics
  let query = supabase
    .from('games')
    .select(GAME_SELECT_COLUMNS)
    .eq('is_expansion', false)
    .neq('id', source.id)
    .gte('rating_count', 50)
    .order('rating', { ascending: false })
    .limit(8);

  if (categories.length > 0) {
    query = query.overlaps('categories', categories.slice(0, 3));
  }

  const { data } = await query;
  const games = ((data ?? []) as GameRow[]).map(rowToGame);
  return JSON.stringify(games.map(summarizeGame));
}

function summarizeGame(g: ReturnType<typeof rowToGame>) {
  return {
    id: g.id,
    name: g.name,
    rating: g.rating?.toFixed(1),
    ratingCount: g.ratingCount,
    players: g.playerCount ? `${g.playerCount.min}-${g.playerCount.max}` : null,
    playTime: g.playTime?.average ?? null,
    complexity: g.complexity?.toFixed(1),
    categories: g.categories.slice(0, 4),
    mechanics: g.mechanics.slice(0, 4),
    types: g.types,
  };
}

function detailedSummary(g: ReturnType<typeof rowToGame>) {
  return {
    ...summarizeGame(g),
    description: g.description?.slice(0, 500),
    yearPublished: g.yearPublished,
    designers: g.designers?.slice(0, 3),
    rankOverall: g.rankOverall,
    themes: g.themes.slice(0, 5),
  };
}

// ─── Route Handler ──────────────────────────────────────

export async function POST(request: NextRequest) {
  const blocked = await rateLimit(request, LIMITS.expensive);
  if (blocked) return blocked;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Chat not configured' }, { status: 503 });
  }

  let body: { messages?: Array<{ role: string; content: string }> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const userMessages = body.messages ?? [];
  if (userMessages.length === 0) {
    return NextResponse.json({ error: 'No messages provided' }, { status: 400 });
  }

  // Cap conversation length to prevent token explosion
  const recentMessages = userMessages.slice(-20);

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: SOMMELIER_SYSTEM_PROMPT },
    ...recentMessages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  ];

  try {
    const openai = new OpenAI({ apiKey, timeout: 30000 });

    // First call -- may return tool calls
    let completion = await openai.chat.completions.create({
      model: MODELS.chat,
      temperature: 0.7,
      max_tokens: 800,
      tools: CHAT_TOOLS,
      messages,
    });

    let choice = completion.choices[0];

    // Handle tool calls (up to 3 rounds to prevent infinite loops)
    let rounds = 0;
    while (choice?.finish_reason === 'tool_calls' && choice.message.tool_calls && rounds < 3) {
      rounds++;
      const toolCalls = choice.message.tool_calls;

      // Add assistant message with tool calls
      messages.push(choice.message);

      // Execute each tool call
      for (const tc of toolCalls) {
        let result: string;
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const fn = (tc as any).function;
          const args = JSON.parse(fn.arguments);
          switch (fn.name as string) {
            case 'search_games':
              result = await executeSearchGames(args);
              break;
            case 'get_game_details':
              result = await executeGetGameDetails(args);
              break;
            case 'find_similar':
              result = await executeFindSimilar(args);
              break;
            default:
              result = 'Unknown tool';
          }
        } catch (err) {
          result = `Tool error: ${err instanceof Error ? err.message : 'unknown'}`;
        }

        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: result,
        });
      }

      // Get the next response
      completion = await openai.chat.completions.create({
        model: MODELS.chat,
        temperature: 0.7,
        max_tokens: 800,
        tools: CHAT_TOOLS,
        messages,
      });
      choice = completion.choices[0];
    }

    const content = choice?.message?.content ?? "I couldn't come up with a response. Try rephrasing?";

    return NextResponse.json({ message: content });
  } catch (err) {
    console.error('[Chat] Error:', err);
    return NextResponse.json({ error: 'Chat failed' }, { status: 500 });
  }
}
