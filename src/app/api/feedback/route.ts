/**
 * Feedback API
 *
 * POST /api/feedback — Record thumbs-up/down on a game
 *   Body: { gameId: string, rating: 1 | -1, context?: string }
 *
 * Uses upsert so users can change their mind (thumbs-down → thumbs-up).
 * Guest users get a 401 — feedback is stored only for authenticated users.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let body: { gameId?: string; rating?: number; context?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { gameId, rating, context } = body;

  if (!gameId || (rating !== 1 && rating !== -1)) {
    return NextResponse.json(
      { error: 'gameId (string) and rating (1 or -1) are required' },
      { status: 400 },
    );
  }

  const feedbackRating = rating as -1 | 1;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('user_game_feedback')
    .upsert(
      { user_id: user.id, game_id: gameId, rating: feedbackRating, context: context ?? 'results' },
      { onConflict: 'user_id,game_id' },
    );

  if (error) {
    console.error('[Feedback] Upsert error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
