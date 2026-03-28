import { Suspense } from 'react';
import ProfileHub from './ProfileHub';

export const metadata = { title: 'My Profile — boredgame.lol' };

export default function ProfilePage() {
  return (
    <Suspense>
      <ProfileHub />
    </Suspense>
  );
}
