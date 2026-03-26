/**
 * OpenAI Semantic Embeddings
 *
 * Generates real semantic embeddings using OpenAI's text-embedding-3-small
 * model. Unlike the hash-based one-hot vectors in embeddings.ts, these
 * capture MEANING — "build your deck" is semantically close to
 * "Deck Building" even without exact tag matches.
 *
 * Cost: ~$0.02/1M tokens = ~$0.40 for 100k games.
 * Dimensions: 1536 (text-embedding-3-small default).
 *
 * Two use cases:
 *   1. Batch: embed all games offline (scripts/generate-semantic-embeddings.ts)
 *   2. Query: embed user preferences at request time (~$0.000002 per query)
 */

import OpenAI from 'openai';
import type { Game } from '@/types/game';
import type { QuestionnaireState } from '@/types/questionnaire';

// ─── Config ──────────────────────────────────────────────────

export const SEMANTIC_DIM = 1536;
const EMBEDDING_MODEL = 'text-embedding-3-small';

// ─── Text Builders ───────────────────────────────────────────

/**
 * Builds a text representation of a game for embedding.
 * Includes name, description, and all metadata tags.
 */
export function gameToText(game: Game): string {
  const parts = [game.name];

  if (game.description) {
    // Take first 500 chars of description (keeps token count reasonable)
    parts.push(game.description.slice(0, 500));
  }

  if (game.categories.length > 0) {
    parts.push(`Categories: ${game.categories.join(', ')}`);
  }
  if (game.mechanics.length > 0) {
    parts.push(`Mechanics: ${game.mechanics.join(', ')}`);
  }
  if (game.themes.length > 0) {
    parts.push(`Themes: ${game.themes.join(', ')}`);
  }
  if (game.complexity != null) {
    parts.push(`Complexity: ${game.complexity}/5`);
  }
  if (game.playerCount) {
    parts.push(`Players: ${game.playerCount.min}-${game.playerCount.max}`);
  }
  if (game.types.length > 0) {
    parts.push(`Type: ${game.types.join(', ')}`);
  }

  return parts.join('. ');
}

/**
 * Builds a text representation of user preferences for embedding.
 * This gets embedded at query time to find semantically similar games.
 */
export function preferencesToText(prefs: QuestionnaireState): string {
  const parts: string[] = [];

  if (prefs.freeText) {
    parts.push(prefs.freeText);
  }

  if (prefs.llmParsed) {
    if (prefs.llmParsed.genres.length > 0) {
      parts.push(`Genres: ${prefs.llmParsed.genres.join(', ')}`);
    }
    if (prefs.llmParsed.mechanics.length > 0) {
      parts.push(`Mechanics: ${prefs.llmParsed.mechanics.join(', ')}`);
    }
    if (prefs.llmParsed.keywords.length > 0) {
      parts.push(`Keywords: ${prefs.llmParsed.keywords.join(', ')}`);
    }
    if (prefs.llmParsed.similarTo.length > 0) {
      parts.push(`Similar to: ${prefs.llmParsed.similarTo.join(', ')}`);
    }
  }

  if (prefs.genres.length > 0) {
    parts.push(`Preferred genres: ${prefs.genres.join(', ')}`);
  }
  if (prefs.moods.length > 0) {
    parts.push(`Mood: ${prefs.moods.join(', ')}`);
  }
  if (prefs.gameTypes.length > 0) {
    parts.push(`Game type: ${prefs.gameTypes.join(', ')}`);
  }

  return parts.join('. ') || 'fun popular game';
}

// ─── OpenAI API ──────────────────────────────────────────────

/**
 * Generates a semantic embedding for a single text using OpenAI.
 * Returns null on failure (no API key, timeout, etc.)
 */
export async function embedText(text: string): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const openai = new OpenAI({ apiKey, timeout: 10000 });
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
    });
    return response.data[0]?.embedding ?? null;
  } catch (error) {
    console.error('[Semantic] Embedding error:', error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Generates semantic embeddings for a batch of texts.
 * OpenAI supports up to 2048 inputs per batch call.
 */
export async function embedBatch(texts: string[]): Promise<(number[] | null)[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return texts.map(() => null);

  try {
    const openai = new OpenAI({ apiKey, timeout: 30000 });
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: texts,
    });

    // OpenAI returns embeddings in same order as input
    const embeddings: (number[] | null)[] = new Array(texts.length).fill(null);
    for (const item of response.data) {
      embeddings[item.index] = item.embedding;
    }
    return embeddings;
  } catch (error) {
    console.error('[Semantic] Batch embedding error:', error instanceof Error ? error.message : error);
    return texts.map(() => null);
  }
}
