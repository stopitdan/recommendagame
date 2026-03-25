/**
 * Tests for questionnaire types and constants.
 */

import { describe, it, expect } from 'vitest';
import {
  INITIAL_STATE,
  TIME_PRESETS,
  GENRE_OPTIONS,
  MOOD_OPTIONS,
} from './questionnaire';

describe('INITIAL_STATE', () => {
  it('has null gameType (surprise me default)', () => {
    expect(INITIAL_STATE.gameType).toBeNull();
  });

  it('has full player count range', () => {
    expect(INITIAL_STATE.playerCount).toEqual({ min: 1, max: 8 });
  });

  it('has full complexity range', () => {
    expect(INITIAL_STATE.complexity).toEqual({ min: 1, max: 5 });
  });

  it('has empty selections', () => {
    expect(INITIAL_STATE.genres).toEqual([]);
    expect(INITIAL_STATE.moods).toEqual([]);
    expect(INITIAL_STATE.freeText).toBe('');
    expect(INITIAL_STATE.timeAvailable).toBeNull();
  });
});

describe('TIME_PRESETS', () => {
  it('has all 5 presets', () => {
    const keys = Object.keys(TIME_PRESETS);
    expect(keys).toEqual(['quick', 'short', 'medium', 'long', 'epic']);
  });

  it('has non-overlapping minute ranges', () => {
    expect(TIME_PRESETS.quick.maxMinutes).toBeLessThanOrEqual(TIME_PRESETS.short.minMinutes);
    expect(TIME_PRESETS.short.maxMinutes).toBeLessThanOrEqual(TIME_PRESETS.medium.minMinutes);
    expect(TIME_PRESETS.medium.maxMinutes).toBeLessThanOrEqual(TIME_PRESETS.long.minMinutes);
    expect(TIME_PRESETS.long.maxMinutes).toBeLessThanOrEqual(TIME_PRESETS.epic.minMinutes);
  });

  it('each preset has label and description', () => {
    for (const preset of Object.values(TIME_PRESETS)) {
      expect(preset.label).toBeTruthy();
      expect(preset.description).toBeTruthy();
    }
  });
});

describe('GENRE_OPTIONS', () => {
  it('has no duplicates', () => {
    const unique = new Set(GENRE_OPTIONS);
    expect(unique.size).toBe(GENRE_OPTIONS.length);
  });

  it('includes common genres', () => {
    expect(GENRE_OPTIONS).toContain('Strategy');
    expect(GENRE_OPTIONS).toContain('RPG');
    expect(GENRE_OPTIONS).toContain('Puzzle');
    expect(GENRE_OPTIONS).toContain('Action');
  });
});

describe('MOOD_OPTIONS', () => {
  it('has unique IDs', () => {
    const ids = MOOD_OPTIONS.map((m) => m.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(MOOD_OPTIONS.length);
  });

  it('each mood has label and description', () => {
    for (const mood of MOOD_OPTIONS) {
      expect(mood.id).toBeTruthy();
      expect(mood.label).toBeTruthy();
      expect(mood.description).toBeTruthy();
    }
  });
});
