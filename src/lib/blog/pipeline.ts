/**
 * Blog Post Generation Pipeline
 *
 * Orchestrates all stages:
 * 1. Topic selection
 * 2. Game fetching
 * 3. Draft generation (LLM)
 * 4. Triple fact-check
 * 5. Triple edit sequence
 * 6. Image processing
 * 7. Quality evaluation
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type OpenAI from 'openai';
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
): Promise<PipelineResult> {
  // Stage 1: Pick topic
  const { template, titleHint, topicIndex } = pickTopic();
  console.log(`[Blog Pipeline] Topic: "${titleHint}"`);

  // Stage 2: Fetch games
  const games = await fetchTopicGames(supabase, template, topicIndex);
  console.log(`[Blog Pipeline] Fetched ${games.length} games`);

  // Stage 3: Generate draft
  const year = new Date().getFullYear();
  const draft = await generateDraft(openai, titleHint, games, year);
  console.log(`[Blog Pipeline] Draft generated: "${draft.title}" (${draft.gamesReferenced.length} games referenced)`);

  // Stage 4: Triple fact-check
  const factResult = await factCheck(openai, draft, games);
  console.log(`[Blog Pipeline] Fact-check: ${factResult.corrections.length} corrections${factResult.passed ? ' (passed)' : ' (fixed)'}`);

  // Stage 5: Triple edit sequence
  const editResult = await editDraft(openai, factResult.content);
  console.log(`[Blog Pipeline] Edits: ${editResult.edits.length} changes`);

  // Stage 6: Image processing
  const imageResult = await processImages(editResult.content, games);
  console.log(`[Blog Pipeline] Images: ${imageResult.imagesInjected} injected, ${imageResult.imageErrors.length} errors`);

  // Stage 7: Quality evaluation
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
