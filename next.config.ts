import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: true },
  // Increase body size for base64 uploads (evidence, login backgrounds, etc)
  experimental: {
    serverActions: { bodySizeLimit: '10mb' },
  },
  // For pages router style API; safe to include
  api: { bodyParser: { sizeLimit: '10mb' } } as any,
}

export default nextConfig
