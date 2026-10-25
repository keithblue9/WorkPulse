'use client'
// Widget dashboard "Instrument Light": satu keluarga = satu warna + aset aurora, ukuran S/M/L.
// Semua widget membaca data yang sama (WCtx) — tidak ada fetch per widget kecuali data tambahan (extra).
import Link from 'next/link'
import { CountUp, Icon, Ring } from '@/components/ui'
import { FAMILIES, WIDGET_BY_ID, type Size } from '@/lib/widgets'
import { picArray } from '@/lib/defaults'
import { CATS, STAGES_SHORT } from '@/lib/enhancement'
import { statusOf, ptd, DAY, dUTC } from '@/lib/progress'
import { upcoming } from '@/lib/dashboard'
import { workload } from '@/lib/workload'
import { otherYearHint } from '@/lib/hero'
import { EnhMatrix, catK } from '@/components/EnhMatrix'

type Any = Record<string, any>
export type WCtx = {
  d: Any; data: Any; me: Any | null; today: number; todayIso: string; year: number; nowYear: number; tpl: number[]
  extra: { mandatory?: Any[] | null; golive?: Any | null; budget?: Any[] | null; cashcard?: Any | null }
  internal: boolean; config: Any | null
  onDetail: (title: string, items: Any[]) => void; onFocus?: (name: string) => void; onMyFocus?: () => void; onYear?: (y: number) => void
}

const P = (v: number) => `${Math.round(v || 0)}%`
const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
const dShort = (s?: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? `${Number(m[3])} ${BLN[Number(m[2]) - 1]}` : '–' }
const rpS = (n: number) => { const a = Math.abs(n || 0), f = (v: number, u: string) => `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(v)} ${u}`; return a >= 1e9 ? f(n / 1e9, 'M') : a >= 1e6 ? f(n / 1e6, 'jt') : a >= 1e3 ? f(n / 1e3, 'rb') : String(Math.round(n || 0)) }
const initials = (n: string) => String(n || '').split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase()
const when = (iso: string, todayIso: string) => { const diff = Math.round((dUTC(iso) - dUTC(todayIso)) / DAY); const t = new Date(dUTC(iso)); return diff === 0 ? 'Hari ini' : diff === 1 ? 'Besok' : `${HARI[t.getUTCDay()]}, ${t.getUTCDate()} ${BLN[t.getUTCMonth()]}` }
const ST_COLOR: Record<string, string> = { ok: 'var(--ok)', warn: 'var(--warn-bar)', bad: 'var(--hot, #E5484D)', none: 'var(--line2)' }
// Palet kategori presensi (tervalidasi dataviz: lolos CVD terang & gelap; label selalu tertulis). Warna lewat CSS var.
const ATT: Record<string, { l: string; c: string; ink: string }> = {
  wfo: { l: 'WFO', c: 'var(--att-wfo)', ink: 'var(--att-ink-dark)' }, wfh: { l: 'WFH', c: 'var(--att-wfh)', ink: '#fff' }, dinas: { l: 'Dinas', c: 'var(--att-dinas)', ink: '#fff' },
  cuti: { l: 'Cuti', c: 'var(--att-cuti)', ink: '#fff' }, sakit: { l: 'Sakit', c: 'var(--att-sakit)', ink: 'var(--att-ink-dark)' }, izin: { l: 'Izin', c: 'var(--att-izin)', ink: 'var(--att-ink-dark)' },
}
const attType = (r: Any) => String((Array.isArray(r?.slots) && r.slots[0]?.type) || r?.type || '').toLowerCase()

/** Bingkai widget: kaca + aurora keluarga, judul kecil, seluruh kartu bisa diketuk (link di lapisan bawah). */
export function WidgetFrame({ id, size, children, href, onOpen, preview }: { id: string; size: Size; children: React.ReactNode; href?: string; onOpen?: () => void; preview?: boolean }) {
  const def = WIDGET_BY_ID.get(id)!; const fam = FAMILIES[def.fam]
  return (
    <article className={`wg wg-${size}`} data-fam={def.fam} style={{ ['--art' as any]: `url(/widgets/${fam.art}.webp)` }} aria-label={`${def.title} (${size})`}>
      {!preview && (onOpen ? <button type="button" className="wg-link" onClick={onOpen} aria-label={`Buka ${def.title}`} /> : href ? <Link href={href} className="wg-link" aria-label={`Buka ${def.title}`} prefetch={false} /> : null)}
      <header className="wg-h"><span className="wg-ic"><Icon name={fam.icon} size={12} stroke={2.2} /></span><span>{size === 'S' ? fam.label.split(' ')[0] : def.title}</span></header>
      <div className="wg-b">{children}</div>
    </article>
  )
}

const Big = ({ v, unit, sub }: { v: React.ReactNode; unit?: string; sub?: React.ReactNode }) => <div className="wg-big"><b>{v}{unit && <small>{unit}</small>}</b>{sub && <span>{sub}</span>}</div>
const Bar = ({ v, c = 'var(--wf)', tick }: { v: number; c?: string; tick?: number }) => <span className="wg-bar"><i style={{ width: `${Math.max(0, Math.min(100, v))}%`, background: c }} />{tick != null && <s style={{ left: `calc(${Math.min(100, tick)}% - 1px)` }} />}</span>
const Empty = ({ t }: { t: string }) => <span className="wg-empty">{t}</span>
const EnhEmpty = ({ x }: { x: WCtx }) => { const h = otherYearHint(x.data.enh || [], x.year); return h && x.onYear ? <span className="wg-empty">Belum ada di {x.year}.<br /><button type="button" className="au-link" onClick={() => x.onYear!(h.year)}>Ada {h.n} di {h.year} — lihat</button></span> : <Empty t={`Belum ada enhancement di ${x.year}`} /> }

export function renderWidget(id: string, size: Size, x: WCtx): React.ReactNode {
  const { d, data, today, todayIso, year, nowYear } = x
  switch (id) {
    case 'summary': {
      const qw = d.enh.filter((v: Any) => v.s.cat === 'Quick Win').length
      const next = upcoming<Any>(d.acts, year === nowYear ? todayIso : `${year}-01-01`, 1)[0]
      const lines = [
        d.inits.length ? <>Realisasi <b>{P(d.port.actual)}</b> vs plan <b>{P(d.port.plan)}</b>{d.behind.length ? <> · <b className="wg-warn">{d.behind.length} tertinggal</b></> : ' · semua sesuai jadwal'}</> : <>Belum ada initiative di {year}</>,
        <><b>{d.enh.length}</b> enhancement{qw ? <> · <b>{qw}</b> Quick Win siap</> : ''}</>,
        <><b>{d.wfoToday.length}/{d.staff.length}</b> WFO hari ini{size === 'L' && next ? <> · berikutnya <b>{next.title}</b> ({dShort(next.actionDate)})</> : ''}</>,
      ]
      return <>
        <ol className="wg-story">{lines.map((l, i) => <li key={i}><span className="n">{i + 1}</span><span>{l}</span></li>)}</ol>
        {size === 'L' && <div className="wg-list">{d.inits.slice(0, 4).map((v: Any) => { const st = statusOf(v.c.spi); return <div key={v.i._id} className="wg-row"><span className="t">{v.i.title}</span><Bar v={v.c.actual} c={ST_COLOR[st.key]} tick={v.c.plan} /></div> })}</div>}
      </>
    }
    case 'progress': {
      const keys = [['ok', 'On track'], ['warn', 'Perhatian'], ['bad', 'Terlambat'], ['none', 'Belum mulai']] as const
      const cnt = keys.map(([k]) => d.inits.filter((v: Any) => statusOf(v.c.spi).key === k).length)
      const ring = (sz: number, st: number) => <Ring value={d.port.actual} plan={d.port.spi == null ? null : d.port.plan} size={sz} stroke={st} color="var(--wf)" label={`Realisasi ${P(d.port.actual)}, plan ${P(d.port.plan)}`}><b style={{ fontSize: sz / 4.2 }}>{P(d.port.actual)}</b>{sz > 90 && <span>plan {P(d.port.plan)}</span>}</Ring>
      if (!d.inits.length) return <Empty t={`Belum ada initiative di ${year}`} />
      if (size === 'S') return <div className="wg-center">{ring(92, 10)}</div>
      const legend = <div className="wg-legend">{keys.map(([k, l], i) => <span key={k}><i style={{ background: ST_COLOR[k] }} />{l}<b>{cnt[i]}</b></span>)}</div>
      if (size === 'M') return <div className="wg-split">{ring(104, 11)}{legend}</div>
      return <><div className="wg-split">{ring(120, 12)}{legend}</div>
        <div className="wg-list">{d.inits.slice(0, 5).map((v: Any) => { const st = statusOf(v.c.spi); return <div key={v.i._id} className="wg-row"><span className="t">{v.i.title}</span><Bar v={v.c.actual} c={ST_COLOR[st.key]} tick={v.c.plan} /></div> })}</div></>
    }
    case 'myfocus': {
      const me = x.me; if (!me) return <Empty t="Memuat…" />
      if (size === 'S') return <Big v={<CountUp to={me.late.length} />} sub={me.late.length ? 'perlu update' : `${me.tasks.length} tugas · aman`} />
      return <div className="wg-list">{me.tasks.length ? me.tasks.slice(0, 3).map((t: Any) => { const pl = t.a.start ? ptd(t.a, today) : 0; return <div key={`${t.x.i._id}-${t.idx}`} className="wg-row"><span className="t">{t.a.name}<small>{t.x.i.title}</small></span><Bar v={t.a.pct} tick={pl} c={t.a.start && pl > t.a.pct + .5 ? 'var(--warn-bar)' : 'var(--wf)'} /></div> }) : <Empty t="Tidak ada tugas yang menunggu" />}</div>
    }
    case 'enhancement': {
      const total = d.enh.length; const by = CATS.map(c => [c, d.enh.filter((v: Any) => v.s.cat === c).length] as const)
      if (!total) return <EnhEmpty x={x} />
      if (size === 'S') return <Big v={<CountUp to={total} />} sub={`${by[0][1]} Quick Win`} />
      const max = Math.max(1, ...by.map(b => b[1]))
      const cats = <div className="wg-list">{by.map(([c, n]) => <div key={c} className="wg-row"><span className="t">{c}</span><Bar v={(n / max) * 100} /><b className="n">{n}</b></div>)}</div>
      if (size === 'M') return <div className="wg-split"><Big v={<CountUp to={total} />} sub="enhancement" />{cats}</div>
      const stageN = STAGES_SHORT.map((_, i) => d.enh.filter((v: Any) => (v.e.stage || 1) === i + 1).length), mx = Math.max(1, ...stageN)
      return <><div className="wg-split"><Big v={<CountUp to={total} />} sub="enhancement" />{cats}</div>
        <div className="wg-stages">{STAGES_SHORT.map((s, i) => <span key={s} title={`${s}: ${stageN[i]}`}><i style={{ height: `${12 + (stageN[i] / mx) * 44}px`, opacity: stageN[i] ? 1 : .25 }} /><small>{s.split(' ')[0]}</small></span>)}</div></>
    }
    case 'agenda': {
      const list = upcoming<Any>(d.acts, year === nowYear ? todayIso : `${year}-01-01`, size === 'L' ? 6 : 2)
      if (!list.length) return <Empty t="Tidak ada agenda terjadwal" />
      if (size === 'S') return <div className="wg-next"><span className="when">{when(list[0].actionDate, todayIso)}</span><b>{list[0].title}</b></div>
      return <div className="wg-list">{list.map((a: Any) => <div key={a._id} className="wg-ag"><span className="dt"><b>{Number(String(a.actionDate).slice(8, 10))}</b>{BLN[Number(String(a.actionDate).slice(5, 7)) - 1]}</span><span className="t">{a.title}<small>{[a.category, picArray(a.pic).join(', ')].filter(Boolean).join(' · ')}</small></span></div>)}</div>
    }
    case 'activity-stats': {
      const defs = [['KPI', (a: Any) => a.subType === 'KPI'], ['Non KPI', (a: Any) => a.subType === 'Non-KPI'], ['Go Live', (a: Any) => a.subType === 'Go-Live'], ['Anggaran', (a: Any) => a.subType === 'Anggaran'], ['Others', (a: Any) => a.subType === 'Others'], ['Prioritas tinggi', (a: Any) => a.priority === 'high']] as const
      const cells = <div className="wg-cells">{defs.map(([l, f]) => { const items = d.st.open.filter(f); return <button key={l} type="button" className="wg-cell" onClick={() => x.onDetail(`Aktivitas ${l}`, items)}><b>{items.length}</b><span>{l}</span></button> })}</div>
      if (size === 'M') return cells
      const high = d.st.open.filter((a: Any) => a.priority === 'high').slice(0, 4)
      return <>{cells}<div className="wg-list">{high.map((a: Any) => <div key={a._id} className="wg-row"><span className="t">{a.title}<small>{picArray(a.pic).join(', ') || '–'}</small></span><span className="wg-pill">High</span></div>)}</div></>
    }
    case 'issues': {
      const high = (data.acts || []).filter((a: Any) => a.showInList !== false && !a.hidden && a.priority === 'high' && !['completed', 'done'].includes(String(a.status)))
      if (size === 'S') return <Big v={<CountUp to={high.length} />} sub={high.length ? 'prioritas tinggi aktif' : 'aman'} />
      return high.length ? <div className="wg-list">{high.slice(0, 3).map((a: Any) => <div key={a._id} className="wg-row"><span className="t">{a.title}<small>{a.category} · PIC {picArray(a.pic).join(', ') || a.picName || '–'}</small></span></div>)}</div> : <Empty t="Tidak ada issue prioritas tinggi" />
    }
    case 'team': {
      const staff: Any[] = d.staff
      const rec = (m: Any, iso: string) => (data.att || []).find((r: Any) => r.date === iso && (String(r.userId) === String(m._id) || String(r.userId) === String(m.email)))
      const todayType = (m: Any) => attType(rec(m, todayIso))
      if (size === 'S') return <Big v={<>{d.wfoToday.length}<small>/{staff.length}</small></>} sub="WFO hari ini" />
      if (size === 'M') {
        const counts = Object.keys(ATT).map(k => [k, staff.filter(m => todayType(m) === k).length] as const).filter(c => c[1])
        const empty = staff.filter(m => !todayType(m)).length
        return <><div className="wg-chips">{counts.map(([k, n]) => <span key={k} style={{ ['--c' as any]: ATT[k].c }}><i />{ATT[k].l}<b>{n}</b></span>)}{empty > 0 && <span style={{ ['--c' as any]: 'var(--line2)' }}><i />Belum isi<b>{empty}</b></span>}</div>
          <div className="wg-avs">{staff.slice(0, 9).map(m => { const t = todayType(m); return <span key={m._id} className="av" title={`${m.name}: ${ATT[t]?.l || 'belum isi'}`} style={{ ['--c' as any]: ATT[t]?.c || 'var(--line2)' }}>{initials(m.name)}</span> })}</div></>
      }
      const mon = new Date(dUTC(todayIso)); mon.setUTCDate(mon.getUTCDate() - ((mon.getUTCDay() + 6) % 7))
      const days = Array.from({ length: 5 }, (_, i) => new Date(mon.getTime() + i * DAY).toISOString().slice(0, 10))
      return <div className="wg-week" role="table" aria-label="Presensi pekan ini">
        <div className="r hd" role="row"><span role="columnheader" />{days.map(dd => <span key={dd} role="columnheader" className={dd === todayIso ? 'today' : ''}>{HARI[new Date(dUTC(dd)).getUTCDay()]}</span>)}</div>
        {staff.slice(0, 8).map(m => <div key={m._id} className="r" role="row"><span role="rowheader" className="nm">{String(m.name).split(' ')[0]}</span>{days.map(dd => { const t = attType(rec(m, dd)); return <span key={dd} role="cell" className="c" title={`${m.name} ${dd}: ${ATT[t]?.l || '–'}`} style={{ ['--c' as any]: ATT[t]?.c || 'transparent', color: ATT[t]?.ink }}>{ATT[t]?.l || ''}</span> })}</div>)}
      </div>
    }
    case 'workload': {
      const rows = workload(d.staff, { acts: d.acts, inits: d.inits.map((v: Any) => v.i), enh: d.enh.map((v: Any) => v.e) }, today, x.tpl).slice(0, size === 'L' ? 8 : 4)
      const max = Math.max(1, ...rows.map(r => r.total))
      return <div className="wg-list">{rows.map(r => <button key={r.name} type="button" className="wg-row wg-btn" onClick={() => x.onFocus?.(r.name)} title={`Fokus ${r.name}`}><span className="t">{r.name.split(' ').slice(0, 2).join(' ')}<small>{r.acts} act · {r.inits} init · {r.enh} enh{r.late ? ` · ${r.late} perlu update` : ''}</small></span><Bar v={(r.total / max) * 100} c={r.late ? 'var(--warn-bar)' : 'var(--wf)'} /><b className="n">{r.total}</b></button>)}</div>
    }
    case 'mandatory': {
      const recs = x.extra.mandatory; if (recs == null) return <Empty t="Memuat…" />
      const staff: Any[] = d.staff; const byId = new Map(recs.map((r: Any) => [String(r.userId), r]))
      const recOf = (m: Any) => byId.get(String(m.email)) || byId.get(String(m._id))
      const pct = (f: (r: Any) => boolean) => staff.length ? Math.round(staff.filter(m => { const r = recOf(m); return r && f(r) }).length / staff.length * 100) : 0
      const mcu = pct(r => r?.mcu?.done === 'sudah'), tr = pct(r => (r?.trainings || []).length > 0), kpi = pct(r => (r?.supportKpi || []).length > 0)
      const ring = (v: number, l: string, sz: number) => <div className="wg-ringc"><Ring value={v} size={sz} stroke={sz > 80 ? 10 : 7} color="var(--wf)" label={`${l} ${v}%`}><b style={{ fontSize: sz / 4.4 }}>{v}%</b></Ring><span>{l}</span></div>
      if (size === 'S') return <div className="wg-center">{ring(mcu, 'MCU', 84)}</div>
      const rings = <div className="wg-rings">{ring(mcu, 'MCU', 74)}{ring(tr, 'Training', 74)}{ring(kpi, 'Support KPI', 74)}</div>
      if (size === 'M') return rings
      const notYet = staff.filter(m => recOf(m)?.mcu?.done !== 'sudah')
      return <>{rings}<div className="wg-list">{notYet.length ? <><span className="wg-cap">Belum MCU {year}</span>{notYet.slice(0, 4).map(m => <div key={m._id} className="wg-row"><span className="t">{m.name}<small>{m.division || ''}</small></span></div>)}</> : <Empty t={`Semua sudah MCU ${year}`} />}</div></>
    }
    case 'golive': {
      const g = x.extra.golive; if (g == null) return <Empty t="Memuat…" />
      const ents: Any[] = g.entities || [], apps: Any[] = g.apps || []
      const isDone = (e: Any, a: Any) => { const ap = (e.apps || {})[a.key]; return !!(ap?.done || (ap?.subs && Object.values(ap.subs).some(Boolean))) }
      const st = apps.map(a => ({ a, n: ents.filter(e => isDone(e, a)).length }))
      if (!apps.length || !ents.length) return <Empty t="Belum ada data go-live" />
      if (size === 'S') { const s0 = st[0]; return <Big v={<>{s0.n}<small>/{ents.length}</small></>} sub={`${s0.a.label} go-live`} /> }
      const bars = <div className="wg-list">{st.map(s => <div key={s.a.key} className="wg-row"><span className="t">{s.a.label}</span><Bar v={(s.n / ents.length) * 100} /><b className="n">{s.n}/{ents.length}</b></div>)}</div>
      if (size === 'M') return bars
      const worst = [...st].sort((a, b) => a.n - b.n)[0]; const pend = ents.filter(e => !isDone(e, worst.a))
      return <>{bars}<div className="wg-list"><span className="wg-cap">Belum go-live {worst.a.label}</span>{pend.slice(0, 4).map(e => <div key={e._id} className="wg-row"><span className="t">{e.name}<small>{e.cocd || ''}</small></span></div>)}{!pend.length && <Empty t="Semua entitas sudah go-live" />}</div></>
    }
    case 'budget': {
      const rows = x.extra.budget; if (rows == null) return <Empty t="Memuat…" />
      const yr = rows.filter((r: Any) => r.year === year)
      const sum = (l: Any[], k: string) => l.reduce((s, r) => s + (Number(r[k]) || 0), 0)
      const plan = sum(yr, 'annualBudgetIDR'), real = sum(yr, 'annualRealIDR'), pct = plan > 0 ? Math.round(real / plan * 100) : 0
      if (!yr.length) return <Empty t={`Belum ada data budget ${year}`} />
      if (size === 'S') return <div className="wg-center"><Ring value={Math.min(100, pct)} size={88} stroke={10} color={pct > 100 ? 'var(--bad)' : 'var(--wf)'} label={`Realisasi budget ${pct}%`}><b style={{ fontSize: 20 }}>{pct}%</b><span>realisasi</span></Ring></div>
      const cats = Array.from(new Set(yr.map((r: Any) => r.category)))
      const catName = (k: string) => (x.config?.budgetCategories || []).find((c: Any) => c.key === k)?.label || k
      const list = <div className="wg-list">{cats.map(k => { const l = yr.filter((r: Any) => r.category === k); const p = sum(l, 'annualBudgetIDR'), rr = sum(l, 'annualRealIDR'); const pc = p > 0 ? rr / p * 100 : 0; return <div key={k} className="wg-row"><span className="t">{catName(k)}<small>{rpS(rr)} / {rpS(p)}</small></span><Bar v={pc} c={pc > 100 ? 'var(--bad)' : 'var(--wf)'} /><b className="n">{Math.round(pc)}%</b></div> })}</div>
      if (size === 'M') return <div className="wg-split"><Big v={`${pct}%`} sub={`${rpS(real)} / ${rpS(plan)}`} />{list}</div>
      const years = Array.from(new Set(rows.map((r: Any) => r.year))).sort().slice(-3) as number[]
      const ys = years.map(y => { const l = rows.filter((r: Any) => r.year === y); return { y, p: sum(l, 'annualBudgetIDR'), r: sum(l, 'annualRealIDR') } }), m = Math.max(1, ...ys.map(v => Math.max(v.p, v.r)))
      return <><div className="wg-split"><Big v={`${pct}%`} sub={`${rpS(real)} / ${rpS(plan)}`} />{list}</div>
        <div className="wg-years">{ys.map(v => <span key={v.y} title={`${v.y}: ${rpS(v.r)} / ${rpS(v.p)}`}><span className="col"><i className="p" style={{ height: `${(v.p / m) * 60}px` }} /><i className="r" style={{ height: `${(v.r / m) * 60}px` }} /></span><small>{v.y}</small></span>)}</div></>
    }
    case 'cashcard': {
      const c = x.extra.cashcard; if (c === undefined) return <Empty t="Memuat…" />
      if (!c || !c.topup) return <Empty t={`Belum ada data cash card ${year}`} />
      const pct = Math.round(c.settlement / c.topup * 100)
      const ring = (sz: number) => <Ring value={Math.min(100, pct)} size={sz} stroke={sz / 9} color={pct >= 80 ? 'var(--ok)' : pct >= 50 ? 'var(--warn-bar)' : 'var(--bad)'} label={`Settlement ${pct}%`}><b style={{ fontSize: sz / 4.4 }}>{pct}%</b></Ring>
      if (size === 'S') return <div className="wg-center">{ring(88)}</div>
      return <div className="wg-split">{ring(100)}<div className="wg-list"><div className="wg-kv"><span>Settlement</span><b>Rp {rpS(c.settlement)}</b></div><div className="wg-kv"><span>Top up</span><b>Rp {rpS(c.topup)}</b></div></div></div>
    }
    case 'team-heatmap': {
      const staff: Any[] = d.staff; const ym = todayIso.slice(0, 7)
      const y = Number(ym.slice(0, 4)), mo = Number(ym.slice(5, 7)) - 1, dim = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate()
      const days = Array.from({ length: dim }, (_, i) => new Date(Date.UTC(y, mo, i + 1))).filter(dt => dt.getUTCDay() > 0 && dt.getUTCDay() < 6)
      const ids = new Set(staff.flatMap(m => [String(m._id), String(m.email)]))
      const pctOf = (iso: string) => { if (!staff.length) return 0; const n = new Set((data.att || []).filter((r: Any) => r.date === iso && ids.has(String(r.userId)) && attType(r) === 'wfo').map((r: Any) => String(r.userId))).size; return n / staff.length }
      const cells = days.map(dt => { const iso = dt.toISOString().slice(0, 10); return { iso, d: dt.getUTCDate(), dow: dt.getUTCDay(), p: pctOf(iso), future: iso > todayIso } })
      const avg = cells.filter(c => !c.future).reduce((s, c) => s + c.p, 0) / Math.max(1, cells.filter(c => !c.future).length)
      const lead = (cells[0]?.dow || 1) - 1
      return <div className={`wg-heat${size === 'L' ? ' big' : ''}`}>
        <div className="wg-heat-h"><Big v={`${Math.round(avg * 100)}%`} sub={`rata-rata WFO · ${BLN[mo]} ${y}`} /></div>
        <div className="wg-heat-g" role="img" aria-label={`Peta WFO ${BLN[mo]} ${y}, rata-rata ${Math.round(avg * 100)}%`}>
          {size === 'L' && ['Sen', 'Sel', 'Rab', 'Kam', 'Jum'].map(h => <span key={h} className="hd">{h}</span>)}
          {size === 'L' && Array.from({ length: lead }, (_, i) => <span key={'x' + i} />)}
          {cells.map(c => <span key={c.iso} className={`c${c.iso === todayIso ? ' today' : ''}${c.future ? ' fut' : ''}`} title={`${c.d} ${BLN[mo]}: ${Math.round(c.p * 100)}% WFO`} style={{ ['--p' as any]: c.future ? 0 : Math.max(.08, c.p) }}>{size === 'L' ? c.d : ''}</span>)}
        </div>
      </div>
    }
    case 'enh-map': {
      if (!d.enh.length) return <EnhEmpty x={x} />
      const stageN = STAGES_SHORT.map((_, i) => d.enh.filter((v: Any) => (v.e.stage || 1) === i + 1).length), mx = Math.max(1, ...stageN)
      return <><div className="wg-matrix"><EnhMatrix list={d.enh} small /></div>
        <div className="wg-legend row">{CATS.map(c => <span key={c} className={catK(c)}><i style={{ background: 'var(--k)' }} />{c}<b>{d.enh.filter((v: Any) => v.s.cat === c).length}</b></span>)}</div>
        <div className="wg-stages sm">{STAGES_SHORT.map((st, i) => <span key={st} title={`${st}: ${stageN[i]}`}><i style={{ height: `${8 + (stageN[i] / mx) * 26}px`, opacity: stageN[i] ? 1 : .25 }} /><small>{st.split(' ')[0]}</small></span>)}</div></>
    }
    case 'mcu-results': {
      const recs = x.extra.mandatory; if (recs == null) return <Empty t="Memuat…" />
      const staff: Any[] = d.staff; const byId = new Map(recs.map((r: Any) => [String(r.userId), r]))
      const res = staff.map(m => { const r = (byId.get(String(m.email)) || byId.get(String(m._id))) as Any | undefined; return r?.mcu?.done === 'sudah' ? (r.mcu.result || 'Sudah') : 'Belum' })
      const keys = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'Sudah', 'Belum'].filter(k => res.includes(k))
      const col: Record<string, string> = { P1: 'var(--ok)', P2: 'color-mix(in srgb,var(--ok) 75%,var(--surface))', P3: 'color-mix(in srgb,var(--ok) 50%,var(--surface))', P4: 'var(--warn-bar)', P5: 'var(--bad)', P6: 'color-mix(in srgb,var(--bad) 70%,#000)', Sudah: 'var(--wf)', Belum: 'var(--line2)' }
      const n = (k: string) => res.filter(r => r === k).length
      return <>
        <Big v={<>{staff.length - n('Belum')}<small>/{staff.length}</small></>} sub={`sudah MCU ${year}`} />
        <div className="wg-stackbar" role="img" aria-label={keys.map(k => `${k} ${n(k)}`).join(', ')}>{keys.map(k => <i key={k} style={{ flex: n(k), background: col[k] }} />)}</div>
        <div className="wg-legend row">{keys.map(k => <span key={k}><i style={{ background: col[k] }} />{k}<b>{n(k)}</b></span>)}</div>
        {size === 'L' && <div className="wg-list"><span className="wg-cap">Belum MCU</span>{staff.filter((_, i) => res[i] === 'Belum').slice(0, 5).map(m => <div key={m._id} className="wg-row"><span className="t">{m.name}<small>{m.division || ''}</small></span></div>)}</div>}
      </>
    }
    case 'progress-status': {
      const keys = [['ok', 'On track'], ['warn', 'Perhatian'], ['bad', 'Terlambat'], ['none', 'Belum mulai']] as const
      const cnt = keys.map(([k]) => d.inits.filter((v: Any) => statusOf(v.c.spi).key === k).length)
      if (!d.inits.length) return <Empty t={`Belum ada initiative di ${year}`} />
      return <><Big v={<CountUp to={d.inits.length} />} sub={`initiative di ${year}`} />
        <div className="wg-stackbar">{keys.map(([k], i) => cnt[i] ? <i key={k} style={{ flex: cnt[i], background: ST_COLOR[k] }} /> : null)}</div>
        <div className="wg-legend row">{keys.map(([k, l], i) => <span key={k}><i style={{ background: ST_COLOR[k] }} />{l}<b>{cnt[i]}</b></span>)}</div></>
    }
    case 'notes': {
      const pins = (data.notes || []).filter((n: Any) => n.pinned).slice(0, size === 'L' ? 5 : 2)
      return pins.length ? <div className="wg-list">{pins.map((n: Any) => <div key={n._id} className="wg-note"><b>{n.title}</b>{n.content && <span>{n.content}</span>}</div>)}</div> : <Empty t="Belum ada catatan disematkan" />
    }
  }
  return null
}

