import { dUTC } from '@/lib/progress'
export const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

/** Time scale for a Gantt: whole months covering every dated activity and today. */
export function ganttScale(acts: { start: string; end: string }[], today: number) {
  const ts = acts.flatMap(a => [dUTC(a.start), dUTC(a.end)]).filter(Number.isFinite)
  if (!ts.length) return null
  const lo = Math.min(...ts, today), hi = Math.max(...ts, today)
  const s = new Date(lo), e = new Date(hi)
  const A = Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), 1), B = Date.UTC(e.getUTCFullYear(), e.getUTCMonth() + 1, 1)
  const months: { t: number; label: string; jan: boolean }[] = []
  for (let y = s.getUTCFullYear(), m = s.getUTCMonth(); Date.UTC(y, m, 1) < B; m++) {
    if (m > 11) { m = 0; y++ }
    const t = Date.UTC(y, m, 1)
    months.push({ t, jan: m === 0, label: m === 0 || !months.length ? `${BLN[m]} ${String(y).slice(2)}` : BLN[m] })
  }
  const pos = (t: number) => Math.round(((t - A) / (B - A)) * 10000) / 100
  return { A, B, months, pos }
}
