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
  // Metadata
  cost_type: 'free' | 'paid' | 'freemium';
  cost_amount: string | null;
  can_post_immediately: 'yes' | 'no' | 'needs_karma' | 'needs_approval';
  maintenance_level: 'one_and_done' | 'low' | 'moderate' | 'high';
  link_type: 'do_follow' | 'no_follow';
  approval_process: 'auto_published' | 'manual_review' | 'community_moderated';
  estimated_reach: 'low' | 'medium' | 'high' | 'very_high';
  time_to_live: 'immediate' | 'hours' | 'days' | 'weeks';
}

const SEED_TASKS: SeedTask[] = [
  // ═══════════════════════════════════════════════════════════════════
  // Day 1: AI Tool Directories
  // ═══════════════════════════════════════════════════════════════════
  {
    category: 'ai-directories',
    priority: 10,
    day_target: 'Day 1',
    platform: "There's An AI For That",
    url: 'https://theresanaiforthat.com/submit/',
    post_title: null,
    post_body: 'boredgame.lol -- AI-powered game recommendation engine. Tell it what you\'re in the mood for in plain English and it finds your next favorite game from 80,000+ board games, video games, word games, and party games. Uses a 6-layer AI pipeline: natural language parsing, semantic vector search (pgvector), multi-dimensional scoring, AI re-ranking, and collaborative filtering. Free, no sign-up required.',
    notes: 'COST: ~$49+ for a standard listing. There is a free option via their monthly X/Twitter thread where they feature tools, but it is competitive.\n\nACCOUNT: Create account, fill out submission form with tool URL, description, category (Entertainment / Recommendations), and screenshot.\n\nPROCESS: Human editorial review checks functionality, accuracy, and for duplicates. Takes 1-2 business days. Rejected submissions get refunds.\n\nTIP: Wait until the product is polished before paying. Emphasize the AI/LLM aspects since that is what their audience cares about. High-traffic directory -- one of the top AI tool discovery sites.',
    cost_type: 'paid',
    cost_amount: '~$49+',
    can_post_immediately: 'no',
    maintenance_level: 'one_and_done',
    link_type: 'do_follow',
    approval_process: 'manual_review',
    estimated_reach: 'very_high',
    time_to_live: 'days',
  },
  {
    category: 'ai-directories',
    priority: 11,
    day_target: 'Day 1',
    platform: 'Futurepedia',
    url: 'https://www.futurepedia.io/submit-tool',
    post_title: null,
    post_body: 'boredgame.lol -- AI-powered game recommendation engine that uses natural language understanding, semantic vector search, and multi-layer scoring to match you with games from a catalog of 80,000+ titles. Free to use.',
    notes: 'COST: Paid only. Basic listing $247 (often sold out), Verified listing $497. No free tier.\n\nACCOUNT: Create account, submit tool with description, screenshots, and category (Fun Tools / Entertainment).\n\nPROCESS: Editorial review. Basic takes ~7 days, Verified takes ~2 business days. Full refund if rejected. 400k+ monthly visitors.\n\nTIP: Only worth it if you want high visibility in the AI tools space. The $497 Verified tier gets faster review and a badge. Wait until launch-ready.',
    cost_type: 'paid',
    cost_amount: '$247-497',
    can_post_immediately: 'no',
    maintenance_level: 'one_and_done',
    link_type: 'do_follow',
    approval_process: 'manual_review',
    estimated_reach: 'high',
    time_to_live: 'days',
  },
  {
    category: 'ai-directories',
    priority: 12,
    day_target: 'Day 1',
    platform: 'Toolify.ai',
    url: 'https://www.toolify.ai/submit',
    post_title: null,
    post_body: 'boredgame.lol -- AI game recommendation engine. Describe what you want in plain English, get matched with board games, video games, word games, and party games. 80,000+ titles, 6-layer AI scoring.',
    notes: 'COST: ~$99 for listing.\n\nACCOUNT: Create account, fill submission form.\n\nPROCESS: Mostly automated. Published within 48 hours. 20,000+ AI tools indexed.\n\nTIP: Quick and easy. Category: AI entertainment tool. Decent traffic from people browsing AI tools.',
    cost_type: 'paid',
    cost_amount: '~$99',
    can_post_immediately: 'no',
    maintenance_level: 'one_and_done',
    link_type: 'do_follow',
    approval_process: 'auto_published',
    estimated_reach: 'high',
    time_to_live: 'days',
  },
  {
    category: 'ai-directories',
    priority: 13,
    day_target: 'Day 1',
    platform: 'Uneed',
    url: 'https://www.uneed.best/submit-a-tool',
    post_title: null,
    post_body: 'boredgame.lol -- free AI-powered game recommendation engine. 80,000+ board games, video games, word games, and party games. Describe what you want, get personalized recommendations.',
    notes: 'COST: Free basic submission available. Paid tiers exist for featured/priority placement.\n\nACCOUNT: Create account, submit with URL and description.\n\nPROCESS: Editorial review. They curate a daily "tool of the day" feature. Getting featured is a nice traffic boost.\n\nTIP: Free tier is worth doing immediately. If selected as tool of the day, you get a traffic spike.',
    cost_type: 'freemium',
    cost_amount: null,
    can_post_immediately: 'no',
    maintenance_level: 'one_and_done',
    link_type: 'do_follow',
    approval_process: 'manual_review',
    estimated_reach: 'medium',
    time_to_live: 'days',
  },

  // ═══════════════════════════════════════════════════════════════════
  // Day 2: Reddit (Self-Promo Friendly)
  // ═══════════════════════════════════════════════════════════════════
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
    notes: 'COST: Free.\n\nACCOUNT: Need a Reddit account. Can post immediately after creating one, but having some karma helps credibility. No minimum karma requirement for this sub.\n\nMAINTENANCE: Check back for comments/questions for the first 24-48 hours. Responding to comments boosts the post in Reddit\'s algorithm. After that, no ongoing effort needed.\n\nRULES: Self-promotion is explicitly welcome. Must be your own creation. Can only post the same project once every 2 months. No dropship/concept posts. Include tech stack and screenshots for best results.\n\nTIP: Post during US business hours (9 AM - 12 PM ET) for best visibility.',
    cost_type: 'free',
    cost_amount: null,
    can_post_immediately: 'yes',
    maintenance_level: 'moderate',
    link_type: 'no_follow',
    approval_process: 'auto_published',
    estimated_reach: 'high',
    time_to_live: 'immediate',
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
    notes: 'COST: Free.\n\nACCOUNT: Need a Reddit account. Can post immediately.\n\nMAINTENANCE: Respond to any feedback you get. This sub is specifically for feedback exchange, so engage genuinely.\n\nRULES: Designed for sharing projects and getting feedback. Frame as "looking for feedback" not "check out my product." Keep it concise.\n\nTIP: Smaller community but high-quality feedback. Good for finding bugs or UX issues.',
    cost_type: 'free',
    cost_amount: null,
    can_post_immediately: 'yes',
    maintenance_level: 'moderate',
    link_type: 'no_follow',
    approval_process: 'auto_published',
    estimated_reach: 'medium',
    time_to_live: 'immediate',
  },

  // ═══════════════════════════════════════════════════════════════════
  // Day 3: BoardGameGeek
  // ═══════════════════════════════════════════════════════════════════
  {
    category: 'bgg',
    priority: 30,
    day_target: 'Day 3',
    platform: 'BGG Guild',
    url: 'https://boardgamegeek.com/guild/create',
    post_title: 'boredgame.lol -- AI Game Recommendations',
    post_body: null,
    notes: 'COST: Free (guild creation costs 10 GeekGold, a virtual currency you get from activity -- essentially free).\n\nACCOUNT: Need a BGG account. Can create a guild right away but GeekGold may take a few days to accumulate if new account.\n\nMAINTENANCE: Low. Post occasional updates to keep the guild alive. No need for daily attention.\n\nPROCESS: Guild creation may need admin approval but is typically fast.\n\nTIP: Name it "boredgame.lol -- AI Game Recommendations". Set description to: "A free AI-powered game recommendation engine. Describe what you want and find your next favorite board game." This becomes a permanent hub for updates.',
    cost_type: 'free',
    cost_amount: null,
    can_post_immediately: 'yes',
    maintenance_level: 'low',
    link_type: 'no_follow',
    approval_process: 'auto_published',
    estimated_reach: 'medium',
    time_to_live: 'immediate',
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
    notes: 'COST: Free.\n\nACCOUNT: Need a BGG account. Can post in forums immediately after signup.\n\nMAINTENANCE: Check back for replies over the first week. BGG forums move slowly -- a thread can get replies days later. Responding shows you care about the community.\n\nRULES: Use BBCode formatting (not Markdown). Keep it informative, not salesy. BGG is friendly to community tools but will push back on anything that feels like advertising.\n\nTIP: The BGG community values depth and specificity. Mention that you use BGG data and are open to feedback on accuracy. This builds trust.',
    cost_type: 'free',
    cost_amount: null,
    can_post_immediately: 'yes',
    maintenance_level: 'moderate',
    link_type: 'no_follow',
    approval_process: 'auto_published',
    estimated_reach: 'medium',
    time_to_live: 'immediate',
  },
  {
    category: 'bgg',
    priority: 32,
    day_target: 'Day 3',
    platform: 'BGG GeekList',
    url: 'https://boardgamegeek.com/geeklist/create',
    post_title: 'Useful Online Tools for Board Gamers',
    post_body: 'A collection of useful online tools for the board gaming community. Add your favorites!\n\n1. boredgame.lol -- AI-powered game recommendation engine. Describe what you want in plain English, get matched with games from 80,000+ titles.',
    notes: 'COST: Free.\n\nACCOUNT: Need a BGG account. Can create GeekLists immediately.\n\nMAINTENANCE: Low. Once created, others can contribute to it. No ongoing effort required.\n\nTIP: Frame as a community resource list, not self-promotion. "Useful Online Tools for Board Gamers" is a collaborative list others can add to. This makes it evergreen and less self-promotional.',
    cost_type: 'free',
    cost_amount: null,
    can_post_immediately: 'yes',
    maintenance_level: 'low',
    link_type: 'no_follow',
    approval_process: 'auto_published',
    estimated_reach: 'medium',
    time_to_live: 'immediate',
  },

  // ═══════════════════════════════════════════════════════════════════
  // Day 4: Product Directories
  // ═══════════════════════════════════════════════════════════════════
  {
    category: 'product-directories',
    priority: 40,
    day_target: 'Day 4',
    platform: 'AlternativeTo',
    url: 'https://alternativeto.net/manage-app/',
    post_title: null,
    post_body: 'boredgame.lol -- AI-powered game recommendation engine. Describe what you want and get matched with board games, video games, word games, and party games from 80,000+ titles. Uses semantic search and multi-layer AI scoring. Free, no sign-up required.',
    notes: 'COST: Free.\n\nACCOUNT: Create a free account. Can submit immediately.\n\nPROCESS: Manual review by their team. Takes 2-7 days depending on review queue. Once approved, listing is permanent.\n\nMAINTENANCE: One-and-done. Listing stays up indefinitely. You can suggest your tool as an alternative to existing apps (BoardGameGeek, Board Game Arena).\n\nTIP: Tags to use: Game Recommendation, Board Games, AI, Free. List as alternative to BoardGameGeek and Board Game Arena. Do-follow link -- good for SEO. Crowd-sourced so community can upvote.',
    cost_type: 'free',
    cost_amount: null,
    can_post_immediately: 'no',
    maintenance_level: 'one_and_done',
    link_type: 'do_follow',
    approval_process: 'manual_review',
    estimated_reach: 'high',
    time_to_live: 'days',
  },
  {
    category: 'product-directories',
    priority: 41,
    day_target: 'Day 4',
    platform: 'BetaList',
    url: 'https://betalist.com/submit',
    post_title: 'boredgame.lol',
    post_body: 'AI-powered game recommendation engine. Tell us what you like, we recommend your next favorite board game, video game, or party game from 80,000+ titles.',
    notes: 'COST: Free tier available but takes 2-4 weeks to be listed. Paid tier ($129) for immediate/priority listing.\n\nACCOUNT: Create account, submit startup with tagline, description, and URL.\n\nPROCESS: Editorial review. Free submissions go into a queue. Paid gets priority.\n\nMAINTENANCE: One-and-done. Listing is permanent.\n\nTIP: Do-follow link. Good for backlink value. If not in a rush, use the free tier. The startup audience is more tech-savvy and may provide quality feedback.',
    cost_type: 'freemium',
    cost_amount: '$129',
    can_post_immediately: 'no',
    maintenance_level: 'one_and_done',
    link_type: 'do_follow',
    approval_process: 'manual_review',
    estimated_reach: 'medium',
    time_to_live: 'weeks',
  },
  {
    category: 'product-directories',
    priority: 42,
    day_target: 'Day 4',
    platform: 'SaaS Hub',
    url: 'https://www.saashub.com/submit',
    post_title: null,
    post_body: 'boredgame.lol -- AI game recommendation engine with 80,000+ board games, video games, word games. Free to use.',
    notes: 'COST: Free basic submission. Paid options exist for featured/promoted placement.\n\nACCOUNT: Create account, submit product.\n\nPROCESS: Quick editorial review, usually approved within a few days.\n\nMAINTENANCE: One-and-done. Can update listing later if needed.\n\nTIP: List alternatives (BGG, Board Game Arena) to help people find you when searching for similar tools. Do-follow link.',
    cost_type: 'free',
    cost_amount: null,
    can_post_immediately: 'no',
    maintenance_level: 'one_and_done',
    link_type: 'do_follow',
    approval_process: 'manual_review',
    estimated_reach: 'medium',
    time_to_live: 'days',
  },

  // ═══════════════════════════════════════════════════════════════════
  // Day 5: High-Reach Reddit
  // ═══════════════════════════════════════════════════════════════════
  {
    category: 'reddit',
    priority: 50,
    day_target: 'Day 5',
    platform: 'r/InternetIsBeautiful',
    url: 'https://www.reddit.com/r/InternetIsBeautiful/submit',
    post_title: 'boredgame.lol -- tell an AI what kind of game you\'re in the mood for and it finds the perfect one',
    post_body: null,
    notes: 'COST: Free.\n\nACCOUNT: Need an established Reddit account with 10+ subreddit karma. Fresh accounts will be flagged. Build karma by commenting genuinely in other subs first.\n\nMAINTENANCE: High in the first 24 hours. If the post gains traction (possible -- 17M members), you\'ll get dozens of comments. Responding to all of them boosts the post in the algorithm. After 48 hours, no ongoing effort.\n\nRULES: Direct link post to https://boredgame.lol (no text body). Must be free, non-commercial, no mandatory sign-up. You qualify. 90:10 rule applies -- 9 genuine contributions for every 1 self-promo across all of Reddit.\n\nTIP: This is the single highest-reach target. A successful post here can get 100k+ views in 48 hours. Post during US peak hours (10 AM - 1 PM ET, Tue-Thu). Title matters more than anything -- make it catchy and descriptive.',
    cost_type: 'free',
    cost_amount: null,
    can_post_immediately: 'needs_karma',
    maintenance_level: 'high',
    link_type: 'no_follow',
    approval_process: 'community_moderated',
    estimated_reach: 'very_high',
    time_to_live: 'immediate',
  },

  // ═══════════════════════════════════════════════════════════════════
  // Days 6-7: Tech Communities
  // ═══════════════════════════════════════════════════════════════════
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
    notes: 'COST: Free.\n\nACCOUNT: Need an HN account. Can post immediately but established accounts get more trust. No minimum karma required for Show HN.\n\nMAINTENANCE: Moderate. Be prepared to answer technical questions for 6-12 hours after posting. The HN audience loves technical depth and will ask about your architecture, scaling, cost, etc. Not responding looks bad.\n\nRULES: Title must start with "Show HN:". URL field = https://boredgame.lol. The post body goes as the FIRST COMMENT, not in the submission. Must be interactive/runnable (not a landing page). No marketing language. No coordinated upvoting.\n\nTIP: Best time: weekday morning 9-11 AM ET (6-8 AM PT). Lead with the technical architecture -- pgvector, HNSW indexes, MMR diversity. HN loves systems-level detail. A good Show HN can get 50k-200k views. Even if it doesn\'t hit front page, Show HN gets its own section with decent traffic.',
    cost_type: 'free',
    cost_amount: null,
    can_post_immediately: 'yes',
    maintenance_level: 'moderate',
    link_type: 'no_follow',
    approval_process: 'auto_published',
    estimated_reach: 'very_high',
    time_to_live: 'immediate',
  },
  {
    category: 'tech-communities',
    priority: 61,
    day_target: 'Day 7',
    platform: 'Product Hunt',
    url: 'https://www.producthunt.com/posts/new',
    post_title: 'boredgame.lol',
    post_body: 'AI recommends your next favorite game in seconds. Tell it what you\'re in the mood for and it matches you with something great from 80,000+ board games, video games, word games, and party games. Uses a 6-layer AI recommendation engine with semantic search, multi-dimensional scoring, and collaborative filtering. Completely free.',
    notes: 'COST: Free to launch.\n\nACCOUNT: Create a Product Hunt account. Can launch immediately.\n\nMAINTENANCE: High on launch day. The "maker comment" (first comment from the creator) is critically important -- 70% of Product of the Day winners include one. You need to respond to comments all day. Voting happens in the first 24 hours and determines ranking.\n\nRULES: Tagline max 60 chars: "AI recommends your next favorite game in seconds". Need square thumbnail (240x240), 2+ gallery images/screenshots, category tags (Gaming, AI, Recommendations), pricing tier selection (Free).\n\nTIP: Launch Tue-Thu at 12:01 AM PST for maximum visibility window. Line up 5-10 friends/colleagues to upvote and leave genuine comments in the first hour. DO NOT ask for upvotes publicly -- PH detects and penalizes this. Write a heartfelt maker comment about why you built it.',
    cost_type: 'free',
    cost_amount: null,
    can_post_immediately: 'yes',
    maintenance_level: 'high',
    link_type: 'no_follow',
    approval_process: 'auto_published',
    estimated_reach: 'very_high',
    time_to_live: 'immediate',
  },

  // ═══════════════════════════════════════════════════════════════════
  // Week 2: Content & Blog Posts
  // ═══════════════════════════════════════════════════════════════════
  {
    category: 'content',
    priority: 70,
    day_target: 'Week 2',
    platform: 'Dev.to',
    url: 'https://dev.to/new',
    post_title: 'How I Built a 6-Layer AI Game Recommendation Engine with Next.js, pgvector, and OpenAI',
    post_body: null,
    notes: 'COST: Free. Optional DEV++ premium for extra features but not needed.\n\nACCOUNT: Create free account. Can publish immediately.\n\nMAINTENANCE: One-and-done. Article stays up permanently. Responding to comments is nice but not required for the article to succeed.\n\nPROCESS: Auto-published. Moderated by community code of conduct (no hate speech, etc). 3.8M+ developer audience.\n\nTIP: Tags: #webdev #ai #nextjs #showdev. Include architecture diagrams, code snippets, and lessons learned. Articles with code snippets get 3x more engagement. Do-follow links in the article body. This is long-term SEO value -- the article will rank for "game recommendation engine" type searches.',
    cost_type: 'free',
    cost_amount: null,
    can_post_immediately: 'yes',
    maintenance_level: 'one_and_done',
    link_type: 'do_follow',
    approval_process: 'auto_published',
    estimated_reach: 'high',
    time_to_live: 'immediate',
  },
  {
    category: 'content',
    priority: 71,
    day_target: 'Week 2',
    platform: 'Hashnode',
    url: 'https://hashnode.com/',
    post_title: 'How I Built a 6-Layer AI Game Recommendation Engine with Next.js, pgvector, and OpenAI',
    post_body: null,
    notes: 'COST: Free.\n\nACCOUNT: Create free account. Can publish immediately.\n\nMAINTENANCE: One-and-done. Cross-post the Dev.to article (Hashnode supports canonical URLs so no duplicate content penalty).\n\nTIP: Hashnode lets you map a custom domain to your blog, and all links are do-follow. The developer community is smaller than Dev.to but more engaged. Set the canonical URL to the Dev.to version if you publish there first.',
    cost_type: 'free',
    cost_amount: null,
    can_post_immediately: 'yes',
    maintenance_level: 'one_and_done',
    link_type: 'do_follow',
    approval_process: 'auto_published',
    estimated_reach: 'medium',
    time_to_live: 'immediate',
  },
  {
    category: 'content',
    priority: 72,
    day_target: 'Week 2',
    platform: 'Indie Hackers',
    url: 'https://www.indiehackers.com/new-post',
    post_title: 'I built boredgame.lol -- an AI game recommendation engine. Here\'s what I learned.',
    post_body: null,
    notes: 'COST: Free.\n\nACCOUNT: Create account. Need to build some credibility first -- comment on a few posts and engage with the community before posting your own content. Low-effort first posts get flagged by moderators.\n\nMAINTENANCE: Moderate. Respond to comments and questions. The IH community values transparency about metrics and decisions.\n\nPROCESS: Merit-based review. Mods check for low-effort content. Having 1-2 genuine comments on other posts first helps.\n\nTIP: Frame as a journey post, not a product launch. Focus on metrics, technical decisions, what worked and what didn\'t. Include screenshots. "Here\'s what I learned" resonates better than "check out my product."',
    cost_type: 'free',
    cost_amount: null,
    can_post_immediately: 'no',
    maintenance_level: 'moderate',
    link_type: 'no_follow',
    approval_process: 'manual_review',
    estimated_reach: 'high',
    time_to_live: 'days',
  },

  // ═══════════════════════════════════════════════════════════════════
  // Week 2: Developer Directories
  // ═══════════════════════════════════════════════════════════════════
  {
    category: 'product-directories',
    priority: 73,
    day_target: 'Week 2',
    platform: 'StackShare',
    url: 'https://stackshare.io/',
    post_title: null,
    post_body: 'Tech stack: Next.js 16, React 19, TypeScript, MUI 7, Supabase (PostgreSQL + pgvector), Redis, OpenAI. Deployed on Vercel.',
    notes: 'COST: Free.\n\nACCOUNT: Create account. Verification requires domain email or GitHub access.\n\nMAINTENANCE: One-and-done. Create a tech stack listing and it stays up permanently.\n\nPROCESS: Auto-published after email/GitHub verification. New tools not already listed may need email approval from the team.\n\nTIP: 500k+ developer profiles. Dev audiences discover tools by browsing stacks. Do-follow link. List the full stack: Next.js 16, React 19, TypeScript, MUI 7, Supabase + pgvector, Redis, OpenAI, Vercel.',
    cost_type: 'free',
    cost_amount: null,
    can_post_immediately: 'needs_approval',
    maintenance_level: 'one_and_done',
    link_type: 'do_follow',
    approval_process: 'auto_published',
    estimated_reach: 'medium',
    time_to_live: 'hours',
  },
  {
    category: 'product-directories',
    priority: 74,
    day_target: 'Week 2',
    platform: 'Awesome RecSys (GitHub)',
    url: 'https://github.com/grahamjenson/list_of_recommender_systems',
    post_title: null,
    post_body: null,
    notes: 'COST: Free.\n\nACCOUNT: Need a GitHub account. Can open a PR immediately.\n\nMAINTENANCE: One-and-done. Once PR is merged, it stays forever.\n\nPROCESS: PR review by repo maintainer. May take days to weeks depending on activity. Keep the PR small and well-formatted.\n\nTIP: Format: "* [boredgame.lol](https://boredgame.lol) - AI-powered game recommendation engine using pgvector semantic search and multi-layer scoring." Add under the Entertainment section. Do-follow link since GitHub renders markdown links.',
    cost_type: 'free',
    cost_amount: null,
    can_post_immediately: 'no',
    maintenance_level: 'one_and_done',
    link_type: 'do_follow',
    approval_process: 'manual_review',
    estimated_reach: 'low',
    time_to_live: 'days',
  },

  // ═══════════════════════════════════════════════════════════════════
  // Ongoing: Organic Reddit Engagement
  // ═══════════════════════════════════════════════════════════════════
  {
    category: 'ongoing',
    priority: 80,
    day_target: 'Ongoing',
    platform: 'r/boardgames (organic engagement)',
    url: 'https://www.reddit.com/r/boardgames/',
    post_title: null,
    post_body: null,
    notes: 'COST: Free.\n\nACCOUNT: Need established Reddit account with karma in this sub. Build karma by commenting on posts first.\n\nMAINTENANCE: High -- this is ongoing organic engagement. Help people in WSIG (What Should I Get) threads. Give genuine, detailed recommendations. Only mention boredgame.lol when it\'s genuinely helpful.\n\nRULES: Self-promotion must be <10% of your Reddit activity. Mods actively enforce this. If all you do is plug your tool, you\'ll get banned. Build genuine participation first.\n\nTIP: This is a long game. Spend 15-20 min a week answering questions. After a few weeks of genuine participation, naturally mention the tool when it\'s relevant. "I also built a tool that does this if you want to try it" is fine. "Check out my site!" is not.',
    cost_type: 'free',
    cost_amount: null,
    can_post_immediately: 'needs_karma',
    maintenance_level: 'high',
    link_type: 'no_follow',
    approval_process: 'auto_published',
    estimated_reach: 'high',
    time_to_live: 'immediate',
  },
  {
    category: 'ongoing',
    priority: 81,
    day_target: 'Ongoing',
    platform: 'r/gamesuggestions',
    url: 'https://www.reddit.com/r/gamesuggestions/',
    post_title: null,
    post_body: null,
    notes: 'COST: Free.\n\nACCOUNT: Need Reddit account. Some karma in the sub helps.\n\nMAINTENANCE: High -- ongoing engagement. Same organic approach as r/boardgames.\n\nTIP: People here literally ask for game suggestions. Answer their questions with real recommendations, then mention the tool. Perfect audience fit.',
    cost_type: 'free',
    cost_amount: null,
    can_post_immediately: 'needs_karma',
    maintenance_level: 'high',
    link_type: 'no_follow',
    approval_process: 'auto_published',
    estimated_reach: 'medium',
    time_to_live: 'immediate',
  },
  {
    category: 'ongoing',
    priority: 82,
    day_target: 'Ongoing',
    platform: 'r/nextjs',
    url: 'https://www.reddit.com/r/nextjs/',
    post_title: null,
    post_body: null,
    notes: 'COST: Free.\n\nACCOUNT: Need Reddit account with some karma.\n\nMAINTENANCE: Moderate -- engage when relevant threads appear. No need for daily attention.\n\nTIP: Frame as technical showcase when relevant. "Built a full AI recommendation engine with Next.js 16 App Router, pgvector, and Redis." Dev communities appreciate technical depth over product pitches.',
    cost_type: 'free',
    cost_amount: null,
    can_post_immediately: 'needs_karma',
    maintenance_level: 'moderate',
    link_type: 'no_follow',
    approval_process: 'auto_published',
    estimated_reach: 'medium',
    time_to_live: 'immediate',
  },
  {
    category: 'ongoing',
    priority: 83,
    day_target: 'Ongoing',
    platform: 'r/webdev (Showoff Saturday)',
    url: 'https://www.reddit.com/r/webdev/',
    post_title: null,
    post_body: null,
    notes: 'COST: Free.\n\nACCOUNT: Need Reddit account with some karma.\n\nMAINTENANCE: Moderate -- only post in weekly Showoff Saturday threads. Check once a week.\n\nRULES: Self-promotion ONLY allowed in the weekly "Showoff Saturday" thread. Posting promos outside that thread will get removed. Focus on the technical build.\n\nTIP: Showoff Saturday posts are specifically for sharing what you built. Include screenshots and tech stack details.',
    cost_type: 'free',
    cost_amount: null,
    can_post_immediately: 'needs_karma',
    maintenance_level: 'moderate',
    link_type: 'no_follow',
    approval_process: 'community_moderated',
    estimated_reach: 'high',
    time_to_live: 'immediate',
  },

  // ═══════════════════════════════════════════════════════════════════
  // Social / Facebook Groups
  // ═══════════════════════════════════════════════════════════════════
  {
    category: 'social',
    priority: 90,
    day_target: 'Week 2',
    platform: 'Board Games (Facebook Group)',
    url: 'https://www.facebook.com/groups/boardgames/',
    post_title: null,
    post_body: 'Hey everyone! I built a free AI tool that recommends board games based on what you describe in plain English. It searches 80,000+ games. Would love your feedback! https://boredgame.lol',
    notes: 'COST: Free.\n\nACCOUNT: Need a Facebook account. May need to join the group and get approved first (can take hours to days).\n\nMAINTENANCE: Moderate -- respond to comments for a few days after posting.\n\nRULES: Group rules vary. Most board game groups allow sharing free tools if framed as "looking for feedback" rather than promotion. Check group rules before posting.\n\nTIP: Keep it casual and genuine. Ask for feedback. Board gamers are opinionated -- use that to your advantage.',
    cost_type: 'free',
    cost_amount: null,
    can_post_immediately: 'yes',
    maintenance_level: 'moderate',
    link_type: 'no_follow',
    approval_process: 'auto_published',
    estimated_reach: 'medium',
    time_to_live: 'immediate',
  },
  {
    category: 'social',
    priority: 91,
    day_target: 'Week 2',
    platform: 'Board Game Recommendations (Facebook Group)',
    url: 'https://www.facebook.com/groups/BoardGameRecommendations/',
    post_title: null,
    post_body: 'Built a free AI recommendation engine for board games (and video/word/party games). Tell it what you\'re in the mood for and it finds matches from 80,000+ titles. https://boredgame.lol',
    notes: 'COST: Free.\n\nACCOUNT: Need Facebook account + group membership.\n\nMAINTENANCE: Moderate -- respond to feedback.\n\nTIP: Perfect target audience -- people who literally want game recommendations. Keep it casual.',
    cost_type: 'free',
    cost_amount: null,
    can_post_immediately: 'yes',
    maintenance_level: 'moderate',
    link_type: 'no_follow',
    approval_process: 'auto_published',
    estimated_reach: 'medium',
    time_to_live: 'immediate',
  },

  // ═══════════════════════════════════════════════════════════════════
  // Lower Priority / When Ready
  // ═══════════════════════════════════════════════════════════════════
  {
    category: 'other',
    priority: 100,
    day_target: 'When Ready',
    platform: 'Bing Webmaster Tools',
    url: 'https://www.bing.com/webmasters/',
    post_title: null,
    post_body: null,
    notes: 'COST: Free.\n\nACCOUNT: Need a Microsoft account. Can submit immediately.\n\nMAINTENANCE: One-and-done. Submit your sitemap URL and Bing handles the rest.\n\nTIP: Takes 5 minutes. Bing feeds results to DuckDuckGo, Yahoo, and ChatGPT search. Worth doing even though Bing has lower direct traffic than Google.',
    cost_type: 'free',
    cost_amount: null,
    can_post_immediately: 'yes',
    maintenance_level: 'one_and_done',
    link_type: 'do_follow',
    approval_process: 'auto_published',
    estimated_reach: 'medium',
    time_to_live: 'immediate',
  },
  {
    category: 'other',
    priority: 101,
    day_target: 'When Ready',
    platform: 'Slant',
    url: 'https://www.slant.co/',
    post_title: null,
    post_body: null,
    notes: 'COST: Free.\n\nACCOUNT: Create account. Can contribute immediately.\n\nMAINTENANCE: High -- Slant is community-driven. You add your tool as an option to comparison questions, but the community can edit, flag, or remove claims that aren\'t backed by evidence. You may need to defend your listing.\n\nPROCESS: Community-moderated. Claims must be backed by objective evidence. Others can add pros/cons.\n\nTIP: Find questions like "What are the best board game recommendation tools?" and add boredgame.lol with specific pros. Do-follow link. Be honest about limitations.',
    cost_type: 'free',
    cost_amount: null,
    can_post_immediately: 'yes',
    maintenance_level: 'high',
    link_type: 'do_follow',
    approval_process: 'community_moderated',
    estimated_reach: 'medium',
    time_to_live: 'immediate',
  },
  {
    category: 'other',
    priority: 102,
    day_target: 'When Ready',
    platform: 'BGG Blog Post',
    url: 'https://boardgamegeek.com/blog/create',
    post_title: 'How AI Can Help You Find Your Next Board Game',
    post_body: null,
    notes: 'COST: Free.\n\nACCOUNT: Need a BGG account. Can create blog posts immediately.\n\nMAINTENANCE: One-and-done. Blog post stays up permanently.\n\nTIP: Write about the approach, not just the product. "How AI Can Help You Find Your Next Board Game" positions it as educational content. BGG users will appreciate technical depth about how the engine works with BGG data.',
    cost_type: 'free',
    cost_amount: null,
    can_post_immediately: 'yes',
    maintenance_level: 'one_and_done',
    link_type: 'no_follow',
    approval_process: 'auto_published',
    estimated_reach: 'medium',
    time_to_live: 'immediate',
  },
  {
    category: 'other',
    priority: 103,
    day_target: 'When Ready',
    platform: 'Shut Up & Sit Down Forum',
    url: 'https://forums.susd.net/',
    post_title: null,
    post_body: null,
    notes: 'COST: Free.\n\nACCOUNT: Create forum account. Can post after signup.\n\nMAINTENANCE: Moderate -- SUSD has an engaged community that will discuss and ask questions. Check back for replies.\n\nTIP: Post in general discussion. SUSD fans are opinionated and knowledgeable about board games. Frame as asking for recommendations on what to test the tool with. They love helping people find games.',
    cost_type: 'free',
    cost_amount: null,
    can_post_immediately: 'yes',
    maintenance_level: 'moderate',
    link_type: 'no_follow',
    approval_process: 'auto_published',
    estimated_reach: 'medium',
    time_to_live: 'immediate',
  },
  {
    category: 'other',
    priority: 104,
    day_target: 'When Ready',
    platform: 'Board Game Discord Servers',
    url: 'https://disboard.org/search?keyword=board+games',
    post_title: null,
    post_body: null,
    notes: 'COST: Free.\n\nACCOUNT: Need Discord account. Must join individual servers and get approved (may take time).\n\nMAINTENANCE: High -- Discord requires ongoing participation. You need to be a genuine community member before self-promoting. Most servers have a #self-promo or #resources channel, but using it without participating elsewhere looks spammy.\n\nTIP: Join 2-3 active board game servers. Participate in discussions for a week or two before sharing your tool. Look for servers with explicit #self-promo channels.',
    cost_type: 'free',
    cost_amount: null,
    can_post_immediately: 'needs_approval',
    maintenance_level: 'high',
    link_type: 'no_follow',
    approval_process: 'community_moderated',
    estimated_reach: 'low',
    time_to_live: 'immediate',
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

/** DELETE /api/admin/outreach/seed -- Wipe all tasks then re-seed with fresh data. */
export async function DELETE() {
  const typedClient = await createTypedClient();
  const { data: { user } } = await typedClient.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = createDbClient();

  // Delete all existing tasks
  const { error: delError } = await supabase
    .from('outreach_tasks')
    .delete()
    .gte('id', 0); // delete all rows

  if (delError) return NextResponse.json({ error: delError.message }, { status: 500 });

  // Re-insert fresh seed data
  const { data, error } = await supabase
    .from('outreach_tasks')
    .insert(SEED_TASKS)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reseeded: data?.length ?? 0 });
}
