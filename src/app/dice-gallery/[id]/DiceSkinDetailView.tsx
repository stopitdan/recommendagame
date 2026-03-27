'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { CustomDiceSkinConfig } from '@/types/custom-dice';
import { resolveCustomSkin, generateSwatchBg } from '@/lib/custom-dice-utils';

const PhysicsDice = dynamic(() => import('@/components/PhysicsDice'), {
  ssr: false,
  loading: () => (
    <Box sx={{ width: '100%', height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <CircularProgress size={32} sx={{ color: 'primary.main' }} />
    </Box>
  ),
});

interface SkinDetail {
  id: string;
  name: string;
  emoji: string;
  config: CustomDiceSkinConfig;
  is_public: boolean;
  vote_count: number;
  created_at: string;
}

export default function DiceSkinDetailView() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [skin, setSkin] = useState<SkinDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasVoted, setHasVoted] = useState(false);
  const [voteCount, setVoteCount] = useState(0);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/dice-skins/${id}`);
        if (!res.ok) {
          setLoading(false);
          return;
        }
        const data = await res.json();
        setSkin(data.skin);
        setVoteCount(data.skin.vote_count);
      } catch {
        // failed to load
      } finally {
        setLoading(false);
      }
    }
    if (id) load();
  }, [id]);

  const previewSkin = useMemo(() => {
    if (!skin) return null;
    return resolveCustomSkin(skin.id, skin.name, skin.emoji, skin.config);
  }, [skin]);

  async function handleVote() {
    if (!id) return;
    try {
      const res = await fetch(`/api/dice-skins/${id}/vote`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setHasVoted(data.voted);
        setVoteCount(data.vote_count);
      }
    } catch {
      // silently fail
    }
  }

  async function handleUseSkin() {
    if (!id) return;
    try {
      await fetch('/api/user/dice-skin', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skinId: id }),
      });
      router.push('/random');
    } catch {
      // silently fail
    }
  }

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ py: 8, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (!skin) {
    return (
      <Container maxWidth="md" sx={{ py: 8, textAlign: 'center' }}>
        <Typography variant="h5" fontWeight={700}>Dice skin not found</Typography>
        <Button variant="outlined" onClick={() => router.push('/dice-gallery')} sx={{ mt: 2 }}>
          Back to Gallery
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Button
        variant="text"
        onClick={() => router.push('/dice-gallery')}
        sx={{ mb: 2, color: 'text.secondary' }}
      >
        Back to Gallery
      </Button>

      <Box sx={{
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        gap: 4,
      }}>
        {/* 3D Preview */}
        <Box sx={{ flex: '0 0 50%' }}>
          <Box sx={{
            borderRadius: 3,
            overflow: 'hidden',
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
          }}>
            {previewSkin && (
              <PhysicsDice
                rolling={false}
                onSettled={() => {}}
                skin={previewSkin}
              />
            )}
            {/* Swatch bar */}
            <Box sx={{
              height: 6,
              background: generateSwatchBg(skin.config),
            }} />
          </Box>
        </Box>

        {/* Details */}
        <Box sx={{ flex: 1 }}>
          <Stack spacing={2}>
            <Box>
              <Typography variant="h4" fontWeight={800}>
                {skin.emoji} {skin.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Created {new Date(skin.created_at).toLocaleDateString()}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip label={skin.config.baseType} size="small" />
              {skin.config.shaderKey && (
                <Chip label={skin.config.shaderKey} size="small" variant="outlined" />
              )}
              {skin.config.overlayShaderKey && (
                <Chip label={`overlay: ${skin.config.overlayShaderKey}`} size="small" variant="outlined" />
              )}
              <Chip label={`labels: ${skin.config.labelStyle}`} size="small" variant="outlined" />
            </Box>

            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Chip
                label={`${voteCount} vote${voteCount !== 1 ? 's' : ''}`}
                color={hasVoted ? 'primary' : 'default'}
                onClick={handleVote}
                icon={<span>{hasVoted ? '❤️' : '🤍'}</span>}
              />
            </Box>

            <Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
              <Button
                variant="contained"
                onClick={handleUseSkin}
                sx={{ flex: 1 }}
              >
                Use This Die
              </Button>
              <Button
                variant="outlined"
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                }}
              >
                Share
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Box>
    </Container>
  );
}
