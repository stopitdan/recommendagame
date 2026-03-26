'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { QuestionnaireState } from '@/types/questionnaire';

interface Preset {
  id: number;
  name: string;
  preferences: QuestionnaireState;
  updated_at: string;
}

export default function PresetsView() {
  const router = useRouter();
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPresets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/presets');
      if (res.status === 401) {
        setError('Log in to see your presets');
        return;
      }
      if (!res.ok) throw new Error('Failed to fetch presets');
      const data = await res.json();
      setPresets(data.presets ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPresets();
  }, [fetchPresets]);

  function usePreset(preset: Preset) {
    const p = preset.preferences;
    const params = new URLSearchParams();
    if (p.gameTypes?.length > 0) params.set('types', p.gameTypes.join(','));
    params.set('minPlayers', String(p.playerCount.min));
    params.set('maxPlayers', String(p.playerCount.max));
    if (p.timePresets?.length > 0) params.set('time', p.timePresets.join(','));
    params.set('minComplexity', String(p.complexity.min));
    params.set('maxComplexity', String(p.complexity.max));
    if (p.genres.length > 0) params.set('genres', p.genres.join(','));
    if (p.moods.length > 0) params.set('moods', p.moods.join(','));
    if (p.freeText?.trim()) params.set('freeText', p.freeText.trim());
    router.push(`/results?${params.toString()}`);
  }

  async function deletePreset(id: number) {
    await fetch(`/api/presets/${id}`, { method: 'DELETE' });
    setPresets((prev) => prev.filter((p) => p.id !== id));
  }

  function describePreset(p: QuestionnaireState): string {
    const parts: string[] = [];
    if (p.gameTypes?.length > 0) parts.push(p.gameTypes.join(', '));
    parts.push(`${p.playerCount.min}-${p.playerCount.max} players`);
    if (p.timePresets?.length > 0) parts.push(p.timePresets.join(', '));
    if (p.genres.length > 0) parts.push(p.genres.slice(0, 3).join(', '));
    return parts.join(' · ');
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h4" fontWeight={700}>
            My Presets
          </Typography>
          <Button variant="contained" onClick={() => router.push('/find-a-game')}>
            Create New
          </Button>
        </Box>

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress sx={{ color: 'secondary.main' }} />
          </Box>
        )}

        {error && (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
              {error}
            </Typography>
            {error.includes('Log in') && (
              <Button variant="contained" onClick={() => router.push('/login')}>
                Log In
              </Button>
            )}
          </Box>
        )}

        {!loading && !error && presets.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
              No presets saved yet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Go through the questionnaire and tap &quot;Save Preset&quot; on the last step.
            </Typography>
            <Button variant="contained" onClick={() => router.push('/find-a-game')}>
              Get Started
            </Button>
          </Box>
        )}

        {!loading && !error && presets.map((preset) => (
          <Card key={preset.id} variant="outlined">
            <CardContent>
              <Typography variant="h6" fontWeight={600}>
                {preset.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {describePreset(preset.preferences)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Saved {new Date(preset.updated_at).toLocaleDateString()}
              </Typography>
            </CardContent>
            <CardActions>
              <Button size="small" variant="contained" onClick={() => usePreset(preset)}>
                Use This Preset
              </Button>
              <Button size="small" color="error" onClick={() => deletePreset(preset.id)}>
                Delete
              </Button>
            </CardActions>
          </Card>
        ))}
      </Stack>
    </Container>
  );
}
