/**
 * Central model configuration for all LLM API calls.
 *
 * Change models in one place instead of editing 12+ files.
 * Most endpoints use OpenAI GPT-4.1 series.
 * Blog generation uses Claude Sonnet for better writing quality.
 */
export const MODELS = {
  /** Preference parsing -- structured JSON extraction from free text */
  parse: 'gpt-4.1-nano',

  /** Query expansion -- creative search term generation */
  expand: 'gpt-4.1-nano',

  /** Reranking -- precision-critical final ordering of candidates */
  rerank: 'gpt-4.1-mini',

  /** Chat sommelier -- conversational game recommendations */
  chat: 'gpt-4.1-mini',

  /** Blog generation -- long-form SEO content (Claude Sonnet for human-like writing) */
  blog: 'claude-sonnet-4-6-20250514',

  /** Blog analysis -- fact-checking, editing, quality evaluation (OpenAI) */
  blogAnalysis: 'gpt-4.1-mini',

  /** Metadata enrichment -- batch moods/vibes generation */
  enrichment: 'gpt-4.1-nano',

  /** Game quickstart guide generation */
  quickstart: 'gpt-4.1-nano',
} as const;
