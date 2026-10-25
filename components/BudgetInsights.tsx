'use client'
import { useEffect, useMemo, useState } from 'react'
import { cachedFetch } from '@/lib/fetchCache'
import { useYear } from '@/lib/year'
import { Ring } from '@/components/ui'

// Infografis budget tanpa library chart (ringan). Satu sumbu: batang "track" = Plan (RKAP),
// isi = realisasi/terpakai, garis tegak = prognosa (threshold × RKAP). Angka selalu tertulis.
const rp = (n: number) => 'Rp ' + new Intl.NumberFormat('id-ID').format(Math.round(n || 0))
function rpShort(n: number) {
  const a = Math.abs(n)
  const f = (v: number, u: string) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(v) + ' ' + u
  if (a >= 1e12) return f(n / 1e12, 'T')
  if (a >= 1e9) return f(n / 1e9, 'M')
  if (a >= 1e6) return f(n / 1e6, 'jt')
  if (a >= 1e3) return f(n / 1e3, 'rb')
  return String(Math.round(n))
}
const catName = (k: string) => k === 'travel' ? 'Travel Expense' : k === 'accommodation' ? 'External Accommodation' : k
const toneFor = (pct: number) => pct > 100 ? 'var(--bad)' : 'var(--accent)'

type Bullet = { label: string; plan: number; real: number; prog?: number }
function BulletRows({ rows, realLabel }: { rows: Bullet[]; realLabel: string }) {
  const max = Math.max(1, ...rows.map(r => Math.max(r.plan, r.real, r.prog || 0)))
  return (
    <div className="au-col" style={{ gap: 14 }}>
      {rows.map(r => {
        const pct = r.plan > 0 ? (r.real / r.plan) * 100 : 0
        const desc = `${r.label}: Plan ${rp(r.plan)}, ${realLabel} ${rp(r.real)} (${pct.toFixed(1)}%)${r.prog != null ? `, prognosa ${rp(r.prog)}` : ''}`
        return (
          <div key={r.label} className="au-bullet" title={desc}>
            <span className="au-row au-between" style={{ gap: 8 }}>
              <b className="au-small" style={{ fontFamily: 'var(--mono)' }}>{r.label}</b>
              <span className="au-xs au-ink2" style={{ fontVariantNumeric: 'tabular-nums' }}><b style={{ color: 'var(--ink)' }}>{rpShort(r.real)}</b> / {rpShort(r.plan)} · <b style={{ color: pct > 100 ? 'var(--bad)' : 'var(--ink)' }}>{pct.toFixed(1)}%</b></span>
            </span>
            <span className="bar" role="img" aria-label={desc}>
              <i className="plan" style={{ width: `${(r.plan / max) * 100}%` }} />
              <i className="real" style={{ width: `${(Math.min(r.real, max) / max) * 100}%`, background: toneFor(pct) }} />
              {r.prog != null && r.prog > 0 && <i className="prog" style={{ left: `calc(${(r.prog / max) * 100}% - 1px)` }} />}
            </span>
          </div>
        )
      })}
    </div>
  )
}
function Legend({ items }: { items: { label: string; kind: 'plan' | 'real' | 'prog' }[] }) {
  return <div className="au-row au-wrap au-xs au-ink2" style={{ gap: 14 }}>{items.map(i => <span key={i.label} className="au-row" style={{ gap: 6 }}><i className={`au-lg ${i.kind}`} />{i.label}</span>)}</div>
}

export default function BudgetInsights({ section }: { section?: 'yield' | 'realpct' | 'prognosa' | 'cashcard' }) {
  const { year } = useYear()
  const [rows, setRows] = useState<any[]>([])
  const [thr, setThr] = useState({ travel: 80, accommodation: 80 })
  const [loading, setLoading] = useState(true)
  const [ccData, setCcData] = useState<{ topup: number; settlement: number } | null>(null)

  // cachedFetch: komponen ini dirender s/d 4x (yield/realpct/prognosa/cashcard) → 1 request saja.
  useEffect(() => {
    (async () => {
      try {
        const [b, c] = await Promise.all([
          cachedFetch('/api/budget?all=1').catch(() => ({ data: [] })),
          cachedFetch('/api/config').catch(() => ({ data: {} })),
        ])
        setRows(b.data || [])
        const cats = c.data?.budgetCategories || []
        setThr({
          travel: cats.find((x: any) => x.key === 'travel')?.threshold ?? 80,
          accommodation: cats.find((x: any) => x.key === 'accommodation')?.threshold ?? 80,
        })
      } finally { setLoading(false) }
    })()
  }, [])
  // Data cash card hanya untuk section 'cashcard'
  useEffect(() => {
    if (section && section !== 'cashcard') return
    cachedFetch(`/api/cashcard/summary?year=${year}`).then(d => setCcData(d.data || null)).catch(() => setCcData(null))
  }, [year, section])

  const { trend, realPctData, budgetBars, hasData } = useMemo(() => {
    const byYear: Record<number, any[]> = {}
    for (const r of rows) { (byYear[r.year] = byYear[r.year] || []).push(r) }
    const years = Object.keys(byYear).map(Number).sort((a, b) => a - b)
    const sum = (list: any[], k: string) => list.reduce((s, r) => s + (r[k] || 0), 0)
    const trend: Bullet[] = years.map(y => ({ label: String(y), plan: sum(byYear[y], 'annualBudgetIDR'), real: sum(byYear[y], 'annualRealIDR') }))
    const catKeys = Array.from(new Set(rows.map(r => r.category)))
    const yrList = byYear[year] || []
    const realPctData = catKeys.map(k => {
      const items = yrList.filter(r => r.category === k)
      const plan = sum(items, 'annualBudgetIDR'), real = sum(items, 'annualRealIDR')
      return { key: k, name: catName(k), plan, real, pct: plan > 0 ? Math.round(real / plan * 100) : 0 }
    }).filter(d => d.plan > 0 || d.real > 0)
    const thrOf = (cat: string) => (cat === 'travel' ? thr.travel : cat === 'accommodation' ? thr.accommodation : 80) / 100
    const budgetBars: Bullet[] = years.slice(-3).map(y => {
      const list = byYear[y] || []
      return { label: String(y), plan: sum(list, 'annualBudgetIDR'), real: sum(list, 'annualRealIDR'), prog: list.reduce((s, r) => s + (r.annualBudgetIDR || 0) * thrOf(r.category), 0) }
    })
    return { trend, realPctData, budgetBars, hasData: rows.length > 0 }
  }, [rows, thr, year])

  if (loading) return <section className="au-card"><div className="au-skel" style={{ width: '40%' }} /><div className="au-skel" /><div className="au-skel" /></section>
  if (!hasData) return null
  const show = (s: string) => !section || section === s

  return (
    <>
      {show('yield') && (
        <section className="au-card">
          <div className="au-col" style={{ gap: 2 }}><h2>Yield · plan vs realisasi</h2><span className="au-xs au-muted">RKAP dan realisasi (IDR) per tahun</span></div>
          <Legend items={[{ label: 'Plan (RKAP)', kind: 'plan' }, { label: 'Realisasi', kind: 'real' }]} />
          <BulletRows rows={trend} realLabel="realisasi" />
        </section>
      )}

      {show('realpct') && (
        <section className="au-card">
          <div className="au-col" style={{ gap: 2 }}><h2>% realisasi {year}</h2><span className="au-xs au-muted">Realisasi dibanding plan per cost element</span></div>
          {realPctData.length === 0 ? <span className="au-small au-muted" style={{ padding: '24px 0', textAlign: 'center' }}>Belum ada data {year}.</span> : (
            <div className="au-row au-wrap" style={{ gap: 18, justifyContent: 'space-around' }}>
              {realPctData.map(d => (
                <div key={d.key} className="au-col" style={{ alignItems: 'center', gap: 6, flex: '1 1 130px', maxWidth: 200, textAlign: 'center' }}>
                  <Ring value={Math.min(d.pct, 100)} size={118} stroke={12} color={toneFor(d.pct)} label={`${d.name}: ${d.pct}% (${rp(d.real)} dari ${rp(d.plan)})`}><b>{d.pct}%</b></Ring>
                  <b className="au-small">{d.name}</b>
                  <span className="au-xs au-muted">{rpShort(d.real)} / {rpShort(d.plan)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {show('cashcard') && (
        <section className="au-card">
          <div className="au-col" style={{ gap: 2 }}><h2>Settlement Cash Card {year}</h2><span className="au-xs au-muted">Total settlement ÷ total top up</span></div>
          {(() => {
            if (!ccData || !ccData.topup) return <span className="au-small au-muted" style={{ padding: '24px 0', textAlign: 'center' }}>Belum ada data cash card {year}.</span>
            const pct = Math.round(ccData.settlement / ccData.topup * 100)
            const color = pct >= 80 ? 'var(--ok)' : pct >= 50 ? 'var(--warn-bar)' : 'var(--bad)'
            const state = pct >= 80 ? 'Baik' : pct >= 50 ? 'Perlu dikejar' : 'Rendah'
            return (
              <div className="au-row au-wrap" style={{ gap: 18, justifyContent: 'center' }}>
                <Ring value={Math.min(pct, 100)} size={118} stroke={12} color={color} label={`Settlement ${pct}% (${rp(ccData.settlement)} dari ${rp(ccData.topup)})`}><b>{pct}%</b><span>{state}</span></Ring>
                <div className="au-col" style={{ gap: 8, justifyContent: 'center' }}>
                  <span className="au-col"><span className="au-xs au-muted">Settlement</span><b>{rp(ccData.settlement)}</b></span>
                  <span className="au-col"><span className="au-xs au-muted">Top up</span><b>{rp(ccData.topup)}</b></span>
                </div>
              </div>
            )
          })()}
        </section>
      )}

      {show('prognosa') && (
        <section className="au-card">
          <div className="au-col" style={{ gap: 2 }}><h2>Prognosa & sisa budget</h2><span className="au-xs au-muted">3 tahun terakhir · garis = prognosa (threshold × RKAP)</span></div>
          <Legend items={[{ label: 'RKAP', kind: 'plan' }, { label: 'Terpakai', kind: 'real' }, { label: 'Prognosa', kind: 'prog' }]} />
          <BulletRows rows={budgetBars} realLabel="terpakai" />
          <div className="au-row au-wrap au-xs au-ink2" style={{ gap: 12 }}>{budgetBars.map(b => <span key={b.label}>{b.label}: sisa <b style={{ color: 'var(--ink)' }}>{rpShort(Math.max(0, b.plan - b.real))}</b></span>)}</div>
        </section>
      )}
    </>
  )
}
