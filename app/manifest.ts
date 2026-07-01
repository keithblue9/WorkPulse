import type { MetadataRoute } from 'next'
import { connectDB } from '@/lib/db'
import { ConfigModel } from '@/models/Config'

export const dynamic = 'force-dynamic'

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  let appName = 'WinS'
  let appColor = '#4f8ef7'
  try {
    await connectDB()
    const cfg = await ConfigModel.findOne({}).lean() as any
    if (cfg?.appName) appName = cfg.appName
    if (cfg?.appColor) appColor = cfg.appColor
  } catch {}
  return {
    name: appName,
    short_name: appName,
    description: 'Team workspace untuk BPD Procurement',
    start_url: '/dashboard',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0f1117',
    theme_color: appColor,
    icons: [
      { src: '/icon-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'maskable' },
      { src: '/icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  }
}
