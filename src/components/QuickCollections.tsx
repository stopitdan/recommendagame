'use client';

import { type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import { motion } from 'motion/react';
import { Heart, Zap, PartyPopper, Brain, Users, TreePine } from 'lucide-react';

/**
 * Quick-access collection cards that link to pre-filtered
 * questionnaire results. Each represents a common game scenario.
 */

const COLLECTIONS: { icon: ReactNode; title: string; subtitle: string; params: string; gradient: string; border: string }[] = [
  {
    icon: <Heart size={28} />,
    title: 'Date Night',
    subtitle: '2-player games',
    params: 'type=board&minPlayers=2&maxPlayers=2&time=medium&moods=chill',
    gradient: 'linear-gradient(135deg, #FF6D3F20, #FF6D3F08)',
    border: '#FF6D3F',
  },
  {
    icon: <Zap size={28} />,
    title: 'Quick Play',
    subtitle: 'Under 15 minutes',
    params: 'time=quick&minPlayers=1&maxPlayers=8',
    gradient: 'linear-gradient(135deg, #FFB02020, #FFB02008)',
    border: '#FFB020',
  },
  {
    icon: <PartyPopper size={28} />,
    title: 'Party Night',
    subtitle: '5+ players, social',
    params: 'type=party&minPlayers=5&maxPlayers=10&moods=social',
    gradient: 'linear-gradient(135deg, #5B4FDB20, #5B4FDB08)',
    border: '#5B4FDB',
  },
  {
    icon: <Brain size={28} />,
    title: 'Brain Burner',
    subtitle: 'Complex strategy',
    params: 'type=board&minComplexity=3.5&maxComplexity=5&genres=Strategy&moods=brain-teaser',
    gradient: 'linear-gradient(135deg, #0EC6C620, #0EC6C608)',
    border: '#0EC6C6',
  },
  {
    icon: <Users size={28} />,
    title: 'Family Fun',
    subtitle: 'Easy & accessible',
    params: 'genres=Family&minComplexity=1&maxComplexity=2.5&moods=chill',
    gradient: 'linear-gradient(135deg, #22C55E20, #22C55E08)',
    border: '#22C55E',
  },
  {
    icon: <TreePine size={28} />,
    title: 'No Equipment',
    subtitle: 'Just yourselves',
    params: 'type=party&minPlayers=3&maxPlayers=10',
    gradient: 'linear-gradient(135deg, #EF444420, #EF444408)',
    border: '#EF4444',
  },
];

export default function QuickCollections() {
  const router = useRouter();

  return (
    <Container maxWidth="lg">
      <Typography variant="h5" fontWeight={700} sx={{ mb: 3, textAlign: 'center' }}>
        Quick Picks
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(2, 1fr)',
            sm: 'repeat(3, 1fr)',
            md: 'repeat(6, 1fr)',
          },
          gap: 2,
        }}
      >
        {COLLECTIONS.map((col) => (
          <motion.div
            key={col.title}
            whileHover={{ y: -4, scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
          >
            <Card
              variant="outlined"
              sx={{
                background: col.gradient,
                borderColor: `${col.border}30`,
                transition: 'all 200ms',
                '&:hover': { borderColor: col.border, boxShadow: `0 4px 16px ${col.border}20` },
              }}
            >
              <CardActionArea
                onClick={() => router.push(`/results?${col.params}`)}
                sx={{ p: 2, textAlign: 'center' }}
              >
                <Box sx={{ mb: 0.5, color: col.border, display: 'flex', justifyContent: 'center' }}>{col.icon}</Box>
                <Typography variant="subtitle2" fontWeight={700} sx={{ lineHeight: 1.2 }}>
                  {col.title}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {col.subtitle}
                </Typography>
              </CardActionArea>
            </Card>
          </motion.div>
        ))}
      </Box>
    </Container>
  );
}
