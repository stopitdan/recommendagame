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

/**
 * Subtle feedback button that opens a dialog to send feedback via email.
 * Place on results, browse, and game detail pages.
 */
export default function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  function handleSend() {
    if (!message.trim()) return;
    // Open mailto with pre-filled body
    const subject = encodeURIComponent('boredgame.lol Feedback');
    const body = encodeURIComponent(`${message.trim()}\n\n---\nPage: ${window.location.href}\nTime: ${new Date().toISOString()}`);
    window.open(`mailto:contact@boredgame.lol?subject=${subject}&body=${body}`, '_blank');
    setSent(true);
    setTimeout(() => { setOpen(false); setSent(false); setMessage(''); }, 2000);
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
          {sent ? (
            <Alert severity="success" sx={{ mb: 2 }}>Thanks for the feedback!</Alert>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Bug report, feature request, or just a thought? We read every message.
              </Typography>
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
                  disabled={!message.trim()}
                  sx={{ textTransform: 'none' }}
                >
                  Send
                </Button>
              </Box>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
