import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { monthGroups, catCounts } from '../notesFeed'

describe('feed Team Notes', () => {
  it('kelompok per bulan, terbaru dulu, tanpa tanggal di akhir', () => {
    const g = monthGroups([{ _id: 'a', date: '2026-09-02' }, { _id: 'b', date: '2026-11-01' }, { _id: 'c' }, { _id: 'd', date: '2026-11-20' }])
    expect(g.map(x => x.label)).toEqual(['November 2026', 'September 2026', 'Tanpa tanggal'])
    expect(g[0].items.map(n => n._id)).toEqual(['d', 'b'])
  })
  it('createdAt dipakai bila tanpa date', () => {
    expect(monthGroups([{ _id: 'a', createdAt: '2026-03-05T10:00:00Z' }])[0].label).toBe('Maret 2026')
  })
  it('properti: setiap catatan tepat sekali & hitungan kategori konsisten', () => {
    const arb = fc.record({ _id: fc.uuid(), category: fc.constantFrom('iPRO', 'iVendor', 'Others'), date: fc.oneof(fc.constant(''), fc.date({ min: new Date(2025, 0, 1), max: new Date(2027, 0, 1) }).map(d => d.toISOString().slice(0, 10))) })
    fc.assert(fc.property(fc.array(arb, { maxLength: 40 }), list => {
      const ids = monthGroups(list).flatMap(g => g.items.map(n => n._id)).sort()
      expect(ids).toEqual(list.map(n => n._id).sort())
      const c = catCounts(list)
      expect(Object.values(c).reduce((s, n) => s + n, 0)).toBe(list.length)
    }), { numRuns: 500 })
  })
})
