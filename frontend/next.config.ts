import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // DALL-E generated outfit images
      { protocol: 'https', hostname: 'oaidalleapiprodscus.blob.core.windows.net' },
      // Unsplash fallback images
      { protocol: 'https', hostname: 'images.unsplash.com' },
      // Local backend uploads
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
    ];
  },
};

export default nextConfig;
