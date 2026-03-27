import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { SKIN_MAP, DEFAULT_SKIN_ID } from '@/lib/dice-skins';
import { isCustomSkinId } from '@/lib/custom-dice-utils';

/**
 * GET /api/user/dice-skin — Returns the current user's dice skin preference.
 * Returns 401 if not authenticated.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('user_preferences')
    .select('dice_skin')
    .eq('id', user.id)
    .single<{ dice_skin: string | null }>();

  if (error || !data) {
    return NextResponse.json({ skinId: DEFAULT_SKIN_ID });
  }

  const skinId = data.dice_skin ?? DEFAULT_SKIN_ID;

  // If it's a custom skin UUID, also return the full config
  if (isCustomSkinId(skinId)) {
    const { data: customSkin } = await supabase
      .from('custom_dice_skins')
      .select('id, name, emoji, config')
      .eq('id', skinId)
      .single();

    if (customSkin) {
      return NextResponse.json({ skinId, customSkin });
    }
    // Custom skin was deleted — fall back to default
    return NextResponse.json({ skinId: DEFAULT_SKIN_ID });
  }

  return NextResponse.json({ skinId });
}

/**
 * PUT /api/user/dice-skin — Saves the user's dice skin preference.
 * Body: { skinId: string }
 * Returns 401 if not authenticated, 400 if invalid skin ID.
 */
export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const skinId = body?.skinId;

  // Accept both built-in skin IDs and custom UUID skin IDs
  if (typeof skinId !== 'string' || (!SKIN_MAP.has(skinId) && !isCustomSkinId(skinId))) {
    return NextResponse.json({ error: 'Invalid skin ID' }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('user_preferences')
    .update({ dice_skin: skinId })
    .eq('id', user.id);

  if (error) {
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }

  return NextResponse.json({ skinId });
}
