/**
 * DELETE /api/account/delete
 *
 * GDPR account deletion — deletes all user data and the auth account.
 * Requires authentication. Uses service role to delete from auth.users
 * (which cascades to all dependent tables).
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const userId = user.id;

  // Use service role client to perform admin operations
  const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceUrl || !serviceKey) {
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 },
    );
  }

  const adminClient = createServiceClient(serviceUrl, serviceKey);

  try {
    // Step 1: Delete user-uploaded storage files (dice textures)
    const { data: files } = await adminClient.storage
      .from('dice-textures')
      .list(userId);

    if (files && files.length > 0) {
      const filePaths = files.map((f) => `${userId}/${f.name}`);
      await adminClient.storage.from('dice-textures').remove(filePaths);
    }

    // Step 2: Manually delete from tables that may not have ON DELETE CASCADE
    // (belt-and-suspenders approach — cascade should handle most of these)
    await Promise.all([
      adminClient.from('custom_dice_votes').delete().eq('user_id', userId),
      adminClient.from('custom_dice_skins').delete().eq('user_id', userId),
      adminClient.from('user_achievements').delete().eq('user_id', userId),
      adminClient.from('user_reviews').delete().eq('user_id', userId),
      adminClient.from('user_favorites').delete().eq('user_id', userId),
      adminClient.from('user_game_feedback').delete().eq('user_id', userId),
      adminClient.from('user_saved_presets').delete().eq('user_id', userId),
    ]);

    // Step 3: Delete preferences and profile (keyed by user id directly)
    await Promise.all([
      adminClient.from('user_preferences').delete().eq('id', userId),
      adminClient.from('user_profiles').delete().eq('id', userId),
    ]);

    // Step 4: Delete the auth user (this is permanent)
    const { error: authError } = await adminClient.auth.admin.deleteUser(userId);

    if (authError) {
      console.error('[Account Delete] Auth deletion failed:', authError);
      return NextResponse.json(
        { error: 'Failed to delete account. Please contact support.' },
        { status: 500 },
      );
    }

    // Step 5: Sign out the current session
    await supabase.auth.signOut();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[Account Delete] Error:', err);
    return NextResponse.json(
      { error: 'Account deletion failed. Please contact support.' },
      { status: 500 },
    );
  }
}
