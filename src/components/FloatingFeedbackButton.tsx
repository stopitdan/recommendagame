'use client';

import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Fab from '@mui/material/Fab';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import { MessageSquare } from 'lucide-react';

interface FloatingFeedbackButtonProps {
  /** Auto-included context about the current search */
  searchContext?: string;
}

/**
 * Fixed-position floating action button for quick feedback submission.
 * Opens a dialog with a text field. Includes search context automatically.
 */
export default function FloatingFeedbackButton({ searchContext }: FloatingFeedbackButtonProps) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  async function handleSend() {
    if (!message.trim()) return;
    setStatus('sending');
    try {
      const fullMessage = searchContext
        ? `${message.trim()}\n\n--- Search Context ---\n${searchContext}`
        : message.trim();

      const res = await fetch('/api/feedback-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: fullMessage, page: window.location.href }),
      });

      setStatus(res.ok ? 'sent' : 'error');
      if (res.ok) {
        setTimeout(() => { setOpen(false); setMessage(''); setStatus('idle'); }, 2000);
      }
    } catch {
      setStatus('error');
    }
  }

  return (
    <>
      <Tooltip title="Send feedback" placement="left">
        <Fab
          size="medium"
          onClick={() => setOpen(true)}
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 1200,
            bgcolor: 'secondary.main',
            color: '#FFFFFF',
            '&:hover': { bgcolor: 'secondary.dark' },
          }}
        >
          <MessageSquare size={22} />
        </Fab>
      </Tooltip>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          Send us feedback
        </DialogTitle>
        <DialogContent>
          {status === 'sent' ? (
            <Alert severity="success">Thanks! Your feedback helps us improve.</Alert>
          ) : (
            <>
              <Box sx={{ mb: 2, color: 'text.secondary', fontSize: '0.875rem' }}>
                Bug, feature request, or just telling us how the results were? We read everything.
              </Box>
              <TextField
                autoFocus
                multiline
                rows={4}
                fullWidth
                placeholder="What's on your mind?"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              {status === 'error' && (
                <Alert severity="error" sx={{ mt: 1 }}>Something went wrong. Try again?</Alert>
              )}
            </>
          )}
        </DialogContent>
        {status !== 'sent' && (
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleSend}
              disabled={!message.trim() || status === 'sending'}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              {status === 'sending' ? 'Sending...' : 'Send'}
            </Button>
          </DialogActions>
        )}
      </Dialog>
    </>
  );
}
