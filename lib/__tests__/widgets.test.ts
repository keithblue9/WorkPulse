import { describe, expect, it } from 'vitest'
import { DEFAULT_LAYOUT, addWidget, availableWidgets, moveWidget, needsOf, normalizeLayout, removeWidget, resizeWidget, sanitizeLayoutInput } from '../widgets'

const all = availableWidgets(null, true)
describe('availableWidgets', () => {
  it('filter menu & internal', () => {
    const ids = availableWidgets(new Set(['dashboard', 'links']), false).map(w => w.id)
    expect(ids).toEqual(['summary', 'enhancement', 'enh-map'])
    const m = availableWidgets(new Set(['progress', 'activities', 'attendance', 'notes']), true).map(w => w.id)
    expect(m).toEqual(expect.arrayContaining(['progress', 'myfocus', 'agenda', 'activity-stats', 'issues', 'team', 'workload', 'notes']))
    expect(m).not.toContain('budget')
  })
})
describe('normalizeLayout', () => {
  it('buang id asing/duplikat/tak diizinkan, perbaiki ukuran', () => {
    const avail = availableWidgets(new Set(['progress']), true)
    expect(normalizeLayout([{ id: 'progress', size: 'X' }, { id: 'progress', size: 'S' }, { id: 'budget', size: 'M' }, { id: 'zzz' }, null], avail, [])).toEqual([{ id: 'progress', size: 'M' }])
  })
  it('tanpa simpanan → default (yang diizinkan saja)', () => {
    expect(normalizeLayout(undefined, all, DEFAULT_LAYOUT)).toHaveLength(DEFAULT_LAYOUT.length)
  })
})
describe('operasi layout', () => {
  const l = [{ id: 'a', size: 'S' as const }, { id: 'b', size: 'M' as const }, { id: 'c', size: 'L' as const }]
  it('tambah/ganti ukuran, hapus, pindah', () => {
    expect(addWidget(l, 'd', 'S')).toHaveLength(4)
    expect(addWidget(l, 'a', 'M')[0]).toEqual({ id: 'a', size: 'M' })
    expect(removeWidget(l, 'b').map(x => x.id)).toEqual(['a', 'c'])
    expect(resizeWidget(l, 'c', 'S')[2].size).toBe('S')
    expect(moveWidget(l, 'c', 0).map(x => x.id)).toEqual(['c', 'a', 'b'])
    expect(moveWidget(l, 'a', 99).map(x => x.id)).toEqual(['b', 'c', 'a'])
  })
  it('needsOf & sanitize', () => {
    expect([...needsOf([{ id: 'golive', size: 'M' }, { id: 'budget', size: 'S' }, { id: 'summary', size: 'M' }])]).toEqual(['golive', 'budget'])
    expect(sanitizeLayoutInput([{ id: 'progress', size: 'S' }])).toEqual([{ id: 'progress', size: 'S' }])
    expect(sanitizeLayoutInput([{ id: 'progress', size: 'XL' }])).toBeNull()
    expect(sanitizeLayoutInput([{ id: 'progress', size: 'S' }, { id: 'progress', size: 'M' }])).toBeNull()
    expect(sanitizeLayoutInput({})).toBeNull()
  })
})

import { chunkLayout } from '../widgets'
describe('chunkLayout & classic', () => {
  it('memisah grid native dan blok infografis v3, indeks asli terjaga', () => {
    const c = chunkLayout([{ id: 'progress', size: 'S' }, { id: 'team', size: 'S' }, { id: 'v3-team', size: 'F' }, { id: 'v3-mcu', size: 'H' }, { id: 'agenda', size: 'M' }])
    expect(c.map(x => [x.kind, x.items.map(i => i.i)])).toEqual([['grid', [0, 1]], ['flow', [2, 3]], ['grid', [4]]])
  })
  it('ukuran H/F hanya untuk infografis v3', () => {
    expect(sanitizeLayoutInput([{ id: 'v3-team', size: 'F' }])).toEqual([{ id: 'v3-team', size: 'F' }])
    expect(sanitizeLayoutInput([{ id: 'progress', size: 'F' }])).toBeNull()
  })
})
