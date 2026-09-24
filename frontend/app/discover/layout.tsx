import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Discover Creators',
  description: 'Search and browse creators to support on SupportMe.',
};

export default function DiscoverLayout({ children }: { children: React.ReactNode }) {
  return children;
}
