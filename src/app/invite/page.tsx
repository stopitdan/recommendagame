import { Suspense } from 'react';
import { Metadata } from 'next';
import Container from '@mui/material/Container';
import InviteView from './InviteView';

export const metadata: Metadata = {
  title: 'Game Night Invite',
  description: 'You\'ve been invited to game night! See what game is on the table and join the fun.',
};

export default function InvitePage() {
  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Suspense>
        <InviteView />
      </Suspense>
    </Container>
  );
}
