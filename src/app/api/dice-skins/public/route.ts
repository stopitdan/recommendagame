import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface PublicSkinRow {
  id: string;
  name: string;
  emoji: string;
  config: Record<string, unknown>;
  is_public: boolean;
  vote_count: number;
  thumbnail_url: string | null;
  created_at: string;
  user_id: string;
}

/**
 * GET /api/dice-skins/public — Browse public dice skins gallery.
 * Query params:
 *   sort: 'top' | 'newest' (default: 'top')
 *   offset: number (default: 0)
 *   limit: number (default: 20, max: 50)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sort = searchParams.get('sort') ?? 'top';
  const offset = Math.max(0, Number(searchParams.get('offset')) || 0);
  const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit')) || 20));

  const supabase = await createClient();

  // Optionally get current user to check their votes
  const { data: { user } } = await supabase.auth.getUser();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from('custom_dice_skins')
    .select('id, name, emoji, config, is_public, vote_count, thumbnail_url, created_at, user_id')
    .eq('is_public', true);

  if (sort === 'newest') {
    query = query.order('created_at', { ascending: false });
  } else {
    query = query.order('vote_count', { ascending: false });
  }

  query = query.range(offset, offset + limit - 1);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch skins' }, { status: 500 });
  }

  let skins: (PublicSkinRow & { has_voted?: boolean })[] = (data as PublicSkinRow[]) ?? [];

  // If user is logged in, check which skins they've voted for
  if (user && skins.length > 0) {
    const skinIds = skins.map((s) => s.id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: votes } = await (supabase as any)
      .from('custom_dice_votes')
      .select('skin_id')
      .eq('user_id', user.id)
      .in('skin_id', skinIds);

    const votedSet = new Set(((votes as { skin_id: string }[]) ?? []).map((v) => v.skin_id));
    skins = skins.map((s) => ({ ...s, has_voted: votedSet.has(s.id) }));
  }

  return NextResponse.json({ skins });
}
