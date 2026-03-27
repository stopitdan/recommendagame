import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateSkinConfig } from '@/lib/custom-dice-utils';

/**
 * GET /api/dice-skins — List the current user's custom dice skins.
 * Returns 401 if not authenticated.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('custom_dice_skins')
    .select('id, name, emoji, config, is_public, vote_count, thumbnail_url, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch skins' }, { status: 500 });
  }

  return NextResponse.json({ skins: data ?? [] });
}

/**
 * POST /api/dice-skins — Create a new custom dice skin.
 * Body: { name, emoji?, config, is_public? }
 * Returns 401 if not authenticated, 400 if invalid.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { name, emoji, config, is_public } = body;

  if (typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 50) {
    return NextResponse.json({ error: 'Name must be 1-50 characters' }, { status: 400 });
  }

  const configErrors = validateSkinConfig(config);
  if (configErrors.length > 0) {
    return NextResponse.json({ error: configErrors[0] }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('custom_dice_skins')
    .insert({
      user_id: user.id,
      name: name.trim(),
      emoji: emoji ?? '🎲',
      config,
      is_public: is_public ?? false,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Failed to create dice skin:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create skin' },
      { status: 500 },
    );
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}
