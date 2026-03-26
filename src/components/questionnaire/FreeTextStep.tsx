'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

export interface FreeTextStepProps {
  value: string;
  onChange: (value: string) => void;
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
  onQuickSubmit,
  onCustomize,
  isParsing,
}: FreeTextStepProps) {
  const hasText = value.trim().length >= 3;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <TextField
        value={value}
        onChange={(e) => onChange(e.target.value)}
        multiline
        rows={4}
        fullWidth
        placeholder='e.g. "A roguelike deck builder for 2 players", "Something like Catan but faster", "A cozy game for date night"'
        variant="outlined"
        onKeyDown={(e) => {
          // Cmd/Ctrl+Enter to quick submit
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && hasText && onQuickSubmit) {
            e.preventDefault();
            onQuickSubmit();
          }
        }}
        sx={{ mt: 1 }}
      />

      {/* Action buttons directly below the input */}
      <Stack direction="row" spacing={2} sx={{ mt: 2, width: '100%' }}>
        {hasText && onQuickSubmit && (
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
              'Find my game →'
            )}
          </Button>
        )}
        {onCustomize && (
          <Button
            variant={hasText ? 'outlined' : 'contained'}
            size="large"
            fullWidth
            onClick={onCustomize}
            disabled={isParsing}
            sx={{ py: 1.5, fontSize: '1rem', borderRadius: 2 }}
          >
            {hasText ? 'Customize filters' : 'Choose manually →'}
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
