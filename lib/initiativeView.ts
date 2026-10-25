import { actsFromPhases, inYear } from '@/lib/progress'

export type Draft = { key: number; name: string; start: string; end: string; w: number; pct: number; notes: string }

/** An initiative shows in its own year and in every year its activities touch. */
export function showInYear(i: { year?: number | string; phases?: any[] }, y: number): boolean {
  const own = Number(i?.year)
  if (own === y) return true
  return inYear(actsFromPhases(i?.phases || [], Number.isFinite(own) ? own : y), y)
}

/**
 * Phases to store after an edit. `key` points at the original phase (or < 0 for a new one);
 * every original field is kept, so the old week cells stay exactly as they were.
 */
export function phasesForSave(original: any[], drafts: Draft[]): any[] {
  return drafts.map(d => {
    const base = d.key >= 0 && original[d.key] ? { ...original[d.key] } : { planCells: [], actualCells: [] }
    delete base.weight
    const pct = Number.isFinite(+d.pct) ? Math.min(100, Math.max(0, +d.pct)) : 0
    const out: any = { ...base, name: d.name.trim(), start: d.start || '', end: d.end || '', pct, progressNotes: d.notes || '' }
    if (Number.isFinite(+d.w) && +d.w > 0) out.weight = +d.w
    return out
  })
}
