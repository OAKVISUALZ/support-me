import type { MetadataRoute } from 'next';

// Served at /manifest.webmanifest and linked from <head> automatically by Next.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SupportMe',
    short_name: 'SupportMe',
    description: 'Support your favorite creators with tips on Stellar.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#fdfcf7',
    theme_color: '#ffd84d',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
