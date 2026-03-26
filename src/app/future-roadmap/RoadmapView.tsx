'use client';

import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { motion } from 'motion/react';

// ─── Roadmap Data ────────────────────────────────────────────

type Status = 'done' | 'in-progress' | 'planned' | 'future';

interface RoadmapItem {
  title: string;
  description: string;
  status: Status;
  tags: string[];
}

interface Phase {
  name: string;
  subtitle: string;
  timeframe: string;
  items: RoadmapItem[];
}

const PHASES: Phase[] = [
  {
    name: 'Phase 1: Foundation',
    subtitle: 'Data pipeline, adapters, and database',
    timeframe: 'Completed',
    items: [
      { title: 'Unified Game schema', description: 'Single type that all data sources map to — board games, video games, word games all in one format.', status: 'done', tags: ['Data'] },
      { title: 'BGG Adapter (XML API)', description: 'Full integration with BoardGameGeek XML API2 — Bearer token auth, XML parsing, 202 retry logic, suggested player count polls.', status: 'done', tags: ['API'] },
      { title: 'RAWG Adapter (Video Games)', description: '80k+ video games from RAWG API with metacritic, ESRB, platforms, genres, screenshots.', status: 'done', tags: ['API'] },
      { title: 'Word & Party Games Dataset', description: '47 curated word and party games including 27 "no equipment needed" games like Charades, Mafia, 20 Questions.', status: 'done', tags: ['Data'] },
      { title: 'Supabase Database + Schema', description: 'PostgreSQL with pgvector extension, RLS policies, indexes, full-text search, and vector similarity.', status: 'done', tags: ['Infrastructure'] },
      { title: 'BGG Kaggle Import (22k games)', description: 'Bulk import from Kaggle dataset with mechanics, themes, categories, designers, publishers.', status: 'done', tags: ['Data'] },
      { title: 'BGG Live API Crawler', description: 'Scanning 400k BGG IDs to replace Kaggle data with real descriptions, ratings, and full metadata from the live API.', status: 'in-progress', tags: ['Data', 'API'] },
      { title: 'RAWG Crawler (80k+ games)', description: 'Automated pagination with exponential backoff, detail backfills for descriptions and extended metadata.', status: 'done', tags: ['Data'] },
    ],
  },
  {
    name: 'Phase 2: Auth & User System',
    subtitle: 'Accounts, profiles, and preferences',
    timeframe: 'Completed',
    items: [
      { title: 'Supabase Auth (Email/Password)', description: 'Signup, login, session refresh proxy, cookie-based auth.', status: 'done', tags: ['Auth'] },
      { title: 'Profile Hub', description: 'Stats dashboard, favorites, reviews, saved presets — all in one tabbed view.', status: 'done', tags: ['UI'] },
      { title: 'Saved Preference Presets', description: 'Name and save questionnaire preferences for quick re-use without answering all questions again.', status: 'done', tags: ['Feature'] },
      { title: 'User Reviews & Ratings', description: '1-10 rating + text review per game. Reviews are publicly readable, own-write.', status: 'done', tags: ['Feature'] },
      { title: 'Favorites / Game Library', description: 'Bookmark games to a personal library with one-click add/remove.', status: 'done', tags: ['Feature'] },
      { title: 'Recommendation Settings', description: 'Popularity mode (popular/any/hidden gems), minimum rating, source toggles.', status: 'done', tags: ['Feature'] },
      { title: 'Google OAuth', description: 'One-click Google login via Supabase + Google Cloud OAuth 2.0. PKCE flow with cookie-based code verifier for SSR compatibility.', status: 'done', tags: ['Auth'] },
      { title: 'Guest Mode', description: 'LocalStorage preferences auto-saved on questionnaire submit, restored on next visit. Signup prompt after 3 recommendations. Guest favorites (limited to 5).', status: 'done', tags: ['Feature'] },
    ],
  },
  {
    name: 'Phase 3: Questionnaire & UI',
    subtitle: 'Interactive preference collection and results',
    timeframe: 'Completed',
    items: [
      { title: '7-Step Questionnaire Flow', description: 'Game type → player count → time → complexity → genres → mood → free text, with slide transitions between steps.', status: 'done', tags: ['UI'] },
      { title: 'Multi-Select Game Types & Time', description: 'Select multiple game types (board + video) and time ranges simultaneously.', status: 'done', tags: ['UI'] },
      { title: 'Free Text Keyword Matching', description: 'Type "I like roguelike games" and the engine extracts keywords to boost matching games. Handles multi-word terms like "deck building" and "social deduction."', status: 'done', tags: ['Recommendation'] },
      { title: 'Results Page with "Why" Reasons', description: 'Each recommended game shows reason chips explaining why it was picked.', status: 'done', tags: ['UI'] },
      { title: 'Quick Collections on Landing Page', description: 'Date Night, Quick Play, Party Night, Strategy Deep Dive — one-click preset recommendations.', status: 'done', tags: ['UI'] },
      { title: 'Browse Page with Filters', description: 'Full game catalog with source, type, and tag filters + server-side pagination.', status: 'done', tags: ['UI'] },
      { title: 'Game Detail Pages', description: 'Full game info, similar games section, review form, favorite button.', status: 'done', tags: ['UI'] },
      { title: 'LLM-Powered Free Text Parsing', description: 'GPT-4o-mini extracts structured preferences from natural language. Two-tier cache (memory + Supabase) with fuzzy matching. DB enrichment for "similarTo" games fills player count, complexity, time, genres from actual game data. Smart questionnaire filtering hides irrelevant options.', status: 'done', tags: ['AI', 'Recommendation'] },
    ],
  },
  {
    name: 'Phase 4: Recommendation Engine',
    subtitle: 'Multi-layer scoring, embeddings, and learning',
    timeframe: 'In Progress',
    items: [
      { title: 'Layer 1: Rule-Based Scoring', description: '9 weighted dimensions: type, players, time, complexity, genre, mood, free text, quality, popularity. Soft preferences with fallback — never returns zero results.', status: 'done', tags: ['Recommendation'] },
      { title: 'Layer 2: Content-Based Filtering (pgvector)', description: '768-dim embeddings for every game based on categories, mechanics, themes, complexity, player count. Cosine similarity via HNSW index. 26.5k embeddings generated.', status: 'done', tags: ['ML', 'Recommendation'] },
      { title: 'Layer 3: Collaborative Filtering', description: 'Item-based and user-based collaborative filtering. "Users who liked Catan also liked Ticket to Ride." Activates when enough reviews exist.', status: 'done', tags: ['ML', 'Recommendation'] },
      { title: 'Layer 4: Feedback Loop', description: 'Reviews and favorites update the user\'s preference vector in real-time. The system learns what you like with each interaction.', status: 'done', tags: ['ML', 'Recommendation'] },
      { title: 'Hybrid Engine', description: 'Combines rule-based scoring (60%) + content similarity (40%) with automatic fallback. Upgrades to collaborative filtering when data is sufficient.', status: 'done', tags: ['Recommendation'] },
      { title: 'pgvector Primary Retrieval', description: 'Use pgvector similarity search as the primary candidate source instead of "top N by rating." Query "500 games closest to this preference vector" for much better niche game discovery. Hybrid retrieval: 250 by rating + 250 by vector similarity.', status: 'planned', tags: ['ML', 'Recommendation'] },
      { title: 'Review-Weighted Similarity', description: 'Weight recommendations from users with similar preference profiles higher. A strategy gamer\'s review matters more to another strategy gamer.', status: 'planned', tags: ['ML', 'Recommendation'] },
    ],
  },
  {
    name: 'Phase 5: Polish & Delight',
    subtitle: 'Animations, design, and user experience',
    timeframe: 'In Progress',
    items: [
      { title: 'Game Night Glow Color Theme', description: 'Indigo + Coral + Teal + Amber palette applied across all components with MUI theme tokens.', status: 'done', tags: ['Design'] },
      { title: 'Animated Landing Page', description: 'Motion-powered hero with parallax scroll, stagger reveals, floating dice decorations, and animated stat counters.', status: 'done', tags: ['UI', 'Animation'] },
      { title: '3D D20 Dice Roller', description: 'Physics-correct rigid body rotation with quaternion integration, precession for multi-axis tumble, parabolic bounce arcs. Natural 20 = confetti. Natural 1 = blood drips + screen shake.', status: 'done', tags: ['3D', 'Animation'] },
      { title: 'Loading Skeletons', description: 'Skeleton cards during game loading for perceived performance.', status: 'done', tags: ['UI'] },
      { title: 'Full Color Theme Overhaul', description: 'More playful, colorful, game-night-inspired palette.', status: 'planned', tags: ['Design'] },
      { title: 'Navigation Improvements', description: 'More intuitive nav with microanimations and better mobile experience.', status: 'planned', tags: ['UI'] },
      { title: 'Iconography & Less Text', description: 'Replace text-heavy sections with game-themed icons and visual elements.', status: 'planned', tags: ['Design'] },
      { title: 'Responsive Polish', description: 'Mobile-first refinements on game detail, browse, and profile pages.', status: 'planned', tags: ['UI'] },
    ],
  },
  {
    name: 'Phase 6: Growth & Monetization',
    subtitle: 'Hosting, marketing, and revenue',
    timeframe: 'Planned',
    items: [
      { title: 'Vercel Deployment + CI/CD', description: 'Production deployment with auto-deploy from main branch.', status: 'done', tags: ['Infrastructure'] },
      { title: 'Custom Domain', description: 'Connect Squarespace domain to Vercel deployment.', status: 'planned', tags: ['Infrastructure'] },
      { title: 'Shareability & Social Cards', description: '"Share my recommendations" links with Open Graph previews for social media.', status: 'planned', tags: ['Feature', 'Growth'] },
      { title: 'AI-Generated Blog / Game News', description: 'SEO-driven game recommendation articles, new releases coverage, "Best games for..." guides.', status: 'planned', tags: ['Content', 'Growth'] },
      { title: 'Google Ads Integration', description: 'Tasteful ad placements for revenue generation.', status: 'planned', tags: ['Revenue'] },
      { title: 'Email Validation', description: 'Verify email addresses before allowing full account features.', status: 'planned', tags: ['Auth'] },
      { title: 'Marketing Plan', description: 'SEO, Reddit presence, BGG forum promotion, social media strategy.', status: 'planned', tags: ['Growth'] },
      { title: 'Help Desk / Bug Reporting', description: 'GitHub Issues integration or embedded feedback widget.', status: 'planned', tags: ['Support'] },
    ],
  },
  {
    name: 'Phase 7: Advanced Intelligence',
    subtitle: 'LLM integration and smart features',
    timeframe: 'Future',
    items: [
      { title: 'LLM Free Text Parser', description: 'GPT-4o-mini parsing with DB enrichment, two-tier fuzzy cache, and smart questionnaire pre-fill. Completed in Phase 3.', status: 'done', tags: ['AI'] },
      { title: 'Advanced LLM Intelligence', description: 'Multi-turn refinement ("too complex, show me simpler ones"), mood/tone detection from phrasing, cross-referencing user review history to personalize LLM extraction, smarter "similarTo" that chains through related games (Catan → Settlers → resource games), and LLM-generated "why you\'ll love this" descriptions per recommendation.', status: 'future', tags: ['AI', 'Recommendation'] },
      { title: 'Conversational Recommendations', description: 'Chat-style interface where users describe what they want and get iterative, conversational recommendations.', status: 'future', tags: ['AI', 'UI'] },
      { title: 'Game Group Matching', description: 'Multiple users input preferences, engine finds games everyone will enjoy. "Find a game for our group."', status: 'future', tags: ['Feature', 'AI'] },
      { title: 'Trending / Seasonal Recommendations', description: 'Surface games trending this week, seasonal picks (Halloween horror games, holiday party games).', status: 'future', tags: ['Feature'] },
      { title: 'Better Video Game Data Source', description: 'RAWG is missing key data (tags, descriptions) for many games. Evaluate IGDB (Twitch-backed, richer metadata), Steam API (store descriptions, user tags, reviews), or GiantBomb. "A modern metroidvania about bugs" should find Hollow Knight.', status: 'planned', tags: ['API', 'Data'] },
      { title: 'Import BGG / Steam Library', description: 'Connect your BGG or Steam account to auto-populate preferences from games you already own and rate.', status: 'future', tags: ['Feature', 'API'] },
      { title: 'Caching Layer (Redis)', description: 'Upstash Redis for sub-100ms cached responses on popular queries.', status: 'future', tags: ['Infrastructure'] },
      { title: 'Tech Stack Diagram', description: 'Visual architecture diagram showing how all the pieces connect.', status: 'future', tags: ['Documentation'] },
      { title: 'FAQ / Tutorial Page', description: 'Onboarding guide and frequently asked questions.', status: 'future', tags: ['Documentation'] },
    ],
  },
];

// ─── Status Config ───────────────────────────────────────────

const STATUS_CONFIG: Record<Status, { label: string; color: string; bgColor: string }> = {
  'done': { label: 'Done', color: '#00C853', bgColor: 'rgba(0, 200, 83, 0.1)' },
  'in-progress': { label: 'In Progress', color: '#FF9100', bgColor: 'rgba(255, 145, 0, 0.1)' },
  'planned': { label: 'Planned', color: '#448AFF', bgColor: 'rgba(68, 138, 255, 0.1)' },
  'future': { label: 'Future', color: '#B388FF', bgColor: 'rgba(179, 136, 255, 0.1)' },
};

// ─── Components ──────────────────────────────────────────────

/** Cycle order when clicking the status badge */
const STATUS_CYCLE: Status[] = ['future', 'planned', 'in-progress', 'done'];

function StatusBadge({ status, onClick }: { status: Status; onClick?: () => void }) {
  const config = STATUS_CONFIG[status];
  return (
    <Chip
      label={config.label}
      size="small"
      onClick={onClick}
      sx={{
        cursor: onClick ? 'pointer' : 'default',
        fontWeight: 700,
        fontSize: '0.7rem',
        height: 22,
        color: config.color,
        bgcolor: config.bgColor,
        border: `1px solid ${config.color}30`,
      }}
    />
  );
}

function RoadmapCard({ item, index, onStatusChange }: { item: RoadmapItem; index: number; onStatusChange: (title: string, newStatus: Status) => void }) {
  const config = STATUS_CONFIG[item.status];

  function cycleStatus() {
    const currentIdx = STATUS_CYCLE.indexOf(item.status);
    const nextStatus = STATUS_CYCLE[(currentIdx + 1) % STATUS_CYCLE.length];
    onStatusChange(item.title, nextStatus);
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03, duration: 0.3 }}
    >
      <Box
        sx={{
          p: 2,
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          borderLeft: `4px solid ${config.color}`,
          bgcolor: item.status === 'done' ? 'rgba(0,200,83,0.03)' : 'background.paper',
          transition: 'all 200ms',
          '&:hover': { boxShadow: 2, transform: 'translateX(4px)' },
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1, mb: 0.5 }}>
          <Typography variant="subtitle2" fontWeight={700} sx={{ flex: 1 }}>
            {item.status === 'done' ? '✓ ' : ''}{item.title}
          </Typography>
          <StatusBadge status={item.status} onClick={cycleStatus} />
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1, lineHeight: 1.5 }}>
          {item.description}
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {item.tags.map((tag) => (
            <Chip
              key={tag}
              label={tag}
              size="small"
              variant="outlined"
              sx={{ height: 20, fontSize: '0.65rem', color: 'text.secondary' }}
            />
          ))}
        </Box>
      </Box>
    </motion.div>
  );
}

function PhaseSection({ phase, phaseIndex, onStatusChange }: { phase: Phase; phaseIndex: number; onStatusChange: (title: string, newStatus: Status) => void }) {
  const doneCount = phase.items.filter((i) => i.status === 'done').length;
  const totalCount = phase.items.length;
  const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: phaseIndex * 0.1, duration: 0.4 }}
    >
      <Box sx={{ mb: 5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 0.5 }}>
          <Typography variant="h5" fontWeight={800}>
            {phase.name}
          </Typography>
          <Typography variant="body2" color="text.secondary" fontWeight={600}>
            {phase.timeframe}
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {phase.subtitle}
        </Typography>

        {/* Progress bar */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <Box sx={{ flex: 1, height: 6, borderRadius: 3, bgcolor: 'divider', overflow: 'hidden' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ delay: phaseIndex * 0.1 + 0.3, duration: 0.6, ease: 'easeOut' }}
              style={{
                height: '100%',
                borderRadius: 3,
                background: progress === 100
                  ? 'linear-gradient(90deg, #00C853, #69F0AE)'
                  : 'linear-gradient(90deg, #448AFF, #82B1FF)',
              }}
            />
          </Box>
          <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ minWidth: 40 }}>
            {progress}%
          </Typography>
        </Box>

        <Stack spacing={1.5}>
          {phase.items.map((item, i) => (
            <RoadmapCard key={item.title} item={item} index={i} onStatusChange={onStatusChange} />
          ))}
        </Stack>
      </Box>
    </motion.div>
  );
}

// ─── Main View ───────────────────────────────────────────────

type StatusFilter = 'all' | Status;

/** Key for localStorage status overrides */
const OVERRIDES_KEY = 'rag_roadmap_overrides';

function loadOverrides(): Record<string, Status> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(OVERRIDES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveOverrides(overrides: Record<string, Status>): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides));
  // Also persist to server file so Claude can read it
  fetch('/api/roadmap-overrides', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(overrides),
  }).catch(() => {}); // Best-effort, don't block UI
}

/** Apply overrides to phases data */
function applyOverrides(phases: Phase[], overrides: Record<string, Status>): Phase[] {
  if (Object.keys(overrides).length === 0) return phases;
  return phases.map((phase) => ({
    ...phase,
    items: phase.items.map((item) => ({
      ...item,
      status: overrides[item.title] ?? item.status,
    })),
  }));
}

export default function RoadmapView() {
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [overrides, setOverrides] = useState<Record<string, Status>>({});

  // Load overrides from localStorage on mount
  useEffect(() => {
    setOverrides(loadOverrides());
  }, []);

  function handleStatusChange(title: string, newStatus: Status) {
    const updated = { ...overrides };
    // Find the original status from PHASES
    const original = PHASES.flatMap((p) => p.items).find((i) => i.title === title);
    if (original && original.status === newStatus) {
      // Status matches original — remove the override
      delete updated[title];
    } else {
      updated[title] = newStatus;
    }
    setOverrides(updated);
    saveOverrides(updated);
  }

  // Apply overrides to get effective phases
  const effectivePhases = applyOverrides(PHASES, overrides);

  const totalItems = effectivePhases.reduce((sum, p) => sum + p.items.length, 0);
  const doneItems = effectivePhases.reduce((sum, p) => sum + p.items.filter((i) => i.status === 'done').length, 0);
  const inProgressItems = effectivePhases.reduce((sum, p) => sum + p.items.filter((i) => i.status === 'in-progress').length, 0);
  const plannedItems = effectivePhases.reduce((sum, p) => sum + p.items.filter((i) => i.status === 'planned').length, 0);
  const futureItems = effectivePhases.reduce((sum, p) => sum + p.items.filter((i) => i.status === 'future').length, 0);

  const filterButtons: { key: StatusFilter; label: string; value: number; color: string }[] = [
    { key: 'all', label: 'All Tasks', value: totalItems, color: 'text.primary' },
    { key: 'done', label: 'Completed', value: doneItems, color: '#00C853' },
    { key: 'in-progress', label: 'In Progress', value: inProgressItems, color: '#FF9100' },
    { key: 'planned', label: 'Planned', value: plannedItems, color: '#448AFF' },
    { key: 'future', label: 'Future', value: futureItems, color: '#B388FF' },
  ];

  // Filter phases — only show phases that have matching items
  const filteredPhases = filter === 'all'
    ? effectivePhases
    : effectivePhases.map((phase) => ({
        ...phase,
        items: phase.items.filter((item) => item.status === filter),
      })).filter((phase) => phase.items.length > 0);

  return (
    <Box>
      <Typography variant="h3" fontWeight={900} sx={{ mb: 1 }}>
        Roadmap
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        The full plan for Recommend a Game — what&apos;s done, what&apos;s in progress, and what&apos;s coming.
      </Typography>

      {/* Clickable filter stats */}
      <Box sx={{ display: 'flex', gap: 2, mb: 4, flexWrap: 'wrap' }}>
        {filterButtons.map((btn) => (
          <Box
            key={btn.key}
            onClick={() => setFilter(filter === btn.key ? 'all' : btn.key)}
            sx={{
              textAlign: 'center',
              cursor: 'pointer',
              px: 2,
              py: 1.5,
              borderRadius: 2,
              border: '2px solid',
              borderColor: filter === btn.key ? btn.color : 'transparent',
              bgcolor: filter === btn.key ? `${btn.color}10` : 'transparent',
              transition: 'all 200ms',
              '&:hover': {
                bgcolor: `${btn.color}08`,
                transform: 'translateY(-2px)',
              },
            }}
          >
            <Typography variant="h4" fontWeight={900} sx={{ color: btn.color }}>
              {btn.value}
            </Typography>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              {btn.label}
            </Typography>
          </Box>
        ))}
      </Box>

      {filter !== 'all' && (
        <Chip
          label={`Showing: ${filterButtons.find((b) => b.key === filter)?.label} — click again to clear`}
          onDelete={() => setFilter('all')}
          sx={{ mb: 3 }}
        />
      )}

      <Divider sx={{ mb: 4 }} />

      {filteredPhases.map((phase, i) => (
        <PhaseSection key={phase.name} phase={phase} phaseIndex={i} onStatusChange={handleStatusChange} />
      ))}

      {Object.keys(overrides).length > 0 && (
        <Box sx={{ mt: 2, mb: 4, textAlign: 'center' }}>
          <Chip
            label={`${Object.keys(overrides).length} status override${Object.keys(overrides).length > 1 ? 's' : ''} — click to reset all`}
            onDelete={() => {
              setOverrides({});
              saveOverrides({});
            }}
            color="warning"
            size="small"
            variant="outlined"
          />
        </Box>
      )}

      <Divider sx={{ my: 4 }} />
      <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ fontStyle: 'italic' }}>
        Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
      </Typography>
    </Box>
  );
}
