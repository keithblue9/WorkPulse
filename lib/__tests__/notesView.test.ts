import { describe, it, expect } from 'vitest'
import { noteYear, notesForYear, matches, sortNotes, groupNotes } from '@/lib/notesView'

describe('notesView', () => {
  it('takes the year from the date, else from createdAt', () => {
    expect(noteYear({ date: '2025-03-02' })).toBe(2025)
    expect(noteYear({ createdAt: '2026-01-05T00:00:00Z' })).toBe(2026)
    expect(noteYear({})).toBeNull()
  })
  it('shows a year’s notes plus all pinned notes', () => {
    const l = [{ _id: 'a', date: '2025-01-01' }, { _id: 'b', date: '2026-02-01' }, { _id: 'c', date: '2024-01-01', pinned: true }]
    expect(notesForYear(l, 2026).map(n => n._id)).toEqual(['b', 'c'])
  })
  it('searches title, content and PIC (case-insensitive)', () => {
    const n = { title: 'SI Vendor', content: 'Checklist migrasi', picTags: ['Augina'] }
    expect(matches(n, 'vendor')).toBe(true); expect(matches(n, 'MIGRASI')).toBe(true); expect(matches(n, 'augi')).toBe(true); expect(matches(n, 'kims')).toBe(false); expect(matches(n, '  ')).toBe(true)
  })
  it('sorts pinned first then newest date', () => {
    const s = sortNotes([{ _id: '1', date: '2026-01-01' }, { _id: '2', date: '2026-03-01' }, { _id: '3', date: '2025-01-01', pinned: true }])
    expect(s.map(n => n._id)).toEqual(['3', '2', '1'])
  })
  it('groups by category order and collects unknown categories in Lainnya', () => {
    const g = groupNotes([{ _id: '1', category: 'PAL' }, { _id: '2', category: 'iVendor' }, { _id: '3', category: 'Lama' }], [{ key: 'iVendor', label: 'iVendor' }, { key: 'PAL', label: 'PAL' }])
    expect(g.map(x => [x.key, x.items.length])).toEqual([['iVendor', 1], ['PAL', 1], ['__orphan', 1]])
  })
})
