import { describe, it, expect } from 'vitest'
import ExcelJS from 'exceljs'
import { parseWorkbook } from '@/lib/enhancementImport'

function book() {
  const wb = new ExcelJS.Workbook()
  wb.addWorksheet('Dashboard').getCell('A1').value = 'Ringkasan'
  const s = wb.addWorksheet('BPDP - iVendor')
  s.getRow(1).values = ['No. ', 'New/Carry Over', 'Enhancement', 'Item', 'Impact', '', 'Effort Perubahan', '', 'Kategori']
  s.getRow(2).values = ['', '', '', '', 'User', 'Fullfiller', 'Flow Aplikasi', 'Proses Bisnis']
  s.getCell('P16').value = 'B-IV'
  s.getRow(3).values = [1, 'Carry Over', 'AI Pre-Review', 'Validasi otomatis', '5 - Sangat besar', '5 - Sangat besar', '2 - Cukup kecil', '1 - Sangat kecil']
  s.getRow(4).values = ['', '', '', '', 'Vendor terarah', 'Akurasi naik', 'Alur pre-review', 'Step validasi']
  s.getRow(5).values = [2, 'Carry Over', 'AI Pre-Review', 'Clarification', '5 - Sangat besar', '4 - Cukup besar', '3 - Cukup', '1 - Sangat kecil']
  s.getRow(6).values = ['', '', '', '', 'Efisien', '', '', '']
  s.getRow(7).values = [3, 'New', 'e-Sign', 'Integrasi e-Sign', 5, 2, 4, 5]
  s.getRow(9).values = [4, 'New', 'e-Sign', 'Skor rusak', '9 - Salah', '2 - Cukup kecil', '4 - Cukup besar', '5 - Sangat besar']
  s.getRow(11).values = [5, '', '', 'Baris lanjutan (judul digabung)', '0 - Tidak ada', '1 - Sangat kecil', '', '']
  s.getRow(13).values = [6, 'New', 'Judul tanpa item', '', '', '', '', '']
  s.getCell('I3').value = { formula: 'LET(x,1,x)', result: 'Quick Win' } as any
  const k = wb.addWorksheet('bpdp - KIMS')
  k.getRow(3).values = [1, 'New', { richText: [{ text: 'Rich ' }, { text: 'title' }] }, 'Item kims', '3 - Cukup', '3 - Cukup', '2 - Cukup kecil', '2 - Cukup kecil']
  // Seperti file asli: kolom A–D di-merge 2 baris (item + narasi).
  const op = wb.addWorksheet('BPDP - OnePro')
  op.getRow(3).values = [1, 'New', 'Redesign', 'Struktur info', '4 - Cukup besar', '1 - Sangat kecil', '3 - Cukup', '2 - Cukup kecil']
  op.getRow(4).values = ['', '', '', '', 'Lebih efektif', 'Lebih efektif', 'Effort EIT', 'Tahapan sourcing']
  op.getRow(5).values = [2, 'New', 'Redesign', 'Skor belum', 'TBC', 'TBC', 'TBC', 'TBC']
  op.getRow(6).values = ['', '', '', '', 'TBC', 'TBC', 'TBC', 'TBC']
  for (const c of ['A', 'B', 'C', 'D']) { op.mergeCells(`${c}3:${c}4`); op.mergeCells(`${c}5:${c}6`) }
  const ssp = wb.addWorksheet('SSP - iVendor')
  ssp.getRow(3).values = [1, 'New', 'Dari SSP', 'Item SSP', '5 - Sangat besar', '5 - Sangat besar', '1 - Sangat kecil', '1 - Sangat kecil']
  return wb
}

describe('parseWorkbook (format IT Requirement)', () => {
  const r = parseWorkbook(book())
  it('reads only "BPDP - …" sheets and lists the ignored ones', () => {
    expect(r.sheets).toEqual(['BPDP - iVendor', 'bpdp - KIMS', 'BPDP - OnePro'])
    expect(r.ignored).toEqual(['Dashboard', 'SSP - iVendor'])
    expect(r.groups.some(g => g.title === 'Dari SSP')).toBe(false)
  })
  it('groups items per enhancement with codes in order of first appearance', () => {
    const iv = r.groups.filter(g => g.app === 'iVendor')
    expect(iv.map(g => [g.code, g.title, g.type, g.items.length])).toEqual([
      ['B-IV-01', 'AI Pre-Review', 'Carry Over', 2],
      ['B-IV-02', 'e-Sign', 'New', 2],
    ])
  })
  it('parses "5 - Sangat besar" and numeric scores, and attaches the narration row', () => {
    const [a] = r.groups
    expect(a.items[0]).toMatchObject({ t: 'Validasi otomatis', u: 5, f: 5, fl: 2, pb: 1, du: 'Vendor terarah', df: 'Akurasi naik', dfl: 'Alur pre-review', dpb: 'Step validasi' })
    expect(a.items[1]).toMatchObject({ u: 5, f: 4, fl: 3, pb: 1, du: 'Efisien' })
    expect(r.groups[1].items[0]).toMatchObject({ t: 'Integrasi e-Sign', u: 5, f: 2, fl: 4, pb: 5 })
  })
  it('keeps a continuation row under the last title and empty scores as null', () => {
    expect(r.groups[1].items[1]).toMatchObject({ t: 'Baris lanjutan (judul digabung)', u: 0, f: 1, fl: null, pb: null })
  })
  it('skips rows with an invalid score and reports them once (not their narration row)', () => {
    expect(r.errors).toEqual(['BPDP - iVendor baris 9: skor "9 - Salah" harus 0–5', 'BPDP - OnePro baris 5: skor "TBC" harus 0–5'])
  })
  it('reads the narration row even when columns A–D are merged with the item row', () => {
    const g = r.groups.find(x => x.app === 'OnePro')!
    expect(g.items).toHaveLength(1)
    expect(g.items[0]).toMatchObject({ t: 'Struktur info', u: 4, f: 1, fl: 3, pb: 2, du: 'Lebih efektif', dpb: 'Tahapan sourcing' })
  })
  it('normalises the app name and reads rich text', () => {
    const k = r.groups.find(g => g.sheet === 'bpdp - KIMS')!
    expect(k).toMatchObject({ app: 'KIMs', title: 'Rich title', code: 'B-KM-01' })
  })
  it('returns nothing useful for a workbook without BPDP sheets', () => {
    const wb = new ExcelJS.Workbook(); wb.addWorksheet('Sheet1')
    expect(parseWorkbook(wb)).toMatchObject({ sheets: [], groups: [] })
  })
})
