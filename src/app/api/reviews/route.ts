/**
 * User Reviews API
 *
 * GET  /api/reviews?gameId=xxx — Get reviews for a game
 * POST /api/reviews — Create or update a review (body: { gameId, rating, reviewText? })
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const gameId = request.nextUrl.searchParams.get('gameId');

  if (!gameId) {
    return NextResponse.json({ error: 'Missing gameId' }, { status: 400 });
  }

  // Query reviews, then separately fetch display names for the users
  const { data: reviews, error } = await supabase
    .from('user_reviews')
    .select('*')
    .eq('game_id', gameId)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch display names for review authors
  const userIds = [...new Set((reviews ?? []).map((r: any) => r.user_id))];
  let profileMap = new Map<string, string>();

  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, display_name')
      .in('id', userIds);

    if (profiles) {
      profileMap = new Map(profiles.map((p: any) => [p.id, p.display_name]));
    }
  }

  // Merge display names into reviews
  const data = (reviews ?? []).map((r: any) => ({
    ...r,
    user_profiles: { display_name: profileMap.get(r.user_id) ?? null },
  }));

  return NextResponse.json({ reviews: data });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json();
  const { gameId, rating, reviewText } = body;

  if (!gameId || !rating || rating < 1 || rating > 10) {
    return NextResponse.json({ error: 'Missing gameId or invalid rating (1-10)' }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('user_reviews')
    .upsert(
      {
        user_id: user.id,
        game_id: gameId,
        rating: Math.round(rating),
        review_text: reviewText || null,
      },
      { onConflict: 'user_id,game_id' },
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ review: data });
}
