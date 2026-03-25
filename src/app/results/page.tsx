import { Suspense } from 'react';
import { Metadata } from 'next';
import ResultsView from './ResultsView';

export const metadata: Metadata = {
  title: 'Your Recommendations | Recommend a Game',
  description: 'Games we think you\'ll love based on your preferences.',
};

export default function ResultsPage() {
  return (
    <Suspense>
      <ResultsView />
    </Suspense>
  );
}
