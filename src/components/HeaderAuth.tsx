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
        <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
          {displayName || email}
        </Typography>
        <form action={logout}>
          <Button type="submit" variant="text" size="small">
            Log Out
          </Button>
        </form>
      </>
    );
  }

  return (
    <>
      <Button variant="text" onClick={() => router.push('/login')}>
        Log In
      </Button>
      <Button variant="contained" size="small" onClick={() => router.push('/signup')}>
        Sign Up
      </Button>
    </>
  );
}
