/**
 * Server Actions for Authentication
 *
 * These run on the server and handle signup, login, and logout.
 * Called from client-side forms via React's form action pattern.
 */

'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

// ---------------------------------------------------------------------------
// Signup
// ---------------------------------------------------------------------------

export interface AuthState {
  error?: string;
}

export async function signup(
  _prevState: AuthState | undefined,
  formData: FormData,
): Promise<AuthState> {
  const supabase = await createClient();

  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const displayName = formData.get('displayName') as string;

  if (!email || !password) {
    return { error: 'Email and password are required' };
  }

  if (password.length < 6) {
    return { error: 'Password must be at least 6 characters' };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName || undefined },
    },
  });

  if (error) {
    return { error: error.message };
  }

  // Create user profile and preferences rows
  if (data.user) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('user_profiles').upsert({
      id: data.user.id,
      display_name: displayName || null,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('user_preferences').upsert({
      id: data.user.id,
    });
  }

  // If email confirmation is enabled, the user won't have a session yet
  if (data.user && !data.session) {
    redirect('/signup/confirm');
  }

  redirect('/');
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

export async function login(
  _prevState: AuthState | undefined,
  formData: FormData,
): Promise<AuthState> {
  const supabase = await createClient();

  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!email || !password) {
    return { error: 'Email and password are required' };
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  redirect('/');
}

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------

export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}
