'use client'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { ensurePushSubscription } from '@/lib/pushClient'
import { Icon } from '@/components/ui'

type St = { supported: boolean; perm: NotificationPermission | 'unsupported'; standalone: boolean; ios: boolean; devices: number | null; serverReady: boolean | null; here: boolean }

// Pengaturan notifikasi di Profil: status perangkat ini, aktifkan, dan kirim tes.
// Tidak bergantung pada banner "Aktifkan Notifikasi" (yang bisa ditutup/terlewat).
export default function NotifySettings() {
  const [st, setSt] = useState<St | null>(null)
  const [busy, setBusy] = useState<'' | 'enable' | 'test'>('')

  const refresh = useCallback(async () => {
    const supported = typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    const standalone = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true
    let here = false
    if (supported) { try { const reg = await navigator.serviceWorker.getRegistration(); here = !!(await reg?.pushManager.getSubscription()) } catch {} }
    let devices: number | null = null, serverReady: boolean | null = null
    try { const r = await fetch('/api/push/test', { cache: 'no-store' }); const j = await r.json(); if (r.ok) { devices = j.data.devices; serverReady = j.data.serverReady } } catch {}
    setSt({ supported, perm: supported ? Notification.permission : 'unsupported', standalone, ios, devices, serverReady, here })
  }, [])
  useEffect(() => { refresh() }, [refresh])

  async function enable() {
    setBusy('enable')
    try {
      const r = await ensurePushSubscription()
      if (r.ok) toast.success('Notifikasi aktif di perangkat ini')
      else if (r.reason === 'denied') toast.error('Izin notifikasi ditolak. Buka setelan browser/HP → Notifikasi → izinkan untuk WINS.')
      else if (r.reason === 'unsupported') toast.error('Perangkat belum mendukung. Di iPhone: Bagikan → Tambah ke Layar Utama, lalu buka WINS dari ikon itu.')
      else if (r.reason === 'no-vapid-key') toast.error('Kunci notifikasi (VAPID) belum di-set di server. Hubungi admin.')
      else toast.error('Gagal mengaktifkan: ' + (r.reason || ''))
    } finally { setBusy(''); refresh() }
  }
  async function test() {
    setBusy('test')
    try {
      const r = await fetch('/api/push/test', { method: 'POST' }); const j = await r.json().catch(() => ({}))
      if (!r.ok) toast.error(j.error || 'Gagal mengirim tes')
      else if (!j.data.sent) toast.error(j.data.total ? 'Perangkat terdaftar tapi pengiriman gagal. Aktifkan ulang notifikasi.' : 'Belum ada perangkat terdaftar. Ketuk "Aktifkan" dulu.')
      else toast.success(`Tes terkirim ke ${j.data.sent} perangkat. Cek notifikasi HP/laptop.`)
    } finally { setBusy(''); refresh() }
  }

  const ok = !!st && st.perm === 'granted' && st.here
  const status = !st ? 'Memeriksa…'
    : !st.supported ? (st.ios && !st.standalone ? 'Perlu dipasang ke Layar Utama dulu (iPhone/iPad)' : 'Browser ini tidak mendukung notifikasi')
    : st.perm === 'denied' ? 'Diblokir di setelan browser/HP'
    : ok ? 'Aktif di perangkat ini' : 'Belum aktif di perangkat ini'

  return (
    <section className="au-col rise" style={{ gap: 8 }}>
      <span className="lbl">Notifikasi</span>
      <div className="au-ig">
        <div className="au-igr">
          <span className="ti au-pti" style={{ background: ok ? 'var(--ok)' : 'var(--warn-bar)' }}><Icon name="bolt" size={16} stroke={2.1} /></span>
          <span className="au-col" style={{ flex: 1, minWidth: 0, gap: 2 }}><b className="au-small">{status}</b>
            <span className="au-xs au-muted">{st?.devices != null ? `${st.devices} perangkat terdaftar untuk akunmu` : 'Pengingat harian, reminder Notes, dan status reimburse'}{st?.serverReady === false ? ' · server belum dikonfigurasi' : ''}</span></span>
        </div>
        <div className="au-igr" style={{ gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-sm" disabled={!!busy || !st?.supported || st?.perm === 'denied'} onClick={enable}>{busy === 'enable' ? 'Mengaktifkan…' : ok ? 'Daftarkan ulang' : 'Aktifkan'}</button>
          <button type="button" className="btn btn-sm btn-primary" disabled={!!busy || !st?.devices} onClick={test}>{busy === 'test' ? 'Mengirim…' : 'Kirim tes'}</button>
        </div>
      </div>
      {st?.ios && !st.standalone && <span className="au-xs au-muted" style={{ padding: '0 4px' }}>iPhone/iPad: notifikasi hanya jalan dari aplikasi yang dipasang. Safari → Bagikan → Tambah ke Layar Utama, lalu buka WINS dari ikon tersebut dan ketuk Aktifkan.</span>}
    </section>
  )
}
