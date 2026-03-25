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
import { signup, type AuthState } from '@/app/actions/auth';

export default function SignupForm() {
  const [state, action, pending] = useActionState<AuthState | undefined, FormData>(
    signup,
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
            Sign Up
          </Typography>

          {state?.error && <Alert severity="error">{state.error}</Alert>}

          <form action={action}>
            <Stack spacing={2}>
              <TextField
                name="displayName"
                label="Display Name"
                fullWidth
                autoComplete="name"
              />
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
                autoComplete="new-password"
                helperText="At least 6 characters"
              />
              <Button
                type="submit"
                variant="contained"
                size="large"
                fullWidth
                disabled={pending}
              >
                {pending ? 'Creating account...' : 'Sign Up'}
              </Button>
            </Stack>
          </form>

          <Typography variant="body2" textAlign="center" color="text.secondary">
            Already have an account?{' '}
            <Link href="/login" style={{ color: 'inherit', fontWeight: 600 }}>
              Log in
            </Link>
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
}
