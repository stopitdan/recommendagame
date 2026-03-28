/**
 * BGG User Collection Fetcher
 *
 * Fetches a BoardGameGeek user's collection (owned games, ratings, plays)
 * via the BGG XML API2. Handles 202 retry (BGG queues collection requests)
 * and XML parsing.
 *
 * API: https://boardgamegeek.com/xmlapi2/collection?username=X&stats=1
 */

import { XMLParser } from 'fast-xml-parser';

const BGG_BASE_URL = 'https://boardgamegeek.com/xmlapi2';
const USER_AGENT = 'BoredGame/1.0 (https://boredgame.lol)';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

export interface BggCollectionItem {
  bggId: string;
  name: string;
  rating: number | null;      // User's personal rating (1-10)
  owned: boolean;
  wishlisted: boolean;
  playCount: number;
  yearPublished: number | null;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
});

/**
 * Fetch a BGG user's collection. Returns null if the user doesn't exist
 * or the request fails after retries.
 */
export async function fetchBggCollection(
  username: string,
): Promise<BggCollectionItem[] | null> {
  const url = `${BGG_BASE_URL}/collection?username=${encodeURIComponent(username)}&stats=1&subtype=boardgame`;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
      });

      // 202 = BGG is generating the collection, retry after delay
      if (res.status === 202) {
        console.log(`[BGG Collection] 202 received for ${username}, retrying in ${RETRY_DELAY_MS}ms...`);
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        continue;
      }

      if (!res.ok) {
        console.error(`[BGG Collection] HTTP ${res.status} for ${username}`);
        return null;
      }

      const xml = await res.text();
      const parsed = parser.parse(xml);

      if (!parsed?.items?.item) return [];

      const items = Array.isArray(parsed.items.item)
        ? parsed.items.item
        : [parsed.items.item];

      return items.map((item: Record<string, unknown>): BggCollectionItem => {
        const stats = item.stats as Record<string, unknown> | undefined;
        const rating = stats?.rating as Record<string, unknown> | undefined;
        const userRating = rating?.['@_value'];
        const status = item.status as Record<string, unknown> | undefined;

        return {
          bggId: String(item['@_objectid'] ?? ''),
          name: typeof item.name === 'string' ? item.name : (item.name as Record<string, unknown>)?.['#text'] as string ?? '',
          rating: userRating && userRating !== 'N/A' ? parseFloat(String(userRating)) : null,
          owned: status?.['@_own'] === '1',
          wishlisted: status?.['@_wishlist'] === '1',
          playCount: parseInt(String(item.numplays ?? '0'), 10),
          yearPublished: item.yearpublished ? parseInt(String(item.yearpublished), 10) : null,
        };
      });
    } catch (err) {
      console.error(`[BGG Collection] Error fetching ${username}:`, err);
      if (attempt < MAX_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      }
    }
  }

  return null;
}
