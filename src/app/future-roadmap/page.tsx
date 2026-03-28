import Container from '@mui/material/Container';
import RoadmapView from './RoadmapView';

export const metadata = {
  title: 'Roadmap | boredgame.lol',
  robots: 'noindex, nofollow',
};

export default function RoadmapPage() {
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <RoadmapView />
    </Container>
  );
}
