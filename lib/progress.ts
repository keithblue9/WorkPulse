// Progress engine for Progress Project and Enhancement.
// Plan-to-date grows linearly per day between an activity's start and end date;
// actual is the % complete entered by the team; SPI = actual / plan.
export type Act = { name: string; start: string; end: string; w: number; pct: number; notes?: string }
export const DAY = 864e5

const clamp = (v: number) => (Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : 0)

/** 'YYYY-MM-DD' → UTC midnight in ms; NaN when the string is not a real date. */
export function dUTC(s: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''))
  if (!m) return NaN
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const t = Date.UTC(y, mo - 1, d)
  const back = new Date(t)
  return back.getUTCFullYear() === y && back.getUTCMonth() === mo - 1 && back.getUTCDate() === d ? t : NaN
}
export const isoDay = (t: number) => new Date(t).toISOString().slice(0, 10)
/** Today as a UTC-midnight timestamp of the local calendar date (no timezone drift). */
export function todayUTC(now = new Date()): number { return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) }

function span(a: Pick<Act, 'start' | 'end'>): [number, number] | null {
  const s = dUTC(a.start), e = dUTC(a.end)
  if (!Number.isFinite(s) || !Number.isFinite(e) || e < s) return null
  return [s, e + DAY]
}

/** Share of an activity that should be done by `t` (0–100). */
export function ptd(a: Pick<Act, 'start' | 'end'>, t: number): number {
  const sp = span(a)
  if (!sp) return 0
  const [s, e] = sp
  if (t >= e) return 100
  if (t <= s) return 0
  return ((t - s) / (e - s)) * 100
}

/** Effective weights: the given weights, or equal weights when none are set. */
function weights(acts: Act[]): number[] {
  const w = acts.map(a => (Number.isFinite(+a.w) && +a.w > 0 ? +a.w : 0))
  return w.some(x => x > 0) ? w : acts.map(() => 1)
}

export function planAt(acts: Act[], t: number): number {
  if (!acts.length) return 0
  const w = weights(acts), W = w.reduce((x, y) => x + y, 0)
  return acts.reduce((x, a, i) => x + w[i] * ptd(a, t), 0) / W
}

export function calc(acts: Act[], today: number): { plan: number; actual: number; spi: number | null; W: number } {
  if (!acts.length) return { plan: 0, actual: 0, spi: null, W: 0 }
  const w = weights(acts), W = w.reduce((x, y) => x + y, 0)
  const plan = acts.reduce((x, a, i) => x + w[i] * ptd(a, today), 0) / W
  const actual = acts.reduce((x, a, i) => x + w[i] * clamp(+a.pct), 0) / W
  return { plan, actual, spi: plan > 0 ? actual / plan : null, W: acts.reduce((x, a) => x + (+a.w > 0 ? +a.w : 0), 0) }
}

export type StatusKey = 'none' | 'ok' | 'warn' | 'bad'
export function statusOf(spi: number | null): { key: StatusKey; label: string } {
  if (spi == null) return { key: 'none', label: 'Belum mulai' }
  if (spi >= 1) return { key: 'ok', label: 'On track' }
  if (spi >= 0.9) return { key: 'warn', label: 'Perlu perhatian' }
  return { key: 'bad', label: 'Terlambat' }
}

// ── Read-time conversion of the old week-cell format ("M-W", 4 weeks per month) ──
const cellIdx = (c: string) => { const [m, w] = String(c).split('-').map(Number); return ((m || 1) - 1) * 4 + ((w || 1) - 1) }
function cellStart(idx: number, year: number) { const m = Math.floor(idx / 4), w = idx % 4; return isoDay(Date.UTC(year, m, w * 7 + 1)) }
function cellEnd(idx: number, year: number) {
  const m = Math.floor(idx / 4), w = idx % 4
  const last = new Date(Date.UTC(year, m + 1, 0)).getUTCDate()
  return isoDay(Date.UTC(year, m, w === 3 ? last : (w + 1) * 7))
}

/** Phases as activities: new fields when present, otherwise derived from week cells (no write). */
export function actsFromPhases(phases: any[], year: number): Act[] {
  const list = Array.isArray(phases) ? phases : []
  const planWeeks = list.map(p => (Array.isArray(p?.planCells) ? p.planCells.length : 0))
  const total = planWeeks.reduce((a, b) => a + b, 0)
  return list.map((p, i) => {
    const cells: number[] = (Array.isArray(p?.planCells) ? p.planCells : []).map(cellIdx).sort((a: number, b: number) => a - b)
    const done = Array.isArray(p?.actualCells) ? p.actualCells.length : 0
    const derived: Act = {
      name: String(p?.name || `Aktivitas ${i + 1}`),
      start: cells.length ? cellStart(cells[0], year) : '',
      end: cells.length ? cellEnd(cells[cells.length - 1], year) : '',
      w: total > 0 ? (planWeeks[i] / total) * 100 : 0,
      pct: planWeeks[i] > 0 ? Math.min(done / planWeeks[i], 1) * 100 : 0,
      notes: p?.progressNotes || '',
    }
    return {
      ...derived,
      start: p?.start || derived.start,
      end: p?.end || derived.end,
      w: Number.isFinite(p?.weight) ? Number(p.weight) : derived.w,
      pct: Number.isFinite(p?.pct) ? clamp(Number(p.pct)) : derived.pct,
    }
  })
}

/** True when any activity overlaps the given calendar year. */
export function inYear(acts: Pick<Act, 'start' | 'end'>[], y: number): boolean {
  const lo = Date.UTC(y, 0, 1), hi = Date.UTC(y, 11, 31)
  return acts.some(a => { const sp = span(a); return !!sp && sp[0] <= hi && sp[1] - DAY >= lo })
}
