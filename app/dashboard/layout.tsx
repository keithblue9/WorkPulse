'use client'
import { useSession, signOut } from 'next-auth/react'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { useTheme, THEMES, Theme } from '@/lib/theme'

const NAV = [
  { href: '/dashboard',            label: 'Dashboard',   icon: '⊞', roles: ['admin','manager','member','guest'] },
  { href: '/dashboard/gantt',      label: 'Gantt Chart', icon: '≡', roles: ['admin','manager','member'] },
  { href: '/dashboard/issues',     label: 'Issues',      icon: '◫', roles: ['admin','manager','member'] },
  { href: '/dashboard/attendance', label: 'Absensi',     icon: '▦', roles: ['admin','manager','member'] },
  { href: '/dashboard/infograph',  label: 'Infografis',  icon: '◕', roles: ['admin','manager','member','guest'] },
  { href: '/dashboard/config',     label: 'Konfigurasi', icon: '⚙', roles: ['admin'] },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const [collapsed, setCollapsed] = useState(false)
  const [showThemePicker, setShowThemePicker] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const themeRef = useRef<HTMLDivElement>(null)

  useEffect(() => { if (status === 'unauthenticated') router.push('/login') }, [status, router])
  useEffect(() => {
    if (!autoRefresh) return
    const id = setInterval(() => router.refresh(), 30000)
    return () => clearInterval(id)
  }, [autoRefresh, router])
  useEffect(() => {
    function handler(e: MouseEvent) { if (themeRef.current && !themeRef.current.contains(e.target as Node)) setShowThemePicker(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (status === 'loading') return (
    <div style={{ display:'flex', height:'100vh', alignItems:'center', justifyContent:'center', background:'var(--bg)' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:36, height:36, border:'3px solid var(--border2)', borderTopColor:'var(--blue)', borderRadius:'50%', margin:'0 auto 12px' }} className="spin" />
        <div style={{ color:'var(--text3)' }}>Memuat WorkPulse...</div>
      </div>
    </div>
  )

  const user = session?.user as any
  const userRole = user?.role || 'guest'
  const visibleNav = NAV.filter(n => n.roles.includes(userRole))
  const initials = user?.name?.split(' ').map((n: string) => n[0]).join('').slice(0,2) || 'U'
  const currentPage = NAV.find(n => pathname === n.href || (n.href !== '/dashboard' && pathname.startsWith(n.href)))?.label || 'Dashboard'

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', background:'var(--bg)' }}>
      {/* Sidebar */}
      <aside style={{ width: collapsed ? 56 : 220, background:'var(--bg2)', borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', flexShrink:0, transition:'width 0.2s ease', overflow:'hidden' }}>
        <div style={{ padding: collapsed ? '14px 12px' : '14px 16px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10, justifyContent: collapsed ? 'center' : 'flex-start', minHeight:52 }}>
          <div style={{ width:28, height:28, background:'var(--blue)', borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700, color:'#fff', flexShrink:0 }}>W</div>
          {!collapsed && <div><div style={{ fontSize:14, fontWeight:700, color:'var(--text)' }}>WorkPulse</div><div style={{ fontSize:10, color:'var(--text3)' }}>BPD & SS Procurement</div></div>}
        </div>
        <nav style={{ padding:'8px', flex:1, overflowY:'auto' }}>
          {!collapsed && <div style={{ fontSize:10, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.08em', padding:'8px 8px 4px' }}>Menu</div>}
          {visibleNav.map(item => {
            const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
            return (
              <Link key={item.href} href={item.href} style={{ textDecoration:'none' }}>
                <div className={`sidebar-link${active ? ' active' : ''}`} style={{ justifyContent: collapsed ? 'center' : 'flex-start', padding: collapsed ? '10px' : '8px 10px' }} title={item.label}>
                  <span style={{ fontSize:15, flexShrink:0 }}>{item.icon}</span>
                  {!collapsed && <span>{item.label}</span>}
                </div>
              </Link>
            )
          })}
        </nav>
        <div style={{ padding: collapsed ? '10px 8px' : '12px 14px', borderTop:'1px solid var(--border)' }}>
          {collapsed ? (
            <div style={{ display:'flex', flexDirection:'column', gap:6, alignItems:'center' }}>
              <div style={{ width:28, height:28, borderRadius:'50%', background:'var(--blue2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'#fff' }}>{initials}</div>
              <button onClick={() => signOut({ callbackUrl:'/login' })} className="btn btn-icon" style={{ fontSize:12, width:28, height:28 }} title="Keluar">⏻</button>
            </div>
          ) : (
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width:30, height:30, borderRadius:'50%', background:'var(--blue2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'#fff', flexShrink:0 }}>{initials}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12, fontWeight:500, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user?.name}</div>
                <div style={{ fontSize:10, color:'var(--text3)', textTransform:'capitalize' }}>{userRole} · {user?.division}</div>
              </div>
              <button onClick={() => signOut({ callbackUrl:'/login' })} className="btn btn-icon" title="Keluar" style={{ fontSize:13 }}>⏻</button>
            </div>
          )}
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        {/* Topbar */}
        <header style={{ display:'flex', alignItems:'center', gap:8, padding:'0 16px', height:52, borderBottom:'1px solid var(--border)', background:'var(--bg2)', flexShrink:0 }}>
          <button onClick={() => setCollapsed(!collapsed)} className="btn btn-icon" style={{ fontSize:16 }} title="Toggle sidebar">☰</button>
          <div style={{ flex:1, display:'flex', alignItems:'center', gap:6, fontSize:13 }}>
            <span style={{ color:'var(--text3)' }}>WorkPulse</span>
            <span style={{ color:'var(--border2)' }}>›</span>
            <span style={{ color:'var(--text)', fontWeight:500 }}>{currentPage}</span>
          </div>
          {/* Auto refresh */}
          <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:'var(--text3)' }}>
            <span>{autoRefresh ? '🔄' : '⏸'}</span>
            <div className={`toggle-wrap${autoRefresh ? ' on' : ''}`} onClick={() => setAutoRefresh(!autoRefresh)} title={autoRefresh ? 'Auto-refresh aktif (30s)' : 'Auto-refresh mati'} />
          </div>
          {/* Theme */}
          <div ref={themeRef} style={{ position:'relative' }}>
            <button className="btn btn-sm" onClick={() => setShowThemePicker(!showThemePicker)}>
              {THEMES.find(t => t.key === theme)?.emoji} {THEMES.find(t => t.key === theme)?.label}
            </button>
            {showThemePicker && (
              <div className="scale-in" style={{ position:'absolute', top:'calc(100% + 6px)', right:0, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:6, zIndex:200, minWidth:160, boxShadow:'var(--shadow)' }}>
                <div style={{ padding:'4px 10px 6px', fontSize:10, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Pilih Theme</div>
                {THEMES.map(t => (
                  <div key={t.key} onClick={() => { setTheme(t.key); setShowThemePicker(false) }}
                    style={{ padding:'7px 10px', borderRadius:6, cursor:'pointer', fontSize:12, display:'flex', alignItems:'center', gap:8, background: theme === t.key ? 'var(--bluebg)' : 'transparent', color: theme === t.key ? 'var(--blue)' : 'var(--text2)', transition:'background 0.1s' }}
                    onMouseEnter={e => { if(theme !== t.key)(e.currentTarget as HTMLElement).style.background='var(--bg3)' }}
                    onMouseLeave={e => { if(theme !== t.key)(e.currentTarget as HTMLElement).style.background='transparent' }}>
                    <span>{t.emoji}</span><span>{t.label}</span>
                    {theme === t.key && <span style={{ marginLeft:'auto' }}>✓</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
          <button className="btn btn-sm btn-primary">+ Tambah Issue</button>
        </header>
        <main style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }} className="fade-in">
          {children}
        </main>
      </div>
    </div>
  )
}
