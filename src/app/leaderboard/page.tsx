import { Metadata } from 'next';
import LeaderboardView from './LeaderboardView';

export const metadata: Metadata = {
  title: 'Leaderboard | Recommend a Game',
  description: 'The top-rated games across board games, video games, and word games.',
};

export default function LeaderboardPage() {
  return <LeaderboardView />;
}
