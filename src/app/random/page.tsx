import { Metadata } from 'next';
import RandomGameView from './RandomGameView';

export const metadata: Metadata = {
  title: 'Random Game | Recommend a Game',
  description: 'Discover a random game — roll the dice and see what you get!',
};

export default function RandomPage() {
  return <RandomGameView />;
}
