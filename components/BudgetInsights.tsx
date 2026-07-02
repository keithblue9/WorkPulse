'use client'
import { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, BarChart, ReferenceLine,
} from 'recharts'

const C = { plan: '#4f8ef7', real: '#22c55e', realLow: '#f59e0b', used: '#ef4444', avail: '#4f8ef7', purple: '#8b7adc', amber: '#f59e0b' }
const PIE_COLORS = ['#4f8ef7', '#8b7adc', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4']

const rp = (n: number) => 'Rp ' + new Intl.NumberFormat('id-ID').format(Math.round(n || 0))
function rpShort(n: number) {
  const a = Math.abs(n)
  if (a >= 1e12) return (n / 1e12).toFixed(1) + ' T'
  if (a >= 1e9) return (n / 1e9).toFixed(1) + ' M'
  if (a >= 1e6) return (n / 1e6).toFixed(0) + ' jt'
  if (a >= 1e3) return (n / 1e3).toFixed(0) + ' rb'
  return String(n)
}
const catName = (k: string) => k === 'travel' ? 'Travel Expense' : k === 'accommodation' ? 'External Accommodation' : k

function CardBox({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{title}</div>
        {sub && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{sub}</div>}
      </div>
      {children}
    </div>
  )
}

function TipBox({ rows }: { rows: { name: string; val: string; color?: string }[] }) {
  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', fontSize: 11.5, boxShadow: '0 4px 14px rgba(0,0,0,0.18)' }}>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '1px 0' }}>
          {r.color && <span style={{ width: 9, height: 9, borderRadius: 2, background: r.color, display: 'inline-block' }} />}
          <span style={{ color: 'var(--text3)' }}>{r.name}:</span><b>{r.val}</b>
        </div>
      ))}
    </div>
  )
}

export default function BudgetInsights() {
  const [rows, setRows] = useState<any[]>([])
  const [thr, setThr] = useState({ travel: 80, accommodation: 80 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const [b, c] = await Promise.all([
          fetch('/api/budget?all=1').then(r => r.json()).catch(() => ({ data: [] })),
          fetch('/api/config').then(r => r.json()).catch(() => ({ data: {} })),
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

  const { years, trend, curYear, donut, waterfall, prognosaTotal, hasData } = useMemo(() => {
    const byYear: Record<number, any[]> = {}
    for (const r of rows) { (byYear[r.year] = byYear[r.year] || []).push(r) }
    const years = Object.keys(byYear).map(Number).sort((a, b) => a - b)
    const trend = years.map(y => {
      const list = byYear[y]
      const plan = list.reduce((s, r) => s + (r.annualBudgetIDR || 0), 0)
      const real = list.reduce((s, r) => s + (r.annualRealIDR || 0), 0)
      return { year: String(y), plan, real, pct: plan > 0 ? +(real / plan * 100).toFixed(1) : 0 }
    })
    const nowY = new Date().getFullYear()
    const curYear = years.includes(nowY) ? nowY : (years.length ? years[years.length - 1] : nowY)
    const curList = byYear[curYear] || []
    const donut = curList.map(r => ({ name: catName(r.category), value: r.annualRealIDR || 0 })).filter(d => d.value > 0)
    const planTot = curList.reduce((s, r) => s + (r.annualBudgetIDR || 0), 0)
    const realTot = curList.reduce((s, r) => s + (r.annualRealIDR || 0), 0)
    const availTot = planTot - realTot
    const prognosaTotal = curList.reduce((s, r) => s + (r.annualBudgetIDR || 0) * ((r.category === 'travel' ? thr.travel : r.category === 'accommodation' ? thr.accommodation : 80) / 100), 0)
    // 3 bar perbandingan dari 0 biar tinggi bar = nilainya (bukan floating waterfall yg bikin Terpakai mepet RKAP)
    const waterfall = [
      { name: 'RKAP', base: 0, val: planTot, fill: C.plan, label: rp(planTot) },
      { name: 'Terpakai', base: 0, val: realTot, fill: C.used, label: rp(realTot) },
      { name: 'Sisa', base: 0, val: Math.max(0, availTot), fill: C.real, label: rp(availTot) },
    ]
    return { years, trend, curYear, donut, waterfall, prognosaTotal, hasData: rows.length > 0 }
  }, [rows, thr])

  if (loading) return <div className="card" style={{ padding: 20, fontSize: 12.5, color: 'var(--text3)' }}>Memuat infografis budget…</div>
  if (!hasData) return null

  const donutTotal = donut.reduce((s, d) => s + d.value, 0)

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 14, fontWeight: 700, margin: '4px 2px 12px' }}>📊 Budget Report — Infografis</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>

        {/* 1. Yield trend: Plan vs Realisasi + % */}
        <CardBox title="Yield — Plan vs Realisasi per Tahun" sub="Tren RKAP & realisasi (IDR) + % realisasi">
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: 'var(--text3)' }} />
              <YAxis yAxisId="l" tickFormatter={rpShort} tick={{ fontSize: 10, fill: 'var(--text3)' }} width={48} />
              <YAxis yAxisId="r" orientation="right" tickFormatter={(v) => v + '%'} tick={{ fontSize: 10, fill: 'var(--text3)' }} width={36} domain={[0, 'dataMax + 10']} />
              <Tooltip content={({ active, payload, label }: any) => active && payload?.length ? (
                <TipBox rows={[
                  { name: 'Tahun', val: label },
                  { name: 'Plan', val: rp(payload[0]?.payload.plan), color: C.plan },
                  { name: 'Realisasi', val: rp(payload[0]?.payload.real), color: C.real },
                  { name: '% Realisasi', val: payload[0]?.payload.pct + '%', color: C.amber },
                ]} />) : null} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="l" dataKey="plan" name="Plan (RKAP)" fill={C.plan} radius={[3, 3, 0, 0]} maxBarSize={34} />
              <Bar yAxisId="l" dataKey="real" name="Realisasi" fill={C.real} radius={[3, 3, 0, 0]} maxBarSize={34} />
              <Line yAxisId="r" dataKey="pct" name="% Realisasi" stroke={C.amber} strokeWidth={2.5} dot={{ r: 3, fill: C.amber }} />
            </ComposedChart>
          </ResponsiveContainer>
        </CardBox>

        {/* 2. Donut: komposisi realisasi cost element */}
        <CardBox title={`Komposisi Realisasi ${curYear}`} sub="Porsi realisasi per cost element (IDR)">
          {donut.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text3)', padding: '40px 0', textAlign: 'center' }}>Belum ada realisasi {curYear}.</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={donut} dataKey="value" nameKey="name" innerRadius={58} outerRadius={88} paddingAngle={2} stroke="none">
                  {donut.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip content={({ active, payload }: any) => active && payload?.length ? (
                  <TipBox rows={[
                    { name: payload[0].name, val: rp(payload[0].value), color: payload[0].payload.fill },
                    { name: 'Porsi', val: donutTotal > 0 ? (payload[0].value / donutTotal * 100).toFixed(1) + '%' : '—' },
                  ]} />) : null} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardBox>

        {/* 3. Waterfall: RKAP -> terpakai -> sisa, garis prognosa */}
        <CardBox title={`Prognosa & Sisa Budget ${curYear}`} sub="Perbandingan RKAP vs terpakai (realisasi) vs sisa · garis = prognosa (threshold)">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={waterfall} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text3)' }} />
              <YAxis tickFormatter={rpShort} tick={{ fontSize: 10, fill: 'var(--text3)' }} width={48} />
              <Tooltip cursor={{ fill: 'transparent' }} content={({ active, payload }: any) => active && payload?.length ? (
                <TipBox rows={[{ name: payload[0].payload.name, val: payload[0].payload.label, color: payload[0].payload.fill }]} />) : null} />
              <Bar dataKey="val" radius={[3, 3, 0, 0]} maxBarSize={60}>
                {waterfall.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Bar>
              {prognosaTotal > 0 && <ReferenceLine y={prognosaTotal} stroke={C.purple} strokeDasharray="5 4" label={{ value: 'Prognosa ' + rpShort(prognosaTotal), position: 'insideTopRight', fontSize: 10, fill: C.purple }} />}
            </BarChart>
          </ResponsiveContainer>
        </CardBox>
      </div>
    </div>
  )
}
