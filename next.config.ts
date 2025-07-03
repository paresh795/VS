import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  devIndicators: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        hostname: 'buokjgqspmdiuyacagez.supabase.co',
      },
      {
        hostname: 'fal.media',
      }
    ],
  },
}

export default nextConfig
