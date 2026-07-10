'use client'
import { useEffect, useState } from 'react'

// Banner install PWA khusus guest/eksternal — hanya ajakan install, TANPA push notif.
// (Guest ga butuh absen/pengingat, cukup akses cepat via home screen.)
export default function InstallPWA() {
  const [show, setShow] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    // sudah ke-install (standalone) → jangan tampilkan
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true
    if (standalone) return
    let dismissed = false
    try { dismissed = !!localStorage.getItem('wp-install-banner-dismissed') } catch {}
    if (dismissed) return

    // iOS: ga ada beforeinstallprompt, kasih instruksi manual
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream
    setIsIOS(ios)

    const handler = (e: any) => { e.preventDefault(); setDeferredPrompt(e); setShow(true) }
    window.addEventListener('beforeinstallprompt', handler)
    // iOS Safari: tampilkan banner instruksi setelah delay
    if (ios) setTimeout(() => setShow(true), 3000)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function install() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    try { await deferredPrompt.userChoice } catch {}
    setDeferredPrompt(null); dismiss()
  }
  function dismiss() { setShow(false); try { localStorage.setItem('wp-install-banner-dismissed', '1') } catch {} }

  if (!show) return null

  return (
    <div style={{ position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 300, width: 'min(420px, calc(100vw - 24px))', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 14, boxShadow: '0 12px 40px rgba(0,0,0,0.18)', padding: 16, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 20 }}>📲</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 3 }}>Install WorkPulse</div>
        {isIOS ? (
          <div style={{ fontSize: 11.5, color: 'var(--text2)', lineHeight: 1.5 }}>
            Tap tombol <b>Bagikan</b> (⬆️) di Safari, lalu pilih <b>“Add to Home Screen”</b> untuk akses cepat seperti aplikasi.
          </div>
        ) : (
          <div style={{ fontSize: 11.5, color: 'var(--text2)', lineHeight: 1.5 }}>Pasang ke layar utama untuk akses cepat, tampil layar penuh seperti aplikasi.</div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          {!isIOS && deferredPrompt && <button onClick={install} className="btn btn-primary btn-sm">Install</button>}
          <button onClick={dismiss} className="btn btn-sm">{isIOS ? 'Mengerti' : 'Nanti'}</button>
        </div>
      </div>
      <button onClick={dismiss} className="btn btn-icon btn-sm" style={{ flexShrink: 0 }}>✕</button>
    </div>
  )
}
