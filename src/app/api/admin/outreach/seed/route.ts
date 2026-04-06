/**
 * POST /api/admin/outreach/seed — Populate outreach_tasks with the initial backlink targets.
 * Only inserts if the table is empty (won't duplicate). Admin-only.
 */

import { NextResponse } from 'next/server';
import { createClient as createTypedClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

const ADMIN_EMAIL = 'danjwiegand@gmail.com';

function createDbClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

interface SeedTask {
  category: string;
  priority: number;
  day_target: string;
  platform: string;
  url: string;
  post_title: string | null;
  post_body: string | null;
  notes: string | null;
}

const SEED_TASKS: SeedTask[] = [
  // ─── Day 1: AI Tool Directories ───────────────────────────────────
  {
    category: 'ai-directories',
    priority: 10,
    day_target: 'Day 1',
    platform: "There's An AI For That",
    url: 'https://theresanaiforthat.com/submit/',
    post_title: null,
    post_body: 'boredgame.lol -- AI-powered game recommendation engine. Tell it what you\'re in the mood for in plain English and it finds your next favorite game from 80,000+ board games, video games, word games, and party games. Uses a 6-layer AI pipeline: natural language parsing, semantic vector search (pgvector), multi-dimensional scoring, AI re-ranking, and collaborative filtering. Free, no sign-up required.',
    notes: 'Category: Entertainment / Recommendations. Emphasize the AI/LLM aspects. Do-follow link. Takes ~1 minute.',
  },
  {
    category: 'ai-directories',
    priority: 11,
    day_target: 'Day 1',
    platform: 'Futurepedia',
    url: 'https://www.futurepedia.io/submit-tool',
    post_title: null,
    post_body: 'boredgame.lol -- AI-powered game recommendation engine that uses natural language understanding, semantic vector search, and multi-layer scoring to match you with games from a catalog of 80,000+ titles. Free to use.',
    notes: 'Category: Fun Tools / Entertainment. Do-follow link.',
  },
  {
    category: 'ai-directories',
    priority: 12,
    day_target: 'Day 1',
    platform: 'Toolify.ai',
    url: 'https://www.toolify.ai/submit',
    post_title: null,
    post_body: 'boredgame.lol -- AI game recommendation engine. Describe what you want in plain English, get matched with board games, video games, word games, and party games. 80,000+ titles, 6-layer AI scoring.',
    notes: 'Category: AI entertainment tool. Do-follow link.',
  },
  {
    category: 'ai-directories',
    priority: 13,
    day_target: 'Day 1',
    platform: 'Uneed',
    url: 'https://www.uneed.best/submit-a-tool',
    post_title: null,
    post_body: 'boredgame.lol -- free AI-powered game recommendation engine. 80,000+ board games, video games, word games, and party games. Describe what you want, get personalized recommendations.',
    notes: 'They curate a daily "tool of the day." Do-follow link.',
  },

  // ─── Day 2: Reddit (Self-Promo Friendly) ──────────────────────────
  {
    category: 'reddit',
    priority: 20,
    day_target: 'Day 2',
    platform: 'r/SideProject',
    url: 'https://www.reddit.com/r/SideProject/submit',
    post_title: 'I built boredgame.lol -- an AI that recommends your next favorite game from 80,000+ titles',
    post_body: `I've been working on an AI-powered game recommendation engine that covers 80,000+ board games, video games, word games, and party games.

Instead of browsing endless lists, you describe what you're in the mood for ("something like Catan but faster for 2 players") and it finds games that match.

The engine uses 6 layers of AI scoring:
1. Natural language parsing (LLM extracts what you actually want)
2. Parallel candidate search (vector search, tag matching, designer lookups)
3. Multi-dimensional scoring (10 weighted dimensions)
4. Semantic similarity (pgvector embeddings)
5. AI re-ranking (LLM judge catches edge cases)
6. Learning from feedback (collaborative filtering)

Built with Next.js 16, Supabase + pgvector, Redis, and OpenAI.

Would love any feedback: https://boredgame.lol`,
    notes: 'Self-promotion explicitly welcome here. Include tech stack and screenshots.',
  },
  {
    category: 'reddit',
    priority: 21,
    day_target: 'Day 2',
    platform: 'r/AlphaAndBetaUSers',
    url: 'https://www.reddit.com/r/alphaandbetausers/submit',
    post_title: 'boredgame.lol -- AI game recommendation engine (looking for feedback)',
    post_body: `I built a free AI-powered game recommendation engine at https://boredgame.lol

Tell it what you're in the mood for in plain English and it finds matching games from 80,000+ board games, video games, word games, and party games.

Uses a 6-layer AI pipeline including semantic vector search, multi-dimensional scoring, and collaborative filtering.

Looking for feedback on:
- Recommendation quality
- UI/UX
- Missing features

Completely free, no sign-up required.`,
    notes: 'Designed for sharing projects and getting feedback. Keep it concise.',
  },

  // ─── Day 3: BoardGameGeek ─────────────────────────────────────────
  {
    category: 'bgg',
    priority: 30,
    day_target: 'Day 3',
    platform: 'BGG Guild',
    url: 'https://boardgamegeek.com/guild/create',
    post_title: 'boredgame.lol -- AI Game Recommendations',
    post_body: null,
    notes: 'Create a guild named "boredgame.lol -- AI Game Recommendations". Free. Can post updates and gather community. Description: "A free AI-powered game recommendation engine. Describe what you want and find your next favorite board game."',
  },
  {
    category: 'bgg',
    priority: 31,
    day_target: 'Day 3',
    platform: 'BGG Recommendations Forum',
    url: 'https://boardgamegeek.com/forum/8/boardgamegeek/recommendations',
    post_title: 'Free AI-powered board game recommendation tool -- boredgame.lol',
    post_body: `[size=14][b]Free AI-powered board game recommendation tool -- boredgame.lol[/b][/size]

Hi everyone! I built a free game recommendation engine at [url=https://boredgame.lol]boredgame.lol[/url] that uses AI to understand what you're looking for.

Instead of clicking through filters, you can just type something like "a cooperative game for 2 players that plays in under an hour" and it finds matching games from a database of 80,000+ titles (including BGG data).

How it works:
- AI parses your description to understand what you want
- Searches across multiple dimensions (genre, mechanics, player count, complexity)
- Scores every candidate on 10 different factors
- Uses semantic similarity to catch matches that tags miss

It covers board games, video games, word games, and party games.

Would love your feedback -- especially on recommendation quality for board games since that's the area I care most about getting right.

[url=https://boredgame.lol]https://boredgame.lol[/url]`,
    notes: 'Use BBCode formatting (not Markdown). Keep it informative, not salesy. BGG allows sharing community tools.',
  },
  {
    category: 'bgg',
    priority: 32,
    day_target: 'Day 3',
    platform: 'BGG GeekList',
    url: 'https://boardgamegeek.com/geeklist/create',
    post_title: 'Useful Online Tools for Board Gamers',
    post_body: 'A collection of useful online tools for the board gaming community. Add your favorites!\n\n1. boredgame.lol -- AI-powered game recommendation engine. Describe what you want in plain English, get matched with games from 80,000+ titles.',
    notes: 'Create a GeekList others can contribute to. Include boredgame.lol as the first item.',
  },

  // ─── Day 4: Product Directories ───────────────────────────────────
  {
    category: 'product-directories',
    priority: 40,
    day_target: 'Day 4',
    platform: 'AlternativeTo',
    url: 'https://alternativeto.net/manage-app/',
    post_title: null,
    post_body: 'boredgame.lol -- AI-powered game recommendation engine. Describe what you want and get matched with board games, video games, word games, and party games from 80,000+ titles. Uses semantic search and multi-layer AI scoring. Free, no sign-up required.',
    notes: 'List as alternative to: BoardGameGeek, Board Game Arena. Tags: Game Recommendation, Board Games, AI, Free. Do-follow link.',
  },
  {
    category: 'product-directories',
    priority: 41,
    day_target: 'Day 4',
    platform: 'BetaList',
    url: 'https://betalist.com/submit',
    post_title: 'boredgame.lol',
    post_body: 'AI-powered game recommendation engine. Tell us what you like, we recommend your next favorite board game, video game, or party game from 80,000+ titles.',
    notes: 'Free tier takes 2-4 weeks to be listed. Paid ($129) for immediate listing. Do-follow link.',
  },
  {
    category: 'product-directories',
    priority: 42,
    day_target: 'Day 4',
    platform: 'SaaS Hub',
    url: 'https://www.saashub.com/submit',
    post_title: null,
    post_body: 'boredgame.lol -- AI game recommendation engine with 80,000+ board games, video games, word games. Free to use.',
    notes: 'List alternatives (BGG, Board Game Arena recommendation features). Do-follow link.',
  },

  // ─── Day 5: High-Reach Reddit ─────────────────────────────────────
  {
    category: 'reddit',
    priority: 50,
    day_target: 'Day 5',
    platform: 'r/InternetIsBeautiful',
    url: 'https://www.reddit.com/r/InternetIsBeautiful/submit',
    post_title: 'boredgame.lol -- tell an AI what kind of game you\'re in the mood for and it finds the perfect one',
    post_body: null,
    notes: 'Direct link post to https://boredgame.lol (no text body needed). Rules: must be free, non-commercial, no sign-up walls. 17M+ members -- highest potential reach of any target.',
  },

  // ─── Days 6-7: Tech Communities ───────────────────────────────────
  {
    category: 'tech-communities',
    priority: 60,
    day_target: 'Day 6',
    platform: 'Hacker News (Show HN)',
    url: 'https://news.ycombinator.com/submit',
    post_title: 'Show HN: boredgame.lol -- AI game recommendation engine with pgvector and 6-layer scoring',
    post_body: `Hi HN! I built boredgame.lol -- a game recommendation engine that tries to actually understand what you want instead of just showing popular games.

The core insight: most game finders just filter on tags. This one uses a 6-layer pipeline: LLM parses free-text preferences, then 7 parallel search strategies (semantic vector search via pgvector HNSW, tag matching, mechanic search, text search, designer lookups, LLM query expansion) find ~500 candidates, which get scored across 10 dimensions, re-ranked by hybrid score (65% rule-based + 35% cosine similarity), diversity-penalized via MMR (lambda=0.12), and finally reviewed by an LLM judge.

Tech stack: Next.js 16 App Router, React 19, Supabase (PostgreSQL + pgvector), Redis, OpenAI, MUI 7. Data from BGG (65k games), IGDB (11k), RAWG (3.8k), plus curated word/party games.

Completely free, no sign-up required. Happy to answer any questions about the recommendation architecture.`,
    notes: 'Title must start with "Show HN:". URL field = https://boredgame.lol. Post the body text as the FIRST COMMENT (not in the URL field). Best time: weekday morning 9-11 AM ET. HN loves technical depth.',
  },
  {
    category: 'tech-communities',
    priority: 61,
    day_target: 'Day 7',
    platform: 'Product Hunt',
    url: 'https://www.producthunt.com/posts/new',
    post_title: 'boredgame.lol',
    post_body: 'AI recommends your next favorite game in seconds. Tell it what you\'re in the mood for and it matches you with something great from 80,000+ board games, video games, word games, and party games. Uses a 6-layer AI recommendation engine with semantic search, multi-dimensional scoring, and collaborative filtering. Completely free.',
    notes: 'Tagline (60 char max): "AI recommends your next favorite game in seconds". Topics: Gaming, AI, Recommendations, Entertainment. Best launch: Tue-Thu at 12:01 AM PST. Line up 5-10 people to upvote + comment in first hour. Add a maker comment explaining why you built it.',
  },

  // ─── Week 2: Content ──────────────────────────────────────────────
  {
    category: 'content',
    priority: 70,
    day_target: 'Week 2',
    platform: 'Dev.to',
    url: 'https://dev.to/new',
    post_title: 'How I Built a 6-Layer AI Game Recommendation Engine with Next.js, pgvector, and OpenAI',
    post_body: null,
    notes: 'Write a technical article about the architecture. Tags: #webdev #ai #nextjs #showdev. Include architecture diagrams, code snippets, lessons learned. This takes real effort but has long-term SEO value.',
  },
  {
    category: 'content',
    priority: 71,
    day_target: 'Week 2',
    platform: 'Hashnode',
    url: 'https://hashnode.com/',
    post_title: 'How I Built a 6-Layer AI Game Recommendation Engine with Next.js, pgvector, and OpenAI',
    post_body: null,
    notes: 'Cross-post the Dev.to article. Hashnode gives do-follow links on custom domain blogs.',
  },
  {
    category: 'content',
    priority: 72,
    day_target: 'Week 2',
    platform: 'Indie Hackers',
    url: 'https://www.indiehackers.com/new-post',
    post_title: 'I built boredgame.lol -- an AI game recommendation engine. Here\'s what I learned.',
    post_body: null,
    notes: 'Frame as a journey post. Focus on metrics, technical decisions, what worked. Include screenshots.',
  },

  // ─── Week 2: Developer Directories ────────────────────────────────
  {
    category: 'product-directories',
    priority: 73,
    day_target: 'Week 2',
    platform: 'StackShare',
    url: 'https://stackshare.io/',
    post_title: null,
    post_body: 'Tech stack: Next.js 16, React 19, TypeScript, MUI 7, Supabase (PostgreSQL + pgvector), Redis, OpenAI. Deployed on Vercel.',
    notes: 'Create a tech stack listing. Dev audiences discover tools this way. Do-follow link.',
  },
  {
    category: 'product-directories',
    priority: 74,
    day_target: 'Week 2',
    platform: 'Awesome RecSys (GitHub)',
    url: 'https://github.com/grahamjenson/list_of_recommender_systems',
    post_title: null,
    post_body: null,
    notes: 'Open a PR to add boredgame.lol under Entertainment section. Do-follow link. Format: "* [boredgame.lol](https://boredgame.lol) - AI-powered game recommendation engine using pgvector semantic search and multi-layer scoring."',
  },

  // ─── Ongoing: Organic Reddit ──────────────────────────────────────
  {
    category: 'ongoing',
    priority: 80,
    day_target: 'Ongoing',
    platform: 'r/boardgames (organic engagement)',
    url: 'https://www.reddit.com/r/boardgames/',
    post_title: null,
    post_body: null,
    notes: 'Help people in WSIG (What Should I Get) threads. Give genuine recommendations, then mention "I also built a free tool at boredgame.lol that does this." Self-promotion must be <10% of your Reddit activity. Build karma first.',
  },
  {
    category: 'ongoing',
    priority: 81,
    day_target: 'Ongoing',
    platform: 'r/gamesuggestions',
    url: 'https://www.reddit.com/r/gamesuggestions/',
    post_title: null,
    post_body: null,
    notes: 'Same organic approach as r/boardgames. Help people, mention tool naturally when relevant.',
  },
  {
    category: 'ongoing',
    priority: 82,
    day_target: 'Ongoing',
    platform: 'r/nextjs',
    url: 'https://www.reddit.com/r/nextjs/',
    post_title: null,
    post_body: null,
    notes: 'Frame as technical showcase when relevant threads appear. "Built a full AI recommendation engine with Next.js 16 App Router, pgvector, and Redis."',
  },
  {
    category: 'ongoing',
    priority: 83,
    day_target: 'Ongoing',
    platform: 'r/webdev (Showoff Saturday)',
    url: 'https://www.reddit.com/r/webdev/',
    post_title: null,
    post_body: null,
    notes: 'Self-promotion only in weekly Showoff Saturday threads. Focus on the technical build.',
  },

  // ─── Social / Facebook Groups ─────────────────────────────────────
  {
    category: 'social',
    priority: 90,
    day_target: 'Week 2',
    platform: 'Board Games (Facebook Group)',
    url: 'https://www.facebook.com/groups/boardgames/',
    post_title: null,
    post_body: 'Hey everyone! I built a free AI tool that recommends board games based on what you describe in plain English. It searches 80,000+ games. Would love your feedback! https://boredgame.lol',
    notes: 'Share as a helpful free resource. Ask for feedback.',
  },
  {
    category: 'social',
    priority: 91,
    day_target: 'Week 2',
    platform: 'Board Game Recommendations (Facebook Group)',
    url: 'https://www.facebook.com/groups/BoardGameRecommendations/',
    post_title: null,
    post_body: 'Built a free AI recommendation engine for board games (and video/word/party games). Tell it what you\'re in the mood for and it finds matches from 80,000+ titles. https://boredgame.lol',
    notes: 'Perfect target audience. Keep it casual.',
  },

  // ─── Lower Priority ───────────────────────────────────────────────
  {
    category: 'other',
    priority: 100,
    day_target: 'When Ready',
    platform: 'Bing Webmaster Tools',
    url: 'https://www.bing.com/webmasters/',
    post_title: null,
    post_body: null,
    notes: 'Submit sitemap. Bing feeds results to DuckDuckGo, ChatGPT search, etc.',
  },
  {
    category: 'other',
    priority: 101,
    day_target: 'When Ready',
    platform: 'Slant',
    url: 'https://www.slant.co/',
    post_title: null,
    post_body: null,
    notes: 'Answer questions like "What are the best board game recommendation tools?" and add boredgame.lol. Do-follow link.',
  },
  {
    category: 'other',
    priority: 102,
    day_target: 'When Ready',
    platform: 'BGG Blog Post',
    url: 'https://boardgamegeek.com/blog/create',
    post_title: 'How AI Can Help You Find Your Next Board Game',
    post_body: null,
    notes: 'Write a blog post about the approach. BGG allows user blogs.',
  },
  {
    category: 'other',
    priority: 103,
    day_target: 'When Ready',
    platform: 'Shut Up & Sit Down Forum',
    url: 'https://forums.susd.net/',
    post_title: null,
    post_body: null,
    notes: 'Post in general discussion. SUSD has an engaged, recommendation-friendly community.',
  },
  {
    category: 'other',
    priority: 104,
    day_target: 'When Ready',
    platform: 'Board Game Discord Servers',
    url: 'https://disboard.org/search?keyword=board+games',
    post_title: null,
    post_body: null,
    notes: 'Join relevant servers, participate genuinely, then share in #self-promo or #resources channels.',
  },
];

export async function POST() {
  const typedClient = await createTypedClient();
  const { data: { user } } = await typedClient.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = createDbClient();

  // Check if tasks already exist
  const { count } = await supabase
    .from('outreach_tasks')
    .select('id', { count: 'exact', head: true });

  if (count && count > 0) {
    return NextResponse.json({ error: `Table already has ${count} tasks. Delete them first to re-seed.` }, { status: 409 });
  }

  const { data, error } = await supabase
    .from('outreach_tasks')
    .insert(SEED_TASKS)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ inserted: data?.length ?? 0 });
}
