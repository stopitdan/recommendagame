/**
 * Supabase server client.
 *
 * Use this in Server Components, API routes, and server actions for:
 * - Database queries with RLS
 * - Auth verification (always use getUser(), never getSession())
 * - Service-role operations (admin tasks only)
 *
 * IMPORTANT: Always create a new client per request — never cache at module level.
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/supabase';

/**
 * Creates a Supabase client for server-side use with cookie-based auth.
 * Call this inside request handlers — not at module scope.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll is called from a Server Component where cookies can't be
            // set. This can be ignored if middleware is refreshing sessions.
          }
        },
      },
    },
  );
}

/**
 * Creates a Supabase client with the service role key.
 * Bypasses RLS — use only for admin/system operations (cron jobs, migrations).
 *
 * NEVER expose this in client-side code.
 */
export function createServiceClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {},
      },
    },
  );
}
