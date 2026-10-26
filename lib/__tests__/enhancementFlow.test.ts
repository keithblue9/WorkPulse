import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { canCarry, carriedTo, carryPatch, cleanActs, initiativeToEnh, klasOf, reschedule, uncarryPatch, yearRole } from '@/lib/enhancementFlow'
import { enhActs, normWeights } from '@/lib/enhancement'
import { calc } from '@/lib/progress'

describe('klasifikasi', () => {
  it('SI tetap SI, lainnya (Non SI, Others, kosong) jadi Non-SI', () => {
    expect(klasOf({ klas: 'SI' })).toBe('SI')
    expect(klasOf({ urgency: 'S.I.' })).toBe('SI')
    for (const v of ['Non SI', 'Non-SI', 'Others', '', undefined, null, 'si x']) expect(klasOf({ urgency: v as any })).toBe('Non-SI')
  })
  it('klas menang atas urgency lama', () => expect(klasOf({ klas: 'Non-SI', urgency: 'SI' })).toBe('Non-SI'))
})

describe('migrasi initiative → enhancement', () => {
  const ini = { _id: 'abc', app: 'kims', urgency: 'Others', title: ' Aplikasi KIMAP ', year: 2026, pic: 'Dwi, Jaoza', hiddenGuest: true, progressNotes: 'catatan',
    phases: [{ name: 'Design', start: '2026-01-01', end: '2026-03-31', weight: 40, pct: 100 }, { name: 'Development', start: '2026-04-01', end: '2026-12-31', weight: 60, pct: 50 }] }
  it('membawa judul, app, PIC, catatan, tamu, dan aktivitas', () => {
    const e = initiativeToEnh(ini, 2026)
    expect(e).toMatchObject({ app: 'KIMs', title: 'Aplikasi KIMAP', year: 2026, klas: 'Non-SI', hiddenGuest: true, notes: 'catatan', fromInitiative: 'abc', type: 'New' })
    expect(e.pic).toEqual(['Dwi', 'Jaoza'])
    expect(e.acts.map(a => [a.name, a.w, a.pct])).toEqual([['Design', 40, 100], ['Development', 60, 50]])
  })
  it('progress hasil pindahan sama dengan progress initiative semula', () => {
    const e = initiativeToEnh(ini, 2026)
    const t = Date.UTC(2026, 9, 26)
    const c = calc(enhActs(e, normWeights(null)), t)
    expect(c.actual).toBeCloseTo(0.4 * 100 + 0.6 * 50, 5)
  })
  it('app tak dikenal → Others; tahun kosong → tahun berjalan', () => {
    const e = initiativeToEnh({ _id: 'x', app: 'SAP', title: 'Abc' }, 2027)
    expect(e.app).toBe('Others'); expect(e.year).toBe(2027)
  })
})

describe('Carry Over (pindah tahun)', () => {
  const base = { _id: '1', year: 2026, type: 'New', code: 'B-IV-03', acts: [{ name: 'Dev', start: '2026-09-01', end: '2026-12-15', w: 0, pct: 40 }] }
  it('hanya ke tahun setelahnya', () => {
    expect(canCarry(base, 2027).ok).toBe(true)
    expect(canCarry(base, 2026).ok).toBe(false)
    expect(canCarry(base, 2025).ok).toBe(false)
    expect(canCarry(base, NaN).ok).toBe(false)
  })
  it('pindah ke 2027, jenis Carry Over, riwayat tersimpan, kode baru', () => {
    const s: any = carryPatch(base, 2027, { by: 'erwin', code: 'B-IV-01' })
    expect(s).toMatchObject({ year: 2027, type: 'Carry Over', carriedFrom: 2026, code: 'B-IV-01' })
    expect(s.carryLog).toEqual([expect.objectContaining({ from: 2026, to: 2027, prevType: 'New', prevCode: 'B-IV-03', by: 'erwin' })])
  })
  it('tetap terlihat di tahun asal sebagai "dibawa", dan di tahun tujuan sebagai miliknya', () => {
    const moved = { ...base, ...(carryPatch(base, 2027) as any) }
    expect(yearRole(moved, moved.acts, 2027)).toBe('own')
    expect(yearRole(moved, moved.acts, 2026)).toBe('carried')
    expect(carriedTo(moved, 2026)).toBe(2027)
    expect(yearRole(moved, moved.acts, 2025)).toBeNull()
  })
  it('bisa berlanjut 2026 → 2027 → 2028 dan dibatalkan bertahap', () => {
    const a = { ...base, ...(carryPatch(base, 2027, { code: 'B-IV-01' }) as any) }
    const b = { ...a, ...(carryPatch(a, 2028, { code: 'B-IV-09' }) as any) }
    expect(b).toMatchObject({ year: 2028, carriedFrom: 2026 })
    expect(yearRole(b, b.acts, 2026)).toBe('carried')
    expect(yearRole(b, b.acts, 2027)).toBe('carried')
    const u1: any = uncarryPatch(b); expect(u1.ok).toBe(true)
    const c = { ...b, ...u1.set }
    expect(c).toMatchObject({ year: 2027, type: 'Carry Over', code: 'B-IV-01' }); expect(u1.unset).toEqual([])
    const u2: any = uncarryPatch(c); const d = { ...c, ...u2.set }
    expect(d).toMatchObject({ year: 2026, type: 'New', code: 'B-IV-03', carryLog: [] }); expect(u2.unset).toEqual(['carriedFrom'])
    expect(uncarryPatch(d).ok).toBe(false)
  })
  it('jadwal ulang hanya menggeser aktivitas yang belum selesai & sudah lewat tahun', () => {
    const acts = [
      { name: 'A', start: '2026-02-01', end: '2026-02-28', pct: 100 },
      { name: 'B', start: '2026-11-01', end: '2026-11-30', pct: 20 },
      { name: 'C', start: '2026-12-15', end: '2027-02-15', pct: 0 },
      { name: 'D', start: '', end: '', pct: 0 },
    ]
    const r = reschedule(acts, 2027)
    expect(r[0]).toEqual(acts[0])
    expect(r[1]).toMatchObject({ start: '2027-01-01', end: '2027-01-30' })
    expect(r[2]).toEqual(acts[2])
    expect(r[3]).toEqual(acts[3])
  })
  it('properti: carry lalu batalkan selalu kembali ke tahun, jenis & kode semula', () => {
    fc.assert(fc.property(fc.integer({ min: 2020, max: 2090 }), fc.integer({ min: 1, max: 10 }), fc.constantFrom('New', 'Carry Over'), fc.string({ maxLength: 8 }), (y, k, type, code) => {
      const e = { year: y, type, code, carryLog: [] }
      const moved = { ...e, ...(carryPatch(e, y + k, { code: 'X' }) as any) }
      const u: any = uncarryPatch(moved)
      const back = { ...moved, ...u.set }
      return u.ok && back.year === y && back.type === type && back.code === (code || 'X') && back.carryLog.length === 0
    }))
  })
})

describe('validasi aktivitas kustom', () => {
  it('menolak nama kosong, tanggal terbalik, bobot di luar 0–100', () => {
    expect(cleanActs([{ name: '' }]).ok).toBe(false)
    expect(cleanActs([{ name: 'a', start: '2026-02-01', end: '2026-01-01' }]).ok).toBe(false)
    expect(cleanActs([{ name: 'a', start: '2026-02-01' }]).ok).toBe(false)
    expect(cleanActs([{ name: 'a', w: 120 }]).ok).toBe(false)
    expect(cleanActs([{ name: 'a', pct: -1 }]).ok).toBe(false)
    expect(cleanActs('x').ok).toBe(false)
  })
  it('menerima aktivitas valid & memotong teks panjang', () => {
    const r: any = cleanActs([{ name: 'x'.repeat(300), start: '2026-01-01', end: '2026-01-31', w: '30', pct: 55, notes: '<b>a</b>' }])
    expect(r.ok).toBe(true); expect(r.acts[0].name.length).toBe(120); expect(r.acts[0].w).toBe(30)
  })
  it('properti: input acak tidak pernah melempar error', () => {
    fc.assert(fc.property(fc.anything(), v => { const r = cleanActs(v); return typeof r.ok === 'boolean' }))
  })
})
