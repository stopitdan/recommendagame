/**
 * POST /api/games/[id]/corrections
 *
 * Submit a data correction for a game. Authenticated users only.
 * Body: { fieldName, currentValue?, suggestedValue, notes? }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const VALID_FIELDS = [
  'name', 'description', 'min_players', 'max_players', 'recommended_players',
  'min_play_time', 'max_play_time', 'avg_play_time', 'complexity',
  'year_published', 'categories', 'mechanics', 'themes',
];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: gameId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let body: { fieldName?: string; currentValue?: string; suggestedValue?: string; notes?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { fieldName, currentValue, suggestedValue, notes } = body;

  if (!fieldName || !suggestedValue?.trim()) {
    return NextResponse.json(
      { error: 'fieldName and suggestedValue are required' },
      { status: 400 },
    );
  }

  if (!VALID_FIELDS.includes(fieldName)) {
    return NextResponse.json(
      { error: `Invalid field. Must be one of: ${VALID_FIELDS.join(', ')}` },
      { status: 400 },
    );
  }

  // Rate limit: max 10 corrections per user per day
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const oneDayAgo = new Date(Date.now() - 86400000).toISOString();
  const { count } = await db
    .from('game_corrections')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', oneDayAgo);

  if ((count ?? 0) >= 10) {
    return NextResponse.json(
      { error: 'Rate limit: max 10 corrections per day' },
      { status: 429 },
    );
  }

  const { error } = await db
    .from('game_corrections')
    .insert({
      game_id: gameId,
      user_id: user.id,
      field_name: fieldName,
      current_value: currentValue ?? null,
      suggested_value: suggestedValue.trim(),
      notes: notes?.trim() || null,
    });

  if (error) {
    console.error('[Corrections] Insert error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
