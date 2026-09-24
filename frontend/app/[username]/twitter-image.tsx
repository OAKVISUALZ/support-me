// Same card as og:image; X's summary_large_image accepts 1200x630.
import { OG_SIZE, renderCreatorOgImage } from '@/lib/og';
import { fetchCreatorSummary } from './creator-summary';

export const alt = 'Creator profile on SupportMe';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return renderCreatorOgImage(await fetchCreatorSummary(username));
}
