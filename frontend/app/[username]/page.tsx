import type { Metadata } from 'next';
import CreatorProfileClient from './CreatorProfileClient';
import { fetchCreatorSummary } from './creator-summary';

type ParamsPromise = Promise<{ username: string }>;

export async function generateMetadata({ params }: { params: ParamsPromise }): Promise<Metadata> {
  const { username } = await params;
  const creator = await fetchCreatorSummary(username);

  if (!creator) {
    return {
      title: 'Creator not found — SupportMe',
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const name = creator.displayName || creator.username;
  const description = creator.bio?.trim() || `Support ${name} with a tip on SupportMe.`;
  const title = `Support ${name} (@${creator.username})`;

  // og:image / twitter:image come from the generated opengraph-image.tsx and
  // twitter-image.tsx next to this file (a 1200x630 card with the avatar).
  return {
    title,
    description,
    alternates: {
      canonical: `/${username}`,
    },
    robots: {
      index: true,
      follow: true,
    },
    openGraph: {
      title,
      description,
      type: 'profile',
      siteName: 'SupportMe',
      url: `/${creator.username}`,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default function CreatorProfilePage({ params }: { params: ParamsPromise }) {
  return <CreatorProfileClient params={params} />;
}
