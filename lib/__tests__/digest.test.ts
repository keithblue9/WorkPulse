import { describe, expect, it } from 'vitest'
import { staleReimburses, weeklyDigest, wib } from '../digest'

describe('weeklyDigest', () => {
  const acts = [
    { title: 'A', pic: ['Nabila Fithri Azizah'], status: 'on_track', actionDate: '2026-10-28' },
    { title: 'B', pic: ['Nabila'], status: 'completed', actionDate: '2026-10-28' },
    { title: 'C', pic: ['Erwin'], status: 'on_track', actionDate: '2026-10-28' },
    { title: 'D', picName: 'Nabila', status: 'on_track', actionDate: '2026-12-01' },
  ]
  const inits = [{ pic: ['Nabila'], year: 2026, phases: [{ name: 'X', start: '2026-10-01', end: '2026-10-31', weight: 100, pct: 0 }] }]
  const enh = [{ pic: ['Nabila'], stage: 3 }, { pic: ['Nabila'], stage: 7 }]
  it('hanya item dengan PIC orang itu; activity selesai & enhancement selesai tidak dihitung', () => {
    const d = weeklyDigest('Nabila Fithri Azizah', { acts, inits, enh }, '2026-10-26')!
    expect(d).toMatchObject({ openActs: 2, dueWeek: 1, lateTasks: 1, enh: 1 })
    expect(d.body).toContain('2 activity terbuka (1 jatuh tempo pekan ini)')
  })
  it('null bila tidak ada apa pun', () => {
    expect(weeklyDigest('Jaoza', { acts, inits, enh }, '2026-10-26')).toBeNull()
  })
})

describe('staleReimburses', () => {
  const now = Date.parse('2026-10-26T01:00:00Z')
  const items = [
    { status: 'submitted', submittedAt: '2026-10-20T08:00:00Z' },
    { status: 'submitted', submittedAt: '2026-10-25T08:00:00Z' },
    { status: 'done', submittedAt: '2026-10-01T08:00:00Z' },
    { status: 'approved', createdAt: '2026-10-10T08:00:00Z' },
    { status: 'submitted' },
  ]
  it('hanya yang belum ditransfer & lewat N hari', () => { expect(staleReimburses(items, now, 3)).toHaveLength(2) })
  it('0 hari = mati', () => { expect(staleReimburses(items, now, 0)).toEqual([]) })
})

describe('wib', () => {
  it('Senin pagi WIB dari waktu UTC', () => { expect(wib(new Date('2026-10-26T01:00:00Z'))).toEqual({ iso: '2026-10-26', dow: 1, hour: 8 }) })
})
