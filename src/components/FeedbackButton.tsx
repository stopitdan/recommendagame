'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import { MessageSquare } from 'lucide-react';

export default function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  async function handleSend() {
    if (!message.trim()) return;
    setStatus('sending');
    try {
      const res = await fetch('/api/feedback-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message.trim(),
          page: window.location.href,
        }),
      });
      if (!res.ok) throw new Error();
      setStatus('sent');
      setTimeout(() => { setOpen(false); setStatus('idle'); setMessage(''); }, 2000);
    } catch {
      setStatus('error');
    }
  }

  return (
    <>
      <Button
        size="small"
        variant="text"
        onClick={() => setOpen(true)}
        startIcon={<MessageSquare size={14} />}
        sx={{
          textTransform: 'none',
          color: 'text.secondary',
          fontSize: '0.75rem',
          '&:hover': { color: 'primary.main' },
        }}
      >
        Feedback
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Send Feedback</DialogTitle>
        <DialogContent>
          {status === 'sent' ? (
            <Alert severity="success">Thanks! We got your feedback.</Alert>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Bug report, feature request, or just a thought? We read every message.
              </Typography>
              {status === 'error' && (
                <Alert severity="error" sx={{ mb: 2 }}>Failed to send. Try again?</Alert>
              )}
              <TextField
                multiline
                rows={3}
                fullWidth
                placeholder="What's on your mind?"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                sx={{ mb: 2 }}
              />
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                <Button onClick={() => setOpen(false)} sx={{ textTransform: 'none' }}>
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  onClick={handleSend}
                  disabled={!message.trim() || status === 'sending'}
                  sx={{ textTransform: 'none' }}
                >
                  {status === 'sending' ? 'Sending...' : 'Send'}
                </Button>
              </Box>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
