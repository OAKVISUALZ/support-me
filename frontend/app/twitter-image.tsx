// Same card as og:image; X's summary_large_image accepts 1200x630.
import { OG_SIZE, renderLandingOgImage } from '@/lib/og';

export const alt = 'SupportMe — Get tipped in XLM or USDC on Stellar';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default function Image() {
  return renderLandingOgImage();
}
