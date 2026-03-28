/**
 * GET /api/collections — List user's collections (or public collections)
 * POST /api/collections — Create a new collection
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

export async function GET(request: NextRequest) {
  const supabase = await createClient() as AnyClient;
  const { searchParams } = request.nextUrl;
  const publicOnly = searchParams.get('public') === 'true';

  if (publicOnly) {
    const { data, error } = await supabase
      .from('game_collections')
      .select('*, game_collection_items(count)')
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ collections: data ?? [] });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data, error } = await supabase
    .from('game_collections')
    .select('*, game_collection_items(count)')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ collections: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient() as AnyClient;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await request.json();
  const { name, description, is_public } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('game_collections')
    .insert({
      user_id: user.id,
      name: name.trim(),
      description: description?.trim() || null,
      is_public: is_public ?? false,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ collection: data }, { status: 201 });
}
