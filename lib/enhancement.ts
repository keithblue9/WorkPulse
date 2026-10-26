// Enhancement (IT Requirement BPDP): scoring identical to the "BPDP - …" sheets,
// BRD stages and the 5-activity template timeline. Pure functions, unit-tested.
import type { Act } from '@/lib/progress'

export const STAGES = ['Drafting', 'Pre-review', 'Submit [To T&D]', 'Revisi', 'Final Submit [to T&D]', 'Submit [To BR]', 'Development'] as const
export const STAGES_SHORT = ['Drafting', 'Pre-review', 'Submit T&D', 'Revisi', 'Final Submit', 'Submit BR', 'Development']
export const TPL = ['BRD', 'Development', 'UAT', 'Go Live', 'Stabilisasi'] as const
export const DEFAULT_TEMPLATE = [30, 40, 15, 10, 5]
export const ENH_APPS = ['iVendor', 'iPRO', 'PAL', 'KIMs', 'OnePro', 'BMC', 'Others']
export const ENH_TYPES = ['New', 'Carry Over']
export const INITIATORS = ['BPD', 'SS Procurement', 'Proc. Retain', 'Others']
export const CATS = ['Quick Win', 'Strategis', 'Minor', 'To Be Consider'] as const
export type Cat = (typeof CATS)[number] | 'Belum lengkap' | 'Belum dinilai'

// Same parameters as sheet "List": high score ≥ 2.5; more than 10 items → effort +1 (max 5).
export const HIGH = 2.5
const ITEM_LIMIT = 10, ITEM_BONUS = 1, EFFORT_MAX = 5

export type EnhItem = { t?: string; u?: number | null; f?: number | null; fl?: number | null; pb?: number | null; du?: string; df?: string; dfl?: string; dpb?: string }
const ok = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 5
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN)

export function catOf(impact: number, effort: number): (typeof CATS)[number] {
  const hi = impact >= HIGH, he = effort >= HIGH
  return hi ? (he ? 'Strategis' : 'Quick Win') : he ? 'To Be Consider' : 'Minor'
}

/** Impact, effort and category of one enhancement, exactly like the summary table of the sheet. */
export function score(items: EnhItem[] | undefined): { impact: number; effort: number; cat: Cat; n: number; scored: number } {
  const list = (Array.isArray(items) ? items : []).filter(i => (i?.t && String(i.t).trim()) || [i?.u, i?.f, i?.fl, i?.pb].some(v => v != null))
  const n = list.length
  const scored = list.filter(i => [i.u, i.f, i.fl, i.pb].every(ok)).length
  const none = list.filter(i => ![i.u, i.f, i.fl, i.pb].some(ok)).length
  const imp = avg(list.flatMap(i => [i.u, i.f].filter(ok)))
  let eff = avg(list.filter(i => ok(i.fl) && ok(i.pb)).map(i => ((i.fl as number) + (i.pb as number)) / 2))
  if (Number.isFinite(eff) && n > ITEM_LIMIT) eff = Math.min(EFFORT_MAX, eff + ITEM_BONUS)
  const impact = Number.isFinite(imp) ? imp : 0, effort = Number.isFinite(eff) ? eff : 0
  const cat: Cat = n === 0 || none === n ? 'Belum dinilai' : scored < n ? 'Belum lengkap' : catOf(impact, effort)
  return { impact, effort, cat, n, scored }
}

const CAT_ORDER: Record<string, number> = { 'Quick Win': 1, Strategis: 2, Minor: 3, 'To Be Consider': 4 }
const r6 = (v: number) => Math.round(v * 1e6) / 1e6

/** Priority per app (1 = first): category order, then highest impact, then lowest effort, then input order. */
export function rankPrio<T extends { _id: string; app: string; items: EnhItem[] }>(list: T[]): Map<string, number> {
  const out = new Map<string, number>()
  const byApp = new Map<string, { id: string; o: number; i: number; e: number; k: number }[]>()
  list.forEach((x, k) => {
    const s = score(x.items), o = CAT_ORDER[s.cat]
    if (!o) return
    const arr = byApp.get(x.app) || []
    arr.push({ id: String(x._id), o, i: r6(s.impact), e: r6(s.effort), k })
    byApp.set(x.app, arr)
  })
  for (const arr of byApp.values()) {
    arr.sort((a, b) => a.o - b.o || b.i - a.i || a.e - b.e || a.k - b.k).forEach((x, idx) => out.set(x.id, idx + 1))
  }
  return out
}

export const brdPct = (stage: number) => (Math.min(7, Math.max(0, Number(stage) || 0)) / 7) * 100

/** Template weights from Configuration, or the default 30/40/15/10/5 when missing or invalid. */
export function normWeights(cfg: { name: string; w: number }[] | undefined | null): number[] {
  if (!Array.isArray(cfg)) return [...DEFAULT_TEMPLATE]
  const w = TPL.map(n => cfg.find(x => x?.name === n)?.w)
  return w.every(v => typeof v === 'number' && Number.isFinite(v) && v >= 0) && (w as number[]).some(v => v > 0) ? (w as number[]) : [...DEFAULT_TEMPLATE]
}
const validW = (w: unknown): w is number[] => Array.isArray(w) && w.length === TPL.length && w.every(v => typeof v === 'number' && Number.isFinite(v) && v >= 0) && w.some(v => v > 0)

export type EnhPhase = { key: string; start?: string; end?: string; pct?: number }
/** The 5 template activities; BRD % follows the stage (stage ÷ 7). */
export function enhActs(e: { stage?: number; weights?: number[] | null; phases?: EnhPhase[]; acts?: any[] }, tpl: number[]): Act[] {
  // Aktivitas kustom (mis. hasil pindahan Progress Project) menggantikan template 5 aktivitas.
  if (Array.isArray(e.acts) && e.acts.length) {
    return e.acts.map((a: any, i: number) => ({ name: String(a?.name || `Aktivitas ${i + 1}`), start: a?.start || '', end: a?.end || '', w: Number(a?.w) > 0 ? Number(a.w) : 0, pct: Math.min(100, Math.max(0, Number(a?.pct) || 0)), notes: a?.notes || '' }))
  }
  const w = validW(e.weights) ? e.weights : tpl
  return TPL.map((name, i) => {
    const p = (e.phases || []).find(x => x?.key === name) || ({} as EnhPhase)
    const pct = name === 'BRD' ? brdPct(e.stage ?? 1) : Math.min(100, Math.max(0, Number(p.pct) || 0))
    return { name, w: w[i], start: p.start || '', end: p.end || '', pct }
  })
}

/** Code prefix used by the sheets (cell P16), e.g. iVendor → B-IV. */
export const CODE_PREFIX: Record<string, string> = { iVendor: 'B-IV', iPRO: 'B-IP', PAL: 'B-PL', KIMs: 'B-KM', OnePro: 'B-OP', BMC: 'B-BM', Others: 'B-OT' }
