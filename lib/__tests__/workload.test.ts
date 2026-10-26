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

describe('daftar "perlu update" (sumber badge menu Enhancement)', () => {
  it('jumlah item sama dengan angka badge dan menyebut asal & tautannya', async () => {
    const { needsUpdate, needsUpdateList } = await import('@/lib/workload')
    const { normWeights } = await import('@/lib/enhancement')
    const t = Date.UTC(2026, 9, 26)
    const data = {
      inits: [{ _id: 'i1', title: 'KIMAP', year: 2026, pic: ['Erwin Harry Saputra'], phases: [{ name: 'Dev', start: '2026-01-01', end: '2026-06-30', pct: 50 }, { name: 'UAT', start: '2026-07-01', end: '2026-07-31', pct: 100 }] }],
      enh: [{ _id: 'e1', title: 'BMC', year: 2026, pic: ['Erwin'], acts: [{ name: 'Build', start: '2026-02-01', end: '2026-03-01', pct: 10, w: 0 }] }, { _id: 'e2', title: 'Lain', year: 2026, pic: ['Dwi'], acts: [{ name: 'X', start: '2026-02-01', end: '2026-03-01', pct: 0, w: 0 }] }],
    }
    const n = needsUpdate('Erwin Harry Saputra', data, t, normWeights(null))
    const list = needsUpdateList('Erwin Harry Saputra', data, t, normWeights(null))
    expect(list.length).toBe(n.progress + n.enhancement)
    expect(list.map(x => [x.title, x.act, x.href])).toEqual([['KIMAP', 'Dev', '/dashboard/progress?i=i1'], ['BMC', 'Build', '/dashboard/enhancement?e=e1']])
  })
})
