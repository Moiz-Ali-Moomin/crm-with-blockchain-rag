import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { allowedOrigins: ['localhost:3000'] },
  },
  images: {
    domains: ['localhost', 'avatars.githubusercontent.com'],
  },
};

export default nextConfig;
