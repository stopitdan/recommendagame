/**
 * Blog Post Generation Pipeline
 *
 * Orchestrates all stages:
 * 1. Topic selection (slot-aware for 2x daily)
 * 2. Game fetching (topic-aware constraints)
 * 3. Recent posts query (for internal linking)
 * 4. Draft generation (format-aware LLM)
 * 5. Triple fact-check (+ game-type alignment)
 * 6. Triple edit sequence
 * 7. Image processing
 * 8. Quality evaluation
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type OpenAI from 'openai';
import type Anthropic from '@anthropic-ai/sdk';
import { pickTopic } from './topic-picker';
import { fetchTopicGames } from './game-fetcher';
import { generateDraft } from './generator';
import { factCheck } from './fact-checker';
import { editDraft } from './editor';
import { processImages } from './image-processor';
import { evaluateQuality } from './quality-evaluator';
import type { PipelineResult } from './types';

export async function runBlogPipeline(
  supabase: SupabaseClient,
  openai: OpenAI,
  anthropic: Anthropic,
  slot = 0,
): Promise<PipelineResult> {
  // Stage 1: Pick topic
  const { template, titleHint, topicIndex } = pickTopic(undefined, slot);
  const allowVideoGames = template.allowVideoGames ?? false;
  const format = template.format ?? 'list';
  console.log(`[Blog Pipeline] Topic #${topicIndex}: "${titleHint}" (format: ${format}, slot: ${slot})`);

  // Stage 2: Fetch games
  const games = await fetchTopicGames(supabase, template, titleHint, allowVideoGames);
  console.log(`[Blog Pipeline] Fetched ${games.length} games`);

  // Stage 3: Fetch recent published posts for internal linking
  const { data: recentPosts } = await supabase
    .from('blog_posts')
    .select('slug, title')
    .eq('status', 'published')
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false })
    .limit(15);

  // Stage 4: Generate draft (Claude Sonnet for human-like writing)
  const year = new Date().getFullYear();
  const draft = await generateDraft(
    anthropic,
    titleHint,
    games,
    year,
    format,
    allowVideoGames,
    recentPosts ?? [],
  );
  console.log(`[Blog Pipeline] Draft generated: "${draft.title}" (${draft.gamesReferenced.length} games referenced)`);

  // Stage 5: Triple fact-check (with game-type alignment)
  const factResult = await factCheck(openai, draft, games, allowVideoGames);
  console.log(`[Blog Pipeline] Fact-check: ${factResult.corrections.length} corrections${factResult.passed ? ' (passed)' : ' (fixed)'}`);

  // Stage 6: Triple edit sequence
  const editResult = await editDraft(openai, factResult.content);
  console.log(`[Blog Pipeline] Edits: ${editResult.edits.length} changes`);

  // Stage 7: Image processing
  const imageResult = await processImages(editResult.content, games);
  console.log(`[Blog Pipeline] Images: ${imageResult.imagesInjected} injected, ${imageResult.imageErrors.length} errors`);

  // Stage 8: Quality evaluation
  const qualityReport = await evaluateQuality(
    openai,
    imageResult.content,
    draft.title,
    draft.description,
    games,
  );
  console.log(`[Blog Pipeline] Quality: ${qualityReport.average}/10 (${qualityReport.passed ? 'PASS' : 'FAIL'})`);

  // Extract featured game IDs from content
  const gameIdMatches = imageResult.content.matchAll(/\/games\/([a-zA-Z0-9_%-]+)/g);
  const featuredGameIds = [...new Set([...gameIdMatches].map((m) => decodeURIComponent(m[1])))];

  return {
    title: draft.title,
    description: draft.description,
    content: imageResult.content,
    tags: draft.tags,
    featuredGameIds,
    qualityReport,
    corrections: factResult.corrections,
    edits: editResult.edits,
    imageErrors: imageResult.imageErrors,
  };
}
