import { Metadata } from 'next';
import { Suspense } from 'react';
import CompareView from './CompareView';

export const metadata: Metadata = {
  title: 'Compare Games',
  description: 'Compare board games and video games side by side. Players, time, complexity, ratings, and more.',
};

export default function ComparePage() {
  return (
    <Suspense>
      <CompareView />
    </Suspense>
  );
}
