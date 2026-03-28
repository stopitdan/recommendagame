import { Metadata } from 'next';
import PresetsView from './PresetsView';

export const metadata: Metadata = {
  title: 'My Presets | boredgame.lol',
  description: 'Your saved game preference presets.',
};

export default function PresetsPage() {
  return <PresetsView />;
}
