import { Metadata } from 'next';
import DiceGalleryView from './DiceGalleryView';

export const metadata: Metadata = {
  title: 'Dice Gallery | Recommend a Game',
  description: 'Browse and vote on custom d20 dice skins created by the community.',
};

export default function DiceGalleryPage() {
  return <DiceGalleryView />;
}
