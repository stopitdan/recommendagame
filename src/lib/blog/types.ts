/**
 * Shared types for the blog generation pipeline.
 */

/** A game row with the fields we need for blog posts */
export interface BlogGameRow {
  id: string;
  name: string;
  rating: number;
  rating_count: number;
  categories: string[] | null;
  mechanics: string[] | null;
  min_players: number;
  max_players: number;
  avg_play_time: number;
  complexity: number;
  year_published: number;
  source: string;
  image_url: string | null;
  designers: string[] | null;
  enriched_metadata: Record<string, unknown> | null;
}

/** The initial draft from LLM generation */
export interface BlogDraft {
  title: string;
  description: string;
  content: string;
  tags: string[];
  /** Games the LLM says it referenced, with claimed stats */
  gamesReferenced: GameReference[];
}

/** A game reference as claimed by the LLM */
export interface GameReference {
  name: string;
  id: string;
  claimedPlayers: string;
  claimedTime: string;
  claimedComplexity: string;
}

/** A single factual error found during checking */
export interface FactError {
  game: string;
  field: string;
  claimed: string;
  actual: string;
}

/** Result of the fact-checking stage */
export interface FactCheckResult {
  content: string;
  corrections: FactError[];
  passed: boolean;
}

/** Result of the editing stage */
export interface EditResult {
  content: string;
  edits: string[];
}

/** Result of the image processing stage */
export interface ImageResult {
  content: string;
  imagesInjected: number;
  imageErrors: string[];
}

/** Quality scores on a 0-10 scale */
export interface QualityScores {
  accuracy: number;
  readability: number;
  tone: number;
  seo: number;
  completeness: number;
}

/** Full quality evaluation report */
export interface QualityReport {
  scores: QualityScores;
  average: number;
  passed: boolean;
  feedback: string;
}

/** Final pipeline output */
export interface PipelineResult {
  title: string;
  description: string;
  content: string;
  tags: string[];
  featuredGameIds: string[];
  qualityReport: QualityReport;
  corrections: FactError[];
  edits: string[];
  imageErrors: string[];
}

/** Topic template from the daily rotation */
export interface TopicTemplate {
  template: string;
  category: string | null;
  /** Post format -- controls the structure of the generated content */
  format?: 'list' | 'comparison' | 'guide' | 'opinion' | 'deep-dive' | 'buying-guide';
  /** When true, video games (RAWG/IGDB sources) are allowed alongside board games */
  allowVideoGames?: boolean;
}
