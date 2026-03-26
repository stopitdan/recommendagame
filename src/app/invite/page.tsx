import { Metadata } from 'next';
import Container from '@mui/material/Container';
import InviteView from './InviteView';

export const metadata: Metadata = {
  title: 'Game Night Invite',
};

export default function InvitePage() {
  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <InviteView />
    </Container>
  );
}
