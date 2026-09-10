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
    // Keep lucide tree-shaken. Do not optimize @eims/shared — Next's barrel
    // split drops newly exported ops enums and crashes staff pages on .map.
    optimizePackageImports: ['lucide-react'],
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
    ],
  },
};

export default withBundleAnalyzer(nextConfig);
