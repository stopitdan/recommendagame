import Link from 'next/link';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

const LINKS = {
  Discover: [
    { label: 'Find a Game', href: '/questionnaire' },
    { label: 'Browse Games', href: '/browse' },
    { label: 'Leaderboard', href: '/leaderboard' },
    { label: 'How It Works', href: '/about' },
  ],
  Account: [
    { label: 'Sign Up', href: '/signup' },
    { label: 'Log In', href: '/login' },
    { label: 'My Profile', href: '/profile' },
    { label: 'Settings', href: '/settings' },
  ],
  'Game Types': [
    { label: 'Board Games', href: '/browse?type=board' },
    { label: 'Video Games', href: '/browse?type=video' },
    { label: 'Word Games', href: '/browse?type=word' },
    { label: 'Party Games', href: '/browse?type=party' },
  ],
};

export default function Footer() {
  return (
    <Box
      component="footer"
      sx={{
        mt: 'auto',
        pt: 6,
        pb: 4,
        background: 'linear-gradient(180deg, transparent 0%, rgba(91, 79, 219, 0.03) 100%)',
        borderTop: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Container maxWidth="lg">
        <Grid container spacing={4}>
          {/* Brand */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Typography variant="h6" fontWeight={800} sx={{ mb: 1 }}>
              🎲 Recommend a Game
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 280, lineHeight: 1.6 }}>
              Find your next favorite game. 100,000+ board games, video games,
              word games, and party games — all scored by our 4-layer recommendation engine.
            </Typography>
          </Grid>

          {/* Link columns */}
          {Object.entries(LINKS).map(([title, links]) => (
            <Grid size={{ xs: 6, sm: 4, md: 2 }} key={title}>
              <Typography
                variant="subtitle2"
                fontWeight={700}
                sx={{ mb: 1.5, textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.1em', color: 'text.secondary' }}
              >
                {title}
              </Typography>
              <Stack spacing={0.75}>
                {links.map((link) => (
                  <Link key={link.href} href={link.href} style={{ textDecoration: 'none' }}>
                    <Typography
                      variant="body2"
                      sx={{
                        color: 'text.secondary',
                        transition: 'color 150ms ease',
                        '&:hover': { color: 'primary.main' },
                      }}
                    >
                      {link.label}
                    </Typography>
                  </Link>
                ))}
              </Stack>
            </Grid>
          ))}
        </Grid>

        <Divider sx={{ my: 3 }} />

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
          <Typography variant="caption" color="text.secondary">
            &copy; {new Date().getFullYear()} Recommend a Game. Built with Next.js, Supabase, and a love for games.
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Data from BoardGameGeek &amp; RAWG
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}
