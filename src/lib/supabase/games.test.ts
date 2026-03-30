/**
 * Tests for Game ↔ DB row conversion helpers.
 */

import { describe, it, expect } from 'vitest';
import { gameToInsert, rowToGame } from './games';
import type { Game } from '@/types/game';
import type { GameRow } from '@/types/supabase';

const sampleGame: Game = {
  id: 'bgg-13',
  source: 'bgg',
  sourceId: '13',
  name: 'Catan',
  description: 'Trade, build, settle.',
  yearPublished: 1995,
  types: ['board'],
  playerCount: { min: 3, max: 4, recommended: 4 },
  playTime: { min: 60, max: 120, average: 90 },
  complexity: 2.3,
  rating: 7.2,
  ratingCount: 95000,
  categories: ['Strategy', 'Family'],
  mechanics: ['Dice Rolling', 'Trading'],
  themes: ['Medieval'],
  platforms: [],
  thumbnailUrl: 'https://example.com/thumb.jpg',
  imageUrl: 'https://example.com/image.jpg',
  sourceUrl: 'https://boardgamegeek.com/boardgame/13',
};

const sampleRow: GameRow = {
  id: 'rawg-3498',
  source: 'rawg',
  source_id: '3498',
  name: 'Grand Theft Auto V',
  description: 'An open world game.',
  year_published: 2013,
  types: ['video'],
  min_players: null,
  max_players: null,
  recommended_players: null,
  min_play_time: null,
  max_play_time: 1800,
  avg_play_time: 1800,
  complexity: null,
  rating: 9.2,
  rating_count: 6000,
  categories: ['Action', 'Adventure'],
  mechanics: [],
  themes: ['Open World', 'Crime'],
  platforms: ['PC', 'PlayStation'],
  thumbnail_url: 'https://example.com/gta.jpg',
  image_url: 'https://example.com/gta-full.jpg',
  source_url: 'https://rawg.io/games/grand-theft-auto-v',
  rank_overall: null,
  num_owned: null,
  bayes_avg_rating: null,
  designers: [],
  publishers: [],
  num_wish: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

describe('gameToInsert', () => {
  it('maps all Game fields to insert row', () => {
    const insert = gameToInsert(sampleGame);

    expect(insert.id).toBe('bgg-13');
    expect(insert.source).toBe('bgg');
    expect(insert.source_id).toBe('13');
    expect(insert.name).toBe('Catan');
    expect(insert.description).toBe('Trade, build, settle.');
    expect(insert.year_published).toBe(1995);
    expect(insert.types).toEqual(['board']);
    expect(insert.min_players).toBe(3);
    expect(insert.max_players).toBe(4);
    expect(insert.recommended_players).toBe(4);
    expect(insert.min_play_time).toBe(60);
    expect(insert.max_play_time).toBe(120);
    expect(insert.avg_play_time).toBe(90);
    expect(insert.complexity).toBe(2.3);
    expect(insert.rating).toBe(7.2);
    expect(insert.rating_count).toBe(95000);
    expect(insert.categories).toEqual(['Strategy', 'Family']);
    expect(insert.mechanics).toEqual(['Dice Rolling', 'Trading']);
    expect(insert.themes).toEqual(['Medieval']);
    expect(insert.platforms).toEqual([]);
    expect(insert.thumbnail_url).toBe('https://example.com/thumb.jpg');
    expect(insert.image_url).toBe('https://example.com/image.jpg');
    expect(insert.source_url).toBe('https://boardgamegeek.com/boardgame/13');
  });

  it('converts undefined optional fields to null', () => {
    const minimalGame: Game = {
      id: 'local-test',
      source: 'local',
      sourceId: 'test',
      name: 'Test Game',
      description: '',
      types: ['word'],
      categories: [],
      mechanics: [],
      themes: [],
      platforms: [],
    };

    const insert = gameToInsert(minimalGame);

    expect(insert.year_published).toBeNull();
    expect(insert.min_players).toBeNull();
    expect(insert.max_players).toBeNull();
    expect(insert.complexity).toBeNull();
    expect(insert.rating).toBeNull();
    expect(insert.thumbnail_url).toBeNull();
  });
});

describe('rowToGame', () => {
  it('maps all DB row fields to Game', () => {
    const game = rowToGame(sampleRow);

    expect(game.id).toBe('rawg-3498');
    expect(game.source).toBe('rawg');
    expect(game.sourceId).toBe('3498');
    expect(game.name).toBe('Grand Theft Auto V');
    expect(game.description).toBe('An open world game.');
    expect(game.yearPublished).toBe(2013);
    expect(game.types).toEqual(['video']);
    expect(game.rating).toBe(9.2);
    expect(game.ratingCount).toBe(6000);
    expect(game.categories).toEqual(['Action', 'Adventure']);
    expect(game.themes).toEqual(['Open World', 'Crime']);
    expect(game.platforms).toEqual(['PC', 'PlayStation']);
    expect(game.sourceUrl).toBe('https://rawg.io/games/grand-theft-auto-v');
  });

  it('converts null DB fields to undefined', () => {
    const game = rowToGame(sampleRow);

    expect(game.playerCount).toBeUndefined();
    expect(game.complexity).toBeUndefined();
  });

  it('builds playerCount when min/max are present', () => {
    const rowWithPlayers = { ...sampleRow, min_players: 2, max_players: 6, recommended_players: 4 };
    const game = rowToGame(rowWithPlayers);

    expect(game.playerCount).toEqual({ min: 2, max: 6, recommended: 4 });
  });

  it('builds playTime when min/max are present', () => {
    const game = rowToGame(sampleRow);

    expect(game.playTime).toEqual({ min: 0, max: 1800, average: 1800 });
  });

  it('round-trips: gameToInsert → rowToGame preserves data', () => {
    const insert = gameToInsert(sampleGame);
    // Simulate what comes back from DB (add timestamps)
    const row: GameRow = {
      ...insert,
      description: insert.description ?? '',
      year_published: insert.year_published ?? null,
      types: insert.types ?? [],
      min_players: insert.min_players ?? null,
      max_players: insert.max_players ?? null,
      recommended_players: insert.recommended_players ?? null,
      min_play_time: insert.min_play_time ?? null,
      max_play_time: insert.max_play_time ?? null,
      avg_play_time: insert.avg_play_time ?? null,
      complexity: insert.complexity ?? null,
      rating: insert.rating ?? null,
      rating_count: insert.rating_count ?? null,
      categories: insert.categories ?? [],
      mechanics: insert.mechanics ?? [],
      themes: insert.themes ?? [],
      platforms: insert.platforms ?? [],
      thumbnail_url: insert.thumbnail_url ?? null,
      image_url: insert.image_url ?? null,
      source_url: insert.source_url ?? null,
      rank_overall: null,
      num_owned: null,
      bayes_avg_rating: null,
      designers: [],
      publishers: [],
      num_wish: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    const roundTripped = rowToGame(row);

    expect(roundTripped.id).toBe(sampleGame.id);
    expect(roundTripped.name).toBe(sampleGame.name);
    expect(roundTripped.rating).toBe(sampleGame.rating);
    expect(roundTripped.playerCount).toEqual(sampleGame.playerCount);
    expect(roundTripped.playTime).toEqual(sampleGame.playTime);
    expect(roundTripped.categories).toEqual(sampleGame.categories);
  });
});
