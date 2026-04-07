/**
 * Blog draft generation via LLM.
 *
 * Builds a prompt from the topic hint and candidate games, calls GPT-4o,
 * and returns a structured BlogDraft including games_referenced for
 * downstream fact-checking.
 */

import type OpenAI from 'openai';
import type { BlogDraft, BlogGameRow, GameReference } from './types';
import { MODELS } from '@/lib/llm/models';

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

/** Build the "Real Games" context block the prompt needs. */
function buildGameContext(games: BlogGameRow[]): string {
  return games
    .map((g) => {
      const moods = g.enriched_metadata?.moods;
      const moodStr = Array.isArray(moods) ? `, moods: ${moods.join(', ')}` : '';
      return `- ${g.name} (${g.rating}/10, ${g.rating_count} ratings, ${g.min_players}-${g.max_players} players, ~${g.avg_play_time}min, complexity ${g.complexity}/5, categories: ${(g.categories ?? []).join(', ')}, mechanics: ${(g.mechanics ?? []).join(', ')}${moodStr}, source: ${g.source}, id: ${g.id})`;
    })
    .join('\n');
}

/** Build the full system prompt. */
function buildPrompt(titleHint: string, gameContext: string, year: number): string {
  return `You are a blog writer for boredgame.lol, a game recommendation website with 100,000+ board games and video games.

Write an authoritative, well-researched blog post that would rank well on Google.

## Topic
"${titleHint} (${year})"

## Real Games From Our Database
Here are candidate games. CRITICAL: ONLY feature games that genuinely fit the topic.
If a game doesn't match (wrong genre, mechanic, player count, theme, etc.), DO NOT include it.
It is far better to feature 3 truly relevant games than 6 irrelevant ones.
A "modular board game" must actually have modular/variable setup. A "solo game" must support 1 player. Etc.
Use their exact names and IDs for internal links:
${gameContext}

## SEO & Structure Requirements
- Title: compelling, includes the primary keyword naturally. 50-65 characters ideal.
- Meta description: under 155 characters, includes primary keyword, has a call to action.
- Structure the article with clear H2 headings (## in markdown). At least 3-4 sections.
- Open with a hook that addresses the reader's problem or question directly. No fluff intro.
- Write 1000-1500 words. Longer content ranks better, but every sentence must earn its place.
- Include the primary keyword in the first 100 words naturally.
- Use related keywords throughout (LSI terms). If the topic is "strategy games", also use "tactical", "planning", "competitive", etc.

## Game References & Links
- Feature 4-6 games from the list above. For each one, write 2-3 sentences about what makes it special and who it's for.
- Internal links: [Game Name](/games/GAME_ID_HERE) for each featured game.
- Affiliate links: [Check price on Amazon](https://www.amazon.com/s?k=GAME+NAME+board+game&tag=boredgame-20) for each game.
- Link to our recommendation tool naturally: "If you want personalized picks, [try our game finder](/find-a-game)."
- Link to our browse page where relevant: "[Browse all strategy games](/browse?category=Strategy)"
- Link to other relevant blog posts on our site where natural: e.g., "[our guide to gateway games](/blog/seed-best-gateway-board-games-for-beginners)"

## Backlinking for SEO Authority
- Include 2-3 internal links to other pages on boredgame.lol: /find-a-game, /browse, /blog, or specific game pages (/games/ID)
- Include 1-2 external authority links to well-known board game sites like BoardGameGeek (boardgamegeek.com), publisher sites, or relevant Wikipedia articles. These build domain authority.
- Example: "rated 8.5 on [BoardGameGeek](https://boardgamegeek.com/boardgame/ID)" or "published by [Stonemaier Games](https://stonemaiergames.com)"

## Tone & Style
- Write like an experienced gamer talking to a friend. Casual but knowledgeable.
- Have opinions. Say "this is one of the best" not "this is considered good by many."
- Share specific details that show expertise: mention player count sweet spots, common complaints, who a game is NOT for.
- Short paragraphs (2-3 sentences max). Web readers skim.
- Use bullet lists for comparisons or quick info.
- NO emdashes. Use commas, periods, or parentheses.
- NO generic AI phrases: "dive into", "elevate your", "game-changer", "whether you're a seasoned veteran or a newcomer", "in the world of", "look no further", "without further ado"
- NO starting paragraphs with "So," or "Now,"
- End with a brief conclusion and CTA to /find-a-game

## Output Format
Respond in this exact JSON format:
{
  "title": "The blog post title",
  "description": "Meta description under 155 chars with keyword and CTA",
  "content": "Full markdown content with ## headings, links, and formatting",
  "tags": ["tag1", "tag2", "tag3", "tag4"],
  "games_referenced": [
    { "name": "Game Name", "id": "game-id", "players": "2-4", "time": "60min", "complexity": "3.2/5" }
  ]
}

The games_referenced array MUST list every game you mention in the article, with the stats you cited. This is used for automated fact-checking.`;
}

/* -------------------------------------------------------------------------- */
/*  Main export                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Generate an initial blog draft via GPT-4o.
 *
 * @param openai   - Initialized OpenAI client
 * @param titleHint - Topic / title seed (e.g. "Best Solo Board Games")
 * @param games    - Candidate games from the database
 * @param year     - Current year for the post title
 * @returns Parsed BlogDraft with game references for fact-checking
 */
export async function generateDraft(
  openai: OpenAI,
  titleHint: string,
  games: BlogGameRow[],
  year: number,
): Promise<BlogDraft> {
  const gameContext = buildGameContext(games);
  const prompt = buildPrompt(titleHint, gameContext, year);

  const completion = await openai.chat.completions.create({
    model: MODELS.blog,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.6,
    max_tokens: 4000,
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new Error('Empty AI response from blog generation');
  }

  const parsed = JSON.parse(raw) as {
    title: string;
    description: string;
    content: string;
    tags: string[];
    games_referenced?: Array<{
      name: string;
      id: string;
      players: string;
      time: string;
      complexity: string;
    }>;
  };

  const gamesReferenced: GameReference[] = (parsed.games_referenced ?? []).map(
    (g) => ({
      name: g.name,
      id: g.id,
      claimedPlayers: g.players,
      claimedTime: g.time,
      claimedComplexity: g.complexity,
    }),
  );

  return {
    title: parsed.title,
    description: parsed.description,
    content: parsed.content,
    tags: parsed.tags ?? [],
    gamesReferenced,
  };
}
