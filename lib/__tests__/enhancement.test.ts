import { describe, it, expect } from 'vitest'
import ref from './fixtures/bpdp-2027-scores.json'
import { score, rankPrio, STAGES, brdPct, enhActs, DEFAULT_TEMPLATE, normWeights } from '@/lib/enhancement'

const items = (rows: (number | null)[][]) => rows.map(([u, f, fl, pb], i) => ({ t: `Item ${i + 1}`, u, f, fl, pb }))

describe('score (sama dengan rumus sheet BPDP)', () => {
  it('reproduces impact, effort and category of all 24 reference enhancements', () => {
    for (const e of ref as any[]) {
      const s = score(items(e.items))
      expect(s.cat, e.code).toBe(e.cat)
      expect(s.impact, e.code).toBeCloseTo(e.impact, 6)
      expect(s.effort, e.code).toBeCloseTo(e.effort, 6)
    }
  })
  it('adds 1 effort point (max 5) when there are more than 10 items', () => {
    expect(score(items(Array(11).fill([3, 3, 3, 3]))).effort).toBe(4)
    expect(score(items(Array(10).fill([3, 3, 3, 3]))).effort).toBe(3)
    expect(score(items(Array(11).fill([3, 3, 5, 5]))).effort).toBe(5)
  })
  it('uses 2.5 as the inclusive high threshold', () => {
    expect(score(items([[3, 2, 2, 3]])).cat).toBe('Strategis')
    expect(score(items([[2, 2, 2, 2]])).cat).toBe('Minor')
    expect(score(items([[1, 1, 4, 4]])).cat).toBe('To Be Consider')
  })
  it('marks incomplete scoring like the sheet does', () => {
    expect(score(items([[5, 5, null, null]])).cat).toBe('Belum lengkap')
    expect(score(items([[null, null, null, null]])).cat).toBe('Belum dinilai')
    expect(score([]).cat).toBe('Belum dinilai')
    expect(score(items([[4, 4, 1, 1], [null, null, null, null]])).cat).toBe('Belum lengkap')
  })
  it('accepts 0 as a valid score', () => {
    expect(score(items([[0, 0, 0, 0]])).cat).toBe('Minor')
  })
})

describe('rankPrio', () => {
  it('orders per app: Quick Win → Strategis → Minor → To Be Consider, then impact high, effort low', () => {
    const list = (ref as any[]).map(e => ({ _id: e.code, app: e.app, items: items(e.items) }))
    const pr = rankPrio(list)
    for (const e of ref as any[]) expect(pr.get(e.code), e.code).toBe(e.prio)
  })
  it('gives no priority to unscored enhancements', () => {
    const pr = rankPrio([{ _id: 'a', app: 'X', items: items([[null, null, null, null]]) }, { _id: 'b', app: 'X', items: items([[1, 1, 1, 1]]) }])
    expect(pr.get('a')).toBeUndefined(); expect(pr.get('b')).toBe(1)
  })
})

describe('BRD stages & timeline', () => {
  it('has the 7 agreed stages starting from Drafting', () => {
    expect(STAGES).toEqual(['Drafting', 'Pre-review', 'Submit [To T&D]', 'Revisi', 'Final Submit [to T&D]', 'Submit [To BR]', 'Development'])
    expect(brdPct(1)).toBeCloseTo(100 / 7); expect(brdPct(7)).toBe(100); expect(brdPct(0)).toBe(0); expect(brdPct(9)).toBe(100)
  })
  it('builds the 5 template activities with BRD % from the stage and template weights', () => {
    const acts = enhActs({ stage: 7, phases: [{ key: 'Development', start: '2027-01-01', end: '2027-03-31', pct: 40 }] }, DEFAULT_TEMPLATE)
    expect(acts.map(a => a.name)).toEqual(['BRD', 'Development', 'UAT', 'Go Live', 'Stabilisasi'])
    expect(acts.map(a => a.w)).toEqual([30, 40, 15, 10, 5])
    expect(acts[0].pct).toBe(100)
    expect(acts[1]).toMatchObject({ start: '2027-01-01', end: '2027-03-31', pct: 40 })
    expect(acts[2]).toMatchObject({ start: '', end: '', pct: 0 })
  })
  it('uses per-enhancement weights when set', () => {
    expect(enhActs({ stage: 1, weights: [20, 50, 10, 10, 10] }, DEFAULT_TEMPLATE).map(a => a.w)).toEqual([20, 50, 10, 10, 10])
  })
  it('normalises template weights from config (fallback when invalid)', () => {
    expect(normWeights([{ name: 'BRD', w: 25 }, { name: 'Development', w: 45 }, { name: 'UAT', w: 15 }, { name: 'Go Live', w: 10 }, { name: 'Stabilisasi', w: 5 }])).toEqual([25, 45, 15, 10, 5])
    expect(normWeights(undefined)).toEqual([30, 40, 15, 10, 5])
    expect(normWeights([{ name: 'BRD', w: -1 }])).toEqual([30, 40, 15, 10, 5])
  })
})
