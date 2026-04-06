'use client';

import { useState, useMemo } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { Download, Share2, Image as ImageIcon } from 'lucide-react';
import type { Game } from '@/types/game';

interface RecommendedGame extends Game {
  _score?: number;
}

interface ShareCardDialogProps {
  open: boolean;
  onClose: () => void;
  games: RecommendedGame[];
  /** Default title, e.g. from the search context */
  defaultTitle?: string;
}

interface CardGame {
  name: string;
  score?: number;
  types?: string[];
}

const THEME_OPTIONS = [
  { key: 'purple', label: 'Cosmic', color: '#5B4FDB' },
  { key: 'orange', label: 'Sunset', color: '#FF6D3F' },
  { key: 'teal', label: 'Ocean', color: '#0EC6C6' },
] as const;

function buildCardUrl(title: string, games: CardGame[], theme: string): string {
  const params = new URLSearchParams();
  params.set('title', title);
  params.set('games', JSON.stringify(games));
  params.set('theme', theme);
  return `/api/og/share-card?${params.toString()}`;
}

export default function ShareCardDialog({ open, onClose, games, defaultTitle }: ShareCardDialogProps) {
  const [title, setTitle] = useState(defaultTitle || 'My Top Games');
  const [theme, setTheme] = useState<string>('purple');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    // Pre-select top 5
    return new Set(games.slice(0, 5).map((g) => g.id));
  });
  const [downloading, setDownloading] = useState(false);

  const selectedGames: CardGame[] = useMemo(() => {
    // Maintain original order from games array
    return games
      .filter((g) => selectedIds.has(g.id))
      .slice(0, 5)
      .map((g) => ({
        name: g.name,
        score: g._score,
        types: g.types,
      }));
  }, [games, selectedIds]);

  const cardUrl = useMemo(
    () => buildCardUrl(title, selectedGames, theme),
    [title, selectedGames, theme],
  );

  function toggleGame(gameId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(gameId)) {
        next.delete(gameId);
      } else if (next.size < 5) {
        next.add(gameId);
      }
      return next;
    });
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      const response = await fetch(cardUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '-').toLowerCase()}-boredgame.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  async function handleShare() {
    if (!navigator.share) {
      // Fallback: download instead
      handleDownload();
      return;
    }

    try {
      const response = await fetch(cardUrl);
      const blob = await response.blob();
      const file = new File([blob], 'my-games-boredgame.png', { type: 'image/png' });

      await navigator.share({
        title,
        text: `Check out my top game picks on boredgame.lol!`,
        files: [file],
      });
    } catch {
      // User cancelled or API failed
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
        <ImageIcon size={20} />
        Create Share Card
      </DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          {/* Title input */}
          <TextField
            label="Card Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            fullWidth
            size="small"
            placeholder="My Top Party Games"
            inputProps={{ maxLength: 60 }}
            helperText={`${title.length}/60`}
          />

          {/* Theme selector */}
          <Box>
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
              Theme
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {THEME_OPTIONS.map((t) => (
                <Chip
                  key={t.key}
                  label={t.label}
                  onClick={() => setTheme(t.key)}
                  variant={theme === t.key ? 'filled' : 'outlined'}
                  sx={theme === t.key ? {
                    bgcolor: t.color,
                    color: '#FFFFFF',
                    '&:hover': { bgcolor: t.color, opacity: 0.9 },
                  } : {
                    borderColor: t.color,
                    color: t.color,
                  }}
                />
              ))}
            </Box>
          </Box>

          {/* Game selection */}
          <Box>
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
              Games ({selectedIds.size}/5)
            </Typography>
            <Box sx={{ maxHeight: 200, overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1 }}>
              {games.slice(0, 20).map((game) => (
                <FormControlLabel
                  key={game.id}
                  control={
                    <Checkbox
                      checked={selectedIds.has(game.id)}
                      onChange={() => toggleGame(game.id)}
                      disabled={!selectedIds.has(game.id) && selectedIds.size >= 5}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {game.name}
                      {game._score != null && (
                        <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                          {Math.round(game._score * 100)}%
                        </Typography>
                      )}
                    </Typography>
                  }
                  sx={{ display: 'flex', m: 0, py: 0.25 }}
                />
              ))}
            </Box>
          </Box>

          {/* Preview */}
          <Box>
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
              Preview
            </Typography>
            <Box
              sx={{
                borderRadius: 2,
                overflow: 'hidden',
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: '#0a0a1a',
                position: 'relative',
                aspectRatio: '1200 / 630',
              }}
            >
              {selectedGames.length > 0 ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={cardUrl}
                  alt="Share card preview"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                  <Typography color="text.secondary">Select at least one game</Typography>
                </Box>
              )}
            </Box>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="outlined"
          onClick={handleDownload}
          disabled={selectedGames.length === 0 || downloading}
          startIcon={<Download size={16} />}
        >
          {downloading ? 'Downloading...' : 'Download'}
        </Button>
        <Button
          variant="contained"
          onClick={handleShare}
          disabled={selectedGames.length === 0}
          startIcon={<Share2 size={16} />}
        >
          Share
        </Button>
      </DialogActions>
    </Dialog>
  );
}
