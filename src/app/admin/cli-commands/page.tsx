'use client';

import { useState, useCallback } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Tooltip from '@mui/material/Tooltip';
import Fade from '@mui/material/Fade';
import { useTheme, alpha } from '@mui/material/styles';
import {
  Copy,
  Check,
  Search as SearchIcon,
  Terminal,
  Database,
  CloudDownload,
  FlaskConical,
  Paintbrush,
  RefreshCw,
  FileText,
  Waypoints,
  BarChart3,
  Users,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Command {
  name: string;
  description: string;
  command: string;
  category: Category;
  dangerous?: boolean;
}

type Category =
  | 'cache'
  | 'blog'
  | 'data-ingestion'
  | 'embeddings'
  | 'evals'
  | 'seed-data'
  | 'enrichment'
  | 'map'
  | 'analysis';

const CATEGORY_META: Record<Category, { label: string; icon: React.ReactNode }> = {
  cache:           { label: 'Cache',           icon: <RefreshCw size={16} /> },
  blog:            { label: 'Blog',            icon: <FileText size={16} /> },
  'data-ingestion':{ label: 'Data Ingestion',  icon: <CloudDownload size={16} /> },
  embeddings:      { label: 'Embeddings',      icon: <Waypoints size={16} /> },
  evals:           { label: 'Evals',           icon: <FlaskConical size={16} /> },
  'seed-data':     { label: 'Seed Data',       icon: <Users size={16} /> },
  enrichment:      { label: 'Enrichment',      icon: <Paintbrush size={16} /> },
  map:             { label: 'Map / Viz',        icon: <Database size={16} /> },
  analysis:        { label: 'Analysis',        icon: <BarChart3 size={16} /> },
};

/* ------------------------------------------------------------------ */
/*  Command registry                                                   */
/* ------------------------------------------------------------------ */

const COMMANDS: Command[] = [
  // ── Cache ──
  {
    name: 'Bust LLM Cache',
    description: 'Flush the LLM parse cache from Supabase and in-memory. Use after changing parse prompts or models.',
    command: 'npx tsx scripts/bust-llm-cache.ts',
    category: 'cache',
  },
  {
    name: 'Bust Redis Cache',
    description: 'Flush all recommendation caches from Redis (all rec:* keys). In-memory caches clear on dev server restart.',
    command: 'npx tsx scripts/bust-redis-cache.ts',
    category: 'cache',
  },
  {
    name: 'Populate Popularity Cache',
    description: 'Pre-compute and populate Redis with popularity-ranked game lists. Run daily or after major data changes.',
    command: 'npx tsx scripts/populate-popularity-cache.ts',
    category: 'cache',
  },

  // ── Blog ──
  {
    name: 'Generate Blog Post',
    description: 'Trigger the full 8-stage blog pipeline manually (topic pick, game fetch, Claude Sonnet draft, fact-check, edit, images, quality eval).',
    command: 'curl "http://localhost:1337/api/blog/generate?slot=0" -H "Authorization: Bearer $CRON_SECRET"',
    category: 'blog',
  },
  {
    name: 'Seed Blog Posts',
    description: 'Insert 15 high-quality, fact-checked seed blog posts targeting high-volume search queries.',
    command: 'npx tsx scripts/seed-blog-posts.ts',
    category: 'blog',
  },
  {
    name: 'Restore Deleted Blog Posts',
    description: 'Recreate 10 previously deleted blog posts with original slugs and publish dates.',
    command: 'npx tsx scripts/restore-blog-posts.ts',
    category: 'blog',
  },
  {
    name: 'Cleanup Seed Blog Posts',
    description: 'Remove all seeded blog posts from the database.',
    command: 'npx tsx scripts/seed-blog-posts.ts --cleanup',
    category: 'blog',
    dangerous: true,
  },

  // ── Data Ingestion ──
  {
    name: 'Crawl BGG (XML API)',
    description: 'Fetch board games from BoardGameGeek XML API2. Batches 20 IDs per request with 6s throttling. Long-running.',
    command: 'npx tsx scripts/crawl-bgg-api.ts',
    category: 'data-ingestion',
  },
  {
    name: 'Crawl BGG (Legacy)',
    description: 'Older BGG crawler. Fetches board games by ID range with 5-6s rate limiting.',
    command: 'npx tsx scripts/crawl-bgg.ts',
    category: 'data-ingestion',
  },
  {
    name: 'Import BGG Kaggle Dataset',
    description: 'Import 22k board games from Kaggle CSV files (games.csv, mechanics.csv, themes.csv, etc.).',
    command: 'npx tsx scripts/import-bgg-kaggle.ts',
    category: 'data-ingestion',
  },
  {
    name: 'Crawl RAWG',
    description: 'Populate Supabase with video games from RAWG API. Default 2000 pages (~80k games). Long-running.',
    command: 'npx tsx scripts/crawl-rawg.ts',
    category: 'data-ingestion',
  },
  {
    name: 'Backfill RAWG Details',
    description: 'Add descriptions, developers, and publishers to RAWG games missing that data. Auto-resumes.',
    command: 'npx tsx scripts/backfill-rawg-details.ts',
    category: 'data-ingestion',
  },
  {
    name: 'Crawl IGDB',
    description: 'Fetch video games from IGDB (richer metadata than RAWG with genres, themes, keywords).',
    command: 'npx tsx scripts/crawl-igdb.ts',
    category: 'data-ingestion',
  },
  {
    name: 'Deduplicate RAWG/IGDB',
    description: 'Find games in both RAWG and IGDB, keep IGDB version, migrate user data. Dry run by default.',
    command: 'npx tsx scripts/dedupe-rawg-igdb.ts',
    category: 'data-ingestion',
  },
  {
    name: 'Deduplicate RAWG/IGDB (Apply)',
    description: 'Actually delete RAWG duplicates after reviewing dry run output.',
    command: 'npx tsx scripts/dedupe-rawg-igdb.ts --apply',
    category: 'data-ingestion',
    dangerous: true,
  },
  {
    name: 'Fix Gibberish Descriptions',
    description: 'Re-fetch ~7k games with lemmatized descriptions from Kaggle import via BGG XML API. ~30 min runtime.',
    command: 'npx tsx scripts/fix-gibberish-descriptions.ts',
    category: 'data-ingestion',
  },

  // ── Embeddings ──
  {
    name: 'Generate Semantic Embeddings',
    description: 'Generate OpenAI text-embedding-3-small vectors (1536-dim) for all games. ~$0.40 for 100k games. Resumable.',
    command: 'npx tsx scripts/generate-semantic-embeddings.ts',
    category: 'embeddings',
  },
  {
    name: 'Generate Attribute Embeddings',
    description: 'Generate 768-dim attribute-based embeddings using custom encoder. Safe to re-run (upsert).',
    command: 'npx tsx scripts/generate-embeddings.ts',
    category: 'embeddings',
  },
  {
    name: 'Generate Tag Embeddings',
    description: 'Pre-compute embeddings for all unique categories, mechanics, and themes. Output: scripts/tag-embeddings.json. ~$0.001.',
    command: 'npx tsx scripts/generate-tag-embeddings.ts',
    category: 'embeddings',
  },
  {
    name: 'Check Embedding Health',
    description: 'Diagnostic: compare game counts vs embedding counts, check data quality and coverage.',
    command: 'npx tsx scripts/check-embeddings.ts',
    category: 'embeddings',
  },

  // ── Evals ──
  {
    name: 'Run Evals',
    description: 'Run the full eval suite with LLM judge scoring. Requires dev server running.',
    command: 'npm run eval',
    category: 'evals',
  },
  {
    name: 'Run Evals (Quick)',
    description: 'Fast eval run without LLM judge. Good for iterating on scoring changes.',
    command: 'npm run eval:quick',
    category: 'evals',
  },
  {
    name: 'Run Evals (Full, 8x Concurrency)',
    description: 'Full eval suite with max parallelism. Use for final regression checks.',
    command: 'npm run eval:full',
    category: 'evals',
  },
  {
    name: 'Run Golden Evals',
    description: 'Run golden dataset with graded relevance. Computes NDCG@10, MAP@10, MRR, ILD, Novelty, Coverage.',
    command: 'npx tsx scripts/run-golden-evals.ts',
    category: 'evals',
  },
  {
    name: 'Run Golden Evals (Baseline)',
    description: 'Run golden evals against popularity baseline for comparison.',
    command: 'npx tsx scripts/run-golden-evals.ts --baseline=popularity',
    category: 'evals',
  },
  {
    name: 'Compare Eval Runs',
    description: 'Compare two eval runs side-by-side to see regressions and improvements.',
    command: 'npm run eval:compare',
    category: 'evals',
  },
  {
    name: 'Eval Summary',
    description: 'Show summary of the most recent eval run.',
    command: 'npm run eval:summary',
    category: 'evals',
  },
  {
    name: 'Eval History',
    description: 'Show summary of all eval runs over time.',
    command: 'npm run eval:history',
    category: 'evals',
  },
  {
    name: 'Analyze Eval Failures',
    description: 'Deep-dive into failing eval cases with detailed breakdown.',
    command: 'npm run eval:analyze',
    category: 'evals',
  },
  {
    name: 'Generate Eval Cases',
    description: 'Generate diverse eval test cases via LLM covering typos, ESL, every mechanic/theme/player count.',
    command: 'npm run eval:generate',
    category: 'evals',
  },
  {
    name: 'Generate Massive Eval Cases',
    description: 'Generate 1000+ eval cases for comprehensive coverage.',
    command: 'npm run eval:generate-massive',
    category: 'evals',
  },
  {
    name: 'Expand Eval Cases',
    description: 'Generate additional eval cases to fill coverage gaps.',
    command: 'npm run eval:expand',
    category: 'evals',
  },
  {
    name: 'Validate Eval Cases',
    description: 'Check that every game referenced in eval-cases.json actually exists in the database.',
    command: 'source .env.local && npx tsx scripts/validate-eval-cases.ts',
    category: 'evals',
  },
  {
    name: 'Annotate Eval Cases',
    description: 'Run golden evals and output annotation-worksheet.json for human graded relevance scoring (0-3).',
    command: 'source .env.local && npx tsx scripts/annotate-eval.ts',
    category: 'evals',
  },

  // ── Seed Data ──
  {
    name: 'Seed Test Users',
    description: 'Create test users (test_123_* emails) with favorites, reviews, and presets for development.',
    command: 'npx tsx scripts/seed-test-data.ts',
    category: 'seed-data',
  },
  {
    name: 'Cleanup Test Users',
    description: 'Remove all seeded test users and their data.',
    command: 'npx tsx scripts/seed-test-data.ts --cleanup',
    category: 'seed-data',
    dangerous: true,
  },
  {
    name: 'Seed Collaborative Data',
    description: 'Create synthetic users representing board game taste archetypes (20-40 ratings each) for collaborative filtering.',
    command: 'npx tsx scripts/seed-collaborative-data.ts',
    category: 'seed-data',
  },

  // ── Enrichment ──
  {
    name: 'Enrich Game Metadata',
    description: 'LLM-powered enrichment: mood tags, refined mechanics, audience keywords, "similar to" refs. ~$5-10 for 81k games, ~1-2 hours.',
    command: 'npx tsx scripts/enrich-game-metadata.ts',
    category: 'enrichment',
  },
  {
    name: 'Train BPR Model',
    description: 'Train Bayesian Personalized Ranking model from user feedback and store in Redis. Designed for nightly cron.',
    command: 'npx tsx scripts/train-bpr.ts',
    category: 'enrichment',
  },

  // ── Map / Viz ──
  {
    name: 'Compute Map Positions',
    description: 'UMAP dimensionality reduction + k-means clustering for game map. Requires Python + umap-learn, scikit-learn, numpy.',
    command: 'python3 scripts/compute-map-positions.py',
    category: 'map',
  },
  {
    name: 'Compute Map Hierarchy',
    description: 'Build 4-level hierarchical clustering on top of UMAP positions. Uses GPT-4o-mini for cluster names.',
    command: 'python3 scripts/compute-map-hierarchy.py',
    category: 'map',
  },
  {
    name: 'Export Map Data',
    description: 'Export hierarchical map tree to static JSON (public/data/map-tree.json, map-nodes.json) for client.',
    command: 'npx tsx scripts/export-map-data.ts',
    category: 'map',
  },

  // ── Analysis ──
  {
    name: 'Analyze A/B Experiments',
    description: 'Compute per-group metrics from Supabase experiments: latency, feedback rate, return rate, diversity.',
    command: 'npx tsx scripts/analyze-experiments.ts',
    category: 'analysis',
  },
  {
    name: 'Publish to HackMD',
    description: 'Push technical review packet to HackMD as a public, commentable note. Requires HACKMD_API_KEY.',
    command: 'npx tsx scripts/publish-to-hackmd.ts',
    category: 'analysis',
  },
];

/* ------------------------------------------------------------------ */
/*  Copy button                                                        */
/* ------------------------------------------------------------------ */

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const theme = useTheme();

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <Tooltip title={copied ? 'Copied!' : 'Copy command'} placement="top">
      <IconButton
        onClick={handleCopy}
        size="small"
        sx={{
          color: copied ? 'success.main' : theme.palette.text.secondary,
          bgcolor: copied ? alpha(theme.palette.success.main, 0.12) : 'transparent',
          transition: 'all 200ms ease',
          '&:hover': {
            bgcolor: copied
              ? alpha(theme.palette.success.main, 0.18)
              : alpha(theme.palette.primary.main, 0.1),
          },
        }}
      >
        <Fade in={copied} timeout={200}>
          <Box sx={{ position: 'absolute', display: 'flex' }}>
            <Check size={16} />
          </Box>
        </Fade>
        <Fade in={!copied} timeout={200}>
          <Box sx={{ position: 'absolute', display: 'flex' }}>
            <Copy size={16} />
          </Box>
        </Fade>
      </IconButton>
    </Tooltip>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function CliCommandsPage() {
  const theme = useTheme();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);

  const filtered = COMMANDS.filter((cmd) => {
    const matchesCategory = !activeCategory || cmd.category === activeCategory;
    const matchesSearch =
      !search ||
      cmd.name.toLowerCase().includes(search.toLowerCase()) ||
      cmd.description.toLowerCase().includes(search.toLowerCase()) ||
      cmd.command.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const categories = Object.keys(CATEGORY_META) as Category[];

  return (
    <Container maxWidth="md" sx={{ py: 5 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
          <Terminal size={32} color={theme.palette.primary.main} />
          <Typography variant="h4" fontWeight={800}>
            CLI Commands
          </Typography>
        </Box>
        <Typography variant="body1" color="text.secondary">
          {COMMANDS.length} commands across {categories.length} categories. Click to copy.
        </Typography>
      </Box>

      {/* Search + filters */}
      <Box sx={{ mb: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          placeholder="Search commands..."
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon size={18} color={theme.palette.text.secondary} />
                </InputAdornment>
              ),
            },
          }}
          sx={{ maxWidth: 360 }}
        />
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
          {categories.map((cat) => {
            const meta = CATEGORY_META[cat];
            const count = COMMANDS.filter((c) => c.category === cat).length;
            const isActive = activeCategory === cat;
            return (
              <Chip
                key={cat}
                icon={meta.icon as React.ReactElement}
                label={`${meta.label} (${count})`}
                size="small"
                variant={isActive ? 'filled' : 'outlined'}
                color={isActive ? 'primary' : 'default'}
                onClick={() => setActiveCategory(isActive ? null : cat)}
                sx={{ cursor: 'pointer' }}
              />
            );
          })}
        </Box>
      </Box>

      {/* Command list */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {filtered.map((cmd) => (
          <Paper
            key={cmd.command}
            variant="outlined"
            sx={{
              p: 2,
              borderColor: cmd.dangerous
                ? alpha(theme.palette.error.main, 0.3)
                : 'divider',
              '&:hover': {
                borderColor: cmd.dangerous
                  ? alpha(theme.palette.error.main, 0.5)
                  : alpha(theme.palette.primary.main, 0.4),
              },
              transition: 'border-color 200ms ease',
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.75 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography variant="subtitle2" fontWeight={700}>
                  {cmd.name}
                </Typography>
                {cmd.dangerous && (
                  <Chip label="destructive" size="small" color="error" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
                )}
              </Box>
              <Chip
                icon={CATEGORY_META[cmd.category].icon as React.ReactElement}
                label={CATEGORY_META[cmd.category].label}
                size="small"
                variant="outlined"
                sx={{ height: 24, fontSize: '0.72rem', flexShrink: 0 }}
              />
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, lineHeight: 1.5 }}>
              {cmd.description}
            </Typography>

            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                bgcolor: alpha(theme.palette.text.primary, 0.04),
                borderRadius: 1.5,
                px: 1.5,
                py: 0.75,
                fontFamily: '"JetBrains Mono", "Fira Code", "SF Mono", Consolas, monospace',
                fontSize: '0.82rem',
                color: 'text.primary',
                overflow: 'hidden',
              }}
            >
              <Typography
                component="code"
                sx={{
                  flex: 1,
                  fontFamily: 'inherit',
                  fontSize: 'inherit',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {cmd.command}
              </Typography>
              <CopyButton text={cmd.command} />
            </Box>
          </Paper>
        ))}

        {filtered.length === 0 && (
          <Typography color="text.secondary" sx={{ textAlign: 'center', py: 6 }}>
            No commands match your search.
          </Typography>
        )}
      </Box>
    </Container>
  );
}
