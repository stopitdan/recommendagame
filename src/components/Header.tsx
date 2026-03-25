import Link from 'next/link';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { createClient } from '@/lib/supabase/server';
import HeaderNav from './HeaderNav';
import HeaderAuth from './HeaderAuth';
import MobileNav from './MobileNav';

export default async function Header() {
  let user = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // Supabase not configured or auth failed — continue without user
  }

  return (
    <AppBar position="static" elevation={0} sx={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
      <Toolbar sx={{ maxWidth: 'lg', mx: 'auto', width: '100%' }}>
        <Link href="/" style={{ textDecoration: 'none', marginRight: 24 }}>
          <Typography
            variant="h6"
            sx={{
              color: '#FFFFFF',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <Box component="span" sx={{ fontSize: '1.3rem' }}>🎲</Box>
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
              Recommend a Game
            </Box>
            <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
              RAG
            </Box>
          </Typography>
        </Link>

        {/* Desktop nav */}
        <Box sx={{ display: { xs: 'none', md: 'flex' } }}>
          <HeaderNav />
        </Box>

        <Box sx={{ flex: 1 }} />

        {/* Desktop auth */}
        <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 1, alignItems: 'center' }}>
          <HeaderAuth
            isLoggedIn={!!user}
            email={user?.email ?? ''}
            displayName={user?.user_metadata?.display_name}
          />
        </Box>

        {/* Mobile hamburger menu */}
        <Box sx={{ display: { xs: 'flex', md: 'none' } }}>
          <MobileNav
            isLoggedIn={!!user}
            email={user?.email ?? ''}
            displayName={user?.user_metadata?.display_name}
          />
        </Box>
      </Toolbar>
    </AppBar>
  );
}
