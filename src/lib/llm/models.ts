/**
 * Central model configuration for all OpenAI API calls.
 *
 * Change models in one place instead of editing 12+ files.
 * Starting with GPT-4.1 series -- better than GPT-4o at lower cost.
 * Can bump to GPT-5.4 series after eval testing confirms no regressions.
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

  /** Blog generation -- long-form SEO content (full model for quality) */
  blog: 'gpt-4.1',

  /** Blog analysis -- fact-checking, editing, quality evaluation */
  blogAnalysis: 'gpt-4.1-mini',

  /** Metadata enrichment -- batch moods/vibes generation */
  enrichment: 'gpt-4.1-nano',

  /** Game quickstart guide generation */
  quickstart: 'gpt-4.1-nano',
} as const;
