import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Link from 'next/link';

export const metadata = {
  title: 'Check Your Email | Recommend a Game',
};

export default function ConfirmEmailPage() {
  return (
    <Box
      component="main"
      sx={{
        minHeight: '80vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        py: 4,
      }}
    >
      <Container maxWidth="xs">
        <Stack spacing={3} alignItems="center" textAlign="center">
          <Typography sx={{ fontSize: '4rem' }}>📧</Typography>
          <Typography variant="h4" fontWeight={800}>
            Check Your Email
          </Typography>
          <Typography variant="body1" color="text.secondary">
            We sent a confirmation link to your email address. Click the link to activate your account and start getting recommendations.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Didn&apos;t receive it? Check your spam folder or try signing up again.
          </Typography>
          <Link
            href="/login"
            style={{
              marginTop: 16,
              padding: '8px 24px',
              border: '1px solid rgba(91, 79, 219, 0.5)',
              borderRadius: 8,
              color: '#5B4FDB',
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '0.9rem',
            }}
          >
            Back to Login
          </Link>
        </Stack>
      </Container>
    </Box>
  );
}
