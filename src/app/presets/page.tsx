import { Metadata } from 'next';
import PresetsView from './PresetsView';

export const metadata: Metadata = {
  title: 'My Presets | Recommend a Game',
  description: 'Your saved game preference presets.',
};

export default function PresetsPage() {
  return <PresetsView />;
}
