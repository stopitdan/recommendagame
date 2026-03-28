'use client';

import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import Link from 'next/link';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 1.5 }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <Typography variant="body1" color="text.secondary" sx={{ mb: 1.5, lineHeight: 1.8 }}>
      {children}
    </Typography>
  );
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <Typography component="li" variant="body1" color="text.secondary" sx={{ lineHeight: 1.8 }}>
      {children}
    </Typography>
  );
}

export default function PrivacyView() {
  return (
    <Container maxWidth="md" sx={{ py: 8 }}>
      <Typography variant="h3" fontWeight={800} sx={{ mb: 1 }}>
        Privacy Policy
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
        Last updated: March 27, 2026
      </Typography>

      <Divider sx={{ mb: 4 }} />

      <Stack spacing={4}>
        <Section title="1. Introduction">
          <P>
            Welcome to boredgame.lol (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;). We are
            committed to protecting your privacy and being transparent about how we collect, use, and
            share your information. This Privacy Policy explains our practices when you use our
            website at boredgame.lol (the &quot;Service&quot;).
          </P>
          <P>
            By using the Service, you agree to the collection and use of information in accordance
            with this policy.
          </P>
        </Section>

        <Section title="2. Information We Collect">
          <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>
            Account Information
          </Typography>
          <P>
            When you create an account, we collect your email address, display name, and
            authentication credentials. If you sign in with Google, we receive your name, email, and
            profile picture from Google.
          </P>

          <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>
            Preference &amp; Usage Data
          </Typography>
          <P>
            To provide personalized game recommendations, we collect the preferences you enter
            through our questionnaire (game types, player count, complexity, genres, moods, and
            free-text descriptions), your feedback on recommendations (likes, dislikes, &quot;Not
            This&quot; and &quot;More Like This&quot; signals), your saved favorites, reviews, and
            preset configurations.
          </P>

          <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>
            Automatically Collected Data
          </Typography>
          <P>We automatically collect certain information when you visit the Service, including:</P>
          <Box component="ul" sx={{ pl: 3, mt: 0 }}>
            <Li>Device information (browser type, operating system)</Li>
            <Li>IP address</Li>
            <Li>Pages visited and actions taken</Li>
            <Li>Referring URL</Li>
            <Li>Cookies and similar tracking technologies</Li>
          </Box>
        </Section>

        <Section title="3. How We Use Your Information">
          <P>We use the information we collect to:</P>
          <Box component="ul" sx={{ pl: 3, mt: 0 }}>
            <Li>Provide, maintain, and improve the Service</Li>
            <Li>Generate personalized game recommendations using our recommendation engine</Li>
            <Li>Process your feedback to improve future recommendations</Li>
            <Li>Manage your account, favorites, and preferences</Li>
            <Li>Analyze usage trends and improve the user experience</Li>
            <Li>Display relevant advertisements</Li>
            <Li>Communicate with you about the Service (if you opt in)</Li>
            <Li>Detect and prevent abuse or security issues</Li>
          </Box>
        </Section>

        <Section title="4. Third-Party Services">
          <P>We use the following third-party services that may collect and process your data:</P>
          <Box component="ul" sx={{ pl: 3, mt: 0 }}>
            <Li>
              <strong>Supabase</strong> &mdash; Authentication, database hosting, and data storage
            </Li>
            <Li>
              <strong>Google Analytics</strong> &mdash; Website usage analytics and traffic analysis
            </Li>
            <Li>
              <strong>Google AdSense</strong> &mdash; Advertising (may use cookies to serve
              personalized ads)
            </Li>
            <Li>
              <strong>OpenAI</strong> &mdash; Natural language processing for preference parsing
              (your free-text input may be sent to OpenAI&apos;s API; no personal data is included)
            </Li>
            <Li>
              <strong>Vercel</strong> &mdash; Website hosting and deployment
            </Li>
            <Li>
              <strong>Upstash</strong> &mdash; Redis caching (no personal data stored)
            </Li>
          </Box>
          <P>
            Each third-party service has its own privacy policy. We encourage you to review them.
          </P>
        </Section>

        <Section title="5. Cookies">
          <P>We use cookies and similar technologies for the following purposes:</P>
          <Box component="ul" sx={{ pl: 3, mt: 0 }}>
            <Li>
              <strong>Essential cookies</strong> &mdash; Required for authentication and session
              management
            </Li>
            <Li>
              <strong>Analytics cookies</strong> &mdash; Help us understand how visitors use the
              Service (Google Analytics)
            </Li>
            <Li>
              <strong>Advertising cookies</strong> &mdash; Used by Google AdSense to display
              relevant ads
            </Li>
            <Li>
              <strong>Preference cookies</strong> &mdash; Remember your settings (theme, dark mode)
            </Li>
          </Box>
          <P>
            You can manage your cookie preferences through the cookie consent banner shown when you
            first visit the site, or by adjusting your browser settings. Note that disabling essential
            cookies may affect your ability to use certain features of the Service.
          </P>
        </Section>

        <Section title="6. Data Retention">
          <P>
            We retain your account information and preference data for as long as your account is
            active. If you delete your account, we will delete your personal data within 30 days,
            except where we are required to retain it for legal or security purposes.
          </P>
          <P>
            Anonymized and aggregated data (such as general usage statistics) may be retained
            indefinitely as it cannot be used to identify you.
          </P>
        </Section>

        <Section title="7. Your Rights">
          <P>Depending on your location, you may have the following rights:</P>
          <Box component="ul" sx={{ pl: 3, mt: 0 }}>
            <Li>
              <strong>Access</strong> &mdash; Request a copy of the personal data we hold about you
            </Li>
            <Li>
              <strong>Correction</strong> &mdash; Request correction of inaccurate data
            </Li>
            <Li>
              <strong>Deletion</strong> &mdash; Request deletion of your personal data
            </Li>
            <Li>
              <strong>Data portability</strong> &mdash; Request your data in a portable format
            </Li>
            <Li>
              <strong>Opt out</strong> &mdash; Opt out of personalized advertising
            </Li>
          </Box>
          <P>
            To exercise any of these rights, please contact us at{' '}
            <a href="mailto:contact@boredgame.lol" style={{ color: 'inherit' }}>
              contact@boredgame.lol
            </a>
            . We will respond within 30 days.
          </P>
        </Section>

        <Section title="8. Data Security">
          <P>
            We implement industry-standard security measures to protect your data, including
            encrypted connections (HTTPS), secure authentication via Supabase, and row-level security
            policies on our database. However, no method of transmission over the Internet is 100%
            secure, and we cannot guarantee absolute security.
          </P>
        </Section>

        <Section title="9. Children&apos;s Privacy">
          <P>
            The Service is not directed to children under 13. We do not knowingly collect personal
            information from children under 13. If you believe we have collected data from a child
            under 13, please contact us and we will delete it promptly.
          </P>
        </Section>

        <Section title="10. Changes to This Policy">
          <P>
            We may update this Privacy Policy from time to time. We will notify you of significant
            changes by posting the updated policy on this page and updating the &quot;Last
            updated&quot; date. Your continued use of the Service after changes constitutes
            acceptance of the updated policy.
          </P>
        </Section>

        <Section title="11. Contact Us">
          <P>
            If you have questions about this Privacy Policy, please contact us at:{' '}
            <a href="mailto:contact@boredgame.lol" style={{ color: 'inherit' }}>
              contact@boredgame.lol
            </a>
          </P>
        </Section>

        <Divider />

        <Typography variant="body2" color="text.secondary">
          See also: <Link href="/terms" style={{ color: 'inherit' }}>Terms of Service</Link>
        </Typography>
      </Stack>
    </Container>
  );
}
