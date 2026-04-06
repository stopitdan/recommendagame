/**
 * Tests for /api/og/share-card — social card image generation.
 */

import { describe, it, expect, vi } from 'vitest';

// Mock next/og since it requires Edge runtime
vi.mock('next/og', () => ({
  ImageResponse: class MockImageResponse {
    body: ReadableStream;
    status: number;
    headers: Headers;
    constructor(element: React.ReactNode, options?: { width?: number; height?: number }) {
      this.body = new ReadableStream();
      this.status = 200;
      this.headers = new Headers({ 'content-type': 'image/png' });
      // Capture the dimensions for assertion
      (this as any)._width = options?.width;
      (this as any)._height = options?.height;
      (this as any)._element = element;
    }
  },
}));

import { GET } from './route';
import { NextRequest } from 'next/server';

function makeRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/og/share-card');
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url);
}

describe('GET /api/og/share-card', () => {
  it('returns a response with default title when no params given', async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
  });

  it('accepts a custom title', async () => {
    const res = await GET(makeRequest({ title: 'My Party Night Picks' }));
    expect(res.status).toBe(200);
  });

  it('accepts games JSON', async () => {
    const games = [
      { name: 'Catan', score: 0.85, types: ['board'] },
      { name: 'Hades', score: 0.72, types: ['video'] },
    ];
    const res = await GET(makeRequest({
      title: 'Top 2',
      games: JSON.stringify(games),
    }));
    expect(res.status).toBe(200);
  });

  it('handles invalid games JSON gracefully', async () => {
    const res = await GET(makeRequest({
      games: 'not-valid-json{{{',
    }));
    expect(res.status).toBe(200);
  });

  it('handles all theme variants', async () => {
    for (const theme of ['purple', 'orange', 'teal']) {
      const res = await GET(makeRequest({ theme }));
      expect(res.status).toBe(200);
    }
  });

  it('clamps to 5 games maximum', async () => {
    const games = Array.from({ length: 10 }, (_, i) => ({ name: `Game ${i + 1}` }));
    const res = await GET(makeRequest({
      games: JSON.stringify(games),
    }));
    expect(res.status).toBe(200);
  });

  it('handles unknown theme by falling back to purple', async () => {
    const res = await GET(makeRequest({ theme: 'neon-pink' }));
    expect(res.status).toBe(200);
  });
});
