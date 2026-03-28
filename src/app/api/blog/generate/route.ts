/**
 * POST /api/blog/generate — Generate and publish a new blog post
 *
 * Called by Vercel Cron Job daily. Protected by CRON_SECRET.
 * Uses OpenAI GPT-4o to generate SEO-optimized game articles.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const CRON_SECRET = process.env.CRON_SECRET;

// Article topic templates that rotate based on day of year
const TOPIC_TEMPLATES = [
  { template: 'Best {category} Games for 2 Players', category: 'Strategy' },
  { template: 'Top 10 Quick Games Under 30 Minutes', category: null },
  { template: 'Best {category} Board Games for Families', category: 'Family' },
  { template: 'Hidden Gem {category} Games You Missed', category: 'Adventure' },
  { template: 'Best Party Games for Large Groups', category: 'Party' },
  { template: 'Top {category} Games for Game Night', category: 'Strategy' },
  { template: 'Best Solo Board Games to Play Alone', category: null },
  { template: 'Cooperative Games Everyone Should Try', category: 'Cooperative' },
  { template: 'Best {category} Games for Beginners', category: 'Gateway' },
  { template: 'Underrated Board Games with Amazing Mechanics', category: null },
  { template: 'Best Video Games for Board Game Lovers', category: null },
  { template: 'Top Card Games That Fit in Your Pocket', category: 'Card Game' },
  { template: 'Best Games for a Rainy Day Indoors', category: null },
  { template: 'Complex Strategy Games Worth the Learning Curve', category: 'Heavy Strategy' },
  { template: 'Best {category} Games Released Recently', category: 'Thematic' },
  { template: 'Games That Are Better Than Their Ratings Suggest', category: null },
  { template: 'Best Games to Play with Non-Gamers', category: 'Light' },
  { template: 'Worker Placement Games Ranked', category: 'Worker Placement' },
  { template: 'Best Deck-Building Games for Every Budget', category: 'Deck Building' },
  { template: 'Top Games with Amazing Artwork', category: null },
  { template: 'Best {category} Games for Date Night', category: 'Romance' },
  { template: 'Euro Games vs Ameritrash: What to Play', category: null },
  { template: 'Best Dungeon Crawl and RPG Board Games', category: 'RPG' },
  { template: 'Games You Can Finish in Under 15 Minutes', category: null },
  { template: 'Best Area Control Games for Competitive Players', category: 'Area Control' },
  { template: 'Top Deduction Games That Test Your Brain', category: 'Deduction' },
  { template: 'Board Games That Replaced Video Games for Us', category: null },
  { template: 'Best Engine Building Games of All Time', category: 'Engine Building' },
  { template: 'Games That Scale Perfectly from 2 to 6 Players', category: null },
  { template: 'Best Abstract Strategy Games', category: 'Abstract' },
];

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Vercel Cron sends GET requests
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return NextResponse.json({ error: 'OpenAI not configured' }, { status: 503 });
  }

  const openai = new OpenAI({ apiKey: openaiKey });

  // Pick today's topic based on day of year
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  const topicIndex = dayOfYear % TOPIC_TEMPLATES.length;
  const topic = TOPIC_TEMPLATES[topicIndex];

  // Fetch some real games from the DB to reference
  let gameContext = '';
  const { data: games } = await supabase
    .from('games')
    .select('id, name, rating, rating_count, categories, mechanics, min_players, max_players, avg_play_time, complexity, year_published')
    .gte('rating', 7.0)
    .gte('rating_count', 100)
    .eq('is_expansion', false)
    .order('rating', { ascending: false })
    .limit(50);

  if (games && games.length > 0) {
    // Pick 8 random games from the top 50
    const shuffled = games.sort(() => Math.random() - 0.5).slice(0, 8);
    gameContext = shuffled.map((g) =>
      `- ${g.name} (${g.rating}/10, ${g.rating_count} ratings, ${g.min_players}-${g.max_players} players, ~${g.avg_play_time}min, complexity ${g.complexity}/5, categories: ${(g.categories ?? []).join(', ')}, id: ${g.id})`
    ).join('\n');
  }

  const year = new Date().getFullYear();
  const titleHint = topic.template.replace('{category}', topic.category ?? 'Board');

  const prompt = `You are a blog writer for boredgame.lol, a game recommendation website with 100,000+ board games and video games.

Write an authoritative, well-researched blog post that would rank well on Google.

## Topic
"${titleHint} (${year})"

## Real Games From Our Database
Reference these actual games (use their exact names and IDs for internal links):
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
  "tags": ["tag1", "tag2", "tag3", "tag4"]
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.8,
      max_tokens: 4000,
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return NextResponse.json({ error: 'Empty AI response' }, { status: 500 });
    }

    const article = JSON.parse(raw);
    const slug = slugify(article.title) + `-${Date.now().toString(36)}`;

    // Extract game IDs mentioned in the content
    const gameIdMatches = article.content.matchAll(/\/games\/([a-zA-Z0-9-]+)/g);
    const featuredGameIds = [...new Set([...gameIdMatches].map((m: RegExpMatchArray) => m[1]))];

    // Store in Supabase
    const { data: post, error } = await supabase
      .from('blog_posts')
      .insert({
        slug,
        title: article.title,
        description: article.description,
        content: article.content,
        tags: article.tags ?? [],
        featured_game_ids: featuredGameIds,
        published_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('[Blog Generate] DB error:', error);
      return NextResponse.json({ error: 'Failed to save post' }, { status: 500 });
    }

    return NextResponse.json({ success: true, slug: post.slug, title: post.title });
  } catch (err) {
    console.error('[Blog Generate] Error:', err);
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 });
  }
}
