'use client';

import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Link from 'next/link';
import JsonLd from '@/components/JsonLd';

const CONTACT_EMAIL = 'contact@boredgame.lol';

export default function ContactView() {
  return (
    <Container maxWidth="md" sx={{ py: 8 }}>
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'ContactPage',
        name: 'Contact boredgame.lol',
        description: 'Get in touch with the boredgame.lol team. Report bugs, request features, or just say hi.',
        url: 'https://boredgame.lol/contact',
        mainEntity: {
          '@type': 'Organization',
          name: 'boredgame.lol',
          url: 'https://boredgame.lol',
          email: 'contact@boredgame.lol',
        },
      }} />
      <Typography variant="h3" fontWeight={800} sx={{ mb: 1 }}>
        Contact Us
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Have a question, found a bug, or just want to say hi? We&apos;d love to hear from you.
      </Typography>

      <Divider sx={{ mb: 4 }} />

      <Stack spacing={4}>
        <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
          <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
            General Inquiries
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.8 }}>
            For questions, feedback, or partnership inquiries, email us at{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: 'inherit', fontWeight: 600 }}>
              {CONTACT_EMAIL}
            </a>
          </Typography>
        </Paper>

        <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
          <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
            Bug Reports
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.8 }}>
            Found something broken? Please include as much detail as possible: what you were doing,
            what you expected to happen, and what actually happened. Screenshots are always helpful.
            Send reports to{' '}
            <a href={`mailto:${CONTACT_EMAIL}?subject=Bug Report`} style={{ color: 'inherit', fontWeight: 600 }}>
              {CONTACT_EMAIL}
            </a>
          </Typography>
        </Paper>

        <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
          <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
            Data &amp; Privacy Requests
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.8 }}>
            To request a copy of your data, account deletion, or to exercise any of your privacy
            rights under GDPR or other regulations, please email{' '}
            <a href={`mailto:${CONTACT_EMAIL}?subject=Privacy Request`} style={{ color: 'inherit', fontWeight: 600 }}>
              {CONTACT_EMAIL}
            </a>
            {'. '}
            See our{' '}
            <Link href="/privacy" style={{ color: 'inherit', fontWeight: 600 }}>
              Privacy Policy
            </Link>{' '}
            for more details on your rights.
          </Typography>
        </Paper>

        <Box>
          <Typography variant="body2" color="text.secondary">
            We aim to respond to all inquiries within 48 hours.
          </Typography>
        </Box>
      </Stack>
    </Container>
  );
}
