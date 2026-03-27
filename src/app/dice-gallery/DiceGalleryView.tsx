'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import { motion, AnimatePresence } from 'motion/react';
import type { CustomDiceSkinSummary } from '@/types/custom-dice';
import { generateSwatchBg } from '@/lib/custom-dice-utils';

const PAGE_SIZE = 20;

export default function DiceGalleryView() {
  const router = useRouter();
  const [skins, setSkins] = useState<CustomDiceSkinSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortTab, setSortTab] = useState<'top' | 'newest'>('top');
  const [hasMore, setHasMore] = useState(true);

  const fetchSkins = useCallback(async (sort: string, offset: number, append: boolean) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dice-skins/public?sort=${sort}&offset=${offset}&limit=${PAGE_SIZE}`);
      if (res.ok) {
        const data = await res.json();
        const fetched = data.skins ?? [];
        setSkins((prev) => append ? [...prev, ...fetched] : fetched);
        setHasMore(fetched.length === PAGE_SIZE);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSkins(sortTab, 0, false);
  }, [sortTab, fetchSkins]);

  function handleLoadMore() {
    fetchSkins(sortTab, skins.length, true);
  }

  async function handleVote(skinId: string) {
    try {
      const res = await fetch(`/api/dice-skins/${skinId}/vote`, { method: 'POST' });
      if (res.ok) {
        const { voted, vote_count } = await res.json();
        setSkins((prev) =>
          prev.map((s) =>
            s.id === skinId ? { ...s, has_voted: voted, vote_count } : s,
          ),
        );
      }
    } catch {
      // silently fail
    }
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4" fontWeight={800} sx={{ mb: 1 }}>
            Dice Gallery
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Browse custom dice skins created by the community. Vote for your favorites!
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Tabs
            value={sortTab}
            onChange={(_, val) => setSortTab(val)}
            sx={{ minHeight: 36 }}
          >
            <Tab label="Top Rated" value="top" sx={{ minHeight: 36, py: 0 }} />
            <Tab label="Newest" value="newest" sx={{ minHeight: 36, py: 0 }} />
          </Tabs>
          <Button
            variant="contained"
            size="small"
            onClick={() => router.push('/dice-creator')}
          >
            Create Your Own
          </Button>
        </Box>

        {/* Skin grid */}
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(2, 1fr)',
            sm: 'repeat(3, 1fr)',
            md: 'repeat(4, 1fr)',
          },
          gap: 2,
        }}>
          <AnimatePresence mode="popLayout">
            {skins.map((skin, i) => (
              <motion.div
                key={skin.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <DiceSkinCard
                  skin={skin}
                  onVote={() => handleVote(skin.id)}
                  onClick={() => router.push(`/dice-gallery/${skin.id}`)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </Box>

        {/* Loading / Load More */}
        <Box sx={{ textAlign: 'center' }}>
          {loading && (
            <CircularProgress size={28} sx={{ color: 'primary.main' }} />
          )}
          {!loading && skins.length === 0 && (
            <Typography color="text.secondary">
              No public dice skins yet. Be the first to create one!
            </Typography>
          )}
          {!loading && hasMore && skins.length > 0 && (
            <Button variant="outlined" onClick={handleLoadMore}>
              Load More
            </Button>
          )}
        </Box>
      </Stack>
    </Container>
  );
}

// ─── Skin Card ──────────────────────────────────────────────────

function DiceSkinCard({ skin, onVote, onClick }: {
  skin: CustomDiceSkinSummary;
  onVote: () => void;
  onClick: () => void;
}) {
  const swatchBg = generateSwatchBg(skin.config);

  return (
    <Card
      variant="outlined"
      sx={{
        cursor: 'pointer',
        transition: 'all 200ms',
        '&:hover': {
          boxShadow: 4,
          transform: 'translateY(-2px)',
        },
      }}
      onClick={onClick}
    >
      {/* Swatch preview */}
      <Box sx={{
        height: 100,
        background: swatchBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Typography sx={{ fontSize: '2.5rem' }}>{skin.emoji}</Typography>
      </Box>

      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Typography variant="subtitle2" fontWeight={700} noWrap>
          {skin.name}
        </Typography>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
          <Chip
            label={`${skin.vote_count} votes`}
            size="small"
            variant="outlined"
            color={skin.has_voted ? 'primary' : 'default'}
            onClick={(e) => {
              e.stopPropagation();
              onVote();
            }}
            icon={<span>{skin.has_voted ? '❤️' : '🤍'}</span>}
          />

          <Typography variant="caption" color="text.secondary">
            {skin.config.baseType}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}
