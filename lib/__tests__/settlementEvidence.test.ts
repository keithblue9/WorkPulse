import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import {
  formatRupiah, formatTanggal, transactionLabel, sortDocs, selectSettlementItems, toEvidenceItems,
  layoutImages, paginateImages, planPages, evidenceBox, periodDateOf, documentTitle, MIN_IMG_H, IMG_GAP,
} from '../settlementEvidence'

describe('format', () => {
  it('rupiah seperti template', () => {
    expect(formatRupiah(1577700)).toBe('Rp 1,577,700')
    expect(formatRupiah(46000)).toBe('Rp 46,000')
    expect(formatRupiah(0)).toBe('Rp 0')
    expect(formatRupiah(999)).toBe('Rp 999')
    expect(formatRupiah(1000)).toBe('Rp 1,000')
    expect(formatRupiah(274950.6)).toBe('Rp 274,951')
    expect(formatRupiah(NaN as any)).toBe('Rp 0')
  })
  it('tanggal "01 September 2026"', () => {
    expect(formatTanggal(new Date(2026, 8, 1))).toBe('01 September 2026')
    expect(formatTanggal(new Date(2026, 11, 31))).toBe('31 Desember 2026')
    expect(formatTanggal(null)).toBe('-')
  })
  it('billDate YYYY-MM-DD tidak bergeser hari', () => {
    const d = periodDateOf({ billDate: '2026-09-30' })!
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 8, 30])
  })
  it('judul memakai periode bulan', () => {
    expect(documentTitle(8, 2026)[1]).toBe('REALISASI BIAYA OPERATIONAL FUNGSI BPD PROCUREMENT PERIODE SEPTEMBER 2026')
  })
  it('label transaksi', () => {
    expect(transactionLabel({ category: 'OE-07', tokoPenjual: 'Boost' })).toBe('Konsumsi Meeting - Boost')
    expect(transactionLabel({ category: 'OE-07', tokoPenjual: '  ' })).toBe('Konsumsi Meeting')
    expect(transactionLabel({ category: 'OE-01' })).toBe('Transportasi')
    expect(transactionLabel({ category: 'XYZ' })).toBe('XYZ')
    expect(transactionLabel({})).toBe('Transaksi')
  })
})

describe('urutan evidence', () => {
  it('calmeet → dokumentasi → invoice → bukti TF → lainnya, stabil', () => {
    const docs = [{ slot: 'buktitf', n: 1 }, { slot: 'invoice', n: 2 }, { n: 3 }, { slot: 'calmeet', n: 4 }, { slot: 'dokumentasi', n: 5 }, { slot: 'invoice', n: 6 }]
    expect(sortDocs(docs).map(d => d.n)).toEqual([4, 5, 2, 6, 1, 3])
  })
})

describe('pemilihan item', () => {
  const base = { amount: 1000, title: 't' }
  const items = [
    { ...base, _id: 'a', isCashCard: true, status: 'verified', billDate: '2026-09-05' },
    { ...base, _id: 'b', isCashCard: true, status: 'done', billDate: '2026-09-01' },       // belum verified
    { ...base, _id: 'c', isCashCard: false, status: 'verified', billDate: '2026-09-02' },  // petty cash
    { ...base, _id: 'd', isCashCard: true, status: 'verified', billDate: '2026-10-01' },   // beda bulan
    { ...base, _id: 'e', isCashCard: true, status: 'verified', billDate: '2026-09-01' },
    { ...base, _id: 'f', isCashCard: true, status: 'verified' },                            // tanpa tanggal
    { ...base, _id: 'g', isCashCard: true, status: 'verified', billDate: '2025-09-03' },   // beda tahun
  ]
  it('hanya Cash Card verified di periode, urut tanggal', () => {
    expect(selectSettlementItems(items, 8, 2026).map(r => r._id)).toEqual(['e', 'a'])
  })
  it('nomor urut & total konsisten', () => {
    const ev = toEvidenceItems(selectSettlementItems(items, 8, 2026))
    expect(ev.map(e => e.no)).toEqual([1, 2])
    expect(ev[0].tanggal).toBe('01 September 2026')
  })
  it('properti: hasil selalu subset valid & terurut', () => {
    fc.assert(fc.property(fc.array(fc.record({
      _id: fc.uuid(), isCashCard: fc.boolean(), status: fc.constantFrom('verified', 'done', 'paid', 'clarification'),
      billDate: fc.date({ min: new Date(2025, 0, 1), max: new Date(2027, 11, 31) }).map(d => d.toISOString().slice(0, 10)),
      amount: fc.integer({ min: 0, max: 1e8 }), title: fc.string(),
    }), { maxLength: 60 }), fc.integer({ min: 0, max: 11 }), fc.constantFrom(2025, 2026, 2027), (arr, m, y) => {
      const out = selectSettlementItems(arr, m, y)
      out.forEach(r => { expect(r.isCashCard).toBe(true); expect(r.status).toBe('verified'); const d = periodDateOf(r)!; expect(d.getMonth()).toBe(m); expect(d.getFullYear()).toBe(y) })
      for (let i = 1; i < out.length; i++) expect(periodDateOf(out[i])!.getTime()).toBeGreaterThanOrEqual(periodDateOf(out[i - 1])!.getTime())
      const expected = arr.filter(r => r.isCashCard && r.status === 'verified' && periodDateOf(r)!.getMonth() === m && periodDateOf(r)!.getFullYear() === y).length
      expect(out.length).toBe(expected)
    }), { numRuns: 300 })
  })
})

describe('tata letak gambar', () => {
  const imgArb = fc.record({ w: fc.integer({ min: 50, max: 4000 }), h: fc.integer({ min: 50, max: 4000 }) })
  it('properti: semua gambar muat dalam kotak, tidak tumpang tindih, rasio terjaga', () => {
    fc.assert(fc.property(fc.array(imgArb, { minLength: 1, maxLength: 12 }), fc.integer({ min: 80, max: 200 }), fc.integer({ min: 60, max: 170 }), (imgs, W, H) => {
      const lay = layoutImages(imgs, W, H)
      const placed = lay.rows.flatMap(r => r.items)
      expect(placed.map(p => p.index).sort((a, b) => a - b)).toEqual(imgs.map((_, i) => i))
      placed.forEach(p => {
        expect(p.x).toBeGreaterThanOrEqual(-1e-6); expect(p.y).toBeGreaterThanOrEqual(-1e-6)
        expect(p.x + p.w).toBeLessThanOrEqual(W + 1e-6); expect(p.y + p.h).toBeLessThanOrEqual(H + 1e-6)
      })
      lay.rows.forEach(r => r.items.forEach((p, i) => { if (i) { const q = r.items[i - 1]; expect(p.x).toBeGreaterThanOrEqual(q.x + q.w + IMG_GAP - 1e-6) } }))
      for (let i = 1; i < lay.rows.length; i++) expect(lay.rows[i].y).toBeGreaterThanOrEqual(lay.rows[i - 1].y + lay.rows[i - 1].h + IMG_GAP - 1e-6)
    }), { numRuns: 500 })
  })
  it('properti: paginasi mencakup semua gambar tepat sekali & menjaga ukuran minimum', () => {
    const box = evidenceBox(false)
    fc.assert(fc.property(fc.array(imgArb, { minLength: 0, maxLength: 25 }), imgs => {
      const pages = paginateImages(imgs, box.h, box.h, box.w)
      expect(pages.flat()).toEqual(imgs.map((_, i) => i))
      pages.forEach(g => { if (g.length > 1) expect(layoutImages(g.map(i => imgs[i]), box.w, box.h).minH).toBeGreaterThanOrEqual(MIN_IMG_H - 1e-6) })
    }), { numRuns: 300 })
  })
  it('header hanya di halaman pertama; transaksi tanpa gambar tetap 1 halaman', () => {
    const items = toEvidenceItems([{ _id: '1', title: 'A', amount: 1, billDate: '2026-09-01' }, { _id: '2', title: 'B', amount: 2, billDate: '2026-09-02' }])
    const plans = planPages(items, [[{ w: 800, h: 600 }], []])
    expect(plans.map(p => p.withHeader)).toEqual([true, false])
    expect(plans[1].images).toEqual([])
  })
  it('banyak gambar → halaman lanjutan bertanda continued', () => {
    const items = toEvidenceItems([{ _id: '1', title: 'A', amount: 1, billDate: '2026-09-01' }])
    const imgs = Array.from({ length: 24 }, () => ({ w: 600, h: 1200 }))
    const plans = planPages(items, [imgs])
    expect(plans.length).toBeGreaterThan(1)
    expect(plans.slice(1).every(p => p.continued && !p.withHeader)).toBe(true)
    expect(plans.flatMap(p => p.images)).toEqual(imgs.map((_, i) => i))
  })
})
