import { Metadata } from 'next';
import BrowseView from './BrowseView';

export const metadata: Metadata = {
  title: 'Browse Games | Recommend a Game',
  description: 'Browse and filter games by category, mechanic, theme, and more.',
};

export default function BrowsePage() {
  return <BrowseView />;
}
