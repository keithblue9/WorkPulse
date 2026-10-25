import type { NextConfig } from "next"

// Identitas build: dipakai klien untuk mendeteksi versi baru setelah deploy (lihat components/VersionWatch).
const BUILD_ID = process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID || `local-${Date.now()}`

const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: true },
  env: { NEXT_PUBLIC_BUILD_ID: BUILD_ID },
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
