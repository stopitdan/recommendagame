'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { Mail, CheckCircle } from 'lucide-react';

export default function NewsletterSignup() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus('loading');
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error();
      setStatus('success');
      setEmail('');
    } catch {
      setStatus('error');
    }
  }

  if (status === 'success') {
    return (
      <Container maxWidth="sm" sx={{ textAlign: 'center', py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1, color: 'success.main' }}>
          <CheckCircle size={32} />
        </Box>
        <Typography variant="h6" fontWeight={700}>
          You&apos;re in!
        </Typography>
        <Typography variant="body2" color="text.secondary">
          We&apos;ll let you know when we ship something cool.
        </Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ textAlign: 'center', py: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1.5, color: 'primary.main' }}>
        <Mail size={28} />
      </Box>
      <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>
        Stay in the loop
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
        Get notified about new features and game catalog updates. No spam, ever.
      </Typography>
      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{
          display: 'flex',
          gap: 1,
          maxWidth: 400,
          mx: 'auto',
        }}
      >
        <TextField
          value={email}
          onChange={(e) => { setEmail(e.target.value); setStatus('idle'); }}
          placeholder="you@email.com"
          type="email"
          size="small"
          fullWidth
          required
          error={status === 'error'}
          helperText={status === 'error' ? 'Something went wrong, try again' : undefined}
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
        />
        <Button
          type="submit"
          variant="contained"
          disabled={status === 'loading'}
          sx={{ borderRadius: 2, px: 3, fontWeight: 700, textTransform: 'none', whiteSpace: 'nowrap' }}
        >
          {status === 'loading' ? 'Subscribing...' : 'Subscribe'}
        </Button>
      </Box>
    </Container>
  );
}
