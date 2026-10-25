import { describe, it, expect } from 'vitest'
import { ganttScale } from '@/lib/gantt'
import { dUTC } from '@/lib/progress'

describe('ganttScale', () => {
  it('spans whole months around the activities and today', () => {
    const g = ganttScale([{ start: '2026-03-10', end: '2026-05-02' }], dUTC('2026-04-01'))!
    expect(g.months.map(m => m.label)).toEqual(['Mar 26', 'Apr', 'Mei'])
    expect(g.pos(dUTC('2026-03-01'))).toBe(0)
    expect(g.pos(dUTC('2026-06-01'))).toBe(100)
  })
  it('extends to include today', () => {
    const g = ganttScale([{ start: '2026-03-10', end: '2026-03-20' }], dUTC('2026-07-15'))!
    expect(g.months.length).toBe(5)
  })
  it('labels January with the year when crossing years', () => {
    const g = ganttScale([{ start: '2026-11-01', end: '2027-02-10' }], dUTC('2026-11-05'))!
    expect(g.months.map(m => m.label)).toEqual(['Nov 26', 'Des', 'Jan 27', 'Feb'])
  })
  it('returns null when nothing has dates', () => {
    expect(ganttScale([{ start: '', end: '' }], dUTC('2026-01-01'))).toBeNull()
  })
})
