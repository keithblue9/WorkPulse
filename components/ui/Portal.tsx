'use client'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * Render anak ke <body>. Overlay (sheet, popup, bar seleksi) WAJIB lewat sini: area konten
 * (.wn-main) membentuk stacking context sendiri (z-index 1), sehingga overlay di dalamnya selalu
 * tertimpa tab bar HP (z-index 30) dan tombol aksi di bagian bawah sheet tidak bisa diklik.
 */
export function Portal({ children }: { children: React.ReactNode }) {
  // Langsung tersedia di klien supaya ref & fokus di dalam sheet siap pada efek pertama.
  const [host, setHost] = useState<HTMLElement | null>(() => (typeof document === 'undefined' ? null : document.body))
  useEffect(() => { if (!host) setHost(document.body) }, [host])
  return host ? createPortal(children, host) : null
}
