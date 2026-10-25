// Pure helpers (no DB): PIC baru & daftar perubahan field. Dipakai notifikasi PIC dan Riwayat.
import { picArray } from '@/lib/defaults'
import { samePerson } from '@/lib/dashboard'

/** Nama PIC yang ada di `after` tapi belum ada di `before` (perbandingan nama longgar: "Erwin" = "Erwin Harry Saputra"). */
export function addedPics(before: unknown, after: unknown): string[] {
  const b = picArray(before).map(String), out: string[] = []
  for (const p of picArray(after).map(String)) {
    const n = p.trim()
    if (!n || b.some(x => samePerson(x, n)) || out.some(x => samePerson(x, n))) continue
    out.push(n)
  }
  return out
}

export type Change = { field: string; label: string; from: string; to: string }

const show = (v: unknown): string => {
  if (v == null || v === '') return '—'
  if (Array.isArray(v)) return v.length ? v.map(show).join(', ') : '—'
  if (typeof v === 'boolean') return v ? 'Ya' : 'Tidak'
  if (typeof v === 'number') return new Intl.NumberFormat('id-ID').format(v)
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === 'object') return '…'
  const s = String(v)
  // ISO datetime → tanggal saja
  return /^\d{4}-\d{2}-\d{2}T/.test(s) ? s.slice(0, 10) : s.length > 140 ? s.slice(0, 137) + '…' : s
}
const same = (a: unknown, b: unknown) => show(a) === show(b)

/** Perubahan pada field yang dilacak saja (field yang tidak dikirim di patch diabaikan). */
export function diffFields(before: Record<string, any> | null | undefined, patch: Record<string, any>, labels: Record<string, string>): Change[] {
  const out: Change[] = []
  for (const [field, label] of Object.entries(labels)) {
    if (!patch || !(field in patch)) continue
    const from = before?.[field], to = patch[field]
    if (same(from, to)) continue
    out.push({ field, label, from: show(from), to: show(to) })
  }
  return out
}

export const ACTIVITY_FIELDS: Record<string, string> = {
  title: 'Judul', status: 'Status', priority: 'Prioritas', pic: 'PIC', category: 'Kategori', subType: 'Sub tipe',
  actionDate: 'Tanggal', actionDateEnd: 'Tanggal selesai', description: 'Progress', nextPlan: 'Next plan', targetWeek: 'Target week',
  showInList: 'Tampil di daftar', hidden: 'Disembunyikan',
}
export const REIMBURSE_FIELDS: Record<string, string> = {
  status: 'Status', amount: 'Nominal', title: 'Keperluan', category: 'Kategori', billDate: 'Bill date', bank: 'Bank', noRekening: 'No. rekening',
  isCashCard: 'Cash Card', source: 'Sumber dana', hasBiayaAntarBank: 'Biaya antar bank', biayaAntarBank: 'Nominal biaya', totalTransfer: 'Total transfer',
  rejectReason: 'Alasan reject', reversalReason: 'Alasan pembatalan', clarifyNote: 'Klarifikasi', tokoPenjual: 'Toko',
}
