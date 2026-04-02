/**
 * A/B Testing Framework for Recommendation Engine
 *
 * Assigns users to experiment groups and logs recommendation events
 * for comparing engine variants. Based on Koch's recommended split:
 * 5% baseline (most popular), 50% production, 45% experimental.
 *
 * Usage:
 *   const group = getExperimentGroup(userId);
 *   // ... run recommendation with group-specific weights
 *   logExperimentEvent(group, query, results, metrics);
 *
 * Analysis: npx tsx scripts/analyze-experiments.ts
 */

import type { ScoringWeights } from './scoring';
import { DEFAULT_WEIGHTS, HIDDEN_GEMS_WEIGHTS } from './scoring';

// ─── Experiment Groups ──────────────────────────────────────

export type ExperimentGroup = 'control' | 'production' | 'experimental';

/**
 * Deterministically assign a user to an experiment group based on
 * a hash of their user ID (or session ID for anonymous users).
 *
 * Distribution (Koch's recommended split):
 * - control: 5% (popularity-only baseline)
 * - production: 50% (current best weights)
 * - experimental: 45% (new weights being tested)
 */
export function getExperimentGroup(userId: string): ExperimentGroup {
  const hash = simpleHash(userId);
  const bucket = hash % 100;

  if (bucket < 5) return 'control';
  if (bucket < 55) return 'production';
  return 'experimental';
}

/**
 * Get scoring weights for an experiment group.
 * Control uses popularity-heavy weights (the naive baseline).
 * Production uses current best. Experimental uses the variant being tested.
 */
export function getWeightsForGroup(
  group: ExperimentGroup,
  experimentalWeights?: Partial<ScoringWeights>,
): ScoringWeights {
  switch (group) {
    case 'control':
      // Popularity-heavy baseline (naive system)
      return {
        ...DEFAULT_WEIGHTS,
        popularitySignal: 0.40,
        genreMatch: 0.15,
        freeTextMatch: 0.10,
        qualitySignal: 0.10,
        moodAlignment: 0.05,
        playerCountFit: 0.05,
        timeFit: 0.05,
        complexityFit: 0.05,
        typeMatch: 0.03,
        recencyBoost: 0.02,
      };

    case 'production':
      return DEFAULT_WEIGHTS;

    case 'experimental':
      if (experimentalWeights) {
        return { ...DEFAULT_WEIGHTS, ...experimentalWeights };
      }
      return DEFAULT_WEIGHTS; // No experiment running
  }
}

// ─── Experiment Event Logging ───────────────────────────────

export interface ExperimentEvent {
  timestamp: string;
  group: ExperimentGroup;
  userId: string;
  queryHash: string;
  resultCount: number;
  topGameIds: string[];
  latencyMs: number;
  /** Optional: user feedback on these results */
  feedback?: {
    thumbsUp: number;
    thumbsDown: number;
    saved: number;
  };
}

/**
 * Create an experiment event for logging.
 * Store these in Supabase experiment_logs table for analysis.
 */
export function createExperimentEvent(
  group: ExperimentGroup,
  userId: string,
  query: string,
  resultIds: string[],
  latencyMs: number,
): ExperimentEvent {
  return {
    timestamp: new Date().toISOString(),
    group,
    userId,
    queryHash: simpleHash(query).toString(16),
    resultCount: resultIds.length,
    topGameIds: resultIds.slice(0, 10),
    latencyMs,
  };
}

// ─── Helpers ────────────────────────────────────────────────

/**
 * Simple deterministic hash for consistent group assignment.
 * FNV-1a 32-bit hash.
 */
function simpleHash(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash;
}
