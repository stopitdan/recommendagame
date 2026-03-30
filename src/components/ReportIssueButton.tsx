'use client';

import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { Flag } from 'lucide-react';
import type { Game } from '@/types/game';

const FIELD_OPTIONS = [
  { value: 'min_players', label: 'Min Players' },
  { value: 'max_players', label: 'Max Players' },
  { value: 'recommended_players', label: 'Recommended Players' },
  { value: 'min_play_time', label: 'Min Play Time' },
  { value: 'max_play_time', label: 'Max Play Time' },
  { value: 'avg_play_time', label: 'Average Play Time' },
  { value: 'complexity', label: 'Complexity' },
  { value: 'year_published', label: 'Year Published' },
  { value: 'categories', label: 'Categories' },
  { value: 'mechanics', label: 'Mechanics' },
  { value: 'themes', label: 'Themes' },
  { value: 'name', label: 'Game Name' },
  { value: 'description', label: 'Description' },
];

function getCurrentValue(game: Game, field: string): string {
  switch (field) {
    case 'min_players': return String(game.playerCount?.min ?? '');
    case 'max_players': return String(game.playerCount?.max ?? '');
    case 'recommended_players': return String(game.playerCount?.recommended ?? '');
    case 'min_play_time': return String(game.playTime?.min ?? '');
    case 'max_play_time': return String(game.playTime?.max ?? '');
    case 'avg_play_time': return String(game.playTime?.average ?? '');
    case 'complexity': return game.complexity != null ? game.complexity.toFixed(1) : '';
    case 'year_published': return String(game.yearPublished ?? '');
    case 'categories': return game.categories.join(', ');
    case 'mechanics': return game.mechanics.join(', ');
    case 'themes': return game.themes.join(', ');
    case 'name': return game.name;
    case 'description': return game.description?.slice(0, 100) ?? '';
    default: return '';
  }
}

interface ReportIssueButtonProps {
  game: Game;
}

export default function ReportIssueButton({ game }: ReportIssueButtonProps) {
  const [open, setOpen] = useState(false);
  const [field, setField] = useState('');
  const [suggestedValue, setSuggestedValue] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const currentValue = field ? getCurrentValue(game, field) : '';

  async function handleSubmit() {
    if (!field || !suggestedValue.trim()) return;
    setStatus('sending');
    try {
      const res = await fetch(`/api/games/${encodeURIComponent(game.id)}/corrections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fieldName: field,
          currentValue: currentValue || undefined,
          suggestedValue: suggestedValue.trim(),
          notes: notes.trim() || undefined,
        }),
      });

      if (res.ok) {
        setStatus('sent');
        setTimeout(() => {
          setOpen(false);
          setField('');
          setSuggestedValue('');
          setNotes('');
          setStatus('idle');
        }, 2000);
      } else if (res.status === 401) {
        setStatus('error');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  }

  return (
    <>
      <Tooltip title="Report incorrect data">
        <IconButton size="small" onClick={() => setOpen(true)} sx={{ color: 'text.secondary' }}>
          <Flag size={18} />
        </IconButton>
      </Tooltip>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          Report Incorrect Data
        </DialogTitle>
        <DialogContent>
          {status === 'sent' ? (
            <Alert severity="success">Thanks! We'll review this correction.</Alert>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                See something wrong with {game.name}? Let us know and we'll fix it.
              </Typography>

              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>What's incorrect?</InputLabel>
                <Select
                  value={field}
                  label="What's incorrect?"
                  onChange={(e) => { setField(e.target.value); setSuggestedValue(''); }}
                >
                  {FIELD_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              {field && currentValue && (
                <Box sx={{ mb: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary">Current value:</Typography>
                  <Typography variant="body2">{currentValue}</Typography>
                </Box>
              )}

              <TextField
                fullWidth
                size="small"
                label="Correct value"
                value={suggestedValue}
                onChange={(e) => setSuggestedValue(e.target.value)}
                sx={{ mb: 2 }}
              />

              <TextField
                fullWidth
                size="small"
                label="Notes (optional)"
                placeholder="Any additional context"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                multiline
                rows={2}
              />

              {status === 'error' && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  Failed to submit. Make sure you're logged in.
                </Alert>
              )}
            </>
          )}
        </DialogContent>
        {status !== 'sent' && (
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={!field || !suggestedValue.trim() || status === 'sending'}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              {status === 'sending' ? 'Submitting...' : 'Submit Correction'}
            </Button>
          </DialogActions>
        )}
      </Dialog>
    </>
  );
}
