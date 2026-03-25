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

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
