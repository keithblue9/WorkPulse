import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: true },
  experimental: {
    serverActions: { bodySizeLimit: '10mb' },
  },
  // Menu yang sudah dihapus: bookmark lama diarahkan ke dashboard (data tetap utuh di DB).
  async redirects() {
    return [
      { source: '/dashboard/meetings', destination: '/dashboard', permanent: false },
      { source: '/dashboard/playground', destination: '/dashboard', permanent: false },
    ]
  },
}

export default nextConfig
