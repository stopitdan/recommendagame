'use client';

import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

/**
 * Custom 404 page — shown when navigating to a non-existent route.
 * Playful tone matching the game theme.
 */
export default function NotFound() {
  const router = useRouter();

  return (
    <Container maxWidth="sm" sx={{ py: 12, textAlign: 'center' }}>
      <Typography sx={{ fontSize: '6rem', lineHeight: 1, mb: 2 }}>
        🎲
      </Typography>
      <Typography
        variant="h2"
        fontWeight={800}
        sx={{
          background: 'linear-gradient(135deg, #5B4FDB, #FF6D3F)',
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          mb: 2,
        }}
      >
        404
      </Typography>
      <Typography variant="h5" fontWeight={600} sx={{ mb: 1 }}>
        This page rolled off the table
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 360, mx: 'auto' }}>
        The page you&apos;re looking for doesn&apos;t exist. Maybe it was a critical fumble?
      </Typography>
      <Stack direction="row" spacing={2} justifyContent="center">
        <Button
          variant="contained"
          onClick={() => router.push('/')}
          sx={{ px: 4 }}
        >
          Go Home
        </Button>
        <Button
          variant="outlined"
          onClick={() => router.push('/questionnaire')}
        >
          Find a Game Instead
        </Button>
      </Stack>
    </Container>
  );
}
