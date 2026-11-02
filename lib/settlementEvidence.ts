// Dokumen "Rincian Kuitansi/Nota Settlement Cash Card" (evidence per transaksi).
// Modul ini MURNI (tanpa DOM) supaya logika urutan, format, dan tata letak bisa diuji.
// Dipakai bersama oleh export PDF (jsPDF) dan Word (docx) agar hasil keduanya identik.

export const ID_MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']

/** Kertas A4 landscape, satuan mm. */
export const PAGE = { w: 297, h: 210 }
/** Margin halaman (mm). */
export const MARGIN = { top: 22, bottom: 20, left: 15, right: 15 }
/** Lebar kolom tabel (mm) — urutan: No, Ket. Transaksi, Tanggal, Jumlah, Evidence. */
export const COLS = { no: 11, ket: 40, tgl: 24, jml: 26 }
export const TABLE_W = PAGE.w - MARGIN.left - MARGIN.right
export const EVIDENCE_W = TABLE_W - COLS.no - COLS.ket - COLS.tgl - COLS.jml
export const HEADER_H = 6.5
/** Tinggi baris transaksi = sisa tinggi halaman (1 transaksi = 1 halaman, seperti template). */
export const ROW_H = PAGE.h - MARGIN.top - MARGIN.bottom
/** Padding di dalam sel evidence (mm) dan jarak antar gambar. */
export const CELL_PAD = 2.5
export const IMG_GAP = 2.5
/** Sisi terpendek gambar tidak boleh di bawah ini (mm); kalau tidak → sebagian pindah ke halaman lanjutan. */
export const MIN_IMG_H = 30
/** Tinggi maksimal satu baris gambar supaya satu gambar tunggal tidak raksasa. */
export const MAX_ROW_H = 95

// Urutan evidence mengikuti template: undangan (Calmeet) → dokumentasi → invoice/nota → bukti transfer → lainnya.
const SLOT_ORDER: Record<string, number> = { calmeet: 0, dokumentasi: 1, invoice: 2, buktitf: 3, bukti: 4 }

const CATEGORY_LABEL: Record<string, string> = {
  'OE-07': 'Konsumsi Meeting',
  'OE-01': 'Transportasi',
  'OE-02': 'ATK/Pengiriman Dokumen',
  'OE-08': 'Relationship',
  'NOE-07': 'Fit Up/Olahraga',
}

export function periodDateOf(r: any): Date | null {
  const raw = r?.billDate || r?.submittedAt || r?.createdAt
  if (!raw) return null
  // billDate disimpan 'YYYY-MM-DD' → parse sebagai tanggal lokal (hindari geser hari karena UTC)
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(raw))
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(raw)
  return isNaN(d.getTime()) ? null : d
}

/** 1577700 → "Rp 1,577,700" (format sama dengan template). */
export function formatRupiah(n: number): string {
  const v = Math.round(Number(n) || 0)
  const s = Math.abs(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${v < 0 ? '-' : ''}Rp ${s}`
}

/** Date → "01 September 2026". */
export function formatTanggal(d: Date | null): string {
  if (!d) return '-'
  return `${String(d.getDate()).padStart(2, '0')} ${ID_MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

/** Baris 1 kolom Ket. Transaksi: "Konsumsi Meeting - Boost". */
export function transactionLabel(r: any): string {
  const base = CATEGORY_LABEL[r?.category] || (r?.category ? String(r.category) : 'Transaksi')
  const toko = String(r?.tokoPenjual || '').trim()
  return toko ? `${base} - ${toko}` : base
}

export function docSortKey(d: any): number {
  const k = SLOT_ORDER[String(d?.slot || 'bukti')]
  return k === undefined ? 5 : k
}

export function sortDocs<T>(docs: T[]): T[] {
  return docs.map((d, i) => ({ d, i })).sort((a, b) => docSortKey(a.d) - docSortKey(b.d) || a.i - b.i).map(x => x.d)
}

export type EvidenceItem = {
  _id: string
  no: number
  label: string
  keperluan: string
  tanggal: string
  jumlah: string
  amount: number
}

/**
 * Pilih & urutkan item untuk dokumen settlement:
 * hanya Cash Card, status verified, pada bulan/tahun periode, urut tanggal bukti (lalu judul).
 */
export function selectSettlementItems(items: any[], month: number, year: number): any[] {
  return (items || []).filter(r => {
    if (!r?.isCashCard || r.status !== 'verified') return false
    const d = periodDateOf(r)
    return !!d && d.getMonth() === month && d.getFullYear() === year
  }).sort((a, b) => (periodDateOf(a)!.getTime() - periodDateOf(b)!.getTime()) || String(a.title || '').localeCompare(String(b.title || '')))
}

export function toEvidenceItems(items: any[]): EvidenceItem[] {
  return items.map((r, i) => ({
    _id: String(r._id),
    no: i + 1,
    label: transactionLabel(r),
    keperluan: String(r.title || '-').trim() || '-',
    tanggal: formatTanggal(periodDateOf(r)),
    jumlah: formatRupiah(r.amount),
    amount: Math.round(Number(r.amount) || 0),
  }))
}

export function documentTitle(month: number, year: number): [string, string] {
  return [
    'RINCIAN KUITANSI/NOTA SETTLEMENT CASH CARD',
    `REALISASI BIAYA OPERATIONAL FUNGSI BPD PROCUREMENT PERIODE ${ID_MONTHS[month].toUpperCase()} ${year}`,
  ]
}

export function fileBaseName(month: number, year: number): string {
  return `Evidence_Settlement_${ID_MONTHS[month]}_${year}_All_Transaksi`
}

// ---------------- Tata letak gambar ----------------

export type Img = { w: number; h: number }            // ukuran asli (px) — hanya rasio yang dipakai
export type Placed = { index: number; x: number; y: number; w: number; h: number } // mm, relatif ke pojok kiri-atas area
export type LayoutRow = { y: number; h: number; items: Placed[] }
export type Layout = { rows: LayoutRow[]; height: number; minH: number } // minH = sisi terpendek gambar terkecil (mm)

function aspect(i: Img): number {
  const a = i.w > 0 && i.h > 0 ? i.w / i.h : 1
  return Math.min(Math.max(a, 0.2), 6) // jaga dari gambar super panjang/pipih
}

/** Bagi gambar berurutan menjadi `r` baris dengan jumlah rasio yang seimbang. */
function partition(asp: number[], r: number): number[][] {
  const total = asp.reduce((s, a) => s + a, 0)
  const rows: number[][] = []
  let cur: number[] = [], acc = 0, done = 0
  asp.forEach((a, i) => {
    cur.push(i); acc += a
    const remainingRows = r - rows.length - 1
    const remainingImgs = asp.length - i - 1
    const target = (total - done) / (r - rows.length)
    if (remainingRows > 0 && (acc >= target * 0.92 || remainingImgs === remainingRows)) {
      rows.push(cur); done += acc; cur = []; acc = 0
    }
  })
  if (cur.length) rows.push(cur)
  return rows
}

function buildLayout(asp: number[], rowsIdx: number[][], boxW: number, boxH: number, gap: number): Layout {
  let heights = rowsIdx.map(row => {
    const sum = row.reduce((s, i) => s + asp[i], 0)
    return Math.min((boxW - gap * (row.length - 1)) / sum, MAX_ROW_H)
  })
  const total = heights.reduce((s, h) => s + h, 0) + gap * (rowsIdx.length - 1)
  if (total > boxH) {
    const k = (boxH - gap * (rowsIdx.length - 1)) / heights.reduce((s, h) => s + h, 0)
    heights = heights.map(h => h * k)
  }
  let y = 0
  const rows: LayoutRow[] = rowsIdx.map((row, ri) => {
    const h = heights[ri]
    let x = 0
    const items = row.map(i => { const w = asp[i] * h; const p = { index: i, x, y, w, h }; x += w + gap; return p })
    const out = { y, h, items }
    y += h + gap
    return out
  })
  const height = Math.max(0, y - gap)
  const minH = Math.min(...rows.flatMap(r => r.items.map(p => Math.min(p.w, p.h))))
  return { rows, height, minH }
}

/** Tata letak terbaik (luas gambar terbesar) untuk sekumpulan gambar dalam kotak boxW×boxH (mm). */
export function layoutImages(imgs: Img[], boxW: number, boxH: number, gap = IMG_GAP): Layout {
  if (!imgs.length) return { rows: [], height: 0, minH: 0 }
  const asp = imgs.map(aspect)
  let best: Layout | null = null, bestArea = -1
  for (let r = 1; r <= imgs.length; r++) {
    const lay = buildLayout(asp, partition(asp, r), boxW, boxH, gap)
    const area = lay.rows.reduce((s, row) => s + row.items.reduce((t, p) => t + p.w * p.h, 0), 0)
    if (area > bestArea + 1e-6) { best = lay; bestArea = area }
  }
  return best!
}

/**
 * Bagi gambar satu transaksi ke beberapa halaman bila terlalu banyak
 * (gambar jadi lebih kecil dari MIN_IMG_H). Mengembalikan daftar kelompok indeks per halaman.
 */
export function paginateImages(imgs: Img[], firstBoxH: number, nextBoxH: number, boxW: number): number[][] {
  const pages: number[][] = []
  let start = 0
  while (start < imgs.length) {
    const boxH = pages.length === 0 ? firstBoxH : nextBoxH
    let take = imgs.length - start
    while (take > 1) {
      const lay = layoutImages(imgs.slice(start, start + take), boxW, boxH)
      if (lay.minH >= MIN_IMG_H) break
      take--
    }
    pages.push(Array.from({ length: take }, (_, k) => start + k))
    start += take
  }
  return pages.length ? pages : [[]]
}

/** Ringkas satu halaman dokumen (dipakai renderer PDF & Word). */
export type PagePlan = {
  item: EvidenceItem
  withHeader: boolean
  continued: boolean   // halaman lanjutan transaksi yang sama
  images: number[]     // indeks gambar (dalam daftar gambar item) di halaman ini
  layout: Layout
}

export function evidenceBox(withHeader: boolean): { w: number; h: number } {
  return { w: EVIDENCE_W - CELL_PAD * 2, h: ROW_H - (withHeader ? HEADER_H : 0) - CELL_PAD * 2 }
}

/** Rencana halaman lengkap. Header tabel hanya di halaman tabel pertama (sesuai template). */
export function planPages(items: EvidenceItem[], imagesPerItem: Img[][]): PagePlan[] {
  const plans: PagePlan[] = []
  items.forEach((item, idx) => {
    const imgs = imagesPerItem[idx] || []
    const firstHeader = plans.length === 0
    const first = evidenceBox(firstHeader), next = evidenceBox(false)
    const groups = paginateImages(imgs, first.h, next.h, first.w)
    groups.forEach((g, gi) => {
      const withHeader = firstHeader && gi === 0
      const box = evidenceBox(withHeader)
      plans.push({ item, withHeader, continued: gi > 0, images: g, layout: layoutImages(g.map(i => imgs[i]), box.w, box.h) })
    })
  })
  return plans
}
