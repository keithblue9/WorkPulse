import { describe, it, expect } from 'vitest'
import { cleanEnhancement } from '@/lib/enhancementInput'

const base = { app: 'iVendor', title: 'Integrasi e-Sign', type: 'New', year: 2027, items: [{ t: 'API e-Sign', u: 5, f: 2, fl: 4, pb: 5 }] }

describe('cleanEnhancement', () => {
  it('accepts a valid new enhancement and fills defaults', () => {
    const r = cleanEnhancement(base, false)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data).toMatchObject({ app: 'iVendor', title: 'Integrasi e-Sign', type: 'New', year: 2027, stage: 1, items: [{ t: 'API e-Sign', u: 5, f: 2, fl: 4, pb: 5 }] })
  })
  it('requires app, a title of at least 3 characters and a year on create', () => {
    expect(cleanEnhancement({ ...base, app: '' }, false)).toMatchObject({ ok: false })
    expect(cleanEnhancement({ ...base, title: ' a ' }, false)).toMatchObject({ ok: false, error: expect.stringContaining('Judul') })
    expect(cleanEnhancement({ ...base, year: 1990 }, false)).toMatchObject({ ok: false })
  })
  it('rejects scores outside 0–5 and keeps empty scores as null', () => {
    expect(cleanEnhancement({ ...base, items: [{ t: 'x', u: 6, f: 1, fl: 1, pb: 1 }] }, false)).toMatchObject({ ok: false })
    const r = cleanEnhancement({ ...base, items: [{ t: 'x', u: '', f: null, fl: 2, pb: undefined }] }, false)
    expect(r.ok && r.data.items![0]).toMatchObject({ u: null, f: null, fl: 2, pb: null })
  })
  it('validates stage 1–7, weights and phase dates', () => {
    expect(cleanEnhancement({ stage: 8 }, true)).toMatchObject({ ok: false })
    expect(cleanEnhancement({ weights: [10, 10, 10, 10] }, true)).toMatchObject({ ok: false })
    expect(cleanEnhancement({ weights: null }, true)).toMatchObject({ ok: true, data: { weights: null } })
    expect(cleanEnhancement({ phases: [{ key: 'UAT', start: '2027-05-01', end: '2027-04-01', pct: 0 }] }, true)).toMatchObject({ ok: false, error: expect.stringContaining('UAT') })
    expect(cleanEnhancement({ phases: [{ key: 'Hack', start: '', end: '', pct: 0 }] }, true)).toMatchObject({ ok: false })
    const r = cleanEnhancement({ phases: [{ key: 'UAT', start: '2027-04-01', end: '2027-04-30', pct: 140 }] }, true)
    expect(r.ok && r.data.phases).toEqual([{ key: 'UAT', start: '2027-04-01', end: '2027-04-30', pct: 100 }])
  })
  it('only passes known fields on update (no _id, createdBy, prio…)', () => {
    const r = cleanEnhancement({ _id: 'x', createdBy: 'me', prio: 1, notes: 'ok', stage: 3, $where: '1' } as any, true)
    expect(r).toEqual({ ok: true, data: { notes: 'ok', stage: 3 } })
  })
  it('trims long text and caps the number of items', () => {
    const r = cleanEnhancement({ ...base, title: 'x'.repeat(500), items: Array(150).fill(base.items[0]) }, false)
    expect(r.ok && r.data.title!.length).toBe(300)
    expect(r.ok && r.data.items!.length).toBe(100)
  })
})
