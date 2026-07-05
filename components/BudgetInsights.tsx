'use client'
import { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell,
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

export default function BudgetInsights({ section }: { section?: 'yield' | 'realpct' | 'prognosa' | 'cashcard' }) {
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

  const [viewYear, setViewYear] = useState(new Date().getFullYear())
  const [ccData, setCcData] = useState<{topup:number;settlement:number}|null>(null)
  const [ccYear, setCcYear] = useState(new Date().getFullYear())

  // Fetch cash card data
  useEffect(() => {
    fetch(`/api/cashcard/summary?year=${ccYear}`).then(r=>r.json()).then(d=>setCcData(d.data||null)).catch(()=>setCcData(null))
  }, [ccYear])

  const { trend, realPctData, budgetBars, catColors, legendCats, hasData } = useMemo(() => {
    const byYear: Record<number, any[]> = {}
    for (const r of rows) { (byYear[r.year] = byYear[r.year] || []).push(r) }
    const years = Object.keys(byYear).map(Number).sort((a, b) => a - b)
    const trend = years.map(y => {
      const list = byYear[y]
      const plan = list.reduce((s, r) => s + (r.annualBudgetIDR || 0), 0)
      const real = list.reduce((s, r) => s + (r.annualRealIDR || 0), 0)
      return { year: String(y), plan, real, pct: plan > 0 ? +(real / plan * 100).toFixed(1) : 0 }
    })

    const catKeys = Array.from(new Set(rows.map(r => r.category)))
    const catColors: Record<string, string> = {}
    catKeys.forEach((k, i) => { catColors[k] = PIE_COLORS[i % PIE_COLORS.length] })
    const legendCats = catKeys.map(k => ({ key: k, name: catName(k) }))

    // % Realisasi per cost element for viewYear
    const yrList = byYear[viewYear] || []
    const realPctData = catKeys.map(k => {
      const items = yrList.filter(r => r.category === k)
      const plan = items.reduce((s, r) => s + (r.annualBudgetIDR || 0), 0)
      const real = items.reduce((s, r) => s + (r.annualRealIDR || 0), 0)
      return { key: k, name: catName(k), plan, real, pct: plan > 0 ? Math.round(real / plan * 100) : 0, color: catColors[k] }
    })

    const last3 = years.slice(-3)
    const thrOf = (cat: string) => (cat === 'travel' ? thr.travel : cat === 'accommodation' ? thr.accommodation : 80) / 100
    const budgetBars = last3.map(y => {
      const list = byYear[y] || []
      const plan = list.reduce((s, r) => s + (r.annualBudgetIDR || 0), 0)
      const real = list.reduce((s, r) => s + (r.annualRealIDR || 0), 0)
      const prog = list.reduce((s, r) => s + (r.annualBudgetIDR || 0) * thrOf(r.category), 0)
      return { year: String(y), RKAP: plan, Terpakai: real, Sisa: Math.max(0, plan - real), Prognosa: prog }
    })

    return { trend, realPctData, budgetBars, catColors, legendCats, hasData: rows.length > 0 }
  }, [rows, thr, viewYear])

  if (loading) return <div className="card" style={{ padding: 20, fontSize: 12.5, color: 'var(--text3)' }}>Memuat infografis budget…</div>
  if (!hasData) return null


  const showAll = !section
  const show = (s: string) => showAll || section === s

  return (
    <>
      {show('yield') && (
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
      )}

      {show('realpct') && (
        <CardBox title={`% Realisasi ${viewYear}`} sub="Realisasi dibanding Plan (RKAP) per cost element">
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginBottom: 6 }}>
            <button onClick={()=>setViewYear(y=>y-1)} className="btn btn-sm" style={{ padding:'2px 8px' }}>◀</button>
            <span style={{ fontSize: 12, fontWeight: 700, minWidth: 40, textAlign: 'center' }}>{viewYear}</span>
            <button onClick={()=>setViewYear(y=>y+1)} className="btn btn-sm" style={{ padding:'2px 8px' }}>▶</button>
          </div>
          {realPctData.length === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--text3)', padding: '40px 0', textAlign: 'center' }}>Belum ada data {viewYear}.</div>
          ) : (
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
              {realPctData.map(d => {
                const gaugeData = [{ name: 'Realisasi', value: Math.min(d.pct, 100) }, { name: 'Sisa', value: Math.max(0, 100 - d.pct) }]
                return (
                  <div key={d.key} style={{ textAlign: 'center', flex: '1 1 140px', maxWidth: 200 }}>
                    <div style={{ position: 'relative', width: 130, height: 130, margin: '0 auto' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={gaugeData} dataKey="value" innerRadius={42} outerRadius={60} paddingAngle={2} startAngle={90} endAngle={-270} stroke="none">
                            <Cell fill={d.color} /><Cell fill="var(--bg3)" />
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ fontSize: 22, fontWeight: 800, color: d.color }}>{d.pct}%</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 11.5, fontWeight: 700, marginTop: 4 }}>{d.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{rpShort(d.real)} / {rpShort(d.plan)}</div>
                  </div>
                )
              })}
            </div>
          )}
        </CardBox>
      )}

      {show('cashcard') && (
        <CardBox title={`Rata-rata Settlement Cash Card ${ccYear}`} sub="Total settlement ÷ total top-up × 100%">
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginBottom: 6 }}>
            <button onClick={()=>setCcYear(y=>y-1)} className="btn btn-sm" style={{ padding:'2px 8px' }}>◀</button>
            <span style={{ fontSize: 12, fontWeight: 700, minWidth: 40, textAlign: 'center' }}>{ccYear}</span>
            <button onClick={()=>setCcYear(y=>y+1)} className="btn btn-sm" style={{ padding:'2px 8px' }}>▶</button>
          </div>
          {(() => {
            if (!ccData) return <div style={{ fontSize: 11, color: 'var(--text3)', padding: '40px 0', textAlign: 'center' }}>Belum ada data cash card {ccYear}.</div>
            const pct = ccData.topup > 0 ? Math.round(ccData.settlement / ccData.topup * 100) : 0
            const gaugeData = [{ name: 'Settlement', value: Math.min(pct, 100) }, { name: 'Sisa', value: Math.max(0, 100 - pct) }]
            const color = pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444'
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, justifyContent: 'center' }}>
                <div style={{ position: 'relative', width: 130, height: 130 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={gaugeData} dataKey="value" innerRadius={42} outerRadius={60} paddingAngle={2} startAngle={90} endAngle={-270} stroke="none">
                        <Cell fill={color} /><Cell fill="var(--bg3)" />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color }}>{pct}%</div>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>Total Settlement: <b>{rp(ccData.settlement)}</b></div>
                  <div style={{ fontSize: 12, color: 'var(--text2)' }}>Total Top-up: <b>{rp(ccData.topup)}</b></div>
                </div>
              </div>
            )
          })()}
        </CardBox>
      )}

      {show('prognosa') && (
        <CardBox title={`Prognosa & Sisa Budget (3 Tahun Terakhir)`} sub="RKAP vs Terpakai vs Sisa per tahun · garis = Prognosa (threshold)">
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={budgetBars} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: 'var(--text3)' }} />
              <YAxis tickFormatter={rpShort} tick={{ fontSize: 10, fill: 'var(--text3)' }} width={48} />
              <Tooltip cursor={{ fill: 'transparent' }} content={({ active, payload, label }: any) => active && payload?.length ? (
                <TipBox rows={[
                  { name: 'Tahun', val: label },
                  { name: 'RKAP', val: rp(payload[0]?.payload.RKAP), color: C.plan },
                  { name: 'Terpakai', val: rp(payload[0]?.payload.Terpakai), color: C.used },
                  { name: 'Sisa', val: rp(payload[0]?.payload.Sisa), color: C.real },
                  { name: 'Prognosa', val: rp(payload[0]?.payload.Prognosa), color: C.purple },
                ]} />) : null} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="RKAP" fill={C.plan} radius={[3, 3, 0, 0]} maxBarSize={26} />
              <Bar dataKey="Terpakai" fill={C.used} radius={[3, 3, 0, 0]} maxBarSize={26} />
              <Bar dataKey="Sisa" fill={C.real} radius={[3, 3, 0, 0]} maxBarSize={26} />
              <Line dataKey="Prognosa" stroke={C.purple} strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3, fill: C.purple }} />
            </ComposedChart>
          </ResponsiveContainer>
        </CardBox>
      )}
    </>
  )
}
