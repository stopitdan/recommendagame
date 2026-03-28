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
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Moon, Sun } from 'lucide-react';

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
import { useColorMode } from '@/components/ThemeRegistry';
import { COLOR_PRESETS } from '@/lib/color-presets';

export default function SettingsView() {
  const { unlock } = useAchievements();
  const { colorPreset, setColorPreset, mode, toggleMode } = useColorMode();
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
  const [exporting, setExporting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  async function handleExportData() {
    setExporting(true);
    try {
      const res = await fetch('/api/account/export');
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'boredgame-data.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Failed to export data');
    } finally {
      setExporting(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      const res = await fetch('/api/account/delete', { method: 'DELETE' });
      if (!res.ok) throw new Error('Deletion failed');
      router.push('/');
    } catch {
      setError('Failed to delete account. Please contact support.');
      setDeleting(false);
      setDeleteDialogOpen(false);
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

        {/* Color theme */}
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>
              Color Theme
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Choose a color palette for the app.
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 1.5 }}>
              {COLOR_PRESETS.map((preset) => (
                <Card
                  key={preset.id}
                  variant="outlined"
                  onClick={() => setColorPreset(preset.id)}
                  sx={{
                    cursor: 'pointer',
                    borderColor: colorPreset === preset.id ? 'secondary.main' : 'divider',
                    borderWidth: colorPreset === preset.id ? 2 : 1,
                    transition: 'all 200ms',
                    '&:hover': { borderColor: 'secondary.main' },
                  }}
                >
                  <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Typography sx={{ fontSize: '1.2rem' }}>{preset.emoji}</Typography>
                      <Typography variant="subtitle2" fontWeight={600} sx={{ fontSize: '0.8rem' }}>
                        {preset.name}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      {[preset.primary, preset.secondary, preset.accent, preset.rating].map((color) => (
                        <Box
                          key={color}
                          sx={{
                            width: 20,
                            height: 20,
                            borderRadius: '50%',
                            bgcolor: color,
                            border: '1px solid',
                            borderColor: 'divider',
                          }}
                        />
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Box>
          </CardContent>
        </Card>

        {/* Dark mode toggle */}
        <Card variant="outlined">
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography variant="h6" fontWeight={600}>
                  Dark Mode
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {mode === 'dark' ? 'Currently using dark mode' : 'Currently using light mode'}
                </Typography>
              </Box>
              <Chip
                icon={mode === 'dark' ? <Moon size={14} /> as React.ReactElement : <Sun size={14} /> as React.ReactElement}
                label={mode === 'dark' ? 'Dark' : 'Light'}
                onClick={() => {
                  toggleMode();
                  unlock('dark_side');
                }}
                color="secondary"
                variant="outlined"
              />
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

        <Divider sx={{ my: 2 }} />

        {/* Data & Privacy */}
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
              Data &amp; Privacy
            </Typography>

            <Stack spacing={2}>
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Download a copy of all your data (profile, preferences, favorites, reviews,
                  feedback, achievements, and dice skins) as a JSON file.
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleExportData}
                  disabled={exporting}
                  sx={{ textTransform: 'none' }}
                >
                  {exporting ? 'Exporting...' : 'Export My Data'}
                </Button>
              </Box>

              <Divider />

              <Box>
                <Typography variant="body2" color="error.main" sx={{ mb: 1 }}>
                  Permanently delete your account and all associated data. This action cannot be
                  undone.
                </Typography>
                <Button
                  variant="outlined"
                  color="error"
                  size="small"
                  onClick={() => setDeleteDialogOpen(true)}
                  sx={{ textTransform: 'none' }}
                >
                  Delete My Account
                </Button>
              </Box>
            </Stack>
          </CardContent>
        </Card>

        {/* Delete confirmation dialog */}
        <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
          <DialogTitle>Delete Account?</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary">
              This will permanently delete your account, preferences, favorites, reviews, feedback,
              achievements, and all custom dice skins. This action cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              onClick={handleDeleteAccount}
              color="error"
              variant="contained"
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete Everything'}
            </Button>
          </DialogActions>
        </Dialog>
      </Stack>
    </Container>
  );
}
