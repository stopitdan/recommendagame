'use client';

import { useRef } from 'react';
import Link from 'next/link';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { motion, useInView } from 'motion/react';
import {
  Dice5, BarChart3, Cpu, Users, RefreshCw,
  Puzzle, Gamepad2, PartyPopper,
  Zap, Atom, FileCode, Palette, Database, Search, Sparkles, TestTube,
} from 'lucide-react';
import type { ReactNode } from 'react';

function Section({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

const ENGINE_LAYERS: { number: string; title: string; description: string; color: string; icon: ReactNode }[] = [
  {
    number: '01',
    title: 'Rule-Based Scoring',
    description: 'Scores every game across 8 dimensions (type, player count, time, complexity, genre, mood, quality, and popularity) to find your best matches.',
    color: '#5B4FDB',
    icon: <BarChart3 size={24} />,
  },
  {
    number: '02',
    title: 'Content-Based Filtering',
    description: 'Each game is encoded as a vector in high-dimensional space. Your preferences become a vector too. We find games pointing in the same direction as your taste.',
    color: '#0EC6C6',
    icon: <Cpu size={24} />,
  },
  {
    number: '03',
    title: 'Collaborative Filtering',
    description: '"People who liked X also liked Y." As more people use the platform, the engine discovers patterns and connects you with hidden gems.',
    color: '#FF6D3F',
    icon: <Users size={24} />,
  },
  {
    number: '04',
    title: 'Feedback Loop',
    description: 'Every thumbs up, thumbs down, and review adjusts your preference profile. The more you use it, the smarter your recommendations become.',
    color: '#FFB020',
    icon: <RefreshCw size={24} />,
  },
];

const DATA_SOURCES: { name: string; games: string; description: string; icon: ReactNode }[] = [
  {
    name: 'BoardGameGeek',
    games: '22,000+',
    description: 'The gold standard for board game data. Community ratings, complexity scores, mechanics, and player counts.',
    icon: <Puzzle size={32} />,
  },
  {
    name: 'RAWG',
    games: '80,000+',
    description: 'Comprehensive video game database covering every platform, from indie to AAA.',
    icon: <Gamepad2 size={32} />,
  },
  {
    name: 'Curated Collection',
    games: '39',
    description: 'Hand-picked word games and party games you can play anywhere with no equipment needed.',
    icon: <PartyPopper size={32} />,
  },
];

const TECH_STACK: { name: string; role: string; icon: ReactNode }[] = [
  { name: 'Next.js 16', role: 'Framework', icon: <Zap size={20} /> },
  { name: 'React 19', role: 'UI Library', icon: <Atom size={20} /> },
  { name: 'TypeScript', role: 'Type Safety', icon: <FileCode size={20} /> },
  { name: 'MUI', role: 'Components', icon: <Palette size={20} /> },
  { name: 'Supabase', role: 'Database & Auth', icon: <Database size={20} /> },
  { name: 'pgvector', role: 'Similarity Search', icon: <Search size={20} /> },
  { name: 'Motion', role: 'Animations', icon: <Sparkles size={20} /> },
  { name: 'Vitest', role: 'Testing', icon: <TestTube size={20} /> },
];

export default function AboutView() {
  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      {/* Hero */}
      <Section>
        <Box sx={{ textAlign: 'center', mb: 6 }}>
          <Box sx={{ mb: 2, color: 'primary.main', display: 'flex', justifyContent: 'center' }}>
            <Dice5 size={48} strokeWidth={1.5} />
          </Box>
          <Typography variant="h2" fontWeight={800} sx={{ mb: 2 }}>
            About boredgame.lol
          </Typography>
          <Typography variant="h6" color="text.secondary" fontWeight={400} sx={{ maxWidth: 560, mx: 'auto', lineHeight: 1.7 }}>
            You know that feeling when you want to play something but can&apos;t decide what?
            We built this to fix that.
          </Typography>
        </Box>
      </Section>

      {/* The Story */}
      <Section delay={0.1}>
        <Stack spacing={2.5} sx={{ mb: 6 }}>
          <Typography variant="h4" fontWeight={800}>
            The Problem
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.8 }}>
            There are over 100,000 board games, video games, word games, and party games out there.
            Finding the right one for your group, your mood, and your time budget shouldn&apos;t
            require scrolling through endless lists or reading dozens of reviews. You should be
            able to say &quot;I want a 30-minute strategy game for 4 people&quot; and get an
            answer in seconds.
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.8 }}>
            That&apos;s exactly what boredgame.lol does. Tell us what you&apos;re in the mood for,
            and our recommendation engine matches you with games you&apos;ll actually enjoy, not
            just whatever&apos;s trending. And it gets smarter every time you use it.
          </Typography>
        </Stack>
      </Section>

      <Divider sx={{ my: 6 }} />

      {/* Engine Layers */}
      <Section>
        <Typography variant="h4" fontWeight={800} sx={{ mb: 1 }}>
          How Recommendations Work
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4, lineHeight: 1.8 }}>
          Under the hood, a 4-layer AI recommendation engine analyzes 100,000+ games to find
          your perfect match.
        </Typography>
      </Section>

      <Stack spacing={3} sx={{ mb: 8 }}>
        {ENGINE_LAYERS.map((layer, i) => (
          <Section key={layer.number} delay={0.1 + i * 0.1}>
            <Card
              variant="outlined"
              sx={{
                transition: 'all 200ms',
                '&:hover': { borderColor: layer.color, boxShadow: `0 4px 20px ${layer.color}15` },
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', gap: 2.5, alignItems: 'flex-start' }}>
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: `${layer.color}15`,
                      color: layer.color,
                      flexShrink: 0,
                    }}
                  >
                    {layer.icon}
                  </Box>
                  <Box>
                    <Typography variant="overline" sx={{ color: layer.color, fontWeight: 700 }}>
                      Layer {layer.number}
                    </Typography>
                    <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>
                      {layer.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                      {layer.description}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Section>
        ))}
      </Stack>

      <Divider sx={{ my: 6 }} />

      {/* Data Sources */}
      <Section>
        <Typography variant="h4" fontWeight={800} sx={{ mb: 1 }}>
          Where the Data Comes From
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4, lineHeight: 1.8 }}>
          We aggregate game data from the best sources on the internet so you don&apos;t have to
          check multiple sites.
        </Typography>
      </Section>

      <Grid container spacing={3} sx={{ mb: 8 }}>
        {DATA_SOURCES.map((source, i) => (
          <Grid size={{ xs: 12, md: 4 }} key={source.name}>
            <Section delay={0.1 + i * 0.1}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent sx={{ p: 3, textAlign: 'center' }}>
                  <Box sx={{ mb: 1, color: 'primary.main', display: 'flex', justifyContent: 'center' }}>
                    {source.icon}
                  </Box>
                  <Typography variant="h6" fontWeight={700}>{source.name}</Typography>
                  <Typography variant="h5" fontWeight={800} sx={{ color: 'primary.main', my: 1 }}>
                    {source.games}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                    {source.description}
                  </Typography>
                </CardContent>
              </Card>
            </Section>
          </Grid>
        ))}
      </Grid>

      <Divider sx={{ my: 6 }} />

      {/* Tech Stack */}
      <Section>
        <Typography variant="h4" fontWeight={800} sx={{ mb: 4 }}>
          Built With
        </Typography>
      </Section>

      <Grid container spacing={2} sx={{ mb: 6 }}>
        {TECH_STACK.map((tech, i) => (
          <Grid size={{ xs: 6, sm: 3 }} key={tech.name}>
            <Section delay={i * 0.05}>
              <Card
                variant="outlined"
                sx={{
                  textAlign: 'center',
                  py: 2,
                  transition: 'all 200ms',
                  '&:hover': { borderColor: 'primary.main', transform: 'translateY(-2px)' },
                }}
              >
                <Box sx={{ mb: 0.5, color: 'secondary.main', display: 'flex', justifyContent: 'center' }}>
                  {tech.icon}
                </Box>
                <Typography variant="subtitle2" fontWeight={700}>{tech.name}</Typography>
                <Typography variant="caption" color="text.secondary">{tech.role}</Typography>
              </Card>
            </Section>
          </Grid>
        ))}
      </Grid>

      {/* CTA */}
      <Section>
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="h5" fontWeight={800} sx={{ mb: 2 }}>
            Ready to find your next favorite game?
          </Typography>
          <Link href="/find-a-game" style={{ textDecoration: 'none' }}>
            <Button variant="contained" size="large" sx={{ px: 5, py: 1.5, fontWeight: 700, borderRadius: 3 }}>
              Get Started
            </Button>
          </Link>
        </Box>
      </Section>
    </Container>
  );
}
