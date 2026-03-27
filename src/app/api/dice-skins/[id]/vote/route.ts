import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isCustomSkinId } from '@/lib/custom-dice-utils';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/dice-skins/[id]/vote — Toggle vote on a custom dice skin.
 * If the user has already voted, the vote is removed. Otherwise, it's added.
 * Returns { voted: boolean, vote_count: number }.
 */
export async function POST(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isCustomSkinId(id)) {
    return NextResponse.json({ error: 'Invalid skin ID' }, { status: 400 });
  }

  // Check if vote exists
  const { data: existing } = await supabase
    .from('custom_dice_votes')
    .select('id')
    .eq('user_id', user.id)
    .eq('skin_id', id)
    .single();

  let voted: boolean;

  if (existing) {
    // Remove vote
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('custom_dice_votes')
      .delete()
      .eq('user_id', user.id)
      .eq('skin_id', id);

    if (error) {
      return NextResponse.json({ error: 'Failed to remove vote' }, { status: 500 });
    }
    voted = false;
  } else {
    // Add vote
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('custom_dice_votes')
      .insert({ user_id: user.id, skin_id: id });

    if (error) {
      return NextResponse.json({ error: 'Failed to add vote' }, { status: 500 });
    }
    voted = true;
  }

  // Fetch updated vote count
  const { data: skin } = await supabase
    .from('custom_dice_skins')
    .select('vote_count')
    .eq('id', id)
    .single<{ vote_count: number }>();

  return NextResponse.json({
    voted,
    vote_count: skin?.vote_count ?? 0,
  });
}
