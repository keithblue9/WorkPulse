// Helper murni feed Team Notes: kelompok per bulan (terbaru dulu) & hitungan per kategori.
import { sortNotes, type NoteLike } from './notesView'

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

function monthKey(n: NoteLike): string {
  const m = /^(\d{4})-(\d{2})/.exec(String(n.date || ''))
  if (m) return `${m[1]}-${m[2]}`
  const c = n.createdAt ? new Date(n.createdAt) : null
  return c && !Number.isNaN(c.getTime()) ? `${c.getFullYear()}-${String(c.getMonth() + 1).padStart(2, '0')}` : '0000-00'
}

export function monthGroups<T extends NoteLike>(list: T[]): { key: string; label: string; items: T[] }[] {
  const by = new Map<string, T[]>()
  for (const n of list) { const k = monthKey(n); by.set(k, [...(by.get(k) || []), n]) }
  return Array.from(by.keys()).sort((a, b) => b.localeCompare(a)).map(k => {
    const [y, m] = k.split('-').map(Number)
    return { key: k, label: k === '0000-00' ? 'Tanpa tanggal' : `${BULAN[m - 1]} ${y}`, items: sortNotes(by.get(k)!) }
  })
}

export function catCounts(list: NoteLike[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const n of list) { const k = String(n.category || ''); out[k] = (out[k] || 0) + 1 }
  return out
}
