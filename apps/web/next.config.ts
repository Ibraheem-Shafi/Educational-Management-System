import type { NextConfig } from 'next';
import bundleAnalyzer from '@next/bundle-analyzer';

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig: NextConfig = {
  // Required for the production Docker image (see docker/web.Dockerfile).
  output: 'standalone',
  transpilePackages: ['@eims/types', '@eims/shared'],
  experimental: {
    // Avoid loading the full @eims/shared barrel on every client import (reduces HMR churn).
    optimizePackageImports: ['@eims/shared', 'lucide-react'],
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
    ],
  },
};

export default withBundleAnalyzer(nextConfig);
