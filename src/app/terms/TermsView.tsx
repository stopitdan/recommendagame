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

export default function TermsView() {
  return (
    <Container maxWidth="md" sx={{ py: 8 }}>
      <Typography variant="h3" fontWeight={800} sx={{ mb: 1 }}>
        Terms of Service
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
        Last updated: March 27, 2026
      </Typography>

      <Divider sx={{ mb: 4 }} />

      <Stack spacing={4}>
        <Section title="1. Acceptance of Terms">
          <P>
            By accessing or using boredgame.lol (&quot;the Service&quot;), you agree to be bound
            by these Terms of Service (&quot;Terms&quot;). If you do not agree to these Terms, you
            may not use the Service.
          </P>
          <P>
            We reserve the right to modify these Terms at any time. Continued use of the Service
            after changes constitutes acceptance of the updated Terms. We will update the &quot;Last
            updated&quot; date when changes are made.
          </P>
        </Section>

        <Section title="2. Description of Service">
          <P>
            boredgame.lol is a game recommendation platform that helps users discover board games,
            video games, word games, and party games based on their preferences. The Service includes
            personalized recommendations, game browsing, user reviews, favorites, a dice roller, and
            community features such as the Dice Gallery.
          </P>
        </Section>

        <Section title="3. User Accounts">
          <P>
            Some features require creating an account. When you create an account, you agree to:
          </P>
          <Box component="ul" sx={{ pl: 3, mt: 0 }}>
            <Li>Provide accurate and complete information</Li>
            <Li>Maintain the security of your password and account</Li>
            <Li>Notify us promptly of any unauthorized access</Li>
            <Li>Accept responsibility for all activity under your account</Li>
          </Box>
          <P>
            We reserve the right to suspend or terminate accounts that violate these Terms.
          </P>
        </Section>

        <Section title="4. Acceptable Use">
          <P>You agree not to:</P>
          <Box component="ul" sx={{ pl: 3, mt: 0 }}>
            <Li>Use the Service for any unlawful purpose</Li>
            <Li>Attempt to gain unauthorized access to any part of the Service</Li>
            <Li>Interfere with or disrupt the Service or its infrastructure</Li>
            <Li>Scrape, crawl, or use automated tools to extract data from the Service</Li>
            <Li>Upload malicious content, spam, or harmful material</Li>
            <Li>Impersonate other users or entities</Li>
            <Li>Circumvent any rate limits, security measures, or access controls</Li>
            <Li>Use the Service to harass, abuse, or harm others</Li>
          </Box>
        </Section>

        <Section title="5. User-Generated Content">
          <P>
            The Service allows you to create and share content, including custom dice skins, reviews,
            and other materials (&quot;User Content&quot;). By submitting User Content, you:
          </P>
          <Box component="ul" sx={{ pl: 3, mt: 0 }}>
            <Li>
              Retain ownership of your User Content
            </Li>
            <Li>
              Grant us a non-exclusive, worldwide, royalty-free license to display, distribute, and
              make your public User Content available through the Service
            </Li>
            <Li>
              Represent that you have the right to submit the content and that it does not infringe
              on any third-party rights
            </Li>
            <Li>
              Agree that public User Content (such as public dice skins) may be viewed, used, and
              voted on by other users
            </Li>
          </Box>
          <P>
            We reserve the right to remove User Content that violates these Terms or is otherwise
            objectionable, at our sole discretion.
          </P>
        </Section>

        <Section title="6. Intellectual Property">
          <P>
            The Service, including its design, code, logos, and original content, is owned by
            boredgame.lol and protected by intellectual property laws. You may not copy, modify,
            distribute, or create derivative works from the Service without our written permission.
          </P>
          <P>
            Game data displayed on the Service (names, descriptions, images, ratings) is sourced from
            third-party providers including BoardGameGeek, RAWG, and IGDB, and remains the property
            of their respective owners.
          </P>
        </Section>

        <Section title="7. Recommendations Disclaimer">
          <P>
            Game recommendations are generated by an automated system and are provided &quot;as
            is.&quot; We do not guarantee that recommendations will match your preferences perfectly.
            Recommendations are based on the data you provide, community feedback, and algorithmic
            scoring, and should be treated as suggestions, not endorsements.
          </P>
        </Section>

        <Section title="8. Third-Party Links &amp; Services">
          <P>
            The Service may contain links to third-party websites, game stores, or services. We are
            not responsible for the content, privacy practices, or availability of these external
            sites. Accessing third-party links is at your own risk.
          </P>
        </Section>

        <Section title="9. Limitation of Liability">
          <P>
            To the maximum extent permitted by law, boredgame.lol and its operators shall not be
            liable for any indirect, incidental, special, consequential, or punitive damages arising
            from your use of the Service. This includes, but is not limited to, loss of data,
            profits, or goodwill.
          </P>
          <P>
            The Service is provided &quot;as is&quot; and &quot;as available&quot; without warranties
            of any kind, either express or implied, including but not limited to warranties of
            merchantability, fitness for a particular purpose, and non-infringement.
          </P>
        </Section>

        <Section title="10. Indemnification">
          <P>
            You agree to indemnify and hold harmless boredgame.lol, its operators, and affiliates
            from any claims, damages, losses, or expenses (including legal fees) arising from your
            use of the Service, your User Content, or your violation of these Terms.
          </P>
        </Section>

        <Section title="11. Termination">
          <P>
            We may suspend or terminate your access to the Service at any time, with or without
            cause, and with or without notice. Upon termination, your right to use the Service ceases
            immediately. Provisions of these Terms that by their nature should survive termination
            (including intellectual property, limitation of liability, and indemnification) will
            remain in effect.
          </P>
        </Section>

        <Section title="12. Governing Law">
          <P>
            These Terms shall be governed by and construed in accordance with the laws of the United
            States, without regard to conflict of law principles. Any disputes arising from these
            Terms or the Service shall be resolved in the courts of competent jurisdiction.
          </P>
        </Section>

        <Section title="13. Contact Us">
          <P>
            If you have questions about these Terms of Service, please contact us at:{' '}
            <a href="mailto:contact@boredgame.lol" style={{ color: 'inherit' }}>
              contact@boredgame.lol
            </a>
          </P>
        </Section>

        <Divider />

        <Typography variant="body2" color="text.secondary">
          See also: <Link href="/privacy" style={{ color: 'inherit' }}>Privacy Policy</Link>
        </Typography>
      </Stack>
    </Container>
  );
}
