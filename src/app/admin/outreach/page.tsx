import { Metadata } from 'next';
import OutreachView from './OutreachView';

export const metadata: Metadata = {
  title: 'Outreach Tracker | Admin',
  robots: { index: false, follow: false },
};

export default function OutreachPage() {
  return <OutreachView />;
}
