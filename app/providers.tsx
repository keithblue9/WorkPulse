'use client'
import { SessionProvider } from 'next-auth/react'
import { Toaster } from 'react-hot-toast'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1e2335',
            color: '#e8eaf2',
            border: '1px solid #2e3550',
            fontSize: '13px',
          },
        }}
      />
    </SessionProvider>
  )
}
