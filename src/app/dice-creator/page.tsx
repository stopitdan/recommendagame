import { Metadata } from 'next';
import { Suspense } from 'react';
import DiceCreatorView from './DiceCreatorView';

export const metadata: Metadata = {
  title: 'Dice Creator | boredgame.lol',
  description: 'Design your own custom d20 dice skin with colors, shaders, images, and more.',
};

export default function DiceCreatorPage() {
  return (
    <Suspense>
      <DiceCreatorView />
    </Suspense>
  );
}
