'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { getConfig } from '@/lib/configCache'
import { getAllowedMenus, visibleNav, isInternalUser } from '@/lib/nav'
import { displayAppName } from '@/lib/appName'
import { Icon, PageHeader } from '@/components/ui'

// Halaman "Menu" untuk HP: semua menu yang boleh dibuka, dikelompokkan seperti sidebar.
export default function MenuPage() {
  const { data: session } = useSession()
  const [cfg, setCfg] = useState<any>(null)
  useEffect(() => { getConfig().then(setCfg).catch(() => {}) }, [])
  const user = session?.user as any
  const roles: string[] = user?.roles?.length ? user.roles : (user?.role ? [user.role] : ['guest'])
  const groups = visibleNav(getAllowedMenus(cfg?.roleDefs || [], roles, !!cfg), roles)
  return (
    <div className="au-page">
      <div className="au-view au-anim">
        <PageHeader eyebrow={displayAppName(cfg?.appName)} title="Menu" />
        {groups.map((g, gi) => (
          <section key={g.key} className="au-card rise" style={{ ['--d' as any]: gi }}>
            <span className="lbl">{g.label}</span>
            <div className="au-grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 8 }}>
              {g.items.map(i => <Link key={i.href} href={i.href} className="wn-nav" style={{ background: 'var(--sunken)', minHeight: 52 }}><Icon name={i.icon} />{i.label}{i.isNew && <span className="wn-new">BARU</span>}</Link>)}
            </div>
          </section>
        ))}
        <section className="au-card rise">
          <span className="lbl">Akun</span>
          <div className="au-grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 8 }}>
            {isInternalUser(roles) && <Link href="/dashboard/issues" className="wn-nav" style={{ background: 'var(--sunken)', minHeight: 52 }}><Icon name="bolt" />Issues</Link>}
            {isInternalUser(roles) && <Link href="/dashboard/profile" className="wn-nav" style={{ background: 'var(--sunken)', minHeight: 52 }}><Icon name="me" />Profil</Link>}
            <button type="button" className="wn-nav" style={{ background: 'var(--sunken)', minHeight: 52, color: 'var(--bad)' }} onClick={() => signOut({ callbackUrl: '/login' })}><Icon name="out" />Keluar</button>
          </div>
        </section>
      </div>
    </div>
  )
}
