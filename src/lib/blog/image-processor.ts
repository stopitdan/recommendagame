/**
 * Image Processing
 *
 * Injects game images into blog content, handles BGG URL quirks,
 * validates images load, deduplicates, and wraps images in links
 * to the game's page on boredgame.lol.
 */

import type { BlogGameRow, ImageResult } from './types';

/** Resize image URLs for display in blog posts. */
function resizeImageUrl(url: string): string {
  // BGG images use __original / __imagepage convention
  if (url.includes('cf.geekdo-images.com')) {
    return url.replace('__original', '__imagepage');
  }
  // IGDB images use t_thumb, t_cover_big, etc. -- use t_cover_big (~264px)
  if (url.includes('images.igdb.com') && url.includes('t_thumb')) {
    return url.replace('t_thumb', 't_cover_big');
  }
  // RAWG and other images: return as-is (they're already reasonably sized)
  return url;
}

/** Validate that an image URL actually loads (HEAD request, 5s timeout) */
async function validateImageUrl(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Process images for a blog post:
 * 1. Find games mentioned in the content that have images
 * 2. Inject <a><img></a> after the first H2 mentioning each game
 * 3. Use HTML tags (not markdown) because BGG URLs contain parentheses
 * 4. Wrap each image in a link to the game's page on boredgame.lol
 * 5. Validate images load, skip broken ones
 * 6. Deduplicate (one image per game, max)
 */
export async function processImages(
  content: string,
  games: BlogGameRow[],
): Promise<ImageResult> {
  const injectedIds = new Set<string>();
  const imageErrors: string[] = [];
  let processed = content;

  // Build a map of games that are mentioned in the content and have images
  const mentionedGames = games.filter((g) => {
    const escaped = g.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(escaped, 'i').test(content) && g.image_url;
  });

  // Validate all image URLs in parallel
  const validationResults = await Promise.allSettled(
    mentionedGames.map(async (g) => ({
      game: g,
      valid: await validateImageUrl(resizeImageUrl(g.image_url!)),
    })),
  );

  const validGames: BlogGameRow[] = [];
  for (const result of validationResults) {
    if (result.status === 'fulfilled') {
      if (result.value.valid) {
        validGames.push(result.value.game);
      } else {
        imageErrors.push(`Image failed to load for ${result.value.game.name}`);
      }
    }
  }

  // Inject images after H2 headers (first mention only, deduplicated)
  for (const game of validGames) {
    if (injectedIds.has(game.id)) continue;

    const escaped = game.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const headerPattern = new RegExp(
      `(## [^\\n]*${escaped}[^\\n]*)\\n`,
      'i',
    );

    const match = processed.match(headerPattern);
    if (match && match.index !== undefined) {
      const sizedUrl = resizeImageUrl(game.image_url!);
      const gameUrl = `/games/${encodeURIComponent(game.id)}`;
      // Wrap image in a link to the game page (opens in new tab)
      const imgTag = `<a href="${gameUrl}" target="_blank" rel="noopener"><img src="${sizedUrl}" alt="${game.name}" /></a>`;

      const before = processed.slice(0, match.index);
      const after = processed.slice(match.index + match[0].length);
      processed = `${before}${match[1]}\n\n${imgTag}\n\n${after}`;
      injectedIds.add(game.id);
    }
  }

  return {
    content: processed,
    imagesInjected: injectedIds.size,
    imageErrors,
  };
}
