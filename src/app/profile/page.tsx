import { Suspense } from 'react';
import ProfileHub from './ProfileHub';

export const metadata = { title: 'My Profile — Recommend a Game' };

export default function ProfilePage() {
  return (
    <Suspense>
      <ProfileHub />
    </Suspense>
  );
}
