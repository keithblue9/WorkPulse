'use client'
import { BLN } from '@/lib/gantt'
import { DAY, calc, dUTC, planAt, type Act } from '@/lib/progress'

/** Kurva S rencana kumulatif + titik realisasi hari ini. */
export function SCurve({ acts, today }: { acts: Act[]; today: number }) {
  const ts = acts.flatMap(a => [dUTC(a.start), dUTC(a.end)]).filter(Number.isFinite)
  if (!ts.length) return null
  const s0 = Math.min(...ts), e0 = Math.max(...ts) + DAY
  const W = 480, H = 240, L = 34, R = 12, Tp = 16, Bt = 28
  const x = (t: number) => L + ((t - s0) / (e0 - s0)) * (W - L - R), y = (v: number) => Tp + (1 - v / 100) * (H - Tp - Bt)
  const pts = Array.from({ length: 61 }, (_, i) => { const t = s0 + ((e0 - s0) * i) / 60; return [x(t), y(planAt(acts, t))] })
  const d = 'M' + pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L')
  const c = calc(acts, today), tIn = today > s0 && today < e0, tx = x(Math.min(Math.max(today, s0), e0)), flip = tx > W * 0.62
  const months: number[] = []
  for (let t = new Date(s0); t.getTime() < e0; t.setUTCMonth(t.getUTCMonth() + 1)) { const m = Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1); if (m >= s0) months.push(m) }
  const every = Math.max(1, Math.ceil(months.length / 7))
  return (
    <svg className="au-scurve" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Kurva S. Hari ini rencana ${Math.round(c.plan)}%, realisasi ${Math.round(c.actual)}%.`}>
      {[0, 25, 50, 75, 100].map(v => <g key={v}><line className="ax" x1={L} x2={W - R} y1={y(v)} y2={y(v)} strokeDasharray={v ? '3 4' : undefined} /><text x={L - 6} y={y(v) + 3} textAnchor="end">{v}</text></g>)}
      {months.filter((_, i) => i % every === 0).map(m => <text key={m} x={x(m)} y={H - 10} textAnchor="middle">{BLN[new Date(m).getUTCMonth()]}</text>)}
      <path className="pa" d={`${d} L${x(e0).toFixed(1)} ${y(0)} L${x(s0).toFixed(1)} ${y(0)} Z`} />
      <path className="pl" d={d} />
      {tIn && <>
        <line className="tl" x1={tx} x2={tx} y1={Tp} y2={H - Bt} />
        <circle className="pp" cx={tx} cy={y(c.plan)} r={6} />
        <circle className="pt" cx={tx} cy={y(c.actual)} r={8} />
        <text x={flip ? tx - 12 : tx + 12} y={y(c.actual) + (c.actual < c.plan ? 16 : -10)} textAnchor={flip ? 'end' : 'start'} className="lab-a">Realisasi {Math.round(c.actual)}%</text>
        <text x={flip ? tx - 12 : tx + 12} y={y(c.plan) + (c.actual < c.plan ? -10 : 16)} textAnchor={flip ? 'end' : 'start'} className="lab-p">Plan {Math.round(c.plan)}%</text>
      </>}
    </svg>
  )
}
