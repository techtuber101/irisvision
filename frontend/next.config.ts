import type { NextConfig } from 'next';

const nextConfig = (): NextConfig => {
  const isExport = process.env.NODE_ENV === 'production' && process.env.NEXT_EXPORT === 'true';
  
  return {
    output: isExport ? 'export' : (process.env.NEXT_OUTPUT as 'standalone') || undefined,
    trailingSlash: true,
    images: {
      unoptimized: true,
    },
    eslint: {
      ignoreDuringBuilds: true,
    },
    typescript: {
      ignoreBuildErrors: true,
    },
    
    // Only add rewrites for non-export builds
    ...(isExport ? {} : {
      async rewrites() {
        return [
          {
            source: '/ingest/static/:path*',
            destination: 'https://eu-assets.i.posthog.com/static/:path*',
          },
          {
            source: '/ingest/:path*',
            destination: 'https://eu.i.posthog.com/:path*',
          },
          {
            source: '/ingest/flags',
            destination: 'https://eu.i.posthog.com/flags',
          },
        ];
      },
    }),
    skipTrailingSlashRedirect: true,
  };
};

export default nextConfig;
