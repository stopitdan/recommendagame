import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
// import MapView from './MapView'; // Hidden until hierarchical clustering rearchitecture

export const metadata: Metadata = {
  title: 'Game Map | boredgame.lol',
  description: 'Explore the board game universe. Pick any game and see its neighborhood of similar titles in an interactive graph.',
};

export default function MapPage() {
  // Map hidden until rearchitected with hierarchical clustering.
  // All code remains -- just uncomment MapView and remove redirect.
  redirect('/');
  // return <MapView />;
}
