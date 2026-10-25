import type { Metadata, Viewport } from 'next'
import './globals.css'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import localFont from 'next/font/local'
import { THEME_BOOT_SCRIPT } from '@/lib/themeKey'
import { Providers } from './providers'
import { connectDB } from '@/lib/db'
import { ConfigModel } from '@/models/Config'
import { displayAppName } from '@/lib/appName'

// App name is sourced from Config (config.appName) so renaming the app in-app also
// updates the browser tab title, PWA name, and iOS home-screen title.
// Display face (headings, angka besar). Self-hosted lewat next/font: tanpa request ke Google, tanpa layout shift.
const display = localFont({
  src: '../node_modules/@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2',
  variable: '--font-display',
  weight: '200 800',
  display: 'swap',
})

export async function generateMetadata(): Promise<Metadata> {
  let appName = displayAppName()
  try {
    await connectDB()
    const cfg = await ConfigModel.findOne({}).lean() as any
    appName = displayAppName(cfg?.appName)
  } catch {}
  return {
    title: appName,
    description: 'Team workspace',
    manifest: '/manifest.webmanifest',
    appleWebApp: {
      capable: true,
      statusBarStyle: 'black-translucent',
      title: appName,
    },
    icons: {
      icon: '/icon-192.svg',
      apple: '/icon-192.svg',
    },
  }
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F4F3FA' },
    { media: '(prefers-color-scheme: dark)', color: '#0B0D17' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',  // for iPhone notch / dynamic island
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable} ${display.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icon-192.svg" />
      </head>
      <body>
        <Providers>{children}</Providers>
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js').then(function(reg){
                // Cek update tiap kali tab difokuskan + tiap 60 detik
                try { reg.update(); } catch(e){}
                setInterval(function(){ try { reg.update(); } catch(e){} }, 60000);
                document.addEventListener('visibilitychange', function(){ if (!document.hidden) { try { reg.update(); } catch(e){} } });
              }).catch(function(){});
              // Begitu SW baru ambil alih, reload sekali biar dapet versi terbaru
              var refreshing = false;
              navigator.serviceWorker.addEventListener('controllerchange', function(){
                if (refreshing) return; refreshing = true; window.location.reload();
              });
            });
          }
        `}} />
      </body>
    </html>
  )
}
