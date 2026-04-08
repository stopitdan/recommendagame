/**
 * GET /api/map/image-proxy?url=<encoded-url>
 *
 * CORS-safe image proxy for the game map canvas.
 * Fetches game thumbnail images from external domains and serves
 * them from our origin so PixiJS/Canvas can use them.
 *
 * Only allows images from known game image CDNs.
 * Cached via Cache-Control headers (browser) + Redis (server).
 */

import { NextRequest, NextResponse } from 'next/server';
import { redisCache } from '@/lib/redis';
import { shouldSkipCache } from '@/lib/cache-bypass';

const ALLOWED_DOMAINS = [
  'cf.geekdo-images.com',
  'media.rawg.io',
  'images.igdb.com',
];

const CACHE_TTL = 86400; // 24 hours

export async function GET(request: NextRequest) {
  const imageUrl = request.nextUrl.searchParams.get('url');
  if (!imageUrl) {
    return new NextResponse('Missing url param', { status: 400 });
  }

  // Validate domain
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(imageUrl);
  } catch {
    return new NextResponse('Invalid URL', { status: 400 });
  }

  if (!ALLOWED_DOMAINS.some((d) => parsedUrl.hostname.endsWith(d))) {
    return new NextResponse('Domain not allowed', { status: 403 });
  }

  // Check Redis cache
  const skipCache = shouldSkipCache(request);
  const cacheKey = `map-img:${imageUrl}`;
  const cached = !skipCache ? await redisCache.get<string>(cacheKey) : null;
  if (cached) {
    const buf = Buffer.from(cached, 'base64');
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=86400, immutable',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  // Fetch from origin
  try {
    const res = await fetch(imageUrl, {
      headers: { 'User-Agent': 'BoredGame/1.0 (https://boredgame.lol)' },
    });

    if (!res.ok) {
      return new NextResponse('Image fetch failed', { status: 502 });
    }

    const contentType = res.headers.get('content-type') ?? 'image/jpeg';
    const buf = Buffer.from(await res.arrayBuffer());

    // Cache in Redis (base64 encoded, only if reasonable size < 500KB)
    if (buf.length < 500_000) {
      await redisCache.set(cacheKey, buf.toString('base64'), CACHE_TTL);
    }

    return new NextResponse(buf, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, immutable',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch {
    return new NextResponse('Image proxy error', { status: 502 });
  }
}
