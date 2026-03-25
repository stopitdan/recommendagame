'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { login, type AuthState } from '@/app/actions/auth';

export default function LoginForm() {
  const [state, action, pending] = useActionState<AuthState | undefined, FormData>(
    login,
    undefined,
  );

  return (
    <Box
      component="main"
      sx={{
        minHeight: '80vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        py: 4,
        background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(91, 79, 219, 0.06) 0%, transparent 70%)',
      }}
    >
      <Container maxWidth="xs">
        <Stack spacing={3} alignItems="center">
          <Typography sx={{ fontSize: '3rem' }}>🎮</Typography>
          <Typography variant="h4" component="h1" fontWeight={800} textAlign="center">
            Welcome Back
          </Typography>
          <Typography variant="body1" color="text.secondary" textAlign="center">
            Log in to access your favorites, presets, and personalized recommendations.
          </Typography>

          <Card variant="outlined" sx={{ width: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              {state?.error && <Alert severity="error" sx={{ mb: 2 }}>{state.error}</Alert>}

              <form action={action}>
                <Stack spacing={2.5}>
                  <TextField
                    name="email"
                    label="Email"
                    type="email"
                    required
                    fullWidth
                    autoComplete="email"
                  />
                  <TextField
                    name="password"
                    label="Password"
                    type="password"
                    required
                    fullWidth
                    autoComplete="current-password"
                  />
                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    fullWidth
                    disabled={pending}
                    sx={{ py: 1.5, fontSize: '1rem' }}
                  >
                    {pending ? 'Logging in...' : 'Log In'}
                  </Button>
                </Stack>
              </form>
            </CardContent>
          </Card>

          <Typography variant="body2" textAlign="center" color="text.secondary">
            Don&apos;t have an account?{' '}
            <Link href="/signup" style={{ color: '#5B4FDB', fontWeight: 600, textDecoration: 'none' }}>
              Sign up
            </Link>
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
}
