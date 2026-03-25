/**
 * GET /auth/callback
 *
 * Handles the OAuth callback from Supabase Auth.
 * After Google sign-in, Supabase redirects here with a code.
 * We exchange the code for a session, create profile/preference rows
 * if needed, then redirect to the home page.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const cookieStore = await cookies();

    // Build a Supabase client that can write cookies onto the redirect response
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      },
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Ensure profile and preferences rows exist for OAuth users
      await supabase.from('user_profiles').upsert({
        id: data.user.id,
        display_name: data.user.user_metadata?.full_name ?? data.user.user_metadata?.name ?? null,
        avatar_url: data.user.user_metadata?.avatar_url ?? null,
      }, { onConflict: 'id' });

      await supabase.from('user_preferences').upsert({
        id: data.user.id,
      }, { onConflict: 'id' });

      return NextResponse.redirect(`${origin}${next}`);
    }

    console.error('[Auth Callback] Error:', error?.message);
  }

  // Something went wrong — redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
