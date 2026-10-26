'use client'
import { SessionProvider } from 'next-auth/react'
import { Toaster } from 'react-hot-toast'
import { ThemeProvider } from '@/lib/theme'
import VersionWatch from '@/components/VersionWatch'
import { watchMutations } from '@/lib/fetchCache'

// Pasang sedini mungkin (sebelum halaman pertama memuat data).
watchMutations()

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        {children}
        <VersionWatch />
        <Toaster position="top-right" toastOptions={{
          style: { background: 'var(--bg3)', color: 'var(--text)', border: '1px solid var(--border)', fontSize: '13px' },
          success: { iconTheme: { primary: 'var(--green)', secondary: 'var(--bg2)' } },
          error:   { iconTheme: { primary: 'var(--red)',   secondary: 'var(--bg2)' } },
        }} />
      </ThemeProvider>
    </SessionProvider>
  )
}
