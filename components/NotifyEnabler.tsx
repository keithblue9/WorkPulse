'use client'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { ensurePushSubscription } from '@/lib/pushClient'

// Pastikan SEMUA user (bukan cuma yg buka QuickNotes) bisa aktifkan notifikasi harian.
// - Kalau izin sudah 'granted' → daftarkan subscription diam-diam.
// - Kalau 'default' → tampilkan banner "Aktifkan Notifikasi" (butuh tap = syarat iOS).
export default function NotifyEnabler() {
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return
    const perm = Notification.permission
    if (perm === 'granted') {
      // sudah izin → pastikan subscription terdaftar di server
      ensurePushSubscription().catch(() => {})
      return
    }
    if (perm === 'default') {
      let dismissed = false
      try { dismissed = !!localStorage.getItem('wins-notif-banner-dismissed') } catch {}
      if (!dismissed) setTimeout(() => setShow(true), 3500)
    }
  }, [])

  async function enable() {
    setBusy(true)
    try {
      const r = await ensurePushSubscription()
      if (r.ok) { toast.success('Notifikasi aktif! Kamu akan terima pengingat harian 🔔'); setShow(false); try { localStorage.setItem('wins-notif-banner-dismissed', '1') } catch {} }
      else if (r.reason === 'denied') toast.error('Izin notifikasi ditolak. Aktifkan manual lewat setelan browser/HP.')
      else if (r.reason === 'unsupported') toast.error('Perangkat/browser belum mendukung. iOS: install app ke Home Screen dulu, lalu buka dari sana.')
      else if (r.reason === 'no-vapid-key') toast.error('VAPID key belum di-set (hubungi admin).')
      else toast.error('Gagal mengaktifkan: ' + (r.reason || ''))
    } finally { setBusy(false) }
  }

  function dismiss() { setShow(false); try { localStorage.setItem('wins-notif-banner-dismissed', '1') } catch {} }

  if (!show) return null
  return (
    <div className="card scale-in" style={{ position: 'fixed', left: 18, bottom: 18, zIndex: 290, width: 320, maxWidth: 'calc(100vw - 36px)', padding: 14, boxShadow: '0 16px 40px rgba(0,0,0,0.22)', borderRadius: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>🔔 Aktifkan Notifikasi</div>
        <button onClick={dismiss} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 18, lineHeight: 1 }}>×</button>
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--text2)', lineHeight: 1.55 }}>Dapatkan pengingat <b>absen harian</b> &amp; <b>agenda hari ini</b> langsung di HP kamu tiap pagi.</div>
      <button onClick={enable} disabled={busy} className="btn btn-sm btn-primary">{busy ? 'Mengaktifkan…' : 'Aktifkan Sekarang'}</button>
    </div>
  )
}
