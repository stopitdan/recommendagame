/**
 * Unified cache bypass detection for all API routes.
 *
 * Three bypass signals (any one is sufficient):
 * 1. Query param: ?nocache=1
 * 2. Header: X-No-Cache: 1
 * 3. Cookie: __nocache=1 (set by admin toggle in profile dropdown)
 *
 * When bypass is active, API routes skip cache reads but still
 * populate caches (so other users benefit from the fresh computation).
 */

import { NextRequest, NextResponse } from 'next/server';

export function shouldSkipCache(request: NextRequest): boolean {
  try {
    if (request.nextUrl?.searchParams?.get('nocache') === '1') return true;
  } catch {
    // nextUrl may not exist on plain Request objects in tests
  }
  if (request.headers?.get('x-no-cache') === '1') return true;
  try {
    if (request.cookies?.get('__nocache')?.value === '1') return true;
  } catch {
    // cookies may not exist on plain Request objects in tests
  }
  return false;
}

/**
 * Create a response with the x-cache header set.
 * Wraps NextResponse.json to include cache hit/miss info.
 */
export function jsonWithCacheHeader(
  data: unknown,
  hit: boolean,
  init?: ResponseInit,
): NextResponse {
  const response = NextResponse.json(data, init);
  response.headers.set('x-cache', hit ? 'HIT' : 'MISS');
  return response;
}
