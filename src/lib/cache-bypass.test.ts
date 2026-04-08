import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { shouldSkipCache, jsonWithCacheHeader } from './cache-bypass';

function makeRequest(opts: {
  query?: Record<string, string>;
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
} = {}): NextRequest {
  const url = new URL('http://localhost/api/test');
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    url.searchParams.set(k, v);
  }
  const req = new NextRequest(url, {
    headers: new Headers(opts.headers ?? {}),
  });
  // NextRequest doesn't support setting cookies directly in constructor,
  // but the cookie header is parsed from the Cookie header
  return req;
}

function makeRequestWithCookie(name: string, value: string): NextRequest {
  const url = new URL('http://localhost/api/test');
  return new NextRequest(url, {
    headers: new Headers({ Cookie: `${name}=${value}` }),
  });
}

describe('shouldSkipCache', () => {
  it('returns false when no bypass signals', () => {
    expect(shouldSkipCache(makeRequest())).toBe(false);
  });

  it('returns true for ?nocache=1 query param', () => {
    expect(shouldSkipCache(makeRequest({ query: { nocache: '1' } }))).toBe(true);
  });

  it('returns false for ?nocache=0', () => {
    expect(shouldSkipCache(makeRequest({ query: { nocache: '0' } }))).toBe(false);
  });

  it('returns true for X-No-Cache header', () => {
    expect(shouldSkipCache(makeRequest({ headers: { 'x-no-cache': '1' } }))).toBe(true);
  });

  it('returns true for __nocache cookie', () => {
    expect(shouldSkipCache(makeRequestWithCookie('__nocache', '1'))).toBe(true);
  });

  it('returns false for unrelated cookies', () => {
    expect(shouldSkipCache(makeRequestWithCookie('session', 'abc'))).toBe(false);
  });
});

describe('jsonWithCacheHeader', () => {
  it('sets x-cache: HIT for cache hits', () => {
    const res = jsonWithCacheHeader({ ok: true }, true);
    expect(res.headers.get('x-cache')).toBe('HIT');
  });

  it('sets x-cache: MISS for cache misses', () => {
    const res = jsonWithCacheHeader({ ok: true }, false);
    expect(res.headers.get('x-cache')).toBe('MISS');
  });
});
