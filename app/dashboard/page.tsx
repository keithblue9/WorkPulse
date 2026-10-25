'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { getConfig, invalidateConfig } from '@/lib/configCache'
import { cachedFetch, invalidateFetch } from '@/lib/fetchCache'
import { picArray } from '@/lib/defaults'
import BudgetInsights from '@/components/BudgetInsights'
import TeamAvailability from '@/components/TeamAvailability'
import MandatoryInsights from '@/components/MandatoryInsights'
import GoLiveInsights from '@/components/GoLiveInsights'
import ExportMenu from '@/components/ExportMenu'
import { EnhMatrix, catK } from '@/components/EnhMatrix'
import { CountUp, Empty, Icon, PageHeader, Pill, Ring, Seg, Sheet, Tile } from '@/components/ui'
import { userRolesOf } from '@/lib/perms'
import { isInternalUser } from '@/lib/nav'
import { useYear } from '@/lib/year'
import { DAY, actsFromPhases, calc, dUTC, inYear, ptd, statusOf, todayUTC } from '@/lib/progress'
import { showInYear } from '@/lib/initiativeView'
import { CATS, STAGES_SHORT, enhActs, normWeights, score } from '@/lib/enhancement'
import { activityInYear, activityStats, greeting, portfolio, samePerson, upcoming, wfoUserIds } from '@/lib/dashboard'

type View = 'mgmt' | 'staff' | 'issues'
type Any = Record<string, any>
const VIEW_KEY = 'wins-dash-view'
const P = (v: number) => `${Math.round(v)}%`
const n1 = (v: number) => (Math.round(v * 100) / 100).toLocaleString('id-ID')
const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
const fmtD = (s?: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? `${Number(m[3])} ${BLN[Number(m[2]) - 1]}` : '–' }
const whenLabel = (iso: string, today: string) => {
  const d = dUTC(iso), t = dUTC(today); if (!Number.isFinite(d)) return iso
  const diff = Math.round((d - t) / DAY), dd = new Date(d)
  const tail = `${HARI[dd.getUTCDay()].toUpperCase()} ${dd.getUTCDate()} ${BLN[dd.getUTCMonth()].toUpperCase()}`
  return diff === 0 ? `HARI INI · ${tail}` : diff === 1 ? `BESOK · ${tail}` : tail
}
const PRIO: Record<string, { l: string; t: 'bad' | 'warn' | 'ok' }> = { high: { l: 'High', t: 'bad' }, medium: { l: 'Medium', t: 'warn' }, low: { l: 'Low', t: 'ok' } }
const STAT_DEFS = [
  { key: 'stat-kpi', label: 'KPI', icon: 'act', color: 'var(--accent)', pick: (a: Any) => a.subType === 'KPI' },
  { key: 'stat-nonkpi', label: 'Non KPI', icon: 'list', color: '#7B6BFF', pick: (a: Any) => a.subType === 'Non-KPI' },
  { key: 'stat-golive', label: 'Go Live', icon: 'rocket', color: 'var(--aqua)', pick: (a: Any) => a.subType === 'Go-Live' },
  { key: 'stat-anggaran', label: 'Anggaran', icon: 'budget', color: 'var(--warn-bar)', pick: (a: Any) => a.subType === 'Anggaran' },
  { key: 'stat-others', label: 'Others', icon: 'more', color: 'var(--muted)', pick: (a: Any) => a.subType === 'Others' },
  { key: 'stat-highpriority', label: 'Prioritas tinggi', icon: 'bolt', color: 'var(--hot)', pick: (a: Any) => a.priority === 'high' },
]

export default function DashboardPage() {
  const { data: session } = useSession(); const user = session?.user as Any | undefined
  const roles = userRolesOf(user)
  const internal = isInternalUser(roles)
  const isMgr = roles.some(r => r === 'admin' || r === 'manager')
  const { year } = useYear()
  const nowYear = new Date().getFullYear()
  const todayIso = format(new Date(), 'yyyy-MM-dd')
  const today = useMemo(() => todayUTC(), [])
  const first = String(user?.name || '').split(' ')[0] || 'kamu'

  const [view, setView] = useState<View>('mgmt')
  const [data, setData] = useState<{ acts: Any[]; inits: Any[]; enh: Any[]; members: Any[]; att: Any[]; notes: Any[] } | null>(null)
  const [failed, setFailed] = useState<string[]>([])
  const [config, setConfig] = useState<Any | null>(null)
  const [detail, setDetail] = useState<{ title: string; items: Any[] } | null>(null)
  const [layout, setLayout] = useState(false)

  useEffect(() => {
    if (!user) return
    let v: View = isMgr || !internal ? 'mgmt' : 'staff'
    try { const s = localStorage.getItem(VIEW_KEY) as View | null; if (s && (internal || s !== 'staff')) v = s } catch {}
    setView(v)
  }, [user, internal, isMgr])
  const pickView = (v: View) => { setView(v); try { localStorage.setItem(VIEW_KEY, v) } catch {} }

  const load = useCallback(async () => {
    const ym = todayIso.slice(0, 7)
    // Pekan ini bisa melewati awal bulan: ambil juga bulan Senin pekan ini.
    const d = new Date(); const mon = new Date(d); mon.setDate(d.getDate() - ((d.getDay() + 6) % 7))
    const months = Array.from(new Set([format(mon, 'yyyy-MM'), ym]))
    const bad: string[] = []
    const get = (url: string, label: string) => cachedFetch(url).then(r => r?.data ?? []).catch(() => { bad.push(label); return [] })
    const [acts, inits, enh, members, notes, ...att] = await Promise.all([
      get('/api/projects', 'activities'), get('/api/initiatives?year=all', 'initiative'), get('/api/enhancements?year=all', 'enhancement'),
      get('/api/users', 'member'), internal ? get('/api/notes', 'catatan') : Promise.resolve([]),
      ...months.map(m => get(`/api/attendance?month=${m}`, 'presensi')),
    ])
    setData({ acts, inits, enh, members, notes, att: (att as Any[][]).flat() }); setFailed(Array.from(new Set(bad)))
    getConfig(true).then(c => setConfig(c)).catch(() => {})
  }, [internal, todayIso])
  useEffect(() => { if (session !== undefined) load() }, [load, session])

  const widgets: Any[] = config?.dashboardWidgets || []
  const visible = (key: string) => { const w = widgets.find(x => x.key === key); if (!w) return true; return internal ? w.active !== false : w.active !== false && w.activeGuest !== false }
  const tpl = normWeights(config?.enhancementTemplate)

  // ── Derived data ──
  const d = useMemo(() => {
    if (!data) return null
    const inits = data.inits.filter(i => (internal || !i.hiddenGuest) && showInYear(i, year)).map(i => {
      const acts = actsFromPhases(i.phases || [], Number(i.year) || year)
      return { i, acts, c: calc(acts, today) }
    })
    const scheduled = inits.filter(x => x.acts.some(a => a.start))
    const port = portfolio(scheduled.map(x => x.c))
    const enh = data.enh.map(e => { const acts = enhActs(e, tpl); return { e, s: score(e.items), acts, c: calc(acts, today) } }).filter(v => v.e.year === year || inYear(v.acts, year))
    const acts = data.acts.filter(a => activityInYear(a, year, nowYear))
    const st = activityStats(acts)
    const staff = data.members.filter(m => m.active !== false && !userRolesOf(m).every(r => r === 'guest'))
    const wfoIds = wfoUserIds(data.att, todayIso)
    const wfoToday = staff.filter(m => wfoIds.has(String(m._id)) || wfoIds.has(String(m.email)))
    const behind = inits.filter(x => x.c.spi != null && x.c.spi < 1)
    return { inits, port, enh, acts, st, staff, wfoToday, behind }
  }, [data, internal, year, today, nowYear, todayIso, tpl])

  // ── Fokus saya ──
  const me = useMemo(() => {
    if (!data || !d || !user) return null
    const name = String(user.name || '')
    const mineInits = d.inits.filter(x => picArray(x.i.pic).some(p => samePerson(p, name)))
    const tasks = mineInits.flatMap(x => x.acts.map((a, idx) => ({ x, a, idx }))).filter(t => t.a.pct < 100 && (!t.a.start || dUTC(t.a.start) <= today + 45 * DAY) && (!t.a.end || inYear([t.a], year) || !t.a.start))
    const late = tasks.filter(t => t.a.start && ptd(t.a, today) > t.a.pct + 0.5)
    const myActs = d.st.open.filter((a: Any) => picArray(a.pic).some(p => samePerson(p, name)) || samePerson(a.picName || '', name))
    const myEnh = d.enh.filter(v => (v.e.pic || []).some((p: string) => samePerson(p, name)))
    const ids = [String(user.id || ''), String(user.email || '')]
    const myAtt = data.att.filter(r => ids.includes(String(r.userId)))
    const wfoMonth = new Set(myAtt.filter(r => String(r.date || '').startsWith(todayIso.slice(0, 7)) && wfoUserIds([r], r.date).size).map(r => r.date)).size
    const c = tasks.length ? calc(tasks.map(t => t.a), today) : { plan: 0, actual: 0, spi: null }
    return { tasks, late, myActs, myEnh, myAtt, wfoMonth, c }
  }, [data, d, user, today, year, todayIso])

  const views: ReadonlyArray<readonly [View, React.ReactNode]> = internal
    ? [['mgmt', <><Icon name="boss" size={15} />Manajemen</>], ['staff', <><Icon name="me" size={15} />Fokus saya</>], ['issues', <><Icon name="bolt" size={15} />Issues</>]]
    : [['mgmt', <><Icon name="dash" size={15} />Ringkasan</>], ['issues', <><Icon name="bolt" size={15} />Issues</>]]
  const dateLabel = format(new Date(), 'EEEE, d MMMM yyyy', { locale: idLocale })

  return (
    <div className="au-page">
      {detail && <Sheet open title={`${detail.title} (${detail.items.length})`} onClose={() => setDetail(null)}>
        {detail.items.length ? <div className="au-ig">{detail.items.map((it, k) => (
          <div key={k} className="au-igr" style={{ alignItems: 'flex-start' }}><span className="au-col" style={{ gap: 2, minWidth: 0 }}><b style={{ fontSize: 14 }}>{it.title}</b>
            <span className="au-xs au-muted">{[it.category, it.subType, it.actionDate && fmtD(it.actionDate), picArray(it.pic).join(', ')].filter(Boolean).join(' · ')}</span></span></div>
        ))}</div> : <Empty title="Tidak ada data" />}
      </Sheet>}
      {layout && config && <LayoutSheet widgets={widgets} onClose={() => setLayout(false)} onChange={async next => {
        setConfig(c => ({ ...(c || {}), dashboardWidgets: next }))
        const r = await fetch('/api/config', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dashboardWidgets: next }) }).catch(() => null)
        if (!r?.ok) throw new Error('Layout gagal disimpan'); invalidateConfig()
      }} />}

      <div className="au-view au-anim">
        <PageHeader eyebrow={`${dateLabel} · ${year}`} title="Dashboard" actions={<>
          <Seg label="Tampilan dashboard" value={view} onChange={pickView} options={views} />
          {internal && view === 'mgmt' && <button type="button" className="btn btn-ghost" onClick={() => setLayout(true)} disabled={!config}><Icon name="grid" size={15} />Atur layout</button>}
        </>} />
        {failed.length > 0 && <div className="au-row au-wrap p-warn" role="status" style={{ borderRadius: 14, padding: 12 }}><span className="au-small" style={{ flex: 1 }}>Sebagian data gagal dimuat ({failed.join(', ')}).</span><button type="button" className="btn btn-sm" onClick={() => { ['/api/projects', '/api/initiatives?year=all', '/api/enhancements?year=all', '/api/users', '/api/notes'].forEach(u => invalidateFetch(u)); load() }}>Coba lagi</button></div>}

        {!d ? <Skeleton /> : view === 'issues' ? <Issues acts={data!.acts} config={config} internal={internal} onToggleHidden={async (a, next) => {
          setData(x => x && ({ ...x, acts: x.acts.map(y => (y._id === a._id ? { ...y, hidden: next } : y)) }))
          const r = await fetch(`/api/projects/${a._id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hidden: next }) }).catch(() => null)
          if (!r?.ok) setData(x => x && ({ ...x, acts: x.acts.map(y => (y._id === a._id ? { ...y, hidden: !next } : y)) }))
          else invalidateFetch('/api/projects')
        }} />
          : view === 'staff' && internal && me ? <Staff first={first} me={me} d={d} todayIso={todayIso} today={today} />
          : <>
            {/* Hero */}
            <section className="au-hero rise" aria-labelledby="dash-h">
              <span className="au-sticker" aria-hidden="true"><Icon name="bolt" size={12} stroke={2.4} /> LIVE · {year}</span>
              <div className="au-col" style={{ gap: 18, minWidth: 0 }}>
                <h1 id="dash-h">{greeting(new Date().getHours())}, {first}. {d.inits.length
                  ? (d.behind.length ? <><em>{d.behind.length} initiative</em> butuh perhatian{d.enh.length ? `, ${d.enh.filter(v => v.s.cat === 'Quick Win').length} Quick Win siap jalan.` : '.'}</> : <>Semua initiative <em>on track</em>.</>)
                  : d.enh.length ? <>{d.enh.length} enhancement terjadwal di {year}.</> : <>Belum ada pekerjaan tercatat di {year}.</>}</h1>
                <div className="au-hchips">
                  <div className="au-hchip"><b><CountUp to={d.inits.length} /></b><span>Initiative</span></div>
                  <div className="au-hchip"><b><CountUp to={d.enh.length} /></b><span>Enhancement</span></div>
                  <div className="au-hchip"><b><CountUp to={d.wfoToday.length} /><small style={{ fontSize: 16, opacity: .7 }}>/{d.staff.length}</small></b><span>WFO hari ini</span></div>
                </div>
                {internal && <div className="au-row au-wrap">
                  <Link href="/dashboard/progress" className="btn btn-primary" style={{ minHeight: 44 }}>Lihat progress <Icon name="arrow" size={16} stroke={2.2} /></Link>
                  <Link href="/dashboard/enhancement" className="btn btn-ghost" style={{ minHeight: 44 }}>Buka enhancement</Link>
                </div>}
              </div>
              <Ring value={d.port.actual} plan={d.port.spi == null ? null : d.port.plan} size={220} stroke={20} label={`Realisasi portofolio ${P(d.port.actual)} dari rencana ${P(d.port.plan)}`}>
                <b style={{ fontSize: 46 }}>{P(d.port.actual)}</b><span>realisasi · plan {P(d.port.plan)}</span>
              </Ring>
            </section>

            {/* Stat tiles */}
            {(() => {
              const tiles = STAT_DEFS.filter(s => visible(s.key))
              const showWfo = visible('member-count')
              if (!tiles.length && !showWfo) return null
              return (
                <div className="au-grid au-tiles" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(128px,1fr))' }}>
                  {tiles.map(s => { const items = d.st.open.filter(s.pick); return <Tile key={s.key} icon={s.icon} color={s.color} value={<CountUp to={items.length} />} label={s.label} hint={d.st.total ? P((items.length / d.st.total) * 100) : undefined} onClick={() => setDetail({ title: `Aktivitas ${s.label}`, items })} /> })}
                  {showWfo && <Tile icon="user" color="var(--ok)" value={<>{d.wfoToday.length}<small style={{ fontSize: 15, opacity: .6 }}>/{d.staff.length}</small></>} label="WFO hari ini" onClick={() => setDetail({ title: 'WFO hari ini', items: d.wfoToday.map(m => ({ title: m.name, category: m.division || '' })) })} />}
                </div>
              )
            })()}

            {/* Widgets in configured order */}
            <div className="au-bento" style={{ gridAutoFlow: 'row dense' }}>
              {[...widgets].filter(w => w.segment === 'main' && visible(w.key)).sort((a, b) => (a.order ?? 99) - (b.order ?? 99)).map((w, k) => {
                const half = (internal ? w.size : w.sizeGuest || w.size) === 'half'
                const node = renderWidget(w.key, { d, data: data!, internal, today, todayIso, year, nowYear, notes: data!.notes })
                if (!node) return null
                return <div key={w.key} className={`${half ? 's6' : 's12'} au-wslot rise`} style={{ ['--d' as any]: Math.min(k, 8) }}>{node}</div>
              })}
            </div>
          </>}
      </div>
    </div>
  )
}

function Skeleton() {
  return <div className="au-col" style={{ gap: 16 }}><div className="au-hero" style={{ minHeight: 260 }}><div className="au-col" style={{ gap: 12 }}><div className="au-skel" style={{ width: '70%', height: 34 }} /><div className="au-skel" style={{ width: '45%', height: 34 }} /></div></div>
    <div className="au-grid g4">{[0, 1, 2, 3].map(k => <div key={k} className="au-tile"><div className="au-skel" style={{ width: 40, height: 30 }} /><div className="au-skel" style={{ width: '60%' }} /></div>)}</div></div>
}

type Ctx = { d: NonNullable<Any>; data: Any; internal: boolean; today: number; todayIso: string; year: number; nowYear: number; notes: Any[] }
function renderWidget(key: string, x: Ctx): React.ReactNode {
  const { d, internal, today, todayIso, year, nowYear } = x
  switch (key) {
    case 'today-summary': {
      const qw = d.enh.filter((v: Any) => v.s.cat === 'Quick Win').length
      const nextAg = upcoming<Any>(d.acts, year === nowYear ? todayIso : `${year}-01-01`, 1)[0]
      return (
        <section className="au-card">
          <div className="au-row au-between"><h2>Ringkasan {year === nowYear ? 'hari ini' : year}</h2><span className="lbl">dari data</span></div>
          <ol className="au-story">
            <li><span className="n">1</span><span>{d.inits.length
              ? <>Realisasi portofolio <b>{P(d.port.actual)}</b> vs plan <b>{P(d.port.plan)}</b>. {d.behind.length ? <><b style={{ color: 'var(--warn)' }}>{d.behind.slice(0, 3).map((b: Any) => b.i.title).join(', ')}</b>{d.behind.length > 3 ? ` dan ${d.behind.length - 3} lainnya` : ''} di belakang jadwal.</> : 'Semua sesuai jadwal.'}</>
              : `Tidak ada initiative berjalan di ${year}.`}</span></li>
            <li><span className="n">2</span><span><b>{d.enh.length} enhancement</b>{d.enh.length ? `: ${CATS.map(c => [c, d.enh.filter((v: Any) => v.s.cat === c).length] as const).filter(c => c[1]).map(c => `${c[1]} ${c[0]}`).join(', ')}` : ' belum tercatat'}.{qw ? ` ${qw} Quick Win bisa dikerjakan lebih dulu.` : ''}</span></li>
            <li><span className="n">3</span><span><b>{d.wfoToday.length} dari {d.staff.length}</b> orang WFO hari ini.{nextAg ? <> Berikutnya: <b>{nextAg.title}</b> ({fmtD(nextAg.actionDate)}).</> : ''}</span></li>
          </ol>
          <div style={{ height: 1, background: 'var(--line)' }} />
          <div className="au-row au-between"><h2>Laju vs waktu</h2><span className="lbl">garis = plan hari ini</span></div>
          {d.inits.length ? d.inits.slice(0, 8).map((v: Any) => {
            const st = statusOf(v.c.spi)
            const inner = <><span className="t">{v.i.title}</span><span className="au-track"><i className="a" style={{ width: `${Math.min(100, v.c.actual)}%` }} /><span className="tick" style={{ left: `calc(${Math.min(100, v.c.plan)}% - 1px)` }} /></span><Pill tone={st.key}>{st.label}</Pill></>
            return internal ? <Link key={v.i._id} href={`/dashboard/progress?i=${v.i._id}`} className="au-pace" aria-label={`${v.i.title}: realisasi ${P(v.c.actual)}, plan ${P(v.c.plan)}, ${st.label}`}>{inner}</Link> : <div key={v.i._id} className="au-pace">{inner}</div>
          }) : <span className="au-small au-muted">Belum ada initiative di {year}.</span>}
        </section>
      )
    }
    case 'upcoming-agenda': {
      const list = upcoming<Any>(d.acts, year === nowYear ? todayIso : `${year}-01-01`, 6)
      const [n0, ...rest] = list
      return (
        <section className="au-card">
          <div className="au-row au-between"><h2>Berikutnya</h2>{internal && <Link href="/dashboard/calendar" className="au-link">Kalender</Link>}</div>
          {n0 ? <>
            <div className="au-next"><div className="when">{whenLabel(n0.actionDate, todayIso)}</div><h3>{n0.title}</h3><div className="au-small" style={{ opacity: .75 }}>{[n0.category, n0.subType, picArray(n0.pic).join(', ')].filter(Boolean).join(' · ')}</div></div>
            <div>{rest.map((a: Any) => <div key={a._id} className="au-agrow"><span className="w">{fmtD(a.actionDate)}</span><span><b style={{ fontWeight: 600 }}>{a.title}</b><br /><span className="au-xs au-muted">{[a.category, a.subType].filter(Boolean).join(' · ')}</span></span></div>)}</div>
          </> : <Empty title="Tidak ada agenda" text="Belum ada aktivitas terjadwal berikutnya." />}
        </section>
      )
    }
    case 'progress-chart': {
      const keys = [['ok', 'On track', 'var(--ok)'], ['warn', 'Perlu perhatian', 'var(--warn-bar)'], ['bad', 'Terlambat', 'var(--hot)'], ['none', 'Belum mulai', 'var(--line2)']] as const
      const cnt = keys.map(([k]) => d.inits.filter((v: Any) => statusOf(v.c.spi).key === k).length)
      return (
        <section className="au-card">
          <div className="au-row au-between"><h2>Status progress project</h2>{internal && <Link href="/dashboard/progress" className="au-link">Detail</Link>}</div>
          {d.inits.length ? <>
            <div className="au-row" style={{ alignItems: 'baseline', gap: 8 }}><b style={{ font: '700 40px/1 var(--disp)' }}><CountUp to={d.inits.length} /></b><span className="au-small au-ink2">initiative di {year}</span></div>
            <div className="au-stack" style={{ height: 14 }}>{keys.map(([k, , c], i) => cnt[i] ? <i key={k} style={{ flex: cnt[i], background: c }} /> : null)}</div>
            <div className="au-key">{keys.map(([k, l, c], i) => <span key={k}><i style={{ background: c }} />{l} <b style={{ color: 'var(--ink)' }}>{cnt[i]}</b></span>)}</div>
          </> : <Empty title={`Belum ada initiative di ${year}`} />}
        </section>
      )
    }
    case 'enhancement-map': {
      const stageN = STAGES_SHORT.map((_, i) => d.enh.filter((v: Any) => (v.e.stage || 1) === i + 1).length), maxS = Math.max(1, ...stageN)
      return (
        <section className="au-card">
          <div className="au-row au-between"><h2>Peta enhancement</h2>{internal && <Link href="/dashboard/enhancement" className="au-link">Buka</Link>}</div>
          {d.enh.length ? <>
            <EnhMatrix list={d.enh} small />
            <div className="au-key">{CATS.map(c => <span key={c} className={catK(c)}><i style={{ background: 'var(--k)' }} />{c} <b style={{ color: 'var(--ink)' }}>{d.enh.filter((v: Any) => v.s.cat === c).length}</b></span>)}</div>
            <div className="au-col" style={{ gap: 6 }}>{STAGES_SHORT.map((s, i) => stageN[i] ? <div key={s} className="au-stagebar"><span className="au-ink2">{s}</span><span className="au-track" style={{ height: 9 }}><i className="a" style={{ width: `${(stageN[i] / maxS) * 100}%` }} /></span><b>{stageN[i]}</b></div> : null)}</div>
          </> : <Empty title={`Belum ada enhancement di ${year}`} />}
        </section>
      )
    }
    case 'pinned-notes': {
      if (!internal) return null
      const pins = x.notes.filter((n: Any) => n.pinned).slice(0, 5)
      return (
        <section className="au-card">
          <div className="au-row au-between"><h2>Catatan disematkan</h2><Link href="/dashboard/notes" className="au-link">Semua</Link></div>
          {pins.length ? pins.map((n: Any) => <div key={n._id} className="au-row" style={{ alignItems: 'flex-start', gap: 12 }}><span className="au-pin" style={{ marginTop: 3 }}>PIN</span><span className="au-col" style={{ minWidth: 0 }}><b style={{ fontSize: 14.5 }}>{n.title}</b>{n.content && <span className="au-xs au-ink2" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{n.content}</span>}</span></div>)
            : <span className="au-small au-muted">Belum ada catatan yang disematkan. Sematkan dari menu [Team] Notes.</span>}
        </section>
      )
    }
    case 'budget-yield': return <BudgetInsights section="yield" />
    case 'budget-realpct': return <BudgetInsights section="realpct" />
    case 'budget-prognosa': return <BudgetInsights section="prognosa" />
    case 'budget-cashcard': return <BudgetInsights section="cashcard" />
    case 'team-availability': return <TeamAvailability />
    case 'mandatory-mcu': return <MandatoryInsights section="mcu" />
    case 'mandatory-training': return <MandatoryInsights section="training" />
    case 'mandatory-kpi': return <MandatoryInsights section="kpi" />
    case 'golive-insights': return <GoLiveInsights />
    default: return null
  }
}

/* ───────────── Fokus saya ───────────── */
function Staff({ first, me, d, todayIso, today }: { first: string; me: Any; d: Any; todayIso: string; today: number }) {
  const mon = new Date(dUTC(todayIso)); mon.setUTCDate(mon.getUTCDate() - ((mon.getUTCDay() + 6) % 7))
  const week = Array.from({ length: 5 }, (_, i) => { const t = new Date(mon.getTime() + i * DAY); const iso = t.toISOString().slice(0, 10); const r = me.myAtt.find((x: Any) => x.date === iso); const ty = r ? String((r.slots?.[0]?.type) || r.type || '').toUpperCase() : ''; return { iso, d: t.getUTCDate(), h: HARI[t.getUTCDay()], ty } })
  const nextMine = upcoming<Any>(me.myActs, todayIso, 1)[0] || upcoming<Any>(d.acts, todayIso, 1)[0]
  const firstLate = me.late[0]
  return <>
    <section className="au-hero rise" aria-labelledby="me-h">
      <span className="au-sticker" aria-hidden="true"><Icon name="me" size={12} stroke={2.4} /> FOKUS SAYA</span>
      <div className="au-col" style={{ gap: 18, minWidth: 0 }}>
        <h1 id="me-h">Hai {first}, {me.late.length ? <>ada <em>{me.late.length} update</em> yang ditunggu hari ini.</> : me.tasks.length ? <>semua tugasmu <em>sesuai jadwal</em>.</> : <>belum ada tugas initiative atas namamu.</>}</h1>
        <div className="au-hchips">
          <div className="au-hchip"><b><CountUp to={me.tasks.length + me.myActs.length} /></b><span>Tugas saya</span></div>
          <div className="au-hchip"><b><CountUp to={me.late.length} /></b><span>Perlu update</span></div>
          <div className="au-hchip"><b><CountUp to={me.wfoMonth} /></b><span>WFO bulan ini</span></div>
        </div>
        <div className="au-row au-wrap">
          {firstLate && <Link href={`/dashboard/progress?i=${firstLate.x.i._id}`} className="btn btn-primary" style={{ minHeight: 44 }}>Update {firstLate.a.name} <Icon name="arrow" size={16} stroke={2.2} /></Link>}
          <Link href="/dashboard/attendance" className="btn btn-ghost" style={{ minHeight: 44 }}>Isi presensi</Link>
        </div>
      </div>
      <Ring value={me.c.actual} plan={me.tasks.length && me.c.spi != null ? me.c.plan : null} size={210} stroke={20} label={`Tugas saya ${P(me.c.actual)}`}><b style={{ fontSize: 44 }}>{P(me.c.actual)}</b><span>tugas saya · plan {P(me.c.plan)}</span></Ring>
    </section>
    <div className="au-bento">
      <section className="au-card s7 rise" style={{ ['--d' as any]: 1 }}>
        <div className="au-row au-between"><h2>Perlu kamu update</h2><span className="lbl">ketuk untuk isi %</span></div>
        {me.tasks.length ? me.tasks.slice(0, 8).map((t: Any) => {
          const pl = t.a.start ? ptd(t.a, today) : 0, late = t.a.start && pl > t.a.pct + 0.5
          return <Link key={`${t.x.i._id}-${t.idx}`} href={`/dashboard/progress?i=${t.x.i._id}`} className="au-task">
            <span className="ic" style={late ? { background: 'var(--warn-soft)', color: 'var(--warn)' } : undefined}><Icon name={late ? 'clock' : 'check'} size={20} /></span>
            <span className="au-col" style={{ minWidth: 0, gap: 2 }}><b>{t.a.name}</b><span className="au-xs au-muted">{t.x.i.title}{t.a.end ? ` · selesai ${fmtD(t.a.end)}` : ' · belum dijadwal'}</span>
              <span className="au-row au-xs au-ink2" style={{ marginTop: 4 }}><span className="au-mini"><i style={{ width: `${t.a.pct}%` }} /></span>{P(t.a.pct)} · plan {P(pl)}</span></span>
            {late ? <Pill tone="warn">Tertinggal</Pill> : <Pill tone="ok">Aman</Pill>}
          </Link>
        }) : <Empty title="Semua beres" text="Tidak ada aktivitas initiative atas namamu yang menunggu update." />}
      </section>
      <section className="au-card s5 rise" style={{ ['--d' as any]: 2 }}>
        <div className="au-row au-between"><h2>Presensi pekan ini</h2><Link href="/dashboard/attendance" className="au-link">Presensi</Link></div>
        <div className="au-week">{week.map(w => <div key={w.iso} className={`day${w.ty === 'WFO' ? ' on' : ''}${w.iso === todayIso ? ' today' : ''}`}><span className="au-xs" style={{ fontFamily: 'var(--mono)', opacity: .75 }}>{w.h}</span><b>{w.d}</b><span className="au-xs">{w.ty || '–'}</span></div>)}</div>
        {nextMine && <div className="au-next"><div className="when">{whenLabel(nextMine.actionDate, todayIso)}</div><h3>{nextMine.title}</h3><div className="au-small" style={{ opacity: .75 }}>{[nextMine.category, nextMine.subType].filter(Boolean).join(' · ')}</div></div>}
      </section>
      <section className="au-card s6 rise" style={{ ['--d' as any]: 3 }}>
        <div className="au-row au-between"><h2>Activities saya</h2><Link href="/dashboard/activities" className="au-link">Semua</Link></div>
        {me.myActs.length ? <div className="au-ig" style={{ border: 0 }}>{me.myActs.slice(0, 6).map((a: Any) => <Link key={a._id} href="/dashboard/activities" className="au-igr"><span className="au-col" style={{ minWidth: 0, gap: 2 }}><b style={{ fontSize: 14 }}>{a.title}</b><span className="au-xs au-muted">{[a.category, a.subType, a.actionDate && fmtD(a.actionDate)].filter(Boolean).join(' · ')}</span></span>{a.priority && PRIO[a.priority] && <span style={{ marginLeft: 'auto' }}><Pill tone={PRIO[a.priority].t}>{PRIO[a.priority].l}</Pill></span>}</Link>)}</div>
          : <span className="au-small au-muted">Tidak ada activity terbuka dengan PIC kamu.</span>}
      </section>
      <section className="au-card s6 rise" style={{ ['--d' as any]: 4 }}>
        <div className="au-row au-between"><h2>Enhancement saya</h2><Link href="/dashboard/enhancement" className="au-link">Semua</Link></div>
        {me.myEnh.length ? me.myEnh.slice(0, 4).map((v: Any) => <Link key={v.e._id} href={`/dashboard/enhancement?e=${v.e._id}`} className="au-erow">
          <span className="au-row au-between au-xs" style={{ width: '100%' }}><span className="au-muted" style={{ fontFamily: 'var(--mono)' }}>{v.e.code} · {v.e.app}</span><span className={`au-cat ${catK(v.s.cat)}`}>{v.s.cat}</span></span>
          <b>{v.e.title}</b><span className="au-dots">{STAGES_SHORT.map((_, k) => <i key={k} className={k < (v.e.stage || 1) ? 'on' : ''} />)}</span></Link>)
          : <span className="au-small au-muted">Belum ada enhancement dengan PIC kamu. PIC diisi di menu Enhancement.</span>}
      </section>
    </div>
  </>
}

/* ───────────── Issues ───────────── */
function Issues({ acts, config, internal, onToggleHidden }: { acts: Any[]; config: Any | null; internal: boolean; onToggleHidden: (a: Any, next: boolean) => void }) {
  const [status, setStatus] = useState('all'), [showHidden, setShowHidden] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const listed = acts.filter(a => a.showInList !== false)
  const vis = listed.filter(a => !a.hidden), hiddenN = listed.length - vis.length
  const statuses: Any[] = (config?.issueStatuses || []).filter((s: Any) => s.active)
  const dist: Any[] = statuses.map(s => ({ ...s, n: vis.filter(a => a.status === s.key).length }))
  const high = vis.filter(a => a.priority === 'high' && !['completed', 'done'].includes(String(a.status)))
  const rows = (showHidden ? listed : vis).filter(a => status === 'all' || a.status === status)
  const catColor = (k: string) => (config?.activityCategories || []).find((c: Any) => c.key === k)?.color || 'var(--accent)'
  return (
    <div className="au-col" style={{ gap: 16 }} ref={ref}>
      <div className="au-row" style={{ justifyContent: 'flex-end' }} data-export-hide><ExportMenu getNodes={() => ref.current ? Array.from(ref.current.querySelectorAll<HTMLElement>('[data-export-card]')) : []} filename="issues-report" title="Issues — WINS" /></div>
      <div className="au-grid g2" data-export-card="">
        <section className="au-card rise"><h2>Sebaran status</h2>
          <div className="au-row" style={{ alignItems: 'baseline', gap: 8 }}><b style={{ font: '700 40px/1 var(--disp)' }}>{vis.length}</b><span className="au-small au-ink2">issue tampil{hiddenN ? ` · ${hiddenN} disembunyikan` : ''}</span></div>
          <div className="au-stack" style={{ height: 14 }}>{dist.map(s => s.n ? <i key={s.key} style={{ flex: s.n, background: s.color }} /> : null)}</div>
          <div className="au-key">{dist.map(s => <span key={s.key}><i style={{ background: s.color }} />{s.label} <b style={{ color: 'var(--ink)' }}>{s.n}</b></span>)}</div>
        </section>
        <section className="au-card rise" style={{ ['--d' as any]: 1 }}><div className="au-row au-between"><h2>Prioritas tinggi aktif</h2><Pill tone={high.length ? 'bad' : 'ok'}>{high.length ? `${high.length} aktif` : 'Aman'}</Pill></div>
          {high.length ? <div className="au-ig" tabIndex={0} role="region" aria-label="Issue prioritas tinggi" style={{ border: 0, maxHeight: 220, overflowY: 'auto' }}>{high.map(a => <div key={a._id} className="au-igr"><span className="au-col" style={{ gap: 2, minWidth: 0 }}><b style={{ fontSize: 14 }}>{a.title}</b><span className="au-xs au-muted">{a.category} · PIC {picArray(a.pic).join(', ') || a.picName || '–'}</span></span></div>)}</div> : <span className="au-small au-muted">Tidak ada issue prioritas tinggi yang aktif.</span>}
        </section>
      </div>
      <section className="au-card rise" style={{ ['--d' as any]: 2, padding: 0, gap: 0 }} data-export-card="">
        <div className="au-row au-between au-wrap" style={{ padding: '16px 20px' }}><h2>Detail issues</h2>
          {internal && hiddenN > 0 && <button type="button" className="btn btn-sm" data-export-hide onClick={() => setShowHidden(v => !v)}>{showHidden ? 'Sembunyikan yang disembunyikan' : `Tampilkan ${hiddenN} tersembunyi`}</button>}</div>
        <div className="au-chips" role="group" aria-label="Filter status" style={{ padding: '0 20px 14px' }} data-export-hide>
          <button type="button" className="au-chip" aria-pressed={status === 'all'} onClick={() => setStatus('all')}>Semua</button>
          {statuses.map(s => <button key={s.key} type="button" className="au-chip" aria-pressed={status === s.key} onClick={() => setStatus(s.key)}>{s.label}</button>)}
        </div>
        <div className="au-tblw" style={{ border: 0, borderTop: '1px solid var(--line)', borderRadius: 0, maxHeight: '60dvh', overflow: 'auto' }}>
          <table className="wp-table" style={{ minWidth: 900 }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}><tr><th style={{ minWidth: 220 }}>Issue</th><th style={{ minWidth: 220 }}>Progress</th><th>Action date</th><th style={{ minWidth: 180 }}>Next plan</th><th>Target week</th><th>Prioritas</th><th>PIC</th></tr></thead>
            <tbody>{rows.length ? rows.map(a => (
              <tr key={a._id} style={{ opacity: a.hidden ? .5 : 1 }}>
                <td><div className="au-row" style={{ alignItems: 'flex-start', gap: 8 }}>
                  {internal && <button type="button" className="btn btn-icon btn-sm" data-export-hide aria-pressed={!a.hidden} aria-label={a.hidden ? `Tampilkan ${a.title} di dashboard` : `Sembunyikan ${a.title} dari dashboard`} title={a.hidden ? 'Tampilkan di dashboard' : 'Sembunyikan dari dashboard'} onClick={() => onToggleHidden(a, !a.hidden)}><Icon name={a.hidden ? 'lock' : 'check'} size={14} /></button>}
                  <span className="au-col" style={{ gap: 4 }}><b style={{ fontSize: 13.5, color: 'var(--ink)' }}>{a.title}</b><span className="au-row au-wrap" style={{ gap: 4 }}><span className="au-tag"><i style={{ background: catColor(a.category) }} />{a.category}</span>{a.subType && <span className="au-tag">{a.subType}</span>}</span></span>
                </div></td>
                <td style={{ whiteSpace: 'pre-wrap' }}>{a.description || a.progressNotes || '–'}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{a.actionDate ? fmtD(a.actionDate) : '–'}</td>
                <td style={{ whiteSpace: 'pre-wrap' }}>{a.nextPlan || '–'}</td>
                <td>{a.targetWeek || '–'}</td>
                <td>{a.priority && PRIO[a.priority] ? <Pill tone={PRIO[a.priority].t}>{PRIO[a.priority].l}</Pill> : '–'}</td>
                <td>{picArray(a.pic).join(', ') || a.picName || '–'}</td>
              </tr>
            )) : <tr><td colSpan={7} style={{ textAlign: 'center', padding: 28 }} className="au-muted">Belum ada issue untuk filter ini.</td></tr>}</tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

/* ───────────── Atur layout ───────────── */
function LayoutSheet({ widgets, onClose, onChange }: { widgets: Any[]; onClose: () => void; onChange: (w: Any[]) => Promise<void> }) {
  const [mode, setMode] = useState<'internal' | 'guest'>('internal')
  const [busy, setBusy] = useState(false)
  const main = [...widgets].filter(w => w.segment === 'main').sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
  const stats = [...widgets].filter(w => w.segment === 'stats').sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
  const on = (w: Any) => (mode === 'guest' ? w.activeGuest !== false : w.active !== false)
  const size = (w: Any) => (mode === 'guest' ? w.sizeGuest || w.size : w.size) || 'full'
  async function save(next: Any[]) { setBusy(true); try { await onChange(next) } catch (e: any) { toast.error(e.message) } finally { setBusy(false) } }
  const toggle = (w: Any) => { const f = mode === 'guest' ? 'activeGuest' : 'active'; save(widgets.map(x => (x.key === w.key ? { ...x, [f]: !on(w) } : x))) }
  const resize = (w: Any) => { const f = mode === 'guest' ? 'sizeGuest' : 'size'; save(widgets.map(x => (x.key === w.key ? { ...x, [f]: size(w) === 'half' ? 'full' : 'half' } : x))) }
  const move = (i: number, dir: -1 | 1) => { const j = i + dir; if (j < 0 || j >= main.length) return; const arr = [...main]; [arr[i], arr[j]] = [arr[j], arr[i]]; const re = arr.map((x, k) => ({ ...x, order: k + 1 })); save([...widgets.filter(x => x.segment !== 'main'), ...re]) }
  return (
    <Sheet open title="Atur layout dashboard" onClose={onClose}>
      <Seg full label="Tampilan untuk" value={mode} onChange={setMode} options={[['internal', 'Internal'], ['guest', 'Tamu / eksternal']] as const} />
      <p className="au-xs au-muted">{mode === 'guest' ? 'Yang disembunyikan di sini tidak terlihat oleh tamu.' : 'Urutan berlaku untuk semua; visibilitas dan ukuran khusus tampilan internal.'} {busy ? 'Menyimpan…' : 'Tersimpan otomatis.'}</p>
      <span className="au-igh">Blok utama</span>
      <div className="au-ig">{main.map((w, i) => (
        <div key={w.key} className="au-igr" style={{ opacity: on(w) ? 1 : .55, gap: 6 }}>
          <span className="k" style={{ flex: 1, minWidth: 0, fontWeight: 600, color: 'var(--ink)' }}>{w.label}</span>
          <button type="button" className="btn btn-icon btn-sm" aria-label={`Naikkan ${w.label}`} disabled={i === 0 || busy} onClick={() => move(i, -1)}><Icon name="up" size={14} /></button>
          <button type="button" className="btn btn-icon btn-sm" aria-label={`Turunkan ${w.label}`} disabled={i === main.length - 1 || busy} onClick={() => move(i, 1)} style={{ transform: 'rotate(180deg)' }}><Icon name="up" size={14} /></button>
          <button type="button" className="btn btn-sm" disabled={busy} onClick={() => resize(w)} aria-label={`Ukuran ${w.label}: ${size(w) === 'half' ? 'setengah' : 'penuh'}`}>{size(w) === 'half' ? '½' : 'Penuh'}</button>
          <input type="checkbox" className="au-sw" checked={on(w)} disabled={busy} onChange={() => toggle(w)} aria-label={`Tampilkan ${w.label}`} />
        </div>
      ))}</div>
      <span className="au-igh">Kartu statistik</span>
      <div className="au-ig">{stats.map(w => (
        <label key={w.key} className="au-igr"><span className="k" style={{ flex: 1 }}>{String(w.label).replace('Stat: ', '')}</span><input type="checkbox" className="au-sw" checked={on(w)} disabled={busy} onChange={() => toggle(w)} /></label>
      ))}</div>
    </Sheet>
  )
}
