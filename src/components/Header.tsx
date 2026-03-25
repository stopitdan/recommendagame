import Link from 'next/link';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { createClient } from '@/lib/supabase/server';
import HeaderAuth from './HeaderAuth';

export default async function Header() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <AppBar position="static" elevation={0} sx={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
      <Toolbar sx={{ maxWidth: 'lg', mx: 'auto', width: '100%' }}>
        <Link href="/" style={{ textDecoration: 'none', flexGrow: 1 }}>
          <Typography
            variant="h6"
            sx={{ color: '#FFFFFF', fontWeight: 700, letterSpacing: '-0.02em' }}
          >
            Recommend a Game
          </Typography>
        </Link>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <HeaderAuth
            isLoggedIn={!!user}
            email={user?.email ?? ''}
            displayName={user?.user_metadata?.display_name}
          />
        </Box>
      </Toolbar>
    </AppBar>
  );
}
