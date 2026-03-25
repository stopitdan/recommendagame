'use client';

import { useRef } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { motion, useInView } from 'motion/react';

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

const ENGINE_LAYERS = [
  {
    number: '01',
    title: 'Rule-Based Scoring',
    description: 'Scores every game across 8 dimensions: type match, player count fit, time fit, complexity, genre match, mood alignment, quality, and popularity. Each dimension is weighted and produces a 0-1 score.',
    color: '#5B4FDB',
    emoji: '📊',
  },
  {
    number: '02',
    title: 'Content-Based Filtering',
    description: 'Each game is encoded as a 768-dimensional vector capturing its attributes. Your preferences become a vector in the same space. Cosine similarity finds games pointing in the same direction as your taste.',
    color: '#0EC6C6',
    emoji: '🧮',
  },
  {
    number: '03',
    title: 'Collaborative Filtering',
    description: '"Users who liked X also liked Y." As more people use the platform, the engine discovers patterns — connecting you with games loved by people with similar taste.',
    color: '#FF6D3F',
    emoji: '👥',
  },
  {
    number: '04',
    title: 'Feedback Loop',
    description: 'Every review you leave adjusts your preference vector. Rate a strategy game highly? Future recommendations lean strategic. The system literally learns from you.',
    color: '#FFB020',
    emoji: '🔄',
  },
];

const DATA_SOURCES = [
  {
    name: 'BoardGameGeek',
    games: '22,000+',
    description: 'The gold standard for board game data. Ratings, complexity, mechanics, player counts, and community recommendations.',
    emoji: '♟️',
  },
  {
    name: 'RAWG',
    games: '80,000+',
    description: 'Comprehensive video game database. Every platform, from indie to AAA. Metacritic scores, genres, screenshots.',
    emoji: '🎮',
  },
  {
    name: 'Curated Collection',
    games: '39',
    description: 'Hand-picked word games and no-equipment party games. From Wordle to Charades to Mafia — games you can play anywhere.',
    emoji: '🎉',
  },
];

const TECH_STACK = [
  { name: 'Next.js 16', role: 'Framework', emoji: '⚡' },
  { name: 'React 19', role: 'UI Library', emoji: '⚛️' },
  { name: 'TypeScript', role: 'Type Safety', emoji: '📐' },
  { name: 'MUI (Material UI)', role: 'Component Library', emoji: '🎨' },
  { name: 'Supabase', role: 'Database & Auth', emoji: '🗄️' },
  { name: 'pgvector', role: 'Similarity Search', emoji: '🔍' },
  { name: 'Motion', role: 'Animations', emoji: '✨' },
  { name: 'Vitest', role: 'Testing', emoji: '🧪' },
];

export default function AboutView() {
  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      {/* Hero */}
      <Section>
        <Box sx={{ textAlign: 'center', mb: 6 }}>
          <Typography sx={{ fontSize: '3rem', mb: 2 }}>🎲</Typography>
          <Typography variant="h2" fontWeight={800} sx={{ mb: 2 }}>
            How It Works
          </Typography>
          <Typography variant="h6" color="text.secondary" fontWeight={400} sx={{ maxWidth: 520, mx: 'auto', lineHeight: 1.6 }}>
            Recommend a Game uses a 4-layer recommendation engine to match you
            with games you&apos;ll actually enjoy — not just popular picks.
          </Typography>
        </Box>
      </Section>

      {/* Engine Layers */}
      <Section delay={0.1}>
        <Typography variant="h4" fontWeight={800} sx={{ mb: 4 }}>
          The Recommendation Engine
        </Typography>
      </Section>

      <Stack spacing={3} sx={{ mb: 8 }}>
        {ENGINE_LAYERS.map((layer, i) => (
          <Section key={layer.number} delay={0.1 + i * 0.1}>
            <Card
              variant="outlined"
              sx={{
                borderLeft: `4px solid ${layer.color}`,
                transition: 'all 200ms',
                '&:hover': { boxShadow: `0 4px 20px ${layer.color}20` },
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: `${layer.color}15`,
                      fontSize: '1.5rem',
                      flexShrink: 0,
                    }}
                  >
                    {layer.emoji}
                  </Box>
                  <Box>
                    <Typography variant="overline" sx={{ color: layer.color, fontWeight: 700 }}>
                      Layer {layer.number}
                    </Typography>
                    <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>
                      {layer.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
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
        <Typography variant="h4" fontWeight={800} sx={{ mb: 4 }}>
          Where the Data Comes From
        </Typography>
      </Section>

      <Grid container spacing={3} sx={{ mb: 8 }}>
        {DATA_SOURCES.map((source, i) => (
          <Grid size={{ xs: 12, md: 4 }} key={source.name}>
            <Section delay={0.1 + i * 0.1}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent sx={{ p: 3, textAlign: 'center' }}>
                  <Typography sx={{ fontSize: '2rem', mb: 1 }}>{source.emoji}</Typography>
                  <Typography variant="h6" fontWeight={700}>{source.name}</Typography>
                  <Typography
                    variant="h5"
                    fontWeight={800}
                    sx={{ color: 'primary.main', my: 1 }}
                  >
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

      <Grid container spacing={2} sx={{ mb: 4 }}>
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
                <Typography sx={{ fontSize: '1.5rem', mb: 0.5 }}>{tech.emoji}</Typography>
                <Typography variant="subtitle2" fontWeight={700}>
                  {tech.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {tech.role}
                </Typography>
              </Card>
            </Section>
          </Grid>
        ))}
      </Grid>
    </Container>
  );
}
