import { Metadata } from 'next';
import FavoritesView from './FavoritesView';

export const metadata: Metadata = {
  title: 'My Favorites | boredgame.lol',
  description: 'Your saved favorite games.',
};

export default function FavoritesPage() {
  return <FavoritesView />;
}
