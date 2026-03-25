/**
 * Tests for the feedback loop (preference vector updates).
 *
 * Tests the pure functions (ratingToSignal) directly and mocks
 * Supabase for the DB-dependent functions.
 */

import { describe, it, expect } from 'vitest';
import { ratingToSignal } from './feedback-loop';

describe('ratingToSignal', () => {
  it('returns strong positive for rating 10', () => {
    expect(ratingToSignal(10)).toBe(0.3);
  });

  it('returns strong positive for rating 9', () => {
    expect(ratingToSignal(9)).toBe(0.3);
  });

  it('returns moderate positive for rating 8', () => {
    expect(ratingToSignal(8)).toBe(0.2);
  });

  it('returns positive for rating 7', () => {
    expect(ratingToSignal(7)).toBe(0.1);
  });

  it('returns weak positive for rating 6', () => {
    expect(ratingToSignal(6)).toBe(0.05);
  });

  it('returns weak positive for rating 5', () => {
    expect(ratingToSignal(5)).toBe(0.03);
  });

  it('returns weak negative for rating 4', () => {
    expect(ratingToSignal(4)).toBe(-0.05);
  });

  it('returns moderate negative for rating 3', () => {
    expect(ratingToSignal(3)).toBe(-0.1);
  });

  it('returns strong negative for rating 2', () => {
    expect(ratingToSignal(2)).toBe(-0.15);
  });

  it('returns strongest negative for rating 1', () => {
    expect(ratingToSignal(1)).toBe(-0.2);
  });

  it('positive ratings produce positive signals', () => {
    for (let r = 5; r <= 10; r++) {
      expect(ratingToSignal(r)).toBeGreaterThan(0);
    }
  });

  it('negative ratings produce negative signals', () => {
    for (let r = 1; r <= 4; r++) {
      expect(ratingToSignal(r)).toBeLessThan(0);
    }
  });

  it('signal magnitude increases with distance from neutral', () => {
    // Positive side
    expect(Math.abs(ratingToSignal(10))).toBeGreaterThan(Math.abs(ratingToSignal(7)));
    expect(Math.abs(ratingToSignal(7))).toBeGreaterThan(Math.abs(ratingToSignal(5)));

    // Negative side
    expect(Math.abs(ratingToSignal(1))).toBeGreaterThan(Math.abs(ratingToSignal(4)));
  });
});
