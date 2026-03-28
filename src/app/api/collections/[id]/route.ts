/**
 * GET /api/collections/:id — Get collection with its games
 * PUT /api/collections/:id — Update collection
 * DELETE /api/collections/:id — Delete collection
 * POST /api/collections/:id — Add a game to the collection
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { GAME_SELECT_COLUMNS } from '@/lib/supabase/games';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();

  const db = supabase as AnyClient;

  const { data: collection, error } = await db
    .from('game_collections')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !collection) {
    return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
  }

  // Fetch items with game data
  const { data: items } = await db
    .from('game_collection_items')
    .select(`*, games(${GAME_SELECT_COLUMNS})`)
    .eq('collection_id', id)
    .order('added_at', { ascending: false });

  return NextResponse.json({
    collection,
    items: (items ?? []).map((item: Record<string, unknown>) => ({
      ...item,
      game: item.games,
      games: undefined,
    })),
  });
}

export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await request.json();
  const update: Record<string, unknown> = {};
  if (body.name !== undefined) update.name = body.name.trim();
  if (body.description !== undefined) update.description = body.description?.trim() || null;
  if (body.is_public !== undefined) update.is_public = !!body.is_public;

  const db2 = supabase as AnyClient;
  const { data, error } = await db2
    .from('game_collections')
    .update(update)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ collection: data });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const db3 = supabase as AnyClient;
  const { error } = await db3
    .from('game_collections')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await request.json();
  const { game_id, note } = body;

  if (!game_id) {
    return NextResponse.json({ error: 'game_id is required' }, { status: 400 });
  }

  // Verify user owns the collection
  const db4 = supabase as AnyClient;
  const { data: collection } = await db4
    .from('game_collections')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!collection) {
    return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
  }

  const { data, error } = await db4
    .from('game_collection_items')
    .upsert(
      { collection_id: id, game_id, note: note?.trim() || null },
      { onConflict: 'collection_id,game_id' },
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data }, { status: 201 });
}
