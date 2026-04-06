import { Metadata } from 'next';
import DiceSkinDetailView from './DiceSkinDetailView';

export const metadata: Metadata = {
  title: 'Dice Skin | boredgame.lol',
  description: 'View a community-created custom d20 dice skin. Preview it in 3D, use it in the random game picker, or fork it to make your own.',
};

export default function DiceSkinDetailPage() {
  return <DiceSkinDetailView />;
}
