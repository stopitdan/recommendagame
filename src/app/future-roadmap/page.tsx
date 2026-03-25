import Container from '@mui/material/Container';
import RoadmapView from './RoadmapView';

export const metadata = {
  title: 'Roadmap | Recommend a Game',
  robots: 'noindex, nofollow',
};

export default function RoadmapPage() {
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <RoadmapView />
    </Container>
  );
}
