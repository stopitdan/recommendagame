import type { Metadata } from 'next';
import { Suspense } from 'react';
import MapView from './MapView';

export const metadata: Metadata = {
  title: 'Game Map | boredgame.lol',
  description: 'Explore the board game universe. Click clusters to drill into genres, mechanics, and individual games.',
};

export default function MapPage() {
  return (
    <Suspense>
      <MapView />
    </Suspense>
  );
}
