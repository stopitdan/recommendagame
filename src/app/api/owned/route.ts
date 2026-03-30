/**
 * GET /api/owned — List user's owned games
 * POST /api/owned — Add a game to collection
 * DELETE /api/owned — Remove a game from collection
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

export async function GET() {
  const supabase = await createClient() as AnyClient;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data, error } = await supabase
    .from('user_owned_games')
    .select('game_id, source, added_at')
    .eq('user_id', user.id)
    .order('added_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ owned: data ?? [] });
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
