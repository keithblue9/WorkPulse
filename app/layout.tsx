import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Providers } from './providers'
import { connectDB } from '@/lib/db'
import { ConfigModel } from '@/models/Config'

// App name is sourced from Config (config.appName) so renaming the app in-app also
// updates the browser tab title, PWA name, and iOS home-screen title.
export async function generateMetadata(): Promise<Metadata> {
  let appName = 'WorkPulse'
  try {
    await connectDB()
    const cfg = await ConfigModel.findOne({}).lean() as any
    if (cfg?.appName) appName = cfg.appName
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
  themeColor: '#4f8ef7',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',  // for iPhone notch / dynamic island
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icon-192.svg" />
      </head>
      <body style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
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
