'use client';

import { useRouter } from 'next/navigation';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { logout } from '@/app/actions/auth';

export interface HeaderAuthProps {
  isLoggedIn: boolean;
  email: string;
  displayName?: string;
}

export default function HeaderAuth({ isLoggedIn, email, displayName }: HeaderAuthProps) {
  const router = useRouter();

  if (isLoggedIn) {
    return (
      <>
        <Button
          variant="text"
          size="small"
          onClick={() => router.push('/favorites')}
          sx={{ color: 'rgba(255,255,255,0.8)', '&:hover': { color: '#FFFFFF' } }}
        >
          Favorites
        </Button>
        <Typography variant="body2" sx={{ mr: 1, color: 'rgba(255,255,255,0.7)' }}>
          {displayName || email}
        </Typography>
        <form action={logout}>
          <Button
            type="submit"
            variant="text"
            size="small"
            sx={{ color: 'rgba(255,255,255,0.8)', '&:hover': { color: '#FFFFFF' } }}
          >
            Log Out
          </Button>
        </form>
      </>
    );
  }

  return (
    <>
      <Button
        variant="text"
        onClick={() => router.push('/login')}
        sx={{ color: 'rgba(255,255,255,0.8)', '&:hover': { color: '#FFFFFF' } }}
      >
        Log In
      </Button>
      <Button
        variant="contained"
        size="small"
        onClick={() => router.push('/signup')}
        sx={{
          bgcolor: 'secondary.main',
          '&:hover': { bgcolor: 'secondary.dark' },
        }}
      >
        Sign Up
      </Button>
    </>
  );
}
