'use client';

import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { ThumbsUp, ThumbsDown } from 'lucide-react';

const QUICK_REASONS = [
  'Too mainstream',
  'Wrong genre',
  'Wrong complexity',
  'Missing a game I expected',
  'Wrong player count',
  'Results feel random',
];

interface ResultsFeedbackPromptProps {
  /** Current search query context for debugging */
  searchContext?: string;
}

/**
 * Inline feedback prompt that appears in the results list.
 * Asks "Did these results nail it?" with thumbs up/down
 * and optional reason collection on thumbs-down.
 */
export default function ResultsFeedbackPrompt({ searchContext }: ResultsFeedbackPromptProps) {
  const [submitted, setSubmitted] = useState(false);
  const [showReasons, setShowReasons] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [customText, setCustomText] = useState('');
  const [sending, setSending] = useState(false);

  async function sendFeedback(positive: boolean, reason?: string) {
    setSending(true);
    try {
      const message = positive
        ? `[Results feedback: Positive] ${searchContext ?? ''}`
        : `[Results feedback: Negative] Reason: ${reason ?? 'none'}\nContext: ${searchContext ?? ''}`;

      await fetch('/api/feedback-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, page: window.location.href }),
      });
    } catch {
      // Non-blocking -- don't show error for feedback
    } finally {
      setSending(false);
      setSubmitted(true);
    }
  }

  if (submitted) {
    return (
      <Alert severity="success" sx={{ borderRadius: 3 }}>
        Thanks for the feedback! It helps us get better.
      </Alert>
    );
  }

  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 3,
        p: 2.5,
        bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(91,79,219,0.04)' : 'rgba(91,79,219,0.02)',
      }}
    >
      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
        How are these results?
      </Typography>

      {!showReasons ? (
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<ThumbsUp size={16} />}
            onClick={() => sendFeedback(true)}
            disabled={sending}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Nailed it
          </Button>
          <Button
            variant="outlined"
            size="small"
            color="secondary"
            startIcon={<ThumbsDown size={16} />}
            onClick={() => setShowReasons(true)}
            disabled={sending}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Not quite
          </Button>
        </Box>
      ) : (
        <Collapse in={showReasons}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            What went wrong? (pick one or type your own)
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1.5 }}>
            {QUICK_REASONS.map((reason) => (
              <Chip
                key={reason}
                label={reason}
                size="small"
                variant={selectedReason === reason ? 'filled' : 'outlined'}
                color={selectedReason === reason ? 'secondary' : 'default'}
                onClick={() => setSelectedReason(reason === selectedReason ? null : reason)}
              />
            ))}
          </Box>
          <TextField
            size="small"
            placeholder="Or tell us more..."
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            fullWidth
            sx={{ mb: 1.5 }}
          />
          <Button
            variant="contained"
            size="small"
            onClick={() => sendFeedback(false, selectedReason ?? (customText.trim() || 'unspecified'))}
            disabled={sending}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            {sending ? 'Sending...' : 'Send Feedback'}
          </Button>
        </Collapse>
      )}
    </Box>
  );
}
