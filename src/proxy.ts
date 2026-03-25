/**
 * Next.js 16 Proxy — Supabase Auth Session Refresh
 *
 * Refreshes expired auth tokens on every request by reading/writing cookies.
 * This is required because Server Components can't write cookies directly,
 * so the proxy handles token refresh before the request reaches the page.
 *
 * Next.js 16 renamed middleware.ts → proxy.ts and the export from
 * `middleware` → `proxy`. The runtime is now nodejs (not edge).
 *
 * Runs on all routes except static files and images.
 */

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Set cookies on the request (for downstream Server Components)
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          // Create a new response with the updated request
          supabaseResponse = NextResponse.next({ request });
          // Set cookies on the response (for the browser)
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refresh the session — this is the key operation.
  // Do NOT use getSession() here — getUser() validates the JWT.
  await supabase.auth.getUser();

  return supabaseResponse;
}

export const config = {
  matcher: [
    // Run on all routes except static files, images, and favicon
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
