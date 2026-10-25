'use client'
import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import toast from 'react-hot-toast'

const MINE = process.env.NEXT_PUBLIC_BUILD_ID || ''

/**
 * Aplikasi yang dibiarkan terbuka (PWA di HP) tetap menjalankan kode lama setelah deploy.
 * Komponen ini mengecek versi server saat aplikasi kembali aktif, berpindah halaman, dan tiap 5 menit;
 * bila berbeda → muat ulang otomatis (saat tidak sedang mengetik), sehingga semua orang selalu di versi terbaru.
 */
export default function VersionWatch() {
  const pathname = usePathname()
  const reloading = useRef(false)
  const last = useRef(0)

  async function check(force = false) {
    if (!MINE || reloading.current) return
    const now = Date.now(); if (!force && now - last.current < 20000) return
    last.current = now
    try {
      const r = await fetch('/api/version', { cache: 'no-store' }); if (!r.ok) return
      const { build } = await r.json()
      if (!build || build === MINE) return
      // Pengaman: untuk satu versi server, muat ulang otomatis paling banyak sekali (hindari putaran reload).
      let tried = ''; try { tried = sessionStorage.getItem('wins-reload-for') || '' } catch {}
      if (tried === build) return
      try { sessionStorage.setItem('wins-reload-for', build) } catch {}
      reloading.current = true
      const go = () => {
        const a = document.activeElement as HTMLElement | null
        const typing = !!a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable)
        const sheet = !!document.querySelector('.modal-overlay')
        if ((typing || sheet) && !document.hidden) { setTimeout(go, 4000); return }   // jangan ganggu yang sedang mengisi form
        // Buang cache halaman lama agar HTML versi baru yang dimuat
        if ('caches' in window) caches.keys().then(ks => Promise.all(ks.map(k => caches.delete(k)))).finally(() => location.reload())
        else location.reload()
      }
      toast('Versi baru WINS tersedia — memuat ulang…', { icon: '✨', duration: 2500 })
      setTimeout(go, 1200)
    } catch { /* offline: coba lagi nanti */ }
  }

  useEffect(() => {
    check(true)
    const onVis = () => { if (!document.hidden) check(true) }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('focus', onVis)
    window.addEventListener('pageshow', onVis)
    const id = setInterval(() => check(), 5 * 60 * 1000)
    return () => { document.removeEventListener('visibilitychange', onVis); window.removeEventListener('focus', onVis); window.removeEventListener('pageshow', onVis); clearInterval(id) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { check() }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}
