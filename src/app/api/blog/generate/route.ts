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

  const prompt = `Write a blog post for boredgame.lol, a game recommendation website.

Topic: "${titleHint} (${year})"

Here are some real games from our database you can reference (use their exact names and IDs for links):
${gameContext}

Requirements:
- Write a compelling title (can differ from the topic hint above)
- Write a meta description under 155 characters
- Write 800-1200 words of engaging content
- Mention 4-6 specific games from the list above, with brief descriptions of why they're good
- For each game mentioned, include a markdown link like: [Game Name](/games/GAME_ID_HERE)
- Include an Amazon affiliate link for each game: [Buy on Amazon](https://www.amazon.com/s?k=GAME+NAME&tag=boredgame-20)
- End with a call to action linking to /find-a-game
- Tone: casual, knowledgeable, like a friend who plays a lot of games. NOT corporate or AI-sounding.
- Do NOT use emdashes. Use commas, periods, or parentheses instead.
- Do NOT use phrases like "dive into", "elevate your", "game-changer", "whether you're a"
- Use short paragraphs. Web readers skim.
- Include 3-5 relevant tags as a comma-separated list

Respond in this exact JSON format:
{
  "title": "The blog post title",
  "description": "Meta description under 155 chars",
  "content": "Full markdown content of the article",
  "tags": ["tag1", "tag2", "tag3"]
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.8,
      max_tokens: 3000,
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
