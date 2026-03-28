import { Metadata } from 'next';
import SignupForm from './SignupForm';

export const metadata: Metadata = {
  title: 'Sign Up | boredgame.lol',
  description: 'Create an account to save your game preferences and get personalized recommendations.',
};

export default function SignupPage() {
  return <SignupForm />;
}
