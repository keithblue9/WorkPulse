import { describe, expect, it } from 'vitest'
import { needsUpdate, workload } from '../workload'
import { dUTC } from '../progress'

const today = dUTC('2026-10-26')
const tpl = [30, 40, 15, 10, 5]
const inits = [{ pic: ['Nabila'], year: 2026, phases: [{ name: 'X', start: '2026-10-01', end: '2026-10-31', weight: 100, pct: 10 }, { name: 'Y', start: '2026-11-01', end: '2026-11-30', weight: 0, pct: 0 }] }]
const enh = [{ pic: ['Nabila Fithri Azizah'], stage: 7, phases: [{ key: 'Development', start: '2026-10-01', end: '2026-10-20', pct: 50 }] }]
const acts = [{ pic: ['Nabila'], status: 'on_track' }, { pic: ['Erwin'], status: 'on_track' }, { pic: ['Erwin'], status: 'completed' }]

describe('needsUpdate', () => {
  it('menghitung tugas tertinggal per PIC', () => {
    expect(needsUpdate('Nabila Fithri Azizah', { inits, enh }, today, tpl)).toEqual({ progress: 1, enhancement: 1 })
    expect(needsUpdate('Erwin', { inits, enh }, today, tpl)).toEqual({ progress: 0, enhancement: 0 })
  })
})
describe('workload', () => {
  it('urut dari beban terbesar; activity selesai & enhancement selesai tidak dihitung', () => {
    const rows = workload([{ name: 'Erwin Harry Saputra' }, { name: 'Nabila Fithri Azizah' }, {}], { acts, inits, enh }, today, tpl)
    expect(rows.map(r => r.name)).toEqual(['Nabila Fithri Azizah', 'Erwin Harry Saputra'])
    expect(rows[0]).toMatchObject({ acts: 1, inits: 1, enh: 0, late: 2, total: 2 })
    expect(rows[1]).toMatchObject({ acts: 1, total: 1, late: 0 })
  })
})
