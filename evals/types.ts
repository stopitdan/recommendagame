/**
 * Evaluation Framework Types
 *
 * Core type definitions for the boredgame.lol evaluation system.
 * Designed for massive parallel evaluation with full logging and
 * regression tracking.
 */

// ─── Eval Case Types ────────────────────────────────────────

export type RelevanceGrade = 0 | 1 | 2 | 3;

export interface EvalCase {
  /** Unique case identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Category for grouping and reporting */
  category: EvalCategory;
  /** The raw query text (what a user would type) */
  query: string;
  /** Game types filter */
  gameTypes?: string[];
  /** Player count constraint */
  playerCount?: { min: number; max: number };
  /** Time presets */
  timePresets?: string[];
  /** Explicit constraints for violation checking */
  constraints?: {
    maxMinutes?: number;
    timeStrictness?: 'hard' | 'soft';
    maxPlayers?: number;
    minPlayers?: number;
    complexity?: { min: number; max: number };
    designer?: string;
  };
  /** Games that SHOULD appear in results, with graded relevance */
  idealGames: { name: string; relevance: RelevanceGrade; reason?: string; dbGameId?: string }[];
  /** Games that should NOT appear in results */
  antiGames: { name: string; reason?: string; dbGameId?: string }[];
  /** Tags for filtering (e.g., 'regression', 'critical', 'edge-case') */
  tags?: string[];
}

export type EvalCategory =
  | 'mechanic-focused'
  | 'theme-focused'
  | 'player-count'
  | 'time-constraint'
  | 'complexity'
  | 'mood-vibe'
  | 'designer-search'
  | 'similar-to'
  | 'negative-preference'
  | 'multi-constraint'
  | 'edge-case'
  | 'real-user-feedback'
  | 'regression'
  | 'video-game'
  | 'party-game'
  | 'free-text-intent';

// ─── Result Types ───────────────────────────────────────────

export interface GameResult {
  id: string;
  name: string;
  categories?: string[];
  mechanics?: string[];
  themes?: string[];
  minPlayers?: number;
  maxPlayers?: number;
  avgPlayTime?: number;
  complexity?: number;
  rating?: number;
  ratingCount?: number;
  types?: string[];
  designers?: string[];
  _score?: number;
  _reasons?: string[];
  _breakdown?: Record<string, number>;
}

export interface CaseResult {
  caseId: string;
  category: EvalCategory;
  query: string;
  /** Was the case a pass or fail? */
  passed: boolean;
  /** All results returned by API (top 20) */
  results: GameResult[];
  /** Which ideal games were found? */
  idealGamesFound: string[];
  /** Which ideal games were NOT found? */
  idealGamesMissing: string[];
  /** Which anti games were found (bad)? */
  antiGamesFound: string[];
  /** Specific constraint violations */
  constraintViolations: ConstraintViolation[];
  /** Failure categories for this case */
  failureTypes: FailureType[];
  /** LLM judge relevance score (0-10) for top results */
  llmJudgeScore?: number;
  /** LLM judge reasoning */
  llmJudgeReason?: string;
  /** Latency in ms */
  latencyMs: number;
  /** Metrics for this case */
  metrics: CaseMetrics;
}

export interface ConstraintViolation {
  gameId: string;
  gameName: string;
  rank: number;
  type: 'player-count' | 'time' | 'complexity' | 'game-type' | 'designer';
  detail: string;
}

export type FailureType =
  | 'missing-ideal-game'
  | 'anti-game-present'
  | 'constraint-violation'
  | 'genre-mismatch'
  | 'popularity-bias'
  | 'irrelevant-results'
  | 'empty-results'
  | 'api-error'
  | 'llm-judge-low-score';

export interface CaseMetrics {
  ndcg10: number;
  precision10: number;
  mrr: number;
  hitRate5: number;
  constraintViolationRate: number;
}

// ─── Run Types ──────────────────────────────────────────────

export interface EvalRun {
  /** Unique run ID (timestamp-based) */
  runId: string;
  /** When the run started */
  startedAt: string;
  /** When the run finished */
  finishedAt: string;
  /** Total duration in seconds */
  durationSeconds: number;
  /** How many cases ran */
  totalCases: number;
  /** How many passed */
  passedCases: number;
  /** How many failed */
  failedCases: number;
  /** Pass rate (0-1) */
  passRate: number;
  /** Aggregate metrics */
  aggregateMetrics: AggregateMetrics;
  /** Per-category breakdown */
  categoryBreakdown: Record<string, CategorySummary>;
  /** Failure type distribution */
  failureDistribution: Record<FailureType, number>;
  /** Top 20 worst cases */
  worstCases: CaseResult[];
  /** All individual case results */
  cases: CaseResult[];
  /** Config used for this run */
  config: RunConfig;
  /** Comparison with previous run (if available) */
  regression?: RegressionReport;
}

export interface AggregateMetrics {
  avgNdcg10: number;
  avgPrecision10: number;
  avgMrr: number;
  avgHitRate5: number;
  avgConstraintViolationRate: number;
  avgLatencyMs: number;
  avgLlmJudgeScore?: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  /** What % of the game catalog appeared in any recommendation across all cases */
  catalogCoverage?: number;
  /** Constraint violations broken down by type */
  constraintViolationsByType?: Record<string, number>;
  /** Number of "trust buster" results (obviously wrong recommendations) */
  trustBusterCount?: number;
}

export interface CategorySummary {
  totalCases: number;
  passedCases: number;
  passRate: number;
  avgNdcg10: number;
  avgMrr: number;
  avgConstraintViolationRate: number;
}

export interface RegressionReport {
  previousRunId: string;
  passRateDelta: number;
  ndcgDelta: number;
  mrrDelta: number;
  newFailures: string[];
  fixedFailures: string[];
  regressions: string[];
}

export interface RunConfig {
  apiUrl: string;
  concurrency: number;
  useLlmJudge: boolean;
  categories?: EvalCategory[];
  tags?: string[];
  limit?: number;
}
