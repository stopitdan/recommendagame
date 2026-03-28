import { Metadata } from 'next';
import LoginForm from './LoginForm';

export const metadata: Metadata = {
  title: 'Log In | boredgame.lol',
  description: 'Log in to save your game preferences and recommendations.',
};

export default function LoginPage() {
  return <LoginForm />;
}
