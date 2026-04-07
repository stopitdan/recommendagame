/**
 * Supabase browser client.
 *
 * Use this in Client Components ('use client') for:
 * - Real-time subscriptions
 * - Client-side auth state
 * - Non-sensitive queries (respects RLS via anon key)
 *
 * IMPORTANT: Never import the server client in browser code.
 */

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/supabase';
import type { User } from '@supabase/supabase-js';

let client: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function createClient() {
  if (!client) {
    client = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return client;
}

/**
 * Cached getUser — deduplicates concurrent calls so that N components
 * mounting at the same time only trigger a single Supabase auth request.
 * Cache is invalidated on auth state changes.
 */
let userPromise: Promise<User | null> | null = null;
let cachedUser: User | null | undefined = undefined;
let authListenerSetUp = false;

export function getCachedUser(): Promise<User | null> {
  if (cachedUser !== undefined) return Promise.resolve(cachedUser);
  if (userPromise) return userPromise;

  const supabase = createClient();

  // Listen for auth changes to invalidate cache
  if (!authListenerSetUp) {
    authListenerSetUp = true;
    supabase.auth.onAuthStateChange((_event, session) => {
      cachedUser = session?.user ?? null;
      userPromise = null;
    });
  }

  userPromise = supabase.auth.getUser().then(({ data: { user } }) => {
    cachedUser = user;
    userPromise = null;
    return user;
  }).catch(() => {
    userPromise = null;
    return null;
  });

  return userPromise;
}
