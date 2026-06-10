'use client'
import { useSession, signOut } from 'next-auth/react'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { useTheme, THEMES, Theme } from '@/lib/theme'
import toast from 'react-hot-toast'

const NAV_GROUPS = [
  { label:'Overview', items:[
    { href:'/dashboard',               label:'Dashboard',    icon:'⊞', roles:['admin','manager','member','guest'] },
    { href:'/dashboard/gantt',         label:'Gantt Chart',  icon:'≡', roles:['admin','manager','member'] },
    { href:'/dashboard/kpi',           label:'KPI Tracker',  icon:'🎯', roles:['admin','manager','member'] },
    { href:'/dashboard/issues',        label:'Issues',       icon:'◫', roles:['admin','manager','member'] },
    { href:'/dashboard/infograph',     label:'Infografis',   icon:'◕', roles:['admin','manager','member','guest'] },
  ]},
  { label:'Kerja', items:[
    { href:'/dashboard/agenda',        label:'Daily Agenda', icon:'📅', roles:['admin','manager','member'] },
    { href:'/dashboard/projects',      label:'Projects',     icon:'🗂', roles:['admin','manager','member'] },
  ]},
  { label:'Tim', items:[
    { href:'/dashboard/attendance',    label:'Absensi',      icon:'▦', roles:['admin','manager','member'] },
    { href:'/dashboard/announcements', label:'Pengumuman',   icon:'📢', roles:['admin','manager','member','guest'] },
    { href:'/dashboard/reimbursements',label:'Reimburse',    icon:'💰', roles:['admin','manager','member','finance'] },
    { href:'/dashboard/budget',        label:'Anggaran',     icon:'📊', roles:['admin','manager','finance'] },
    { href:'/dashboard/links',         label:'Link Hub',     icon:'🔗', roles:['admin','manager','member','guest'] },
  ]},
  { label:'Admin', items:[
    { href:'/dashboard/members',       label:'Member',       icon:'👥', roles:['admin'] },
    { href:'/dashboard/config',        label:'Konfigurasi',  icon:'⚙', roles:['admin'] },
  ]},
  { label:'Akun', items:[
    { href:'/dashboard/profile',       label:'Profil Saya',  icon:'👤', roles:['admin','manager','member','finance','guest'] },
  ]},
]

function AddIssueModal({ onClose, onSave }: { onClose:()=>void; onSave:()=>void }) {
  const [initiatives, setInitiatives] = useState<any[]>([])
  const [form, setForm] = useState({ initiativeId:'', title:'', description:'', progress:0, status:'on_track', priority:'medium', nextPlan:'', dueDate:'', pic:'', picName:'' })
  const [saving, setSaving] = useState(false)
  const set = (k:string,v:any) => setForm(f=>({...f,[k]:v}))
  useEffect(()=>{ fetch('/api/initiatives').then(r=>r.json()).then(d=>setInitiatives(d.data||[])) },[])

  async function save() {
    if (!form.initiativeId||!form.title||!form.dueDate) { toast.error('Initiative, judul, dan due date wajib'); return }
    setSaving(true)
    try {
      await fetch('/api/issues', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(form) })
      toast.success('Issue ditambahkan!'); onSave(); onClose()
    } catch { toast.error('Gagal') } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ width:540 }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between' }}>
          <span style={{ fontSize:14, fontWeight:600 }}>+ Tambah Issue Baru</span>
          <button onClick={onClose} className="btn btn-icon">×</button>
        </div>
        <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:12 }}>
          <div><label style={lbl}>Initiative *</label>
            <select className="input" value={form.initiativeId} onChange={e=>set('initiativeId',e.target.value)}>
              <option value="">Pilih initiative...</option>
              {initiatives.map(i=><option key={i._id} value={i._id}>[{i.code}] {i.title}</option>)}
            </select></div>
          <div><label style={lbl}>Judul *</label><input className="input" value={form.title} onChange={e=>set('title',e.target.value)} placeholder="Deskripsi singkat issue..." /></div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
            <div><label style={lbl}>Status</label>
              <select className="input" value={form.status} onChange={e=>set('status',e.target.value)}>
                <option value="on_track">On Track</option><option value="at_risk">At Risk</option><option value="delayed">Delayed</option>
              </select></div>
            <div><label style={lbl}>Priority</label>
              <select className="input" value={form.priority} onChange={e=>set('priority',e.target.value)}>
                <option value="high">🔴 High</option><option value="medium">🟡 Medium</option><option value="low">🟢 Low</option>
              </select></div>
            <div><label style={lbl}>Due Date *</label><input type="date" className="input" value={form.dueDate} onChange={e=>set('dueDate',e.target.value)} /></div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div><label style={lbl}>PIC</label><input className="input" value={form.picName} onChange={e=>{set('picName',e.target.value);set('pic',e.target.value)}} placeholder="Nama PIC..." /></div>
            <div><label style={lbl}>Progress (%)</label><input type="number" min={0} max={100} className="input" value={form.progress} onChange={e=>set('progress',Number(e.target.value))} /></div>
          </div>
          <div><label style={lbl}>Next Plan</label><input className="input" value={form.nextPlan} onChange={e=>set('nextPlan',e.target.value)} placeholder="Rencana berikutnya..." /></div>
        </div>
        <div style={{ padding:'12px 20px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'flex-end', gap:8 }}>
          <button onClick={onClose} className="btn">Batal</button>
          <button onClick={save} disabled={saving} className="btn btn-primary">{saving?'Menyimpan...':'Tambah Issue'}</button>
        </div>
      </div>
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data:session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const [collapsed, setCollapsed] = useState(false)
  const [showThemePicker, setShowThemePicker] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [showAddIssue, setShowAddIssue] = useState(false)
  const [appConfig, setAppConfig] = useState<any>(null)
  const themeRef = useRef<HTMLDivElement>(null)

  useEffect(()=>{ if(status==='unauthenticated') router.push('/login') },[status,router])
  useEffect(()=>{
    if(!autoRefresh) return
    const id = setInterval(()=>router.refresh(), 30000)
    return ()=>clearInterval(id)
  },[autoRefresh,router])
  useEffect(()=>{
    function h(e:MouseEvent){ if(themeRef.current&&!themeRef.current.contains(e.target as Node)) setShowThemePicker(false) }
    document.addEventListener('mousedown',h); return ()=>document.removeEventListener('mousedown',h)
  },[])
  useEffect(()=>{
    fetch('/api/config').then(r=>r.json()).then(d=>setAppConfig(d.data)).catch(()=>{})
  },[])

  if(status==='loading') return (
    <div style={{ display:'flex', height:'100vh', alignItems:'center', justifyContent:'center', background:'var(--bg)' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:36, height:36, border:'3px solid var(--border2)', borderTopColor:'var(--blue)', borderRadius:'50%', margin:'0 auto 12px' }} className="spin" />
        <div style={{ color:'var(--text3)' }}>Memuat...</div>
      </div>
    </div>
  )

  const user = session?.user as any
  const userRole = user?.role||'guest'
  const initials = user?.name?.split(' ').map((n:string)=>n[0]).join('').slice(0,2)||'U'
  const currentPage = NAV_GROUPS.flatMap(g=>g.items).find(n=>pathname===n.href||(n.href!=='/dashboard'&&pathname.startsWith(n.href)))?.label||'Dashboard'
  const appName = appConfig?.appName || 'WorkPulse'
  const appTagline = appConfig?.appTagline || 'BPD & SS Procurement'
  const appColor = appConfig?.appColor || 'var(--blue)'

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', background:'var(--bg)' }}>
      {showAddIssue && <AddIssueModal onClose={()=>setShowAddIssue(false)} onSave={()=>router.refresh()} />}

      <aside style={{ width:collapsed?56:220, background:'var(--bg2)', borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', flexShrink:0, transition:'width 0.2s ease', overflow:'hidden' }}>
        <div style={{ padding:collapsed?'14px 12px':'14px 16px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10, justifyContent:collapsed?'center':'flex-start', minHeight:52 }}>
          {appConfig?.appIcon ? (
            <img src={appConfig.appIcon} style={{ width:28, height:28, borderRadius:7, objectFit:'cover', flexShrink:0 }} alt="logo" />
          ) : (
            <div style={{ width:28, height:28, background:appColor, borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700, color:'#fff', flexShrink:0 }}>{appName[0]}</div>
          )}
          {!collapsed && <div><div style={{ fontSize:14, fontWeight:700, color:'var(--text)' }}>{appName}</div><div style={{ fontSize:10, color:'var(--text3)' }}>{appTagline}</div></div>}
        </div>
        <nav style={{ padding:'8px', flex:1, overflowY:'auto' }}>
          {NAV_GROUPS.map(group=>{
            const visibleItems = group.items.filter(n=>n.roles.includes(userRole))
            if(visibleItems.length===0) return null
            return (
              <div key={group.label}>
                {!collapsed && <div style={{ fontSize:9, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.08em', padding:'8px 8px 3px' }}>{group.label}</div>}
                {visibleItems.map(item=>{
                  const active = pathname===item.href||(item.href!=='/dashboard'&&pathname.startsWith(item.href))
                  return (
                    <Link key={item.href} href={item.href} style={{ textDecoration:'none' }}>
                      <div className={`sidebar-link${active?' active':''}`} style={{ justifyContent:collapsed?'center':'flex-start', padding:collapsed?'10px':'6px 10px' }} title={item.label}>
                        <span style={{ fontSize:13, flexShrink:0 }}>{item.icon}</span>
                        {!collapsed && <span style={{ fontSize:12 }}>{item.label}</span>}
                      </div>
                    </Link>
                  )
                })}
              </div>
            )
          })}
        </nav>
        <div style={{ padding:collapsed?'10px 8px':'12px 14px', borderTop:'1px solid var(--border)' }}>
          {collapsed ? (
            <div style={{ display:'flex', flexDirection:'column', gap:6, alignItems:'center' }}>
              <div style={{ width:28, height:28, borderRadius:'50%', background:'var(--blue2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'#fff' }}>{initials}</div>
              <button onClick={()=>signOut({callbackUrl:'/login'})} className="btn btn-icon" style={{ fontSize:12,width:28,height:28 }} title="Keluar">⏻</button>
            </div>
          ):(
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width:30, height:30, borderRadius:'50%', background:'var(--blue2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'#fff', flexShrink:0 }}>{initials}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12, fontWeight:500, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user?.name}</div>
                <div style={{ fontSize:10, color:'var(--text3)', textTransform:'capitalize' }}>{userRole}</div>
              </div>
              <button onClick={()=>signOut({callbackUrl:'/login'})} className="btn btn-icon" title="Keluar" style={{ fontSize:13 }}>⏻</button>
            </div>
          )}
        </div>
      </aside>

      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <header style={{ display:'flex', alignItems:'center', gap:8, padding:'0 16px', height:52, borderBottom:'1px solid var(--border)', background:'var(--bg2)', flexShrink:0 }}>
          <button onClick={()=>setCollapsed(!collapsed)} className="btn btn-icon" style={{ fontSize:16 }}>☰</button>
          <div style={{ flex:1, display:'flex', alignItems:'center', gap:6, fontSize:13 }}>
            <span style={{ color:'var(--text3)' }}>{appName}</span>
            <span style={{ color:'var(--border2)' }}>›</span>
            <span style={{ color:'var(--text)', fontWeight:500 }}>{currentPage}</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'var(--text3)' }}>
            <span>{autoRefresh?'🔄':'⏸'}</span>
            <div className={`toggle-wrap${autoRefresh?' on':''}`} onClick={()=>setAutoRefresh(!autoRefresh)} title="Auto-refresh 30s" />
          </div>
          <div ref={themeRef} style={{ position:'relative' }}>
            <button className="btn btn-sm" onClick={()=>setShowThemePicker(!showThemePicker)}>
              {THEMES.find(t=>t.key===theme)?.emoji} {THEMES.find(t=>t.key===theme)?.label}
            </button>
            {showThemePicker && (
              <div className="scale-in" style={{ position:'absolute', top:'calc(100% + 6px)', right:0, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:6, zIndex:200, minWidth:160, boxShadow:'var(--shadow)' }}>
                {THEMES.map(t=>(
                  <div key={t.key} onClick={()=>{setTheme(t.key);setShowThemePicker(false)}} style={{ padding:'7px 10px', borderRadius:6, cursor:'pointer', fontSize:12, display:'flex', alignItems:'center', gap:8, background:theme===t.key?'var(--bluebg)':'transparent', color:theme===t.key?'var(--blue)':'var(--text2)' }}
                    onMouseEnter={e=>{if(theme!==t.key)(e.currentTarget as HTMLElement).style.background='var(--bg3)'}}
                    onMouseLeave={e=>{if(theme!==t.key)(e.currentTarget as HTMLElement).style.background='transparent'}}>
                    <span>{t.emoji}</span><span>{t.label}</span>{theme===t.key&&<span style={{ marginLeft:'auto' }}>✓</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
          <button className="btn btn-sm btn-primary" onClick={()=>setShowAddIssue(true)}>+ Issue</button>
        </header>
        <main style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }} className="fade-in">
          {children}
        </main>
      </div>
    </div>
  )
}
const lbl: React.CSSProperties = { display:'block', fontSize:11, fontWeight:500, color:'var(--text2)', marginBottom:5 }
