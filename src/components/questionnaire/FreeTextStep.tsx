'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Slider from '@mui/material/Slider';
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
      {/* Player count — required, asked first */}
      <Box sx={{ width: '100%', mb: 3 }}>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          How many players?
        </Typography>
        <Box sx={{ px: 2 }}>
          <Slider
            value={[playerCount.min, playerCount.max]}
            onChange={(_, v) => {
              const [min, max] = v as number[];
              onPlayerCountChange({ min, max });
            }}
            min={1}
            max={10}
            step={1}
            valueLabelDisplay="auto"
            marks={[
              { value: 1, label: '1' },
              { value: 2, label: '2' },
              { value: 4, label: '4' },
              { value: 6, label: '6' },
              { value: 8, label: '8' },
              { value: 10, label: '10+' },
            ]}
          />
        </Box>
        <Typography variant="body2" color="text.secondary" textAlign="center">
          {playerCount.min === playerCount.max
            ? `${playerCount.min} player${playerCount.min === 1 ? '' : 's'}`
            : `${playerCount.min}–${playerCount.max}${playerCount.max >= 10 ? '+' : ''} players`}
        </Typography>
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
