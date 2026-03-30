import type { Metadata } from 'next';
import MapView from './MapView';

export const metadata: Metadata = {
  title: 'Game Map | boredgame.lol',
  description: 'Explore the board game universe. Pick any game and see its neighborhood of similar titles in an interactive graph.',
};

export default function MapPage() {
  return <MapView />;
}
