'use client'
import { getConfig } from '@/lib/configCache'
import { useSession, signOut } from 'next-auth/react'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { useTheme, THEMES } from '@/lib/theme'
import AppPopups from '@/components/AppPopups'
import BirthdayPopup from '@/components/BirthdayPopup'

// Menu definitions with permission keys (matches config.roleDefs[].allowedMenus)
const NAV_GROUPS = [
  { key:'dashboard', label:'Dashboard & Overview', items:[
    { href:'/dashboard',          label:'Dashboard',    permKey:'dashboard' },
    { href:'/dashboard/progress', label:'Progress Project', permKey:'progress' },
  ]},
  { key:'activities', label:'Activities', items:[
    { href:'/dashboard/activities', label:'Activities',  permKey:'activities' },
    { href:'/dashboard/meetings',   label:'Meeting Reports', permKey:'meetings' },
    { href:'/dashboard/notes',      label:'Notes', permKey:'notes' },
  ]},
  { key:'team', label:'Team', items:[
    { href:'/dashboard/attendance', label:'Presensi', permKey:'attendance' },
    { href:'/dashboard/calendar',   label:'Calendar', permKey:'calendar' },
    { href:'/dashboard/links',      label:'Link Hub', permKey:'links' },
    { href:'/dashboard/biodata',    label:'Member Biodata', permKey:'biodata' },
  ]},
  { key:'finance', label:'Finance', items:[
    { href:'/dashboard/budget',         label:'Anggaran', permKey:'budget' },
    { href:'/dashboard/cashcard',       label:'Cash Card', permKey:'cashcard' },
    { href:'/dashboard/reimbursements', label:'Reimbursement', permKey:'reimbursement' },
    { href:'/dashboard/cashier',        label:'Cashier', permKey:'cashier' },
  ]},
  { key:'admin', label:'Admin', items:[
    { href:'/dashboard/members', label:'Member', permKey:'members' },
    { href:'/dashboard/config',  label:'Configuration', permKey:'config' },
  ]},
]

const FALLBACK_MENUS: Record<string,string[]> = {
  admin:   ['dashboard','activities','calendar','issues','progress','attendance','biodata','links','meetings','notes','budget','reimbursement','cashcard','cashier','members','config'],
  manager: ['dashboard','activities','calendar','issues','progress','attendance','biodata','links','meetings','notes','budget','reimbursement','cashcard','cashier','members'],
  member:  ['dashboard','activities','calendar','issues','progress','attendance','biodata','links','meetings','notes','reimbursement'],
  finance: ['dashboard','attendance','biodata','links','budget','reimbursement','cashcard','cashier'],
  cashier: ['dashboard','reimbursement','cashier','cashcard','biodata'],
  guest:   ['dashboard','links'],
}
function getAllowedMenus(roleDefs:any[], userRoles:string[], configLoaded:boolean):Set<string> {
  const allowed = new Set<string>()
  // Try from roleDefs first
  for (const role of userRoles) {
    const def = roleDefs?.find((r:any)=>r.key===role)
    if (def?.allowedMenus) def.allowedMenus.forEach((m:string)=>allowed.add(m))
  }
  // Fallback to defaults if empty (config still loading OR no roleDefs in DB yet)
  if (allowed.size === 0) {
    for (const role of userRoles) {
      (FALLBACK_MENUS[role] || []).forEach(m => allowed.add(m))
    }
    // Ultra last-resort: if STILL empty and config hasn't loaded yet, show admin defaults
    if (allowed.size === 0 && !configLoaded) {
      FALLBACK_MENUS.admin.forEach(m => allowed.add(m))
    }
  }
  return allowed
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data:session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [showThemePicker, setShowThemePicker] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [appConfig, setAppConfig] = useState<any>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['dashboard','activities','team']))
  const themeRef = useRef<HTMLDivElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)

  useEffect(()=>{ if(status==='unauthenticated') router.push('/login') },[status,router])
  useEffect(()=>{
    function h(e:MouseEvent){
      if(themeRef.current && !themeRef.current.contains(e.target as Node)) setShowThemePicker(false)
      if(profileRef.current && !profileRef.current.contains(e.target as Node)) setShowProfileMenu(false)
    }
    document.addEventListener('mousedown',h); return ()=>document.removeEventListener('mousedown',h)
  },[])
  useEffect(()=>{ fetch('/api/warmup').catch(()=>{}); getConfig().then(d=>setAppConfig(d)).catch(()=>{}) },[])
  useEffect(()=>{ setMobileOpen(false) },[pathname])
  useEffect(()=>{
    const check = () => setIsMobile(window.innerWidth <= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  },[])
  useEffect(()=>{
    NAV_GROUPS.forEach(g => {
      if (g.items.some(i => pathname===i.href || (i.href!=='/dashboard' && pathname.startsWith(i.href)))) {
        setExpanded(prev => new Set([...prev, g.key]))
      }
    })
  },[pathname])

  function toggleGroup(key:string) { setExpanded(prev => { const s = new Set(prev); s.has(key)?s.delete(key):s.add(key); return s }) }

  if(status==='loading') return (
    <div style={{ display:'flex', height:'100vh', alignItems:'center', justifyContent:'center', background:'var(--bg)' }}>
      <div style={{ width:36, height:36, border:'3px solid var(--border2)', borderTopColor:'var(--brand)', borderRadius:'50%' }} className="spin" />
    </div>
  )

  const user = session?.user as any
  const userRoles: string[] = user?.roles && user.roles.length ? user.roles : (user?.role ? [user.role] : ['guest'])
  const roleDefs = appConfig?.roleDefs || []
  const allowedMenus = getAllowedMenus(roleDefs, userRoles, !!appConfig)
  const initials = user?.name?.split(' ').map((n:string)=>n[0]).join('').slice(0,2)||'U'
  const allItems = NAV_GROUPS.flatMap(g=>g.items)
  const currentPage = allItems.find(n=>pathname===n.href||(n.href!=='/dashboard'&&pathname.startsWith(n.href)))?.label || (pathname==='/dashboard/profile'?'My Profile':'Dashboard')
  const appName = appConfig?.appName || 'WorkPulse'
  const appTagline = appConfig?.appTagline || 'BPD & SS Procurement'

  return (
    <div className="app-shell" style={{ display:'flex', overflow:'hidden', background:'var(--bg)' }}>
      {/* Mobile backdrop */}
      <div className={`mobile-backdrop${mobileOpen?' show':''}`} onClick={()=>setMobileOpen(false)} />
      <aside className={`app-sidebar${mobileOpen?' mobile-open':''}`} style={{ width:(collapsed && !isMobile)?56:230, background:'var(--bg2)', borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', flexShrink:0, transition:'width 0.2s ease, transform 0.25s ease', overflow:'hidden' }}>
        <div style={{ padding:collapsed?'14px 12px':'14px 16px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10, justifyContent:collapsed?'center':'flex-start', minHeight:52 }}>
          {appConfig?.appIcon ? (
            <img src={appConfig.appIcon} style={{ width:28, height:28, borderRadius:7, objectFit:'cover', flexShrink:0 }} alt="logo" />
          ) : (
            <div style={{ width:28, height:28, background:'var(--brand)', borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700, color:'#fff', flexShrink:0 }}>{appName[0]}</div>
          )}
          {!collapsed && <div style={{ minWidth:0 }}>
            <div style={{ fontSize:14, fontWeight:700, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{appName}</div>
            <div style={{ fontSize:10, color:'var(--text3)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{appTagline}</div>
          </div>}
        </div>
        <nav style={{ padding:'10px 8px', flex:1, overflowY:'auto' }}>
          {NAV_GROUPS.map(group=>{
            const visibleItems = group.items.filter(item => allowedMenus.has(item.permKey))
            if (visibleItems.length === 0) return null
            const isExpanded = expanded.has(group.key)
            const hasActive = visibleItems.some(i => pathname===i.href||(i.href!=='/dashboard'&&pathname.startsWith(i.href)))
            if (collapsed && !isMobile) {
              return (
                <div key={group.key} style={{ marginBottom:6 }}>
                  {visibleItems.map(item=>{
                    const active = pathname===item.href||(item.href!=='/dashboard'&&pathname.startsWith(item.href))
                    return (
                      <Link key={item.href} href={item.href} style={{ textDecoration:'none' }}>
                        <div className={`sidebar-link${active?' active':''}`} style={{ justifyContent:'center', padding:'10px' }} title={item.label}>
                          <span style={{ fontSize:11, fontWeight:600 }}>{item.label[0]}</span>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )
            }
            return (
              <div key={group.key} style={{ marginBottom:4 }}>
                <div className={`sidebar-group-header${isExpanded?' expanded':''}`} onClick={()=>toggleGroup(group.key)} style={{ color: hasActive?'var(--brand)':'var(--text)' }}>
                  <span>{group.label}</span>
                  <span className="chevron">▶</span>
                </div>
                {isExpanded && (
                  <div className="sidebar-sub fade-in">
                    {visibleItems.map(item=>{
                      const active = pathname===item.href||(item.href!=='/dashboard'&&pathname.startsWith(item.href))
                      return (
                        <Link key={item.href} href={item.href} style={{ textDecoration:'none' }}>
                          <div className={`sidebar-link${active?' active':''}`}><span>{item.label}</span></div>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>
      </aside>

      <div className="app-main" style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <header className="app-header" style={{ display:'flex', alignItems:'center', gap:8, padding:'0 16px', height:52, borderBottom:'1px solid var(--border)', background:'var(--bg2)', flexShrink:0 }}>
          <button onClick={()=>{ if (window.innerWidth <= 768) setMobileOpen(o=>!o); else setCollapsed(c=>!c) }} className="btn btn-icon hamburger-btn" style={{ fontSize:16 }}>☰</button>
          <div style={{ flex:1, display:'flex', alignItems:'center', gap:6, fontSize:13 }}>
            <span style={{ color:'var(--text3)' }}>{appName}</span>
            <span style={{ color:'var(--border2)' }}>›</span>
            <span style={{ color:'var(--text)', fontWeight:500 }}>{currentPage}</span>
          </div>
          <div ref={themeRef} style={{ position:'relative' }}>
            <button className="btn btn-sm" onClick={()=>setShowThemePicker(!showThemePicker)}>
              {THEMES.find((t:any)=>t.key===theme)?.emoji} {THEMES.find((t:any)=>t.key===theme)?.label}
            </button>
            {showThemePicker && (
              <div className="glass-strong scale-in" style={{ position:'absolute', top:'calc(100% + 6px)', right:0, borderRadius:10, padding:6, zIndex:200, minWidth:160 }}>
                {THEMES.map((t:any)=>(
                  <div key={t.key} onClick={()=>{setTheme(t.key);setShowThemePicker(false)}} style={{ padding:'7px 10px', borderRadius:6, cursor:'pointer', fontSize:12, display:'flex', alignItems:'center', gap:8, background:theme===t.key?'var(--brand-soft)':'transparent', color:theme===t.key?'var(--brand)':'var(--text2)' }}>
                    <span>{t.emoji}</span><span>{t.label}</span>{theme===t.key && <span style={{ marginLeft:'auto' }}>✓</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div ref={profileRef} style={{ position:'relative' }}>
            <button onClick={()=>setShowProfileMenu(!showProfileMenu)} style={{ width:32, height:32, borderRadius:'50%', background:'var(--brand)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'#fff', cursor:'pointer', border:'none' }}>{initials}</button>
            {showProfileMenu && (
              <div className="glass-strong scale-in" style={{ position:'absolute', top:'calc(100% + 6px)', right:0, borderRadius:10, padding:6, zIndex:200, minWidth:200 }}>
                <div style={{ padding:'8px 10px', borderBottom:'1px solid var(--glass-border)', marginBottom:4 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:'var(--text)' }}>{user?.name}</div>
                  <div style={{ fontSize:10, color:'var(--text3)' }}>{userRoles.join(', ')} {user?.division ? ' · ' + user.division : ''}</div>
                </div>
                <Link href="/dashboard/profile" style={{ textDecoration:'none' }}>
                  <div onClick={()=>setShowProfileMenu(false)} style={{ padding:'7px 10px', borderRadius:6, cursor:'pointer', fontSize:12, color:'var(--text2)' }}
                    onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='var(--bg3)'}
                    onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='transparent'}>
                    👤 My Profile
                  </div>
                </Link>
                <div onClick={()=>{setShowProfileMenu(false); signOut({callbackUrl:'/login'})}} style={{ padding:'7px 10px', borderRadius:6, cursor:'pointer', fontSize:12, color:'var(--red)' }}
                  onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='var(--redbg)'}
                  onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='transparent'}>
                  ⏻ Keluar
                </div>
              </div>
            )}
          </div>
        </header>
        <main style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }} className="fade-in">
          {children}
        </main>
        <AppPopups />
        <BirthdayPopup />
      </div>
    </div>
  )
}
