import { Metadata } from 'next';
import GameDetailView from './GameDetailView';

export const metadata: Metadata = {
  title: 'Game Details | boredgame.lol',
};

export default function GameDetailPage() {
  return <GameDetailView />;
}
