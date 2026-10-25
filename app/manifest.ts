import type { MetadataRoute } from 'next'
import { connectDB } from '@/lib/db'
import { ConfigModel } from '@/models/Config'
import { displayAppName } from '@/lib/appName'

export const dynamic = 'force-dynamic'

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  let appName = displayAppName()
  let appColor = '#4B3BFF'
  try {
    await connectDB()
    const cfg = await ConfigModel.findOne({}).lean() as any
    appName = displayAppName(cfg?.appName)
    // Warna lama bawaan (#4f8ef7) diganti aksen Aurora; warna kustom admin tetap dipakai.
    if (cfg?.appColor && cfg.appColor.toLowerCase() !== '#4f8ef7') appColor = cfg.appColor
  } catch {}
  return {
    name: appName,
    short_name: appName,
    description: 'Team workspace untuk BPD Procurement',
    start_url: '/dashboard',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#F4F3FA',
    theme_color: appColor,
    icons: [
      { src: '/icon-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'maskable' },
      { src: '/icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  }
}
