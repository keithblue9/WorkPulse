import { describe, it, expect } from 'vitest'
import { greeting, isFinished, activityInYear, wfoUserIds, upcoming, portfolio, samePerson, activityStats } from '@/lib/dashboard'

describe('dashboard helpers', () => {
  it('greets by hour', () => {
    expect(greeting(6)).toBe('Pagi'); expect(greeting(12)).toBe('Siang'); expect(greeting(16)).toBe('Sore'); expect(greeting(21)).toBe('Malam'); expect(greeting(2)).toBe('Malam')
  })
  it('knows finished statuses', () => {
    expect(isFinished({ status: 'Completed' })).toBe(true); expect(isFinished({ status: 'on_track' })).toBe(false); expect(isFinished({})).toBe(false)
  })
  it('places activities in a year; open older ones carry into the current year', () => {
    expect(activityInYear({ actionDate: '2026-05-01' }, 2026, 2026)).toBe(true)
    expect(activityInYear({ actionDate: '2025-05-01', status: 'on_track' }, 2026, 2026)).toBe(true)
    expect(activityInYear({ actionDate: '2025-05-01', status: 'completed' }, 2026, 2026)).toBe(false)
    expect(activityInYear({ actionDate: '2025-05-01' }, 2025, 2026)).toBe(true)
    expect(activityInYear({ actionDate: '2026-05-01' }, 2025, 2026)).toBe(false)
    expect(activityInYear({}, 2026, 2026)).toBe(true)
    expect(activityInYear({}, 2025, 2026)).toBe(false)
  })
  it('counts WFO from either slots or the legacy type field', () => {
    const rows = [{ userId: 'a', date: '2026-10-25', type: 'WFO' }, { userId: 'b', date: '2026-10-25', slots: [{ type: 'wfh' }, { type: 'wfo' }] }, { userId: 'c', date: '2026-10-25', type: 'wfh' }, { userId: 'd', date: '2026-10-24', type: 'wfo' }]
    expect([...wfoUserIds(rows, '2026-10-25')].sort()).toEqual(['a', 'b'])
  })
  it('lists upcoming visible activities from today', () => {
    const l = [{ title: 'a', actionDate: '2026-10-24' }, { title: 'b', actionDate: '2026-10-30' }, { title: 'c', actionDate: '2026-10-25' }, { title: 'd', actionDate: '2026-10-26', showInList: false }]
    expect(upcoming(l, '2026-10-25', 5).map(x => x.title)).toEqual(['c', 'b'])
  })
  it('averages initiatives for the portfolio and never returns NaN', () => {
    expect(portfolio([{ plan: 80, actual: 60 }, { plan: 40, actual: 40 }])).toEqual({ plan: 60, actual: 50, spi: 50 / 60 })
    expect(portfolio([])).toEqual({ plan: 0, actual: 0, spi: null })
  })
  it('matches people by name ignoring case and extra spaces', () => {
    expect(samePerson(' Erwin  Harry Saputra', 'erwin harry saputra')).toBe(true)
    expect(samePerson('Erwin', 'Erwin Harry Saputra')).toBe(true)
    expect(samePerson('Erly', 'Erwin Harry Saputra')).toBe(false)
    expect(samePerson('', 'Erwin')).toBe(false)
  })
  it('summarises outstanding activities by sub type', () => {
    const s = activityStats([{ subType: 'KPI', priority: 'high' }, { subType: 'Go-Live' }, { subType: 'KPI', status: 'done' }, { subType: 'Others', showInList: false }])
    expect(s).toMatchObject({ total: 2, kpi: 1, goLive: 1, highPriority: 1, nonKpi: 0 })
  })
})

describe('agenda mendatang (perbaikan: yang sudah selesai tidak muncul)', () => {
  const T = '2026-10-26'
  const acts = [
    { _id: 'a', title: 'Persiapan Koordinasi SSP BPD', actionDate: '2026-10-26', status: 'completed' },
    { _id: 'b', title: 'UAT Tokenisasi', actionDate: '2026-10-26', status: 'on_track' },
    { _id: 'c', title: 'Bootcamp', actionDate: '2026-10-27', status: 'Done' },
    { _id: 'd', title: 'Brainstorming iPro', actionDate: '2026-10-27', status: 'at_risk' },
    { _id: 'e', title: 'Workshop 3 hari', actionDate: '2026-10-24', actionDateEnd: '2026-10-28', status: 'on_track' },
    { _id: 'f', title: 'Kemarin', actionDate: '2026-10-25', status: 'on_track' },
    { _id: 'g', title: 'Disembunyikan', actionDate: '2026-10-29', status: 'on_track', showInList: false },
    { _id: 'h', title: 'Dibatalkan', actionDate: '2026-10-29', status: 'Cancelled' },
  ]
  it('tidak menampilkan agenda berstatus selesai / dibatalkan', () => {
    const ids = upcoming(acts, T, 10).map(a => a._id)
    expect(ids).not.toContain('a'); expect(ids).not.toContain('c'); expect(ids).not.toContain('h')
  })
  it('menampilkan agenda yang sedang berlangsung (mulai kemarin, selesai lusa) dan urut tanggal', () => {
    expect(upcoming(acts, T, 10).map(a => a._id)).toEqual(['e', 'b', 'd'])
  })
  it('status selesai dikenali walau penulisan berbeda', () => {
    for (const s of ['completed', 'Completed', 'COMPLETE', 'done', 'Selesai', 'finished', 'closed', 'cancelled', 'canceled', 'Batal', 'Dibatalkan']) expect(isFinished({ status: s })).toBe(true)
    for (const s of ['on_track', 'at_risk', 'delayed', 'In Progress', '']) expect(isFinished({ status: s })).toBe(false)
  })
})
