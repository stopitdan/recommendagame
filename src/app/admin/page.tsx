'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import { useTheme, alpha } from '@mui/material/styles';
import { createClient } from '@/lib/supabase/client';
import { Bug, Terminal, Send } from 'lucide-react';

const ADMIN_EMAIL = 'danjwiegand@gmail.com';

const PAGES = [
  {
    name: 'Rec Engine Debug',
    description: 'Test recommendation queries with full scoring breakdown, candidate counts, and engine diagnostics.',
    href: '/admin/debug',
    icon: Bug,
  },
  {
    name: 'CLI Commands',
    description: 'All scripts and commands with one-click copy. Cache busting, crawlers, evals, blog generation, and more.',
    href: '/admin/cli-commands',
    icon: Terminal,
  },
  {
    name: 'Outreach Tracker',
    description: 'Track community outreach efforts across Reddit, BGG forums, Discord servers, and other channels.',
    href: '/admin/outreach',
    icon: Send,
  },
];

export default function AdminIndexPage() {
  const theme = useTheme();
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);

  useState(() => {
    createClient().auth.getUser().then(({ data: d }) => {
      setAuthed(d.user?.email === ADMIN_EMAIL);
    });
  });

  if (authed === false) {
    return (
      <Container maxWidth="md" sx={{ py: 8 }}>
        <Typography variant="h5" color="error">Admin access required</Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          Sign in with {ADMIN_EMAIL}
        </Typography>
      </Container>
    );
  }

  if (authed === null) return null;

  return (
    <Container maxWidth="sm" sx={{ py: 5 }}>
      <Typography variant="h4" fontWeight={800} sx={{ mb: 0.5 }}>
        Admin
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        {PAGES.length} tools
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {PAGES.map(({ name, description, href, icon: Icon }) => (
          <Paper
            key={href}
            variant="outlined"
            onClick={() => router.push(href)}
            sx={{
              p: 2.5,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 2,
              transition: 'all 200ms ease',
              '&:hover': {
                borderColor: alpha(theme.palette.primary.main, 0.4),
                bgcolor: alpha(theme.palette.primary.main, 0.04),
                transform: 'translateX(4px)',
              },
            }}
          >
            <Box
              sx={{
                mt: 0.25,
                p: 1,
                borderRadius: 1.5,
                bgcolor: alpha(theme.palette.primary.main, 0.08),
                color: 'primary.main',
                display: 'flex',
                flexShrink: 0,
              }}
            >
              <Icon size={20} />
            </Box>
            <Box>
              <Typography variant="subtitle1" fontWeight={700}>
                {name}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.5 }}>
                {description}
              </Typography>
            </Box>
          </Paper>
        ))}
      </Box>
    </Container>
  );
}
