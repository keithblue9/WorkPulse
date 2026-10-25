import { describe, it, expect } from 'vitest'
import { showInYear, phasesForSave } from '@/lib/initiativeView'

describe('showInYear (initiative lintas tahun)', () => {
  it('shows an initiative in its own year even without dates', () => {
    expect(showInYear({ year: 2026, phases: [{ name: 'Draft', planCells: [], actualCells: [] }] }, 2026)).toBe(true)
    expect(showInYear({ year: 2026, phases: [] }, 2027)).toBe(false)
  })
  it('also shows it in every year its activities touch', () => {
    const i = { year: 2026, phases: [{ name: 'Go live', start: '2026-11-01', end: '2027-02-15' }] }
    expect(showInYear(i, 2027)).toBe(true)
    expect(showInYear(i, 2028)).toBe(false)
  })
  it('understands legacy week cells', () => {
    expect(showInYear({ year: 2025, phases: [{ name: 'A', planCells: ['12-4'], actualCells: [] }] }, 2026)).toBe(false)
  })
  it('accepts a year stored as a string', () => {
    expect(showInYear({ year: '2026' as any, phases: [] }, 2026)).toBe(true)
  })
})

describe('phasesForSave', () => {
  it('keeps the original phase fields (old week cells stay untouched)', () => {
    const orig = [{ _id: 'p1', name: 'A', planCells: ['1-1'], actualCells: ['1-1'], progressNotes: 'x' }]
    const [p] = phasesForSave(orig, [{ key: 0, name: 'A2', start: '2026-01-01', end: '2026-01-31', w: 40, pct: 55, notes: 'y' }])
    expect(p).toMatchObject({ _id: 'p1', planCells: ['1-1'], actualCells: ['1-1'], name: 'A2', start: '2026-01-01', end: '2026-01-31', weight: 40, pct: 55, progressNotes: 'y' })
  })
  it('stores new activities without legacy cells and drops an empty weight', () => {
    const [p] = phasesForSave([], [{ key: -1, name: ' Baru ', start: '', end: '', w: 0, pct: 120, notes: '' }])
    expect(p).toEqual({ name: 'Baru', start: '', end: '', pct: 100, progressNotes: '', planCells: [], actualCells: [] })
  })
})
