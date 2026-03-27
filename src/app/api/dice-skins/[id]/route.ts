import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateSkinConfig, isCustomSkinId } from '@/lib/custom-dice-utils';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/dice-skins/[id] — Fetch a single custom dice skin.
 * Public skins are viewable by anyone. Private skins require the owner.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  if (!isCustomSkinId(id)) {
    return NextResponse.json({ error: 'Invalid skin ID' }, { status: 400 });
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('custom_dice_skins')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Skin not found' }, { status: 404 });
  }

  return NextResponse.json({ skin: data });
}

/**
 * PUT /api/dice-skins/[id] — Update a custom dice skin (owner only).
 * Body: { name?, emoji?, config?, is_public? }
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const update: Record<string, unknown> = {};

  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || body.name.trim().length < 1 || body.name.trim().length > 50) {
      return NextResponse.json({ error: 'Name must be 1-50 characters' }, { status: 400 });
    }
    update.name = body.name.trim();
  }

  if (body.emoji !== undefined) {
    update.emoji = body.emoji;
  }

  if (body.config !== undefined) {
    const configErrors = validateSkinConfig(body.config);
    if (configErrors.length > 0) {
      return NextResponse.json({ error: configErrors[0] }, { status: 400 });
    }
    update.config = body.config;
  }

  if (body.is_public !== undefined) {
    update.is_public = !!body.is_public;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('custom_dice_skins')
    .update(update)
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: 'Failed to update skin' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

/**
 * DELETE /api/dice-skins/[id] — Delete a custom dice skin (owner only).
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('custom_dice_skins')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: 'Failed to delete skin' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
