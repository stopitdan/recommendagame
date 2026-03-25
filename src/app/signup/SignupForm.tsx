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
        minHeight: '80vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        py: 4,
        background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(255, 109, 63, 0.06) 0%, transparent 70%)',
      }}
    >
      <Container maxWidth="xs">
        <Stack spacing={3} alignItems="center">
          <Typography sx={{ fontSize: '3rem' }}>🎲</Typography>
          <Typography variant="h4" component="h1" fontWeight={800} textAlign="center">
            Join the Game
          </Typography>
          <Typography variant="body1" color="text.secondary" textAlign="center">
            Create an account to save favorites, write reviews, and get smarter recommendations over time.
          </Typography>

          <Card variant="outlined" sx={{ width: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              {state?.error && <Alert severity="error" sx={{ mb: 2 }}>{state.error}</Alert>}

              <form action={action}>
                <Stack spacing={2.5}>
                  <TextField
                    name="displayName"
                    label="Display Name"
                    fullWidth
                    autoComplete="name"
                    placeholder="How should we call you?"
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
                    color="secondary"
                    size="large"
                    fullWidth
                    disabled={pending}
                    sx={{ py: 1.5, fontSize: '1rem' }}
                  >
                    {pending ? 'Creating account...' : 'Create Account'}
                  </Button>
                </Stack>
              </form>
            </CardContent>
          </Card>

          <Typography variant="body2" textAlign="center" color="text.secondary">
            Already have an account?{' '}
            <Link href="/login" style={{ color: '#5B4FDB', fontWeight: 600, textDecoration: 'none' }}>
              Log in
            </Link>
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
}
