'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
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
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        py: 4,
      }}
    >
      <Container maxWidth="xs">
        <Stack spacing={3}>
          <Typography variant="h4" component="h1" fontWeight={700} textAlign="center">
            Log In
          </Typography>

          {state?.error && <Alert severity="error">{state.error}</Alert>}

          <form action={action}>
            <Stack spacing={2}>
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
              >
                {pending ? 'Logging in...' : 'Log In'}
              </Button>
            </Stack>
          </form>

          <Typography variant="body2" textAlign="center" color="text.secondary">
            Don&apos;t have an account?{' '}
            <Link href="/signup" style={{ color: 'secondary.main', fontWeight: 600 }}>
              Sign up
            </Link>
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
}
