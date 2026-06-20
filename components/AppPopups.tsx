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
        <div style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>Install {config.appName||'WinS'}</div>
        <div style={{ fontSize:11, color:'var(--text3)' }}>Akses lebih cepat dari home screen</div>
      </div>
      <button onClick={dismiss} className="btn btn-sm" style={{ fontSize:11 }}>Nanti</button>
      <button onClick={install} className="btn btn-sm btn-primary" style={{ fontSize:11 }}>Install</button>
    </div>
  )
}

// NOTE: the daily attendance reminder used to be a modal popup here (PresensiPopup).
// It now lives inside the Wibi chat assistant (components/Wibi.tsx) — Wibi greets the
// member on first visit of the day and asks Sudah/Belum absen right inside the chat
// bubble, instead of a separate blocking modal.

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
      <AgendaReminder />
      {config && <PWAInstallPrompt config={config} />}
    </>
  )
}
