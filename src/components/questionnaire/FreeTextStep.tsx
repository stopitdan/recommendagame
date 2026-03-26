'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type { PlayerCountRange } from '@/types/questionnaire';

export interface FreeTextStepProps {
  value: string;
  onChange: (value: string) => void;
  playerCount: PlayerCountRange;
  onPlayerCountChange: (value: PlayerCountRange) => void;
  /** Called when user wants to go straight to results */
  onQuickSubmit?: () => void;
  /** Called when user wants to customize further */
  onCustomize?: () => void;
  /** Whether the LLM is currently parsing */
  isParsing?: boolean;
}

export default function FreeTextStep({
  value,
  onChange,
  playerCount,
  onPlayerCountChange,
  onQuickSubmit,
  onCustomize,
  isParsing,
}: FreeTextStepProps) {
  const hasText = value.trim().length >= 3;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* Player count — simple number picker */}
      <Box sx={{ width: '100%', mb: 3 }}>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          How many players do you have?
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => {
            const isSelected = playerCount.min === n && playerCount.max === n;
            return (
              <Chip
                key={n}
                label={n}
                onClick={() => onPlayerCountChange({ min: n, max: n })}
                color={isSelected ? 'primary' : 'default'}
                variant={isSelected ? 'filled' : 'outlined'}
                sx={{
                  width: 48,
                  height: 48,
                  fontSize: '1.1rem',
                  fontWeight: 700,
                  borderRadius: '50%',
                  transition: 'all 200ms ease',
                  transform: isSelected ? 'scale(1.1)' : 'scale(1)',
                  '& .MuiChip-label': { px: 0 },
                }}
              />
            );
          })}
          <Chip
            label="9+"
            onClick={() => onPlayerCountChange({ min: 9, max: 99 })}
            color={playerCount.min >= 9 ? 'primary' : 'default'}
            variant={playerCount.min >= 9 ? 'filled' : 'outlined'}
            sx={{
              width: 48,
              height: 48,
              fontSize: '1rem',
              fontWeight: 700,
              borderRadius: '50%',
              transition: 'all 200ms ease',
              transform: playerCount.min >= 9 ? 'scale(1.1)' : 'scale(1)',
              '& .MuiChip-label': { px: 0 },
            }}
          />
        </Box>
      </Box>

      {/* Free text prompt */}
      <Typography variant="subtitle1" fontWeight={600} sx={{ alignSelf: 'flex-start', mb: 1 }}>
        Describe what you&apos;re looking for (optional)
      </Typography>
      <TextField
        value={value}
        onChange={(e) => onChange(e.target.value)}
        multiline
        rows={3}
        fullWidth
        placeholder='e.g. "A roguelike deck builder", "Something like Catan but faster", "A cozy game for date night"'
        variant="outlined"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && onQuickSubmit) {
            e.preventDefault();
            onQuickSubmit();
          }
        }}
      />

      {/* Action buttons */}
      <Stack direction="row" spacing={2} sx={{ mt: 2, width: '100%' }}>
        {onQuickSubmit && (
          <Button
            variant="contained"
            size="large"
            fullWidth
            onClick={onQuickSubmit}
            disabled={isParsing}
            sx={{ py: 1.5, fontSize: '1rem', borderRadius: 2 }}
          >
            {isParsing ? (
              <Stack direction="row" spacing={1} alignItems="center">
                <CircularProgress size={18} color="inherit" />
                <span>Finding games...</span>
              </Stack>
            ) : (
              'Find games →'
            )}
          </Button>
        )}
        {onCustomize && (
          <Button
            variant="outlined"
            size="large"
            fullWidth
            onClick={onCustomize}
            disabled={isParsing}
            sx={{ py: 1.5, fontSize: '1rem', borderRadius: 2 }}
          >
            Customize filters
          </Button>
        )}
      </Stack>

      {hasText && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
          ⌘+Enter to search instantly
        </Typography>
      )}
    </Box>
  );
}
