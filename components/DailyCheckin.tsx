'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'

const NO_PRESENSI_ROLES = ['external', 'guest']
function localToday() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Small daily attendance check-in (formerly inside the Wibi bubble). Shows only when
// today's attendance isn't recorded yet. No chat — just a quick prompt + type buttons.
export default function DailyCheckin() {
  const { data: session } = useSession()
  const user = session?.user as any
  const [show, setShow] = useState(false)
  const [step, setStep] = useState<'ask' | 'choose'>('ask')
  const [types, setTypes] = useState<any[]>([])
  const [profile, setProfile] = useState<any>(null)

  useEffect(() => {
    if (!user) return
    const roles: string[] = (user.roles && user.roles.length) ? user.roles : (user.role ? [user.role] : [])
    const skip = roles.some((r: string) => NO_PRESENSI_ROLES.includes(String(r).toLowerCase()))
    if (skip) return
    const key = `wins-checkin-${localToday()}`
    let cancelled = false
    ;(async () => {
      try { if (localStorage.getItem(key)) return } catch { return }
      try {
        const pr = await fetch('/api/profile').then(r => r.json())
        if (!pr?.data) return
        const prRoles = (pr.data?.roles && pr.data.roles.length) ? pr.data.roles : (pr.data?.role ? [pr.data.role] : [])
        if (prRoles.some((r: string) => NO_PRESENSI_ROLES.includes(String(r).toLowerCase()))) return
        const month = localToday().slice(0, 7)
        const att = await fetch(`/api/attendance?userId=${pr.data._id}&month=${month}`).then(r => r.json())
        const done = (att?.data || []).some((a: any) => a.date === localToday())
        if (done) { try { localStorage.setItem(key, '1') } catch {}; return }
        const cfg = await fetch('/api/config').then(r => r.json())
        if (cancelled) return
        setProfile(pr.data)
        setTypes((cfg.data?.attendanceTypes || []).filter((t: any) => t.active))
        setTimeout(() => { if (!cancelled) setShow(true) }, 1500)
      } catch { /* best-effort */ }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email])

  function dismiss() { setShow(false); try { localStorage.setItem(`wins-checkin-${localToday()}`, '1') } catch {} }

  async function submit(type: any) {
    try {
      await fetch('/api/attendance', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: profile?._id, userName: user?.name, date: localToday(), type: type.key, slots: [{ from: '08:00', to: '17:00', type: type.key }] }),
      })
      toast.success(`Presensi ${type.label} tercatat! 💪`)
    } catch { toast.error('Gagal mencatat presensi') }
    dismiss()
  }

  if (!show) return null
  const first = user?.name?.split(' ')[0] || ''
  return (
    <div className="card scale-in" style={{ position: 'fixed', right: 18, bottom: 18, zIndex: 300, width: 320, maxWidth: 'calc(100vw - 32px)', padding: 16, boxShadow: '0 16px 40px rgba(0,0,0,0.22)', borderRadius: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700 }}>Halo {first}! 👋</div>
        <button onClick={dismiss} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 18, lineHeight: 1 }}>×</button>
      </div>
      {step === 'ask' ? (
        <>
          <div style={{ fontSize: 12.5, color: 'var(--text2)', margin: '6px 0 12px' }}>Sudah mengisi daftar hadir hari ini?</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setStep('choose')} className="btn btn-sm btn-primary" style={{ flex: 1 }}>Belum, isi sekarang</button>
            <button onClick={dismiss} className="btn btn-sm" style={{ flex: 1 }}>Sudah</button>
          </div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 12.5, color: 'var(--text2)', margin: '6px 0 12px' }}>Pilih tipe kehadiran hari ini:</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {types.map((t: any) => (
              <button key={t.key} onClick={() => submit(t)} className="btn btn-sm" style={{ justifyContent: 'flex-start' }}>{t.label}</button>
            ))}
            {types.length === 0 && <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>Tipe kehadiran belum dikonfigurasi.</div>}
          </div>
        </>
      )}
    </div>
  )
}
