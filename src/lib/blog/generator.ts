/**
 * Blog draft generation via LLM.
 *
 * Builds a format-aware prompt from the topic hint, candidate games, and
 * recent posts, calls the blog model, and returns a structured BlogDraft
 * including games_referenced for downstream fact-checking.
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

/** Format-specific writing instructions. */
function getFormatInstructions(format: string): string {
  switch (format) {
    case 'comparison':
      return `This is a COMPARISON post. Compare the two options head-to-head. Include a pros/cons section or table for each. Give a clear verdict at the end: "If you want X, go with A. If you want Y, go with B." Don't sit on the fence.`;
    case 'guide':
      return `This is a HOW-TO GUIDE. Write practical, numbered steps the reader can follow. Include tips and common mistakes to avoid. Feature games as examples within the steps, not as a separate list. The reader should come away feeling confident they can do the thing.`;
    case 'opinion':
      return `This is an OPINION piece. Take a clear stance and defend it with specific examples. It's OK to be provocative or controversial. Back up opinions with game-specific evidence ("Catan's trading is frustrating because..."). Include a "counter-argument" section to show you've considered other views, then explain why you disagree.`;
    case 'deep-dive':
      return `This is a DEEP DIVE on a single game or concept. Go in depth: history, design decisions, strategy tips, who it's for and who should skip it. Reference other games for comparison but keep the focus narrow. The reader should feel like an expert after reading this.`;
    case 'buying-guide':
      return `This is a BUYING GUIDE. Focus on value, price tiers, and where to buy. Group games by price range (under $25, $25-50, $50+). Include affiliate links prominently for every game. Mention which games are good gifts and for whom. Practical, purchase-focused.`;
    default: // 'list' or undefined
      return `This is a LIST post. Feature 4-6 games from the database. For each one, write 2-3 sentences about what makes it special and who it's for. Give each game its own H2 section.`;
  }
}

/** Build the full system prompt. */
function buildPrompt(
  titleHint: string,
  gameContext: string,
  year: number,
  format: string,
  isBoardGameOnly: boolean,
  recentPosts: Array<{ slug: string; title: string }>,
): string {
  const recentPostsBlock = recentPosts.length > 0
    ? `\n## Recent Blog Posts (Link to 1-2 Naturally Where Relevant)\n${recentPosts.map((p) => `- [${p.title}](/blog/${p.slug})`).join('\n')}\n`
    : '';

  const gameTypeRule = isBoardGameOnly
    ? `\nCRITICAL GAME TYPE RULE: This is a BOARD GAME topic. Do NOT feature any video games. Check each game's "source" field: only include games with source "bgg" (BoardGameGeek). Games with source "rawg" or "igdb" are video games and must NOT appear.\n`
    : `\nThis topic allows both board games and video games. Check the "source" field: "bgg" = board game, "rawg"/"igdb" = video game.\n`;

  return `You are a blog writer for boredgame.lol, a game recommendation website with 100,000+ board games and video games.

Write an authoritative, well-researched blog post that would rank well on Google.

## Topic
"${titleHint} (${year})"

## Post Format
${getFormatInstructions(format)}

## Real Games From Our Database
Here are candidate games. CRITICAL: ONLY feature games that genuinely fit the topic.
If a game doesn't match (wrong genre, mechanic, player count, theme, etc.), DO NOT include it.
It is far better to feature 3 truly relevant games than 6 irrelevant ones.
A "modular board game" must actually have modular/variable setup. A "solo game" must support 1 player. Etc.
Use their exact names and IDs for internal links:
${gameContext}
${gameTypeRule}
## SEO & Keyword Requirements
- Title: compelling, includes the primary keyword naturally. 50-65 characters ideal.
- Meta description: under 155 characters, includes primary keyword, has a call to action.
- Structure the article with clear H2 headings (## in markdown). At least 3-4 sections.
- Open with a hook that addresses the reader's problem or question directly. No fluff intro.
- Write 1000-1500 words. Longer content ranks better, but every sentence must earn its place.
- Include the exact topic phrase at least 3-4 times throughout the body naturally.
- Use 2-3 close variations of the topic phrase. Example: if the topic is "cooperative board games", also write "co-op board games", "cooperative games", "best co-op games".
- Include the primary keyword in the first 100 words naturally.

## Links (Critical for SEO)
- Internal links to game pages: [Game Name](/games/GAME_ID_HERE) for each featured game.
- Affiliate links for each featured game: [Check price on Amazon](https://www.amazon.com/s?k=GAME+NAME+board+game&tag=boredgame-20)
- Link to our recommendation tool: "If you want personalized picks, [try our game finder](/find-a-game)."
- Link to our browse page where relevant: "[Browse all strategy games](/browse?category=Strategy)"
- Include 1-2 external authority links to BoardGameGeek (boardgamegeek.com), publisher sites, or Wikipedia. Example: "rated 8.5 on [BoardGameGeek](https://boardgamegeek.com/boardgame/ID)"
${recentPostsBlock}
## Tone & Style
- Write like an experienced gamer talking to a friend. Casual but knowledgeable.
- Have opinions. Say "this is one of the best" not "this is considered good by many."
- Share specific details that show expertise: mention player count sweet spots, common complaints, who a game is NOT for.
- Short paragraphs (2-3 sentences max). Web readers skim.
- Use bullet lists for comparisons or quick info.
- NO generic AI phrases: "dive into", "elevate your", "game-changer", "whether you're a seasoned veteran or a newcomer", "in the world of", "look no further", "without further ado", "let's explore", "buckle up"
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
 * Generate an initial blog draft.
 *
 * @param openai      - Initialized OpenAI client
 * @param titleHint   - Topic / title seed (e.g. "Best Solo Board Games")
 * @param games       - Candidate games from the database
 * @param year        - Current year for the post title
 * @param format      - Post format from the topic template
 * @param allowVideoGames - Whether video games are permitted in this topic
 * @param recentPosts - Recent published posts for internal linking
 * @returns Parsed BlogDraft with game references for fact-checking
 */
export async function generateDraft(
  openai: OpenAI,
  titleHint: string,
  games: BlogGameRow[],
  year: number,
  format = 'list',
  allowVideoGames = false,
  recentPosts: Array<{ slug: string; title: string }> = [],
): Promise<BlogDraft> {
  const gameContext = buildGameContext(games);
  const prompt = buildPrompt(titleHint, gameContext, year, format, !allowVideoGames, recentPosts);

  const completion = await openai.chat.completions.create({
    model: MODELS.blog,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.6,
    max_tokens: 6000,
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
