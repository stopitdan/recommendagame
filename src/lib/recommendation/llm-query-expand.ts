/**
 * LLM Query Expansion
 *
 * Takes the user's free text and generates additional search terms
 * that the rule-based pipeline wouldn't think of. This is what makes
 * the engine feel "magically" smart.
 *
 * Examples:
 * - "spaghetti and meatballs" -> search terms: ["food", "cooking", "Italian", "restaurant"]
 * - "something like Zelda" -> search terms: ["adventure", "exploration", "puzzle", "dungeon"]
 * - "I'm bored on a rainy day" -> search terms: ["cozy", "indoor", "casual", "solo"]
 */

import OpenAI from 'openai';
import { MODELS } from '@/lib/llm/models';

export interface ExpandedQuery {
  /** Additional search terms to use for text/description search */
  searchTerms: string[];
  /** Specific BGG categories to look for */
  categories: string[];
  /** Specific BGG mechanics to look for */
  mechanics: string[];
  /** Themes to match against */
  themes: string[];
}

const EMPTY_EXPANSION: ExpandedQuery = {
  searchTerms: [],
  categories: [],
  mechanics: [],
  themes: [],
};

/**
 * Ask the LLM to creatively expand the user's query into additional
 * search terms. This runs in parallel with the main candidate fetch.
 */
export async function expandQuery(freeText: string): Promise<ExpandedQuery> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !freeText.trim()) return EMPTY_EXPANSION;

  try {
    const openai = new OpenAI({ apiKey, timeout: 5000 });

    const completion = await openai.chat.completions.create({
      model: MODELS.expand,
      temperature: 0.3,
      max_tokens: 300,
      response_format: { type: 'json_object' },
      messages: [{
        role: 'user',
        content: `A user is looking for a board game recommendation. They typed: "${freeText}"

Think creatively about what they might mean and what games would delight them. Consider:
- Literal interpretation (exact mechanics/themes mentioned)
- Thematic connections (food -> cooking games, space -> sci-fi games)
- Emotional connections (bored -> exciting/engaging, stressed -> relaxing)
- Cultural references (movie/book/game references -> similar-themed board games)
- Wordplay and puns (if they're being playful, match that energy)

Generate search terms that would help find the PERFECT game for this person.

Return JSON: {
  "searchTerms": ["words to search game descriptions for"],
  "categories": ["BGG category names like Strategy, Family, Party, Card Game, etc."],
  "mechanics": ["BGG mechanic names like Deck Building, Worker Placement, etc."],
  "themes": ["BGG theme names like Fantasy, Science Fiction, Food, Animals, etc."]
}

Keep each array under 5 items. Be specific, not generic.`,
      }],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return EMPTY_EXPANSION;

    const parsed = JSON.parse(raw);
    return {
      searchTerms: Array.isArray(parsed.searchTerms) ? parsed.searchTerms.slice(0, 5) : [],
      categories: Array.isArray(parsed.categories) ? parsed.categories.slice(0, 5) : [],
      mechanics: Array.isArray(parsed.mechanics) ? parsed.mechanics.slice(0, 5) : [],
      themes: Array.isArray(parsed.themes) ? parsed.themes.slice(0, 5) : [],
    };
  } catch {
    return EMPTY_EXPANSION;
  }
}
