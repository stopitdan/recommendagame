/**
 * User Settings API
 *
 * GET /api/settings — Get current user's recommendation settings
 * PUT /api/settings — Update settings (body: { popularity_mode, min_rating, excluded_sources })
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('user_preferences')
    .select('popularity_mode, min_rating, excluded_sources')
    .eq('id', user.id)
    .single();

  if (error) {
    // Row may not exist yet — return defaults
    return NextResponse.json({
      settings: {
        popularity_mode: 'popular',
        min_rating: 0,
        excluded_sources: [],
      },
    });
  }

  return NextResponse.json({ settings: data });
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('user_preferences')
    .upsert({
      id: user.id,
      popularity_mode: body.popularity_mode ?? 'popular',
      min_rating: body.min_rating ?? 0,
      excluded_sources: body.excluded_sources ?? [],
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
