import type { Metadata } from 'next';
import CollectionView from './CollectionView';

export const metadata: Metadata = {
  title: 'My Collection | boredgame.lol',
  description:
    'Build and manage your game collection. Search for games and add them to your shelf so you can get recommendations from games you already own.',
};

export default function CollectionPage() {
  return <CollectionView />;
}
