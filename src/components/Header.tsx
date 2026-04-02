import Link from 'next/link';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { createClient } from '@/lib/supabase/server';
import HeaderNav from './HeaderNav';
import DiceLogoIcon from './DiceLogoIcon';
import HeaderAuth from './HeaderAuth';
import MobileNav from './MobileNav';
import DarkModeToggle from './DarkModeToggle';
import BetaBadge from './BetaBadge';

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
            <DiceLogoIcon />
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
              boredgame.lol
            </Box>
            <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
              BG.lol
            </Box>
            <BetaBadge />
          </Typography>
        </Link>

        {/* Desktop nav -- show at lg+ (1200px) where all 5 items fit comfortably */}
        <Box sx={{ display: { xs: 'none', lg: 'flex' } }}>
          <HeaderNav />
        </Box>

        <Box sx={{ flex: 1 }} />

        {/* Desktop auth + dark mode */}
        <Box sx={{ display: { xs: 'none', lg: 'flex' }, gap: 1, alignItems: 'center' }}>
          <DarkModeToggle />
          <HeaderAuth
            isLoggedIn={!!user}
            email={user?.email ?? ''}
            displayName={user?.user_metadata?.display_name}
          />
        </Box>

        {/* Mobile/tablet hamburger menu -- show below lg (1200px) */}
        <Box sx={{ display: { xs: 'flex', lg: 'none' }, ml: 'auto' }}>
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
