import { Metadata } from 'next';
import GameDetailView from './GameDetailView';

export const metadata: Metadata = {
  title: 'Game Details | Recommend a Game',
};

export default function GameDetailPage() {
  return <GameDetailView />;
}
