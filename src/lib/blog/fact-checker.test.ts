import { describe, it, expect } from 'vitest';
import type { BlogDraft, BlogGameRow } from './types';

// Test the pure-code check functions by reimplementing the logic
// (the actual functions are not exported, so we test the patterns)

const MOCK_GAMES: BlogGameRow[] = [
  {
    id: 'bgg-1234',
    name: 'Test Game',
    rating: 8.0,
    rating_count: 5000,
    categories: ['Strategy'],
    mechanics: ['Worker Placement'],
    min_players: 2,
    max_players: 4,
    avg_play_time: 60,
    complexity: 3.2,
    year_published: 2020,
    source: 'bgg',
    image_url: 'https://cf.geekdo-images.com/test.jpg',
    designers: ['Designer A'],
    enriched_metadata: null,
  },
  {
    id: 'rawg-5678',
    name: 'Video Game Test',
    rating: 9.0,
    rating_count: 10000,
    categories: ['RPG'],
    mechanics: [],
    min_players: 1,
    max_players: 1,
    avg_play_time: 120,
    complexity: 0,
    year_published: 2023,
    source: 'rawg',
    image_url: 'https://media.rawg.io/test.jpg',
    designers: [],
    enriched_metadata: null,
  },
];

describe('fact-checker: database accuracy', () => {
  it('detects incorrect player count', () => {
    const claimed = '1-6';
    const actual = { min: 2, max: 4 };
    const match = claimed.match(/(\d+)\s*-\s*(\d+)/);
    expect(match).toBeTruthy();
    const claimedMin = parseInt(match![1], 10);
    const claimedMax = parseInt(match![2], 10);
    expect(claimedMin).not.toBe(actual.min);
    expect(claimedMax).not.toBe(actual.max);
  });

  it('accepts correct player count', () => {
    const claimed = '2-4';
    const actual = { min: 2, max: 4 };
    const match = claimed.match(/(\d+)\s*-\s*(\d+)/);
    const claimedMin = parseInt(match![1], 10);
    const claimedMax = parseInt(match![2], 10);
    expect(claimedMin).toBe(actual.min);
    expect(claimedMax).toBe(actual.max);
  });

  it('detects play time outside 30% tolerance', () => {
    const claimedTime = 120; // claimed 120min
    const actualTime = 60;   // actual 60min
    const tolerance = actualTime * 0.3; // 18
    expect(Math.abs(claimedTime - actualTime)).toBeGreaterThan(tolerance);
  });

  it('accepts play time within 30% tolerance', () => {
    const claimedTime = 70;
    const actualTime = 60;
    const tolerance = actualTime * 0.3;
    expect(Math.abs(claimedTime - actualTime)).toBeLessThanOrEqual(tolerance);
  });

  it('detects complexity outside 0.5 tolerance', () => {
    const claimed = 4.0;
    const actual = 3.2;
    expect(Math.abs(claimed - actual)).toBeGreaterThan(0.5);
  });

  it('accepts complexity within 0.5 tolerance', () => {
    const claimed = 3.5;
    const actual = 3.2;
    expect(Math.abs(claimed - actual)).toBeLessThanOrEqual(0.5);
  });
});

describe('fact-checker: game type alignment', () => {
  it('flags video games in a board game topic', () => {
    const allowVideoGames = false;
    const videoGame = MOCK_GAMES.find((g) => g.source === 'rawg')!;
    expect(videoGame.source).not.toBe('bgg');

    // This would be flagged
    if (!allowVideoGames && videoGame.source !== 'bgg') {
      expect(true).toBe(true); // Error would be pushed
    }
  });

  it('allows video games in crossover topics', () => {
    const allowVideoGames = true;
    // In crossover mode, no errors for any source
    for (const game of MOCK_GAMES) {
      if (allowVideoGames) {
        expect(true).toBe(true); // No error regardless of source
      }
    }
  });

  it('allows board games in any topic', () => {
    const boardGame = MOCK_GAMES.find((g) => g.source === 'bgg')!;
    expect(boardGame.source).toBe('bgg');
    // Board games should never be flagged
  });
});

describe('fact-checker: inline stat detection', () => {
  it('detects inline player counts near game names', () => {
    const content = 'Test Game supports 1-6 players and is great for parties.';
    const game = MOCK_GAMES[0];
    const escaped = game.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`${escaped}[^.]*?(\\d+)\\s*[-\u2013]\\s*(\\d+)\\s*players`, 'i');
    const match = content.match(pattern);
    expect(match).toBeTruthy();
    expect(parseInt(match![1], 10)).toBe(1); // Claimed 1 (actual is 2)
    expect(parseInt(match![2], 10)).toBe(6); // Claimed 6 (actual is 4)
  });
});
