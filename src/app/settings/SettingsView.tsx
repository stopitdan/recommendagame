'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Slider from '@mui/material/Slider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

type PopularityMode = 'popular' | 'any' | 'hidden-gems';

interface Settings {
  popularityMode: PopularityMode;
  minRating: number;
  excludedSources: string[];
}

const SOURCE_OPTIONS = [
  { value: 'bgg', label: 'Board Games (BGG)' },
  { value: 'rawg', label: 'Video Games (RAWG)' },
  { value: 'local', label: 'Word Games' },
];

import { useAchievements } from '@/components/AchievementToast';

export default function SettingsView() {
  const { unlock } = useAchievements();
  const router = useRouter();
  const [settings, setSettings] = useState<Settings>({
    popularityMode: 'popular',
    minRating: 0,
    excludedSources: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/settings');
      if (res.status === 401) {
        setError('Log in to manage your settings');
        return;
      }
      if (!res.ok) throw new Error('Failed to load settings');
      const data = await res.json();
      if (data.settings) {
        setSettings({
          popularityMode: data.settings.popularity_mode ?? 'popular',
          minRating: data.settings.min_rating ?? 0,
          excludedSources: data.settings.excluded_sources ?? [],
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  async function saveSettings() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          popularity_mode: settings.popularityMode,
          min_rating: settings.minRating,
          excluded_sources: settings.excludedSources,
        }),
      });
      if (!res.ok) throw new Error('Failed to save');
      setSaved(true);
      unlock('customizer');
    } catch {
      setError('Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  function toggleSource(source: string) {
    setSettings((prev) => ({
      ...prev,
      excludedSources: prev.excludedSources.includes(source)
        ? prev.excludedSources.filter((s) => s !== source)
        : [...prev.excludedSources, source],
    }));
    setSaved(false);
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
        <CircularProgress sx={{ color: 'secondary.main' }} />
      </Box>
    );
  }

  if (error?.includes('Log in')) {
    return (
      <Container maxWidth="sm" sx={{ py: 8, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
          {error}
        </Typography>
        <Button variant="contained" onClick={() => router.push('/login')}>
          Log In
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Stack spacing={4}>
        <Typography variant="h4" fontWeight={700}>
          Recommendation Settings
        </Typography>

        {saved && <Alert severity="success">Settings saved!</Alert>}
        {error && !error.includes('Log in') && <Alert severity="error">{error}</Alert>}

        {/* Popularity preference */}
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>
              Game Popularity
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Choose whether to see mainly well-known games or discover hidden gems.
            </Typography>
            <FormControl fullWidth>
              <InputLabel>Default mode</InputLabel>
              <Select
                value={settings.popularityMode}
                label="Default mode"
                onChange={(e) => {
                  setSettings((prev) => ({ ...prev, popularityMode: e.target.value as PopularityMode }));
                  setSaved(false);
                }}
              >
                <MenuItem value="popular">Popular Games — well-known, highly rated</MenuItem>
                <MenuItem value="any">All Games — no popularity filter</MenuItem>
                <MenuItem value="hidden-gems">Hidden Gems — lesser-known quality games</MenuItem>
              </Select>
            </FormControl>
          </CardContent>
        </Card>

        {/* Minimum rating */}
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>
              Minimum Rating
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Only show games rated above this threshold (0 = show all).
            </Typography>
            <Box sx={{ px: 2 }}>
              <Slider
                value={settings.minRating}
                onChange={(_, value) => {
                  setSettings((prev) => ({ ...prev, minRating: value as number }));
                  setSaved(false);
                }}
                min={0}
                max={9}
                step={0.5}
                marks={[
                  { value: 0, label: 'Any' },
                  { value: 5, label: '5' },
                  { value: 7, label: '7' },
                  { value: 9, label: '9' },
                ]}
                valueLabelDisplay="auto"
              />
            </Box>
          </CardContent>
        </Card>

        {/* Source preferences */}
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>
              Game Sources
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Exclude sources you&apos;re not interested in. Included by default.
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {SOURCE_OPTIONS.map(({ value, label }) => {
                const excluded = settings.excludedSources.includes(value);
                return (
                  <Chip
                    key={value}
                    label={label}
                    onClick={() => toggleSource(value)}
                    color={excluded ? 'default' : 'secondary'}
                    variant={excluded ? 'outlined' : 'filled'}
                    sx={{ textDecoration: excluded ? 'line-through' : 'none' }}
                  />
                );
              })}
            </Box>
          </CardContent>
        </Card>

        <Button
          variant="contained"
          size="large"
          onClick={saveSettings}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </Stack>
    </Container>
  );
}
