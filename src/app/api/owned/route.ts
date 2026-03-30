/**
 * GET /api/owned — List user's owned games
 * POST /api/owned — Add a game to collection
 * DELETE /api/owned — Remove a game from collection
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { GAME_SELECT_COLUMNS, rowToGame } from '@/lib/supabase/games';
import type { GameRow } from '@/types/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

export async function GET() {
  const supabase = await createClient() as AnyClient;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  // Get owned game IDs with source info
  const { data: ownedData, error } = await supabase
    .from('user_owned_games')
    .select('game_id, source, added_at')
    .eq('user_id', user.id)
    .order('added_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ownedList = ownedData ?? [];
  if (ownedList.length === 0) return NextResponse.json({ owned: [] });

  // Fetch full game data for all owned games
  const gameIds = ownedList.map((o: { game_id: string }) => o.game_id);
  const { data: games } = await supabase
    .from('games')
    .select(GAME_SELECT_COLUMNS)
    .in('id', gameIds);

  const gameMap = new Map(
    ((games ?? []) as GameRow[]).map((g) => [g.id, rowToGame(g)])
  );

  // Merge game data with ownership info
  const owned = ownedList.map((o: { game_id: string; source: string; added_at: string }) => ({
    game_id: o.game_id,
    source: o.source,
    added_at: o.added_at,
    game: gameMap.get(o.game_id) ?? null,
  }));

  return NextResponse.json({ owned });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient() as AnyClient;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { gameId } = await request.json();
  if (!gameId) return NextResponse.json({ error: 'gameId required' }, { status: 400 });

  const { error } = await supabase
    .from('user_owned_games')
    .upsert({ user_id: user.id, game_id: gameId, source: 'manual' }, { onConflict: 'user_id,game_id' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient() as AnyClient;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { gameId } = await request.json();
  if (!gameId) return NextResponse.json({ error: 'gameId required' }, { status: 400 });

  const { error } = await supabase
    .from('user_owned_games')
    .delete()
    .eq('user_id', user.id)
    .eq('game_id', gameId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
