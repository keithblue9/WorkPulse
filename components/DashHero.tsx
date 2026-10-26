'use client'
// Kartu "Sorotan" di Dashboard → General. Isinya bisa dipilih: progress, presensi, agenda, enhancement, tugas saya.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { CountUp, Icon, Ring, Seg, Sheet } from '@/components/ui'
import { HERO_KINDS, HERO_META, heroFor, otherYearHint, type HeroKind } from '@/lib/hero'
import { greeting, isFinished, upcoming } from '@/lib/dashboard'
import { CATS } from '@/lib/enhancement'
import { DAY, dUTC } from '@/lib/progress'

type Any = Record<string, any>
const P = (v: number) => `${Math.round(v || 0)}%`
const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
const attType = (r: Any) => String((Array.isArray(r?.slots) && r.slots[0]?.type) || r?.type || '').toLowerCase()
const TYPES: [string, string][] = [['wfo', 'WFO'], ['wfh', 'WFH'], ['dinas', 'Dinas'], ['cuti', 'Cuti'], ['sakit', 'Sakit'], ['izin', 'Izin']]

type Props = { d: Any; data: Any; me: Any | null; first: string; year: number; nowYear: number; todayIso: string; internal: boolean; isAdmin: boolean; setYear: (y: number) => void; onMyFocus?: () => void }

export function DashHero(p: Props) {
  const [saved, setSaved] = useState<{ hero: HeroKind | null; guestHero: HeroKind | null } | null>(null)
  const [pick, setPick] = useState(false)
  useEffect(() => { fetch('/api/me/widgets', { cache: 'no-store' }).then(r => r.ok ? r.json() : Promise.reject()).then(j => setSaved({ hero: j.data?.hero || null, guestHero: j.data?.guestHero || null })).catch(() => setSaved({ hero: null, guestHero: null })) }, [])
  if (!saved) return <div className="au-hero" style={{ minHeight: 260 }} aria-hidden="true"><div className="au-col" style={{ gap: 12, flex: 1 }}><div className="au-skel" style={{ width: '70%', height: 34 }} /><div className="au-skel" style={{ width: '45%', height: 34 }} /></div></div>
  const kind = p.internal ? heroFor(saved.hero, true) : heroFor(saved.guestHero, false)

  async function choose(k: HeroKind, scope: 'mine' | 'guest') {
    const prev = saved
    setSaved(s => s && (scope === 'guest' ? { ...s, guestHero: k } : { ...s, hero: k }))
    const r = await fetch('/api/me/widgets', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hero: k, scope }) }).catch(() => null)
    if (!r?.ok) { setSaved(prev); toast.error('Sorotan gagal disimpan') } else toast.success(`Sorotan: ${HERO_META[k].label}${scope === 'guest' ? ' (tamu)' : ''}`)
  }

  const switcher = p.internal && <button type="button" className="au-hero-sw" onClick={() => setPick(true)} aria-label={`Ganti sorotan (sekarang ${HERO_META[kind].label})`}><Icon name={HERO_META[kind].icon} size={13} stroke={2.2} />{HERO_META[kind].label}<Icon name="chev" size={12} stroke={2.4} /></button>
  const sheet = pick && <HeroPicker current={saved} isAdmin={p.isAdmin} onClose={() => setPick(false)} onChoose={choose} />
  if (kind === 'none') return <>{sheet}{p.internal && <div className="au-row" style={{ justifyContent: 'flex-end' }}>{switcher}</div>}</>
  return <>{sheet}<HeroBody kind={kind} p={p} switcher={switcher} /></>
}

function HeroPicker({ current, isAdmin, onClose, onChoose }: { current: { hero: HeroKind | null; guestHero: HeroKind | null }; isAdmin: boolean; onClose: () => void; onChoose: (k: HeroKind, s: 'mine' | 'guest') => void }) {
  const [scope, setScope] = useState<'mine' | 'guest'>('mine')
  const cur = scope === 'guest' ? heroFor(current.guestHero, false) : heroFor(current.hero, true)
  return (
    <Sheet open title="Pilih sorotan dashboard" onClose={onClose}>
      {isAdmin && <Seg full label="Sorotan untuk" value={scope} onChange={setScope} options={[['mine', 'Dashboard saya'], ['guest', 'Tampilan tamu']] as const} />}
      <p className="au-xs au-muted">Kartu besar di atas widget. Pilihan tersimpan untuk {scope === 'guest' ? 'semua tamu' : 'akunmu'}.</p>
      <div className="au-heropick" role="radiogroup" aria-label="Pilihan sorotan">
        {HERO_KINDS.filter(k => scope === 'mine' || !HERO_META[k].internalOnly).map(k => (
          <button key={k} type="button" role="radio" aria-checked={cur === k} className={`au-heroopt k-${k}`} onClick={() => onChoose(k, scope)}>
            <span className="ic"><Icon name={HERO_META[k].icon} size={18} stroke={2.1} /></span>
            <span className="au-col" style={{ gap: 2, minWidth: 0 }}><b>{HERO_META[k].label}</b><span className="au-xs au-muted">{HERO_META[k].desc}</span></span>
            {cur === k && <Icon name="check" size={16} stroke={2.6} style={{ marginLeft: 'auto', color: 'var(--accent)', flexShrink: 0 }} />}
          </button>
        ))}
      </div>
    </Sheet>
  )
}

function HeroBody({ kind, p, switcher }: { kind: HeroKind; p: Props; switcher: React.ReactNode }) {
  const { d, data, year, todayIso, nowYear, first, internal } = p
  const hello = `${greeting(new Date().getHours())}, ${first}.`
  const shell = (title: React.ReactNode, chips: React.ReactNode, actions: React.ReactNode, visual: React.ReactNode, tag: string) => (
    <section className={`au-hero rise hero-${kind}`} aria-labelledby="dash-h">
      <span className="au-sticker" aria-hidden="true"><Icon name="bolt" size={12} stroke={2.4} /> {tag}</span>
      <div className="au-col" style={{ gap: 18, minWidth: 0 }}>
        {switcher}
        <h1 id="dash-h">{title}</h1>
        <div className="au-hchips">{chips}</div>
        {actions && <div className="au-row au-wrap">{actions}</div>}
      </div>
      {visual}
    </section>
  )
  const chip = (v: React.ReactNode, l: string, key?: string) => <div key={key || l} className="au-hchip"><b>{v}</b><span>{l}</span></div>
  const enhHint = otherYearHint(data.enh || [], year)
  const yearHint = (n: number, h: { year: number; n: number } | null, what: string) => n === 0 && h ? <button type="button" className="au-yearhint" onClick={() => p.setYear(h.year)}>Ada {h.n} {what} di {h.year} — lihat {h.year} <Icon name="arrow" size={13} stroke={2.4} /></button> : null

  if (kind === 'presensi') {
    const staff: Any[] = d.staff
    const rec = (m: Any) => (data.att || []).find((r: Any) => r.date === todayIso && (String(r.userId) === String(m._id) || String(r.userId) === String(m.email)))
    const tt = staff.map(m => attType(rec(m)))
    const cnt = (k: string) => tt.filter(t => t === k).length
    const filled = tt.filter(Boolean).length
    const pct = staff.length ? (cnt('wfo') / staff.length) * 100 : 0
    const mon = new Date(dUTC(todayIso)); mon.setUTCDate(mon.getUTCDate() - ((mon.getUTCDay() + 6) % 7))
    const week = Array.from({ length: 5 }, (_, i) => { const iso = new Date(mon.getTime() + i * DAY).toISOString().slice(0, 10); const n = new Set((data.att || []).filter((r: Any) => r.date === iso && attType(r) === 'wfo').map((r: Any) => String(r.userId))).size; return { iso, n, h: HARI[new Date(dUTC(iso)).getUTCDay()].slice(0, 3) } })
    return shell(
      <>{hello} <em>{cnt('wfo')} dari {staff.length}</em> orang WFO hari ini{staff.length - filled > 0 ? `, ${staff.length - filled} belum isi presensi.` : '.'}</>,
      <>{TYPES.filter(([k]) => k === 'wfo' || cnt(k)).slice(0, 3).map(([k, l]) => chip(<CountUp to={cnt(k)} />, l, k))}{chip(<CountUp to={staff.length - filled} />, 'Belum isi', 'none')}</>,
      internal && <><Link href="/dashboard/attendance" className="btn btn-primary" style={{ minHeight: 44 }}>Isi presensi <Icon name="arrow" size={16} stroke={2.2} /></Link><Link href="/dashboard/calendar" className="btn btn-ghost" style={{ minHeight: 44 }}>Kalender tim</Link></>,
      <div className="au-col" style={{ alignItems: 'center', gap: 14 }}>
        <Ring value={pct} size={200} stroke={18} color="var(--att-wfo)" label={`${P(pct)} WFO hari ini`}><b style={{ fontSize: 44 }}>{P(pct)}</b><span>WFO hari ini</span></Ring>
        <div className="au-heroweek" aria-label="WFO pekan ini">{week.map(w => <span key={w.iso} className={w.iso === todayIso ? 'today' : ''} title={`${w.h}: ${w.n} WFO`}><i style={{ height: `${8 + (staff.length ? w.n / staff.length : 0) * 40}px` }} /><small>{w.h}</small></span>)}</div>
      </div>,
      `PRESENSI · ${new Date(dUTC(todayIso)).getUTCDate()} ${BLN[Number(todayIso.slice(5, 7)) - 1].toUpperCase()}`)
  }

  if (kind === 'agenda') {
    const from = year === nowYear ? todayIso : `${year}-01-01`
    const list = upcoming<Any>(d.acts, from, 4); const n0 = list[0]
    const weekEnd = new Date(dUTC(todayIso) + 6 * DAY).toISOString().slice(0, 10)
    // Hanya agenda yang masih berjalan; yang sedang berlangsung (mulai sebelum hari ini) ikut dihitung hari ini.
    const open = d.acts.filter((a: Any) => a.showInList !== false && !isFinished(a) && a.actionDate)
    const endOf = (a: Any) => (a.actionDateEnd && a.actionDateEnd > a.actionDate ? a.actionDateEnd : a.actionDate)
    const thisWeek = open.filter((a: Any) => endOf(a) >= todayIso && a.actionDate <= weekEnd).length
    const todayN = open.filter((a: Any) => a.actionDate <= todayIso && endOf(a) >= todayIso).length
    const ongoing = !!n0 && n0.actionDate < todayIso
    const dt = n0 ? new Date(dUTC(ongoing ? todayIso : n0.actionDate)) : null
    const diff = n0 && !ongoing ? Math.round((dUTC(n0.actionDate) - dUTC(todayIso)) / DAY) : 0
    return shell(
      n0 ? <>{hello} {ongoing ? 'Sedang berlangsung' : 'Berikutnya'} <em>{n0.title}</em>{ongoing ? `, sampai ${Number(String(endOf(n0)).slice(8, 10))} ${BLN[Number(String(endOf(n0)).slice(5, 7)) - 1]}` : `, ${diff === 0 ? 'hari ini' : diff === 1 ? 'besok' : `${diff} hari lagi`}`}.</> : <>{hello} Belum ada agenda terjadwal berikutnya.</>,
      <>{chip(<CountUp to={todayN} />, 'Hari ini')}{chip(<CountUp to={thisWeek} />, '7 hari ke depan')}{chip(<CountUp to={d.st.highPriority || 0} />, 'Prioritas tinggi')}</>,
      internal && <><Link href="/dashboard/calendar" className="btn btn-primary" style={{ minHeight: 44 }}>Buka kalender <Icon name="arrow" size={16} stroke={2.2} /></Link><Link href="/dashboard/activities" className="btn btn-ghost" style={{ minHeight: 44 }}>Activities</Link></>,
      <div className="au-heroagenda">
        {dt ? <div className="cal"><span className="m">{BLN[dt.getUTCMonth()].toUpperCase()}</span><b>{dt.getUTCDate()}</b><span className="w">{HARI[dt.getUTCDay()]}</span></div> : <div className="cal empty"><b>–</b></div>}
        <ol>{list.slice(1).map(a => <li key={a._id}><span className="d">{Number(String(a.actionDate).slice(8, 10))} {BLN[Number(String(a.actionDate).slice(5, 7)) - 1]}</span><span className="t">{a.title}</span></li>)}</ol>
      </div>,
      'AGENDA')
  }

  if (kind === 'enhancement') {
    const total = d.enh.length; const by = CATS.map(c => [c, d.enh.filter((v: Any) => v.s.cat === c).length] as const)
    const brd = total ? d.enh.reduce((s: number, v: Any) => s + ((v.e.stage || 1) / 7) * 100, 0) / total : 0
    return shell(
      total ? <>{hello} <em>{total} enhancement</em> di {year}{by[0][1] ? `, ${by[0][1]} Quick Win siap jalan.` : '.'}</> : <>{hello} Belum ada enhancement di {year}.</>,
      <>{by.map(([c, n]) => chip(<CountUp to={n} />, c, c))}</>,
      <>{yearHint(total, enhHint, 'enhancement')}{internal && <Link href="/dashboard/enhancement" className="btn btn-primary" style={{ minHeight: 44 }}>Buka enhancement <Icon name="arrow" size={16} stroke={2.2} /></Link>}</>,
      <Ring value={brd} size={220} stroke={20} color="#8C3FD6" label={`Rata-rata tahap BRD ${P(brd)}`}><b style={{ fontSize: 46 }}>{P(brd)}</b><span>rata-rata tahap BRD</span></Ring>,
      `ENHANCEMENT · ${year}`)
  }

  if (kind === 'fokus' && p.me) {
    const me = p.me
    return shell(
      <>Hai {first}, {me.late.length ? <>ada <em>{me.late.length} update</em> yang ditunggu hari ini.</> : me.tasks.length ? <>semua tugasmu <em>sesuai jadwal</em>.</> : <>belum ada tugas atas namamu.</>}</>,
      <>{chip(<CountUp to={me.tasks.length + me.myActs.length} />, 'Tugas saya')}{chip(<CountUp to={me.late.length} />, 'Perlu update')}{chip(<CountUp to={me.myEnh.length} />, 'Enhancement saya')}</>,
      <button type="button" className="btn btn-primary" style={{ minHeight: 44 }} onClick={p.onMyFocus}>Buka Fokus saya <Icon name="arrow" size={16} stroke={2.2} /></button>,
      <Ring value={me.c.actual} plan={me.tasks.length && me.c.spi != null ? me.c.plan : null} size={210} stroke={20} label={`Tugas saya ${P(me.c.actual)}`}><b style={{ fontSize: 44 }}>{P(me.c.actual)}</b><span>tugas saya · plan {P(me.c.plan)}</span></Ring>,
      'FOKUS SAYA')
  }

  // progress (bawaan)
  return shell(
    <>{hello} {d.inits.length
      ? (d.behind.length ? <><em>{d.behind.length} enhancement</em> butuh perhatian{d.enh.length ? `, ${d.enh.filter((v: Any) => v.s.cat === 'Quick Win').length} Quick Win siap jalan.` : '.'}</> : <>Semua enhancement <em>on track</em>.</>)
      : <>Belum ada pekerjaan tercatat di {year}.</>}</>,
    <>{chip(<CountUp to={d.inits.length} />, 'Enhancement')}{chip(<CountUp to={d.inits.filter((v: Any) => v.i.klas === 'SI').length} />, 'SI · KPI')}{chip(<><CountUp to={d.wfoToday.length} /><small style={{ fontSize: 16, opacity: .7 }}>/{d.staff.length}</small></>, 'WFO hari ini')}</>,
    <>{internal && <><Link href="/dashboard/enhancement?view=progress" className="btn btn-primary" style={{ minHeight: 44 }}>Lihat progress <Icon name="arrow" size={16} stroke={2.2} /></Link></>}{yearHint(d.enh.length, enhHint, 'enhancement')}</>,
    <Ring value={d.port.actual} plan={d.port.spi == null ? null : d.port.plan} size={220} stroke={20} label={`Realisasi portofolio ${P(d.port.actual)} dari rencana ${P(d.port.plan)}`}><b style={{ fontSize: 46 }}>{P(d.port.actual)}</b><span>realisasi · plan {P(d.port.plan)}</span></Ring>,
    `LIVE · ${year}`)
}
