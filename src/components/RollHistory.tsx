'use client';

import { useState, useCallback } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { History, Copy, X } from 'lucide-react';
import type { DiceType } from '@/lib/dice-geometries';

export interface RollEntry {
  diceType: DiceType;
  value: number | string;
  timestamp: number;
}

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 5) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export default function RollHistory({ entries }: { entries: RollEntry[] }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyLog = useCallback(() => {
    const lines = entries
      .slice()
      .reverse()
      .map((e) => `${e.diceType.toUpperCase()}: ${e.value}`)
      .join(', ');
    navigator.clipboard.writeText(lines).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [entries]);

  if (entries.length === 0) return null;

  const last = entries[entries.length - 1];

  return (
    <>
      <Box sx={{ position: 'fixed', bottom: 16, right: 16, zIndex: 1200 }}>
        {/* Collapsed: just show last roll as a chip */}
        {!open && (
          <Tooltip title="Roll history" enterDelay={500}>
            <Chip
              icon={<History size={14} />}
              label={`${last.diceType.toUpperCase()}: ${last.value}`}
              onClick={() => setOpen(true)}
              color="secondary"
              variant="filled"
              sx={{
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: 2,
                '&:hover': { boxShadow: 4 },
              }}
            />
          </Tooltip>
        )}

        {/* Expanded: scrollable list */}
        <Collapse in={open}>
          <Paper
            elevation={8}
            sx={{
              width: 220,
              maxHeight: 320,
              overflow: 'hidden',
              borderRadius: 2,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="subtitle2" fontWeight={700}>
                Roll History ({entries.length})
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <Tooltip title="Copy roll log">
                  <IconButton size="small" onClick={copyLog}>
                    <Copy size={14} />
                  </IconButton>
                </Tooltip>
                <IconButton size="small" onClick={() => setOpen(false)}>
                  <X size={14} />
                </IconButton>
              </Box>
            </Box>

            {/* Roll list */}
            <Stack sx={{ overflow: 'auto', maxHeight: 260, px: 1.5, py: 1 }} spacing={0.5}>
              {entries
                .slice()
                .reverse()
                .slice(0, 50)
                .map((entry, i) => (
                  <Box
                    key={`${entry.timestamp}-${i}`}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      py: 0.25,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography
                        variant="caption"
                        sx={{
                          fontWeight: 700,
                          minWidth: 36,
                          color: 'text.secondary',
                        }}
                      >
                        {entry.diceType.toUpperCase()}
                      </Typography>
                      <Typography
                        variant="body2"
                        fontWeight={700}
                        sx={{
                          color:
                            entry.diceType === 'd20' && entry.value === 20
                              ? 'warning.main'
                              : entry.diceType === 'd20' && entry.value === 1
                                ? 'error.main'
                                : 'text.primary',
                        }}
                      >
                        {entry.value}
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.disabled">
                      {timeAgo(entry.timestamp)}
                    </Typography>
                  </Box>
                ))}
            </Stack>
          </Paper>
        </Collapse>
      </Box>

      <Snackbar
        open={copied}
        autoHideDuration={2000}
        onClose={() => setCopied(false)}
        message="Roll log copied!"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </>
  );
}
