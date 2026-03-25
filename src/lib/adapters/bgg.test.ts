/**
 * Tests for the BGG adapter mapping and fetch logic.
 *
 * Mocks fetch to avoid hitting the real API. Tests focus on
 * XML parsing, field mapping, and response handling.
 *
 * Note: We mock the entire module to bypass the 5-second throttle
 * between requests that would cause test timeouts.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// --- Mock fetch globally before importing the module ---
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// --- Mock timers to bypass throttle delays ---
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

// Import after mocks are set up
import { bggAdapter } from './bgg';

// --- Helper: create a BGG /thing XML response ---
function thingXml(items: string): string {
  return `<?xml version="1.0" encoding="utf-8"?><items>${items}</items>`;
}

function gameItemXml(overrides: {
  id?: string;
  name?: string;
  description?: string;
  yearPublished?: string;
  minPlayers?: string;
  maxPlayers?: string;
  playingTime?: string;
  minPlayTime?: string;
  maxPlayTime?: string;
  rating?: string;
  usersRated?: string;
  weight?: string;
  categories?: string[];
  mechanics?: string[];
} = {}): string {
  const {
    id = '174430',
    name = 'Gloomhaven',
    description = 'A great dungeon crawler.',
    yearPublished = '2017',
    minPlayers = '1',
    maxPlayers = '4',
    playingTime = '120',
    minPlayTime = '60',
    maxPlayTime = '150',
    rating = '8.7',
    usersRated = '50000',
    weight = '3.86',
    categories = ['Adventure', 'Fantasy'],
    mechanics = ['Hand Management', 'Cooperative Game'],
  } = overrides;

  const categoryLinks = categories
    .map((c) => `<link type="boardgamecategory" id="1" value="${c}"/>`)
    .join('');
  const mechanicLinks = mechanics
    .map((m) => `<link type="boardgamemechanic" id="1" value="${m}"/>`)
    .join('');

  return `
    <item type="boardgame" id="${id}">
      <name type="primary" sortindex="1" value="${name}"/>
      <description>${description}</description>
      <yearpublished value="${yearPublished}"/>
      <minplayers value="${minPlayers}"/>
      <maxplayers value="${maxPlayers}"/>
      <playingtime value="${playingTime}"/>
      <minplaytime value="${minPlayTime}"/>
      <maxplaytime value="${maxPlayTime}"/>
      <thumbnail>https://cf.geekdo-images.com/test.jpg</thumbnail>
      <image>https://cf.geekdo-images.com/test_full.jpg</image>
      ${categoryLinks}
      ${mechanicLinks}
      <statistics>
        <ratings>
          <average value="${rating}"/>
          <usersrated value="${usersRated}"/>
          <averageweight value="${weight}"/>
        </ratings>
      </statistics>
    </item>
  `;
}

function searchXml(items: { id: string; name: string }[]): string {
  const entries = items
    .map((i) => `<item type="boardgame" id="${i.id}"><name type="primary" value="${i.name}"/></item>`)
    .join('');
  return `<?xml version="1.0" encoding="utf-8"?><items total="${items.length}">${entries}</items>`;
}

// ═══════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════

describe('bggAdapter', () => {
  describe('search', () => {
    it('returns mapped games from a two-step search + thing flow', async () => {
      // Step 1: /search returns IDs
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(searchXml([
          { id: '174430', name: 'Gloomhaven' },
          { id: '167791', name: 'Terraforming Mars' },
        ])),
      });

      // Step 2: /thing returns full details
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(thingXml(
          gameItemXml({ id: '174430', name: 'Gloomhaven' }) +
          gameItemXml({ id: '167791', name: 'Terraforming Mars', rating: '8.4', weight: '3.24' })
        )),
      });

      const results = await bggAdapter.search('gloomhaven', { limit: 2 });

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('bgg-174430');
      expect(results[0].name).toBe('Gloomhaven');
      expect(results[0].source).toBe('bgg');
      expect(results[0].types).toEqual(['board']);
    }, 15000);

    it('returns empty array when search finds nothing', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`<?xml version="1.0"?><items total="0"></items>`),
      });

      const results = await bggAdapter.search('zzzznonexistent');
      expect(results).toEqual([]);
    }, 15000);
  });

  describe('getById', () => {
    it('returns a single mapped game', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(thingXml(gameItemXml({
          id: '174430',
          name: 'Gloomhaven',
          description: 'A tactical game.',
          yearPublished: '2017',
          minPlayers: '1',
          maxPlayers: '4',
          playingTime: '120',
          rating: '8.7',
          usersRated: '50000',
          weight: '3.86',
        }))),
      });

      const game = await bggAdapter.getById('174430');

      expect(game).not.toBeNull();
      expect(game!.id).toBe('bgg-174430');
      expect(game!.name).toBe('Gloomhaven');
      expect(game!.yearPublished).toBe(2017);
      expect(game!.playerCount.min).toBe(1);
      expect(game!.playerCount.max).toBe(4);
      expect(game!.playTime.average).toBe(120);
      expect(game!.complexity).toBeCloseTo(3.86, 1);
      expect(game!.rating).toBeCloseTo(8.7, 1);
      expect(game!.ratingCount).toBe(50000);
      expect(game!.categories).toContain('Adventure');
      expect(game!.categories).toContain('Fantasy');
      expect(game!.mechanics).toContain('Hand Management');
      expect(game!.thumbnailUrl).toBe('https://cf.geekdo-images.com/test.jpg');
      expect(game!.sourceUrl).toBe('https://boardgamegeek.com/boardgame/174430');
    }, 15000);

    it('returns null when game not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`<?xml version="1.0"?><items></items>`),
      });

      const game = await bggAdapter.getById('999999');
      expect(game).toBeNull();
    }, 15000);
  });

  describe('getPopular', () => {
    it('fetches hot list then hydrates with /thing', async () => {
      // Step 1: /hot returns basic info
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`<?xml version="1.0"?>
          <items>
            <item id="174430" rank="1"><name value="Gloomhaven"/></item>
            <item id="167791" rank="2"><name value="Terraforming Mars"/></item>
          </items>
        `),
      });

      // Step 2: /thing for full details
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(thingXml(
          gameItemXml({ id: '174430', name: 'Gloomhaven' }) +
          gameItemXml({ id: '167791', name: 'Terraforming Mars' })
        )),
      });

      const results = await bggAdapter.getPopular(2);

      expect(results).toHaveLength(2);
      expect(results[0].name).toBe('Gloomhaven');
      expect(results[1].name).toBe('Terraforming Mars');
    }, 15000);
  });

  describe('field mapping', () => {
    it('sets source to bgg and prefixes ID', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(thingXml(gameItemXml({ id: '12345' }))),
      });

      const game = await bggAdapter.getById('12345');
      expect(game!.source).toBe('bgg');
      expect(game!.sourceId).toBe('12345');
      expect(game!.id).toBe('bgg-12345');
    }, 15000);

    it('always sets types to ["board"]', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(thingXml(gameItemXml())),
      });

      const game = await bggAdapter.getById('174430');
      expect(game!.types).toEqual(['board']);
    }, 15000);

    it('maps categories and mechanics correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(thingXml(gameItemXml({
          categories: ['Strategy', 'Economic'],
          mechanics: ['Worker Placement', 'Auction/Bidding'],
        }))),
      });

      const game = await bggAdapter.getById('1');
      expect(game!.categories).toEqual(['Strategy', 'Economic']);
      expect(game!.mechanics).toEqual(['Worker Placement', 'Auction/Bidding']);
    }, 15000);

    it('generates correct sourceUrl', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(thingXml(gameItemXml({ id: '99999' }))),
      });

      const game = await bggAdapter.getById('99999');
      expect(game!.sourceUrl).toBe('https://boardgamegeek.com/boardgame/99999');
    }, 15000);

    it('parses player count ranges', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(thingXml(gameItemXml({
          minPlayers: '2',
          maxPlayers: '6',
        }))),
      });

      const game = await bggAdapter.getById('1');
      expect(game!.playerCount.min).toBe(2);
      expect(game!.playerCount.max).toBe(6);
    }, 15000);
  });

  describe('202 retry handling', () => {
    it('retries on 202 and succeeds on subsequent attempt', async () => {
      // First call: 202
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 202,
        text: () => Promise.resolve(''),
      });

      // Second call: 200 with data
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(thingXml(gameItemXml())),
      });

      const game = await bggAdapter.getById('174430');
      expect(game).not.toBeNull();
      expect(mockFetch).toHaveBeenCalledTimes(2);
    }, 30000);
  });

  describe('error handling', () => {
    it('returns null on HTTP 404', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: () => Promise.resolve(''),
      });

      const game = await bggAdapter.getById('999999');
      expect(game).toBeNull();
    }, 15000);
  });
});
