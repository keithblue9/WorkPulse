'use client'
import { getConfig } from '@/lib/configCache'
import { useSession, signOut } from 'next-auth/react'
import { useRouter, usePathname } from 'next/navigation'
import { Suspense, startTransition, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useTheme, THEMES } from '@/lib/theme'
import { useYear } from '@/lib/year'
import { displayAppName } from '@/lib/appName'
import { NAV_GROUPS, getAllowedMenus, visibleNav, isActive, isInternalUser } from '@/lib/nav'
import { Icon } from '@/components/ui'
import dynamic from 'next/dynamic'
// Overlay & popup dimuat terpisah setelah halaman tampil (tidak ikut bundle awal / hidrasi pertama).
const OnlinePresence = dynamic(() => import('@/components/OnlinePresence'), { ssr: false })
const CommandPalette = dynamic(() => import('@/components/CommandPalette'), { ssr: false })
const AppPopups = dynamic(() => import('@/components/AppPopups'), { ssr: false })
const BirthdayPopup = dynamic(() => import('@/components/BirthdayPopup'), { ssr: false })
const DailyCheckin = dynamic(() => import('@/components/DailyCheckin'), { ssr: false })
const NotifyEnabler = dynamic(() => import('@/components/NotifyEnabler'), { ssr: false })
const InstallPWA = dynamic(() => import('@/components/InstallPWA'), { ssr: false })

// Tab bar HP: 4 menu utama + Menu. Item tanpa izin diganti menu berikutnya yang diizinkan.
const TAB_PREF = ['/dashboard', '/dashboard/progress', '/dashboard/enhancement', '/dashboard/notes', '/dashboard/activities', '/dashboard/links']
const TAB_LABEL: Record<string, string> = { '/dashboard': 'Beranda', '/dashboard/progress': 'Progress', '/dashboard/enhancement': 'Enhance', '/dashboard/notes': 'Notes', '/dashboard/activities': 'Activities', '/dashboard/links': 'Link Hub' }

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const { year, years, setYear, hydrate } = useYear()
  const [appConfig, setAppConfig] = useState<any>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [palOpen, setPalOpen] = useState(false)
  // Komponen sekunder (presence, popup, notifikasi) baru dipasang saat browser senggang.
  const [idle, setIdle] = useState(false)
  useEffect(() => {
    const w = window as any
    const id = w.requestIdleCallback ? w.requestIdleCallback(() => setIdle(true), { timeout: 2500 }) : setTimeout(() => setIdle(true), 1200)
    return () => { if (w.cancelIdleCallback && w.requestIdleCallback) w.cancelIdleCallback(id); else clearTimeout(id) }
  }, [])

  useEffect(() => { if (status === 'unauthenticated') router.push('/login') }, [status, router])
  useEffect(() => { hydrate(); getConfig().then(d => startTransition(() => setAppConfig(d))).catch(() => {}) }, [hydrate])
  useEffect(() => { if (idle) fetch('/api/warmup').catch(() => {}) }, [idle])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalOpen(o => !o) } }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const user = session?.user as any
  const userRoles: string[] = user?.roles && user.roles.length ? user.roles : (user?.role ? [user.role] : ['guest'])
  const allowed = useMemo(() => getAllowedMenus(appConfig?.roleDefs || [], userRoles, !!appConfig), [appConfig, userRoles.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps
  const groups = useMemo(() => visibleNav(allowed, userRoles), [allowed, userRoles.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps
  const flat = groups.flatMap(g => g.items.map(i => ({ ...i, group: g.label })))
  const internal = isInternalUser(userRoles)

  if (status === 'loading') return (
    <div style={{ display: 'flex', height: '100dvh', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ width: 36, height: 36, border: '3px solid var(--line)', borderTopColor: 'var(--accent)', borderRadius: '50%' }} className="spin" />
    </div>
  )

  const appName = displayAppName(appConfig?.appName)
  const appTagline = appConfig?.appTagline || 'BPD Procurement'
  const initials = user?.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || 'U'
  // Judul halaman dari seluruh struktur menu (bukan hanya yang terlihat untuk peran ini).
  const allItems = NAV_GROUPS.flatMap(g => g.items.map(i => ({ ...i, group: g.label })))
  const current = flat.find(i => isActive(pathname, i.href)) || allItems.filter(i => i.href !== '/dashboard').find(i => isActive(pathname, i.href)) || (pathname.startsWith('/dashboard/issues') ? { label: 'Issues', group: 'Activities' } : pathname.startsWith('/dashboard/profile') ? { label: 'Profil', group: 'Akun' } : pathname.startsWith('/dashboard/menu') ? { label: 'Menu', group: appName } : { label: 'Dashboard', group: 'Dashboard & Overview' })
  const tabs = TAB_PREF.filter(h => flat.some(i => i.href === h)).slice(0, 4)
  const onTab = tabs.some(h => isActive(pathname, h))
  const nextTheme = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system'
  const themeMeta = THEMES.find(t => t.key === theme)!
  const logo = appConfig?.appIcon
    ? <img src={appConfig.appIcon} alt="" className="wn-logo" style={{ objectFit: 'cover' }} />
    : <div className="wn-logo" aria-hidden="true">{appName[0]}</div>

  return (
    <div className="app-shell wn-shell">
      <aside className="wn-side" aria-label="Menu utama">
        <div className="wn-brand">{logo}<div style={{ minWidth: 0 }}><b>{appName}</b><small>{appTagline}</small></div></div>
        {/* Suspense memecah hidrasi: sidebar dan konten dihidrasi di task terpisah (bukan satu task panjang). */}
        <Suspense fallback={null}>
        <nav className="wn-navs">
          {groups.map(g => {
            const closed = collapsed.has(g.key) && !g.items.some(i => isActive(pathname, i.href))
            return (
              <div key={g.key}>
                <button type="button" className="wn-ghd" aria-expanded={!closed} onClick={() => setCollapsed(p => { const s = new Set(p); s.has(g.key) ? s.delete(g.key) : s.add(g.key); return s })}>
                  <span>{g.label}</span><Icon name="chev" size={14} stroke={2} style={{ transform: `rotate(${closed ? -90 : 0}deg)`, transition: 'transform .2s' }} />
                </button>
                {!closed && g.items.map(i => (
                  <Link key={i.href} href={i.href} className="wn-nav" aria-current={isActive(pathname, i.href) ? 'page' : undefined}>
                    <Icon name={i.icon} />{i.label}{i.isNew && <span className="wn-new">BARU</span>}
                  </Link>
                ))}
              </div>
            )
          })}
        </nav>
        </Suspense>
        <div className="wn-foot">
          <button type="button" className="wn-nav" onClick={() => setTheme(nextTheme)} title="Ganti tema"><Icon name={theme === 'dark' ? 'moon' : theme === 'light' ? 'sun' : 'spark'} />Tema: {themeMeta.label}</button>
          {internal
            ? <Link href="/dashboard/profile" className="wn-me"><span className="au-av">{initials}</span><span className="au-col" style={{ minWidth: 0 }}><b>{user?.name}</b><span className="au-xs au-muted">{userRoles.join(', ')} · Profil</span></span></Link>
            : <button type="button" className="wn-nav" onClick={() => signOut({ callbackUrl: '/login' })}><Icon name="out" />Keluar</button>}
        </div>
      </aside>

      <div className="app-main wn-main">
        <header className="wn-top">
          <span className="wn-crumb">{appName}&nbsp;&nbsp;/&nbsp;&nbsp;{current.group}&nbsp;&nbsp;/&nbsp;&nbsp;<b>{current.label}</b></span>
          <div className="au-row">
            {idle && <OnlinePresence />}
            <button type="button" className="wn-kbtn" onClick={() => setPalOpen(true)}><Icon name="search" size={16} stroke={2} /><span>Cari menu atau aksi</span><kbd>⌘K</kbd></button>
            <div className="au-seg" role="group" aria-label="Tahun">
              {years.map(y => <button type="button" key={y} aria-pressed={y === year} onClick={() => setYear(y)}>{y}</button>)}
            </div>
          </div>
        </header>
        <header className="wn-mtop">
          <Link href="/dashboard" className="au-row" style={{ textDecoration: 'none', color: 'inherit', minWidth: 0 }}>{logo}<b className="disp" style={{ fontSize: 18 }}>{appName}</b></Link>
          <div className="au-row" style={{ gap: 8 }}>
            <label htmlFor="ymob" className="sr-only">Tahun</label>
            <select id="ymob" className="input" style={{ minHeight: 38, padding: '6px 8px', width: 'auto', fontSize: 15 }} value={year} onChange={e => setYear(Number(e.target.value))}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button type="button" className="wn-icb" aria-label="Cari" onClick={() => setPalOpen(true)}><Icon name="search" /></button>
            <button type="button" className="wn-icb" aria-label={'Tema: ' + themeMeta.label} onClick={() => setTheme(nextTheme)}><Icon name={theme === 'dark' ? 'moon' : theme === 'light' ? 'sun' : 'spark'} /></button>
            {internal && <Link href="/dashboard/profile" className="au-av" aria-label="Profil" style={{ textDecoration: 'none' }}>{initials}</Link>}
          </div>
        </header>
        <main className="wn-content fade-in"><Suspense fallback={null}>{children}</Suspense></main>
        <nav className="wn-tabbar" aria-label="Navigasi HP">
          {tabs.map(h => {
            const it = flat.find(i => i.href === h)!
            return <Link key={h} href={h} aria-current={isActive(pathname, h) ? 'page' : undefined}><Icon name={it.icon} size={22} stroke={1.8} />{TAB_LABEL[h]}</Link>
          })}
          <Link href="/dashboard/menu" aria-current={!onTab ? 'page' : undefined}><Icon name="more" size={22} stroke={1.8} />Menu</Link>
        </nav>
        {idle && <>
          <AppPopups />
          {internal && <><BirthdayPopup /><DailyCheckin /></>}
          {internal ? <NotifyEnabler /> : <InstallPWA />}
        </>}
        {palOpen && <CommandPalette open={palOpen} onClose={() => setPalOpen(false)} items={flat} onTheme={() => setTheme(nextTheme)} years={years} onYear={setYear} />}
      </div>
    </div>
  )
}

