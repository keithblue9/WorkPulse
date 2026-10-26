'use client'
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { getConfig } from '@/lib/configCache'
import { cachedFetch, invalidateFetch } from '@/lib/fetchCache'
import { picArray } from '@/lib/defaults'
import ExportMenu from '@/components/ExportMenu'
import { catK } from '@/components/EnhMatrix'
import { WidgetBoard } from '@/components/widgets/WidgetBoard'
import { DashHero } from '@/components/DashHero'
import { getAllowedMenus } from '@/lib/nav'
import { CountUp, Empty, Icon, PageHeader, Pill, Ring, Seg, Sheet } from '@/components/ui'
import { userRolesOf } from '@/lib/perms'
import { isInternalUser } from '@/lib/nav'
import { useYear } from '@/lib/year'
import { DAY, actsFromPhases, calc, dUTC, inYear, ptd, todayUTC } from '@/lib/progress'
import { showInYear } from '@/lib/initiativeView'
import { STAGES_SHORT, enhActs, normWeights, score } from '@/lib/enhancement'
import { activityInYear, activityStats, portfolio, samePerson, upcoming, wfoUserIds } from '@/lib/dashboard'

type View = 'general' | 'staff' | 'issues'
type Any = Record<string, any>
const VIEW_KEY = 'wins-dash-view'
const P = (v: number) => `${Math.round(v)}%`
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

export default function DashboardPage() {
  const { data: session } = useSession(); const user = session?.user as Any | undefined
  const roles = userRolesOf(user)
  const internal = isInternalUser(roles)
  const { year, setYear } = useYear()
  const nowYear = new Date().getFullYear()
  const todayIso = format(new Date(), 'yyyy-MM-dd')
  const today = useMemo(() => todayUTC(), [])
  const first = String(user?.name || '').split(' ')[0] || 'kamu'

  const [view, setView] = useState<View>('general')
  // Fokus: default diri sendiri; bisa dipilih per nama member (filter PIC).
  const [focus, setFocus] = useState<string>('')
  const [data, setData] = useState<{ acts: Any[]; inits: Any[]; enh: Any[]; members: Any[]; att: Any[]; notes: Any[] } | null>(null)
  const [failed, setFailed] = useState<string[]>([])
  const [config, setConfig] = useState<Any | null>(null)
  const [detail, setDetail] = useState<{ title: string; items: Any[] } | null>(null)

  useEffect(() => {
    if (!user) return
    // General = tampilan standar untuk semua member (seperti versi lama). 'mgmt' = nama lama tab ini.
    let v: View = 'general'
    try { const raw = localStorage.getItem(VIEW_KEY); const s = (raw === 'mgmt' ? 'general' : raw) as View | null; if (s && ['general', 'staff', 'issues'].includes(s) && (internal || s !== 'staff')) v = s } catch {}
    setView(v)
  }, [user, internal])
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
    // Transition: render widget yang berat dipecah React menjadi potongan kecil (tidak memblokir input).
    startTransition(() => { setData({ acts, inits, enh, members, notes, att: (att as Any[][]).flat() }); setFailed(Array.from(new Set(bad))) })
    getConfig(true).then(c => startTransition(() => setConfig(c))).catch(() => {})
  }, [internal, todayIso])
  const ready = session !== undefined
  useEffect(() => { if (ready) load() }, [load, ready])

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
    const self = !focus || samePerson(focus, String(user.name || ''))
    const person = self ? null : d.staff.find((m: Any) => samePerson(String(m.name || ''), focus))
    const name = self ? String(user.name || '') : focus
    const mineInits = d.inits.filter(x => picArray(x.i.pic).some(p => samePerson(p, name)))
    const tasks = mineInits.flatMap(x => x.acts.map((a, idx) => ({ x, a, idx }))).filter(t => t.a.pct < 100 && (!t.a.start || dUTC(t.a.start) <= today + 45 * DAY) && (!t.a.end || inYear([t.a], year) || !t.a.start))
    const late = tasks.filter(t => t.a.start && ptd(t.a, today) > t.a.pct + 0.5)
    const myActs = d.st.open.filter((a: Any) => picArray(a.pic).some(p => samePerson(p, name)) || samePerson(a.picName || '', name))
    const myEnh = d.enh.filter(v => (v.e.pic || []).some((p: string) => samePerson(p, name)))
    const ids = self ? [String(user.id || ''), String(user.email || '')] : [String(person?._id || ''), String(person?.email || '')].filter(Boolean)
    const myAtt = data.att.filter(r => ids.includes(String(r.userId)))
    const wfoMonth = new Set(myAtt.filter(r => String(r.date || '').startsWith(todayIso.slice(0, 7)) && wfoUserIds([r], r.date).size).map(r => r.date)).size
    const c = tasks.length ? calc(tasks.map(t => t.a), today) : { plan: 0, actual: 0, spi: null }
    return { tasks, late, myActs, myEnh, myAtt, wfoMonth, c, self, name }
  }, [data, d, user, today, year, todayIso, focus])

  const views: ReadonlyArray<readonly [View, React.ReactNode]> = internal
    ? [['general', <><Icon name="dash" size={15} />General</>], ['staff', <><Icon name="me" size={15} />Fokus saya</>], ['issues', <><Icon name="bolt" size={15} />Issues</>]]
    : [['general', <><Icon name="dash" size={15} />General</>], ['issues', <><Icon name="bolt" size={15} />Issues</>]]
  const dateLabel = format(new Date(), 'EEEE, d MMMM yyyy', { locale: idLocale })

  return (
    <div className="au-page">
      {detail && <Sheet open title={`${detail.title} (${detail.items.length})`} onClose={() => setDetail(null)}>
        {detail.items.length ? <div className="au-ig">{detail.items.map((it, k) => (
          <div key={k} className="au-igr" style={{ alignItems: 'flex-start' }}><span className="au-col" style={{ gap: 2, minWidth: 0 }}><b style={{ fontSize: 14 }}>{it.title}</b>
            <span className="au-xs au-muted">{[it.category, it.subType, it.actionDate && fmtD(it.actionDate), picArray(it.pic).join(', ')].filter(Boolean).join(' · ')}</span></span></div>
        ))}</div> : <Empty title="Tidak ada data" />}
      </Sheet>}

      <div className="au-view au-anim">
        <PageHeader eyebrow={`${dateLabel} · ${year}`} title="Dashboard" actions={<>
          <Seg label="Tampilan dashboard" value={view} onChange={pickView} options={views} />
        </>} />
        {failed.length > 0 && <div className="au-row au-wrap p-warn" role="status" style={{ borderRadius: 14, padding: 12 }}><span className="au-small" style={{ flex: 1 }}>Sebagian data gagal dimuat ({failed.join(', ')}).</span><button type="button" className="btn btn-sm" onClick={() => { ['/api/projects', '/api/initiatives?year=all', '/api/enhancements?year=all', '/api/users', '/api/notes'].forEach(u => invalidateFetch(u)); load() }}>Coba lagi</button></div>}

        {!d ? <Skeleton /> : view === 'issues' ? <Issues acts={data!.acts} config={config} internal={internal} onToggleHidden={async (a, next) => {
          setData(x => x && ({ ...x, acts: x.acts.map(y => (y._id === a._id ? { ...y, hidden: next } : y)) }))
          const r = await fetch(`/api/projects/${a._id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hidden: next }) }).catch(() => null)
          if (!r?.ok) setData(x => x && ({ ...x, acts: x.acts.map(y => (y._id === a._id ? { ...y, hidden: !next } : y)) }))
          else invalidateFetch('/api/projects')
        }} />
          : view === 'staff' && internal && me ? <Staff first={first} me={me} d={d} todayIso={todayIso} today={today} focus={focus} setFocus={setFocus} selfName={String(user?.name || '')} />
          : <>
            {/* Sorotan: bisa diganti (progress, presensi, agenda, enhancement, tugas saya) */}
            <DashHero d={d} data={data!} me={me} first={first} year={year} nowYear={nowYear} todayIso={todayIso} internal={internal} isAdmin={roles.includes('admin')} setYear={setYear} onMyFocus={internal ? () => { setFocus(''); pickView('staff') } : undefined} />

            {/* Widget ala Apple: dipilih & disusun per user (galeri per menu) */}
            <WidgetBoard isAdmin={roles.includes('admin')} allowed={config ? getAllowedMenus(config.roleDefs || [], roles, true) : null}
              ctx={{ d, data: data!, me, today, todayIso, year, nowYear, tpl, internal, config,
                onDetail: (title, items) => setDetail({ title, items }),
                onFocus: internal ? (name: string) => { setFocus(name); pickView('staff') } : undefined,
                onMyFocus: internal ? () => { setFocus(''); pickView('staff') } : undefined, onYear: setYear }} />
          </>}
      </div>
    </div>
  )
}

function Skeleton() {
  return <div className="au-col" style={{ gap: 16 }}><div className="au-hero" style={{ minHeight: 260 }}><div className="au-col" style={{ gap: 12 }}><div className="au-skel" style={{ width: '70%', height: 34 }} /><div className="au-skel" style={{ width: '45%', height: 34 }} /></div></div>
    <div className="au-grid g4">{[0, 1, 2, 3].map(k => <div key={k} className="au-tile"><div className="au-skel" style={{ width: 40, height: 30 }} /><div className="au-skel" style={{ width: '60%' }} /></div>)}</div></div>
}

/* ───────────── Fokus saya ───────────── */
function Staff({ first, me, d, todayIso, today, focus, setFocus, selfName }: { first: string; me: Any; d: Any; todayIso: string; today: number; focus: string; setFocus: (v: string) => void; selfName: string }) {
  const mon = new Date(dUTC(todayIso)); mon.setUTCDate(mon.getUTCDate() - ((mon.getUTCDay() + 6) % 7))
  const week = Array.from({ length: 5 }, (_, i) => { const t = new Date(mon.getTime() + i * DAY); const iso = t.toISOString().slice(0, 10); const r = me.myAtt.find((x: Any) => x.date === iso); const ty = r ? String((r.slots?.[0]?.type) || r.type || '').toUpperCase() : ''; return { iso, d: t.getUTCDate(), h: HARI[t.getUTCDay()], ty } })
  // Hanya agenda dengan PIC orang ini — tidak jatuh ke agenda tim.
  const nextMine = upcoming<Any>(me.myActs, todayIso, 1)[0]
  const who = me.self ? first : String(me.name).split(' ')[0]
  const others = d.staff.filter((m: Any) => m.name && !samePerson(String(m.name), selfName)).sort((a: Any, b: Any) => String(a.name).localeCompare(String(b.name)))
  const firstLate = me.late[0]
  return <>
    <div className="au-row au-wrap" style={{ gap: 10 }}>
      <label htmlFor="focus-who" className="au-small au-ink2" style={{ fontWeight: 600 }}>Fokus untuk</label>
      <select id="focus-who" className="input" style={{ width: 'auto', minWidth: 200, minHeight: 40 }} value={me.self ? '' : focus} onChange={e => setFocus(e.target.value)}>
        <option value="">Saya ({selfName.split(' ')[0] || 'saya'})</option>
        {others.map((m: Any) => <option key={m._id} value={m.name}>{m.name}</option>)}
      </select>
      <span className="au-xs au-muted">Hanya initiative, activity, dan enhancement dengan PIC {me.self ? 'kamu' : me.name}.</span>
    </div>
    <section className="au-hero rise" aria-labelledby="me-h">
      <span className="au-sticker" aria-hidden="true"><Icon name="me" size={12} stroke={2.4} /> {me.self ? 'FOKUS SAYA' : `FOKUS ${String(me.name).toUpperCase()}`}</span>
      <div className="au-col" style={{ gap: 18, minWidth: 0 }}>
        <h1 id="me-h">{me.self ? `Hai ${who}, ` : `${who}: `}{me.late.length ? <>ada <em>{me.late.length} update</em> yang ditunggu hari ini.</> : me.tasks.length ? <>semua tugas <em>sesuai jadwal</em>.</> : <>belum ada tugas initiative dengan PIC {me.self ? 'kamu' : who}.</>}</h1>
        <div className="au-hchips">
          <div className="au-hchip"><b><CountUp to={me.tasks.length + me.myActs.length} /></b><span>{me.self ? 'Tugas saya' : 'Tugas'}</span></div>
          <div className="au-hchip"><b><CountUp to={me.late.length} /></b><span>Perlu update</span></div>
          <div className="au-hchip"><b><CountUp to={me.wfoMonth} /></b><span>WFO bulan ini</span></div>
        </div>
        <div className="au-row au-wrap">
          {firstLate && <Link href={`/dashboard/progress?i=${firstLate.x.i._id}`} className="btn btn-primary" style={{ minHeight: 44 }}>Update {firstLate.a.name} <Icon name="arrow" size={16} stroke={2.2} /></Link>}
          <Link href="/dashboard/attendance" className="btn btn-ghost" style={{ minHeight: 44 }}>Isi presensi</Link>
        </div>
      </div>
      <Ring value={me.c.actual} plan={me.tasks.length && me.c.spi != null ? me.c.plan : null} size={210} stroke={20} label={`Tugas saya ${P(me.c.actual)}`}><b style={{ fontSize: 44 }}>{P(me.c.actual)}</b><span>{me.self ? 'tugas saya' : 'tugas'} · plan {P(me.c.plan)}</span></Ring>
    </section>
    <div className="au-bento">
      <section className="au-card s7 rise" style={{ ['--d' as any]: 1 }}>
        <div className="au-row au-between"><h2>{me.self ? 'Perlu kamu update' : 'Perlu update'}</h2><span className="lbl">ketuk untuk isi %</span></div>
        {me.tasks.length ? me.tasks.slice(0, 8).map((t: Any) => {
          const pl = t.a.start ? ptd(t.a, today) : 0, late = t.a.start && pl > t.a.pct + 0.5
          return <Link key={`${t.x.i._id}-${t.idx}`} href={`/dashboard/progress?i=${t.x.i._id}`} className="au-task">
            <span className="ic" style={late ? { background: 'var(--warn-soft)', color: 'var(--warn)' } : undefined}><Icon name={late ? 'clock' : 'check'} size={20} /></span>
            <span className="au-col" style={{ minWidth: 0, gap: 2 }}><b>{t.a.name}</b><span className="au-xs au-muted">{t.x.i.title}{t.a.end ? ` · selesai ${fmtD(t.a.end)}` : ' · belum dijadwal'}</span>
              <span className="au-row au-xs au-ink2" style={{ marginTop: 4 }}><span className="au-mini"><i style={{ width: `${t.a.pct}%` }} /></span>{P(t.a.pct)} · plan {P(pl)}</span></span>
            {late ? <Pill tone="warn">Tertinggal</Pill> : <Pill tone="ok">Aman</Pill>}
          </Link>
        }) : <Empty title="Semua beres" text={`Tidak ada aktivitas initiative dengan PIC ${me.self ? 'kamu' : who} yang menunggu update.`} />}
      </section>
      <section className="au-card s5 rise" style={{ ['--d' as any]: 2 }}>
        <div className="au-row au-between"><h2>Presensi pekan ini{me.self ? '' : ` · ${who}`}</h2><Link href="/dashboard/attendance" className="au-link">Presensi</Link></div>
        <div className="au-week">{week.map(w => <div key={w.iso} className={`day${w.ty === 'WFO' ? ' on' : ''}${w.iso === todayIso ? ' today' : ''}`}><span className="au-xs" style={{ fontFamily: 'var(--mono)', opacity: .75 }}>{w.h}</span><b>{w.d}</b><span className="au-xs">{w.ty || '–'}</span></div>)}</div>
        {nextMine && <div className="au-next"><div className="when">{whenLabel(nextMine.actionDate, todayIso)}</div><h3>{nextMine.title}</h3><div className="au-small" style={{ opacity: .75 }}>{[nextMine.category, nextMine.subType].filter(Boolean).join(' · ')}</div></div>}
      </section>
      <section className="au-card s6 rise" style={{ ['--d' as any]: 3 }}>
        <div className="au-row au-between"><h2>{me.self ? 'Activities saya' : `Activities ${who}`}</h2><Link href="/dashboard/activities" className="au-link">Semua</Link></div>
        {me.myActs.length ? <div className="au-ig" style={{ border: 0 }}>{me.myActs.slice(0, 6).map((a: Any) => <Link key={a._id} href="/dashboard/activities" className="au-igr"><span className="au-col" style={{ minWidth: 0, gap: 2 }}><b style={{ fontSize: 14 }}>{a.title}</b><span className="au-xs au-muted">{[a.category, a.subType, a.actionDate && fmtD(a.actionDate)].filter(Boolean).join(' · ')}</span></span>{a.priority && PRIO[a.priority] && <span style={{ marginLeft: 'auto' }}><Pill tone={PRIO[a.priority].t}>{PRIO[a.priority].l}</Pill></span>}</Link>)}</div>
          : <span className="au-small au-muted">Tidak ada activity terbuka dengan PIC {me.self ? 'kamu' : who}.</span>}
      </section>
      <section className="au-card s6 rise" style={{ ['--d' as any]: 4 }}>
        <div className="au-row au-between"><h2>{me.self ? 'Enhancement saya' : `Enhancement ${who}`}</h2><Link href="/dashboard/enhancement" className="au-link">Semua</Link></div>
        {me.myEnh.length ? me.myEnh.slice(0, 4).map((v: Any) => <Link key={v.e._id} href={`/dashboard/enhancement?e=${v.e._id}`} className="au-erow">
          <span className="au-row au-between au-xs" style={{ width: '100%' }}><span className="au-muted" style={{ fontFamily: 'var(--mono)' }}>{v.e.code} · {v.e.app}</span><span className={`au-cat ${catK(v.s.cat)}`}>{v.s.cat}</span></span>
          <b>{v.e.title}</b><span className="au-dots">{STAGES_SHORT.map((_, k) => <i key={k} className={k < (v.e.stage || 1) ? 'on' : ''} />)}</span></Link>)
          : <span className="au-small au-muted">Belum ada enhancement dengan PIC {me.self ? 'kamu' : who}. PIC diisi di menu Enhancement.</span>}
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
