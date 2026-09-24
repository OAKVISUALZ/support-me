import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Community Activity',
  description:
    'See new signups, top creators, and total earnings across the SupportMe community.',
};

export default function ActivityLayout({ children }: { children: React.ReactNode }) {
  return children;
}
