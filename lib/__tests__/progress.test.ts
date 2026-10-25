import { describe, it, expect } from 'vitest'
import { ptd, calc, statusOf, actsFromPhases, planAt, dUTC, type Act } from '@/lib/progress'

const T = (s: string) => dUTC(s)
const A = (start: string, end: string, w = 1, pct = 0): Act => ({ name: 'x', start, end, w, pct })

describe('ptd (plan to date, linear per day)', () => {
  it('is 50% halfway through a 30-day activity', () => {
    expect(ptd(A('2026-01-01', '2026-01-30'), T('2026-01-16'))).toBeCloseTo(50)
  })
  it('is 100% from the day after the end date', () => {
    expect(ptd(A('2026-01-01', '2026-01-30'), T('2026-01-31'))).toBe(100)
  })
  it('is 0% on or before the start date', () => {
    expect(ptd(A('2026-01-01', '2026-01-30'), T('2026-01-01'))).toBe(0)
    expect(ptd(A('2026-01-01', '2026-01-30'), T('2025-12-01'))).toBe(0)
  })
  it('treats missing or broken dates as not started', () => {
    expect(ptd(A('', ''), T('2026-06-01'))).toBe(0)
    expect(ptd(A('2026-13-40', 'x'), T('2026-06-01'))).toBe(0)
  })
})

describe('calc', () => {
  const today = T('2026-01-16')
  it('weights plan and actual by activity weight and reports SPI = actual / plan', () => {
    const r = calc([A('2026-01-01', '2026-01-30', 60, 30), A('2026-02-01', '2026-02-28', 40, 0)], today)
    expect(r.plan).toBeCloseTo(30)      // 60% weight × 50% due
    expect(r.actual).toBeCloseTo(18)    // 60% × 30% done
    expect(r.spi).toBeCloseTo(0.6)
    expect(r.W).toBe(100)
  })
  it('uses equal weights when no weights are given (weight is optional)', () => {
    const r = calc([A('2026-01-01', '2026-01-30', 0, 50), A('2026-01-01', '2026-01-30', 0, 50)], today)
    expect(r.plan).toBeCloseTo(50)
    expect(r.actual).toBeCloseTo(50)
    expect(Number.isNaN(r.plan)).toBe(false)
  })
  it('has no SPI before anything is due and never returns NaN for an empty list', () => {
    expect(calc([A('2026-03-01', '2026-03-31', 1, 0)], today).spi).toBeNull()
    expect(calc([], today)).toEqual({ plan: 0, actual: 0, spi: null, W: 0 })
  })
  it('clamps percentages to 0–100', () => {
    expect(calc([A('2025-01-01', '2025-01-31', 1, 140)], today).actual).toBe(100)
  })
})

describe('statusOf', () => {
  it('maps SPI to the four states', () => {
    expect(statusOf(null).label).toBe('Belum mulai')
    expect(statusOf(1).label).toBe('On track')
    expect(statusOf(0.95).label).toBe('Perlu perhatian')
    expect(statusOf(0.9).label).toBe('Perlu perhatian')
    expect(statusOf(0.89).label).toBe('Terlambat')
  })
})

describe('planAt', () => {
  it('is the weighted plan curve at a point in time', () => {
    const acts = [A('2026-01-01', '2026-01-30', 1, 0), A('2026-02-01', '2026-02-28', 1, 0)]
    expect(planAt(acts, T('2026-01-31'))).toBeCloseTo(50)
    expect(planAt(acts, T('2026-03-01'))).toBeCloseTo(100)
  })
})

describe('actsFromPhases (read-time conversion of week cells)', () => {
  it('turns week cells into a date range covering whole weeks', () => {
    const [a] = actsFromPhases([{ name: 'Design', planCells: ['3-1', '3-4'], actualCells: ['3-1'] }], 2026)
    expect(a).toMatchObject({ name: 'Design', start: '2026-03-01', end: '2026-03-31' })
    expect(a.pct).toBeCloseTo(50)
  })
  it('ends an early week on day 7 × week', () => {
    const [a] = actsFromPhases([{ name: 'X', planCells: ['2-2'], actualCells: [] }], 2026)
    expect(a.start).toBe('2026-02-08'); expect(a.end).toBe('2026-02-14')
  })
  it('derives weights from planned weeks', () => {
    const acts = actsFromPhases([{ name: 'A', planCells: ['1-1', '1-2', '1-3'], actualCells: [] }, { name: 'B', planCells: ['2-1'], actualCells: [] }], 2026)
    expect(acts[0].w).toBeCloseTo(75); expect(acts[1].w).toBeCloseTo(25)
  })
  it('prefers the new fields when a phase was saved with dates', () => {
    const [a] = actsFromPhases([{ name: 'A', planCells: ['1-1'], actualCells: [], start: '2026-05-01', end: '2026-05-20', weight: 40, pct: 70 }], 2026)
    expect(a).toMatchObject({ start: '2026-05-01', end: '2026-05-20', w: 40, pct: 70 })
  })
  it('keeps an unscheduled phase as not started', () => {
    const acts = actsFromPhases([{ name: 'Draft', planCells: [], actualCells: [] }], 2026)
    expect(acts[0]).toMatchObject({ start: '', end: '', pct: 0 })
    expect(calc(acts, T('2026-06-01')).spi).toBeNull()
  })
  it('caps completion at 100% when more weeks were worked than planned', () => {
    const [a] = actsFromPhases([{ name: 'A', planCells: ['1-1'], actualCells: ['1-1', '1-2'] }], 2026)
    expect(a.pct).toBe(100)
  })
})
