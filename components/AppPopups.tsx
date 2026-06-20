'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'

// ─── PWA Install Prompt ─────────────────────────────────────
function PWAInstallPrompt({ config }: { config:any }) {
  const [deferred, setDeferred] = useState<any>(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!config?.pwaInstallEnabled) return
    // Already installed?
    if (window.matchMedia('(display-mode: standalone)').matches) return

    function handler(e:any) {
      e.preventDefault()
      setDeferred(e)
      const last = localStorage.getItem('pwa-install-dismiss')
      const cooldownDays = config.pwaPromptCooldown || 7
      if (last) {
        const lastDate = new Date(last)
        const daysSince = (Date.now() - lastDate.getTime()) / (1000*60*60*24)
        if (daysSince < cooldownDays) return
      }
      setTimeout(() => setShow(true), config.pwaPromptDelay || 8000)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [config])

  async function install() {
    if (!deferred) return
    deferred.prompt()
    const { outcome } = await deferred.userChoice
    if (outcome === 'accepted') toast.success('App terinstall!')
    setShow(false); setDeferred(null)
  }
  function dismiss() {
    localStorage.setItem('pwa-install-dismiss', new Date().toISOString())
    setShow(false)
  }

  if (!show) return null
  return (
    <div className="fade-in" style={{ position:'fixed', bottom:'max(20px, env(safe-area-inset-bottom))', left:'50%', transform:'translateX(-50%)', zIndex:9999, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:14, padding:'14px 16px', boxShadow:'0 12px 40px rgba(0,0,0,0.3)', display:'flex', alignItems:'center', gap:12, maxWidth:'calc(100% - 32px)', width:380 }}>
      <div style={{ width:42, height:42, borderRadius:10, background:config.appColor||'var(--blue)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, color:'#fff', flexShrink:0 }}>📱</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>Install {config.appName||'WorkPulse'}</div>
        <div style={{ fontSize:11, color:'var(--text3)' }}>Akses lebih cepat dari home screen</div>
      </div>
      <button onClick={dismiss} className="btn btn-sm" style={{ fontSize:11 }}>Nanti</button>
      <button onClick={install} className="btn btn-sm btn-primary" style={{ fontSize:11 }}>Install</button>
    </div>
  )
}

// ─── Presensi Daily Popup ───────────────────────────────────
// Shows once per day. Gate is a localStorage per-day key (robust, independent of the
// profile API), so: pick "Sudah"/submit → hidden the rest of today → reappears next day.
function localDateStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function PresensiPopup() {
  const { data:session } = useSession(); const user = session?.user as any
  const [show, setShow] = useState(false)
  const [step, setStep] = useState<'ask'|'choose'>('ask')
  const [attendanceTypes, setAttendanceTypes] = useState<any[]>([])
  const [profile, setProfile] = useState<any>(null)

  // Roles that should NOT get the daily attendance popup (external collaborators)
  const NO_PRESENSI_ROLES = ['external', 'guest']
  const userRoles = (user?.roles && user.roles.length) ? user.roles : (user?.role ? [user.role] : [])
  const skipPresensi = userRoles.some((r:string) => NO_PRESENSI_ROLES.includes(String(r).toLowerCase()))

  useEffect(() => {
    if (!session?.user?.email) return
    if (skipPresensi) return  // external/guest: no daily attendance prompt
    let cancelled = false
    async function check() {
      const today = localDateStr()
      const doneKey = `presensi-check-${today}`
      try { if (localStorage.getItem(doneKey)) return } catch {}
      // Load attendance types (needed for the "choose" step)
      try {
        const cfg = await fetch('/api/config').then(r=>r.json())
        if (!cancelled) setAttendanceTypes((cfg.data?.attendanceTypes||[]).filter((t:any)=>t.active))
      } catch {}
      // Best-effort: if profile resolves AND attendance already recorded today, auto-suppress.
      try {
        const pr = await fetch('/api/profile').then(r=>r.json())
        if (pr?.data) {
          if (!cancelled) setProfile(pr.data)
          const prRoles = (pr.data?.roles && pr.data.roles.length) ? pr.data.roles : (pr.data?.role ? [pr.data.role] : [])
          if (prRoles.some((r:string) => NO_PRESENSI_ROLES.includes(String(r).toLowerCase()))) return
          const att = await fetch(`/api/attendance?userId=${pr.data._id}&date=${today}`).then(r=>r.json())
          if (att?.data?.length) { try { localStorage.setItem(doneKey, '1') } catch {} ; return }
        }
      } catch {}
      if (!cancelled) setShow(true)
    }
    check()
    // Re-check just after midnight so the popup returns on a new day without a reload
    const now = new Date()
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate()+1, 0, 0, 5)
    const tid = setTimeout(check, tomorrow.getTime() - now.getTime())
    return () => { cancelled = true; clearTimeout(tid) }
  }, [session, skipPresensi])

  function gateToday() {
    try { localStorage.setItem(`presensi-check-${localDateStr()}`, '1') } catch {}
  }
  async function markChecked() {
    gateToday()
    setShow(false)
    // Best-effort persist to profile (non-blocking; popup already gated locally)
    fetch('/api/profile', { method:'PATCH', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ lastAttendanceCheck: localDateStr() }) }).catch(()=>{})
  }
  async function submitAttendance(type:string) {
    const today = localDateStr()
    try {
      await fetch('/api/attendance', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ userId: profile?._id, userName: user?.name, date: today, type, slots:[{ from:'08:00', to:'17:00', type }] }) })
      toast.success('Presensi tercatat!')
    } catch { toast.error('Gagal mencatat presensi') }
    markChecked()
  }

  if (!show) return null
  return (
    <div className="modal-overlay" style={{ zIndex:10000 }}>
      <div className="modal" style={{ width:380 }}>
        {step === 'ask' ? (
          <>
            <div style={{ padding:'24px 22px 14px', textAlign:'center' }}>
              <div style={{ fontSize:34, marginBottom:10 }}>📅</div>
              <div style={{ fontSize:15, fontWeight:600, color:'var(--text)', marginBottom:6 }}>Selamat datang, {user?.name?.split(' ')[0]}!</div>
              <div style={{ fontSize:12, color:'var(--text3)', lineHeight:1.5 }}>Sudah mengisi daftar hadir hari ini?</div>
            </div>
            <div style={{ padding:'10px 22px 18px', display:'flex', gap:8 }}>
              <button className="btn" style={{ flex:1, justifyContent:'center' }} onClick={()=>setStep('choose')}>Belum</button>
              <button className="btn btn-primary" style={{ flex:1, justifyContent:'center' }} onClick={markChecked}>Sudah</button>
            </div>
          </>
        ) : (
          <>
            <div style={{ padding:'18px 22px 10px' }}>
              <div style={{ fontSize:14, fontWeight:600, color:'var(--text)', marginBottom:4 }}>Pilih Tipe Kehadiran</div>
              <div style={{ fontSize:11, color:'var(--text3)' }}>Untuk hari ini, {new Date().toLocaleDateString('id-ID',{ weekday:'long', day:'numeric', month:'long' })}</div>
            </div>
            <div style={{ padding:'8px 18px 18px', display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:7 }}>
              {attendanceTypes.map(t => (
                <button key={t.key} onClick={()=>submitAttendance(t.key)} style={{ padding:'12px 10px', borderRadius:10, border:`1px solid ${t.textColor}66`, background:t.color, color:t.textColor, cursor:'pointer', fontSize:12, fontWeight:600 }}>
                  {t.label}
                </button>
              ))}
            </div>
            <div style={{ padding:'8px 18px 16px', borderTop:'1px solid var(--border)' }}>
              <button className="btn" style={{ width:'100%', justifyContent:'center', fontSize:11 }} onClick={()=>setShow(false)}>Nanti saja</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Agenda H-1 Reminder ────────────────────────────────────
function AgendaReminder() {
  const { data:session } = useSession(); const user = session?.user as any
  const [show, setShow] = useState(false)
  const [items, setItems] = useState<any[]>([])

  useEffect(() => {
    if (!session?.user?.email) return
    async function check() {
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate()+1)
      const dateStr = tomorrow.toISOString().split('T')[0]
      const dismissKey = `agenda-h1-dismiss-${dateStr}`
      if (localStorage.getItem(dismissKey)) return

      const pr = await fetch('/api/profile').then(r=>r.json())
      const d = await fetch(`/api/agenda?userId=${pr.data._id}&from=${dateStr}&to=${dateStr}`).then(r=>r.json())
      const tomorrowItems = (d.data?.[0]?.items) || []
      if (tomorrowItems.length > 0) {
        setItems(tomorrowItems)
        setShow(true)
      }
    }
    check()
  }, [session])

  function dismiss() {
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate()+1)
    const dateStr = tomorrow.toISOString().split('T')[0]
    localStorage.setItem(`agenda-h1-dismiss-${dateStr}`, '1')
    setShow(false)
  }

  if (!show) return null
  const ITEM_ICONS: Record<string,string> = { meeting:'👥', task:'✅', dinas:'✈️', wfo:'🏢', wfh:'🏠', event:'🎉', other:'📌' }

  return (
    <div className="modal-overlay" style={{ zIndex:9998 }} onClick={e=>e.target===e.currentTarget&&dismiss()}>
      <div className="modal" style={{ width:420 }}>
        <div style={{ padding:'18px 22px 12px', borderBottom:'1px solid var(--border)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:38, height:38, borderRadius:10, background:'var(--bluebg)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>🔔</div>
            <div>
              <div style={{ fontSize:14, fontWeight:600, color:'var(--text)' }}>Reminder agenda besok</div>
              <div style={{ fontSize:11, color:'var(--text3)' }}>Kamu punya {items.length} agenda untuk besok</div>
            </div>
          </div>
        </div>
        <div style={{ padding:'12px 22px', maxHeight:340, overflowY:'auto', display:'flex', flexDirection:'column', gap:7 }}>
          {items.sort((a,b)=>(a.time||'').localeCompare(b.time||'')).map((it,i) => (
            <div key={i} style={{ padding:'9px 11px', background:'var(--bg3)', borderRadius:8, borderLeft:`3px solid var(--blue)`, display:'flex', gap:9 }}>
              <span style={{ fontSize:15 }}>{ITEM_ICONS[it.type]||'📌'}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:12, fontWeight:500, color:'var(--text)' }}>{it.title}</div>
                <div style={{ fontSize:10, color:'var(--text3)', marginTop:2 }}>
                  {it.time && `⏰ ${it.time}${it.endTime?` – ${it.endTime}`:''}`}
                  {it.location && ` · 📍 ${it.location}`}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding:'10px 22px 16px', borderTop:'1px solid var(--border)' }}>
          <button onClick={dismiss} className="btn btn-primary" style={{ width:'100%', justifyContent:'center' }}>Oke, dimengerti</button>
        </div>
      </div>
    </div>
  )
}

// ─── Main exported component ────────────────────────────────
export default function AppPopups() {
  const { data:session } = useSession()
  const [config, setConfig] = useState<any>(null)
  useEffect(() => {
    if (!session) return
    fetch('/api/config').then(r=>r.json()).then(d => setConfig(d.data)).catch(()=>{})
  }, [session])

  if (!session?.user) return null
  return (
    <>
      <PresensiPopup />
      <AgendaReminder />
      {config && <PWAInstallPrompt config={config} />}
    </>
  )
}
