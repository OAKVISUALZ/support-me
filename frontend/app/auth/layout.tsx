import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Set Up Your Profile',
  description: 'Choose a username and finish setting up your SupportMe creator profile.',
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
