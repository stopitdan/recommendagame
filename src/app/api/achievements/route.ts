/**
 * GET /api/achievements — Get user's unlocked achievements
 * POST /api/achievements — Unlock an achievement
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ achievements: [] });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from('user_achievements')
      .select('achievement_id, unlocked_at')
      .eq('user_id', user.id);

    return NextResponse.json({ achievements: data ?? [] });
  } catch {
    return NextResponse.json({ achievements: [] });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });

    const { achievementId } = await request.json();
    if (!achievementId) {
      return NextResponse.json({ error: 'Missing achievementId' }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('user_achievements')
      .upsert({
        user_id: user.id,
        achievement_id: achievementId,
      }, { onConflict: 'user_id,achievement_id' });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, achievementId });
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
