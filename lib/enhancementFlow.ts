// Alur Enhancement terpadu (Progress Project digabung ke Enhancement). Fungsi murni, tanpa DB.
// - Klasifikasi per tahun: SI (Strategic Initiative, masuk KPI) atau Non-SI.
// - Aktivitas kustom (acts): bila diisi, progress dihitung dari aktivitas ini, bukan template 5 aktivitas.
// - Carry Over = pindah tahun. Riwayat disimpan di carryLog sehingga bisa dibatalkan & tetap
//   terlihat di tahun asal sebagai "dibawa ke {tahun}".
import { actsFromPhases, dUTC, inYear, isoDay, type Act } from '@/lib/progress'
import { ENH_APPS, TPL, type EnhPhase } from '@/lib/enhancement'
import { picArray } from '@/lib/defaults'

export const KLAS = ['SI', 'Non-SI'] as const
export type Klas = (typeof KLAS)[number]
export const KLAS_LABEL: Record<Klas, string> = { SI: 'Strategic Initiative (KPI)', 'Non-SI': 'Non-SI (bukan KPI)' }

/** 'SI', 'si', 'S.I.' → SI. Selain itu (Non SI, Others, kosong) → Non-SI. */
export function klasOf(e: { klas?: unknown; urgency?: unknown } | null | undefined): Klas {
  const raw = String(e?.klas ?? e?.urgency ?? '').replace(/[^a-z]/gi, '').toUpperCase()
  return raw === 'SI' ? 'SI' : 'Non-SI'
}

export type CustomAct = { name: string; start: string; end: string; w: number; pct: number; notes?: string }
export const isCustom = (e: { acts?: unknown } | null | undefined) => Array.isArray(e?.acts) && (e!.acts as unknown[]).length > 0

export type CarryEntry = { from: number; to: number; at?: string | Date; by?: string; prevType?: string; prevCode?: string }
const log = (e: any): CarryEntry[] => (Array.isArray(e?.carryLog) ? e.carryLog : [])

/**
 * Hubungan enhancement dengan tahun `y`:
 * own = memang tahunnya · span = enhancement tahun sebelumnya yang jadwalnya masih berjalan di `y`
 * carried = sudah dibawa (Carry Over) dari `y` ke tahun berikutnya · null = tidak tampil.
 */
export function yearRole(e: { year?: number; carryLog?: CarryEntry[] }, acts: Pick<Act, 'start' | 'end'>[], y: number): 'own' | 'span' | 'carried' | null {
  const own = Number(e?.year)
  if (own === y) return 'own'
  if (own > y && log(e).some(c => Number(c.from) === y)) return 'carried'
  if (own < y && inYear(acts, y)) return 'span'
  return null
}

/** Tujuan Carry Over terakhir dari tahun `y` (untuk label "dibawa ke 2027"). */
export function carriedTo(e: { carryLog?: CarryEntry[] }, y: number): number | null {
  const hit = log(e).filter(c => Number(c.from) === y).pop()
  return hit ? Number(hit.to) : null
}

export const isDone = (actual: number) => actual >= 99.5

export type CarryCheck = { ok: true } | { ok: false; error: string }
export function canCarry(e: { year?: number }, to: number): CarryCheck {
  const from = Number(e?.year)
  if (!Number.isInteger(to) || to < 2020 || to > 2100) return { ok: false, error: 'Tahun tujuan tidak valid' }
  if (!Number.isInteger(from)) return { ok: false, error: 'Tahun enhancement tidak valid' }
  if (to <= from) return { ok: false, error: `Carry Over harus ke tahun setelah ${from}` }
  return { ok: true }
}

/** Geser aktivitas yang belum selesai & berakhir sebelum tahun `to` agar mulai 1 Januari `to` (durasi tetap). */
export function reschedule<T extends { start?: string; end?: string; pct?: number }>(acts: T[], to: number): T[] {
  const jan1 = Date.UTC(to, 0, 1)
  return acts.map(a => {
    const s = dUTC(a.start || ''), e = dUTC(a.end || '')
    if ((Number(a.pct) || 0) >= 100 || !Number.isFinite(s) || !Number.isFinite(e) || e >= jan1) return a
    const shift = jan1 - Math.min(s, jan1)
    return { ...a, start: isoDay(s + shift), end: isoDay(Math.max(e + shift, jan1)) }
  })
}

/** Perubahan dokumen untuk Carry Over ke tahun `to`. */
export function carryPatch(e: any, to: number, opt: { by?: string; at?: Date; code?: string; reschedule?: boolean } = {}): Record<string, unknown> {
  const entry: CarryEntry = { from: Number(e.year), to, at: opt.at || new Date(), by: opt.by || '', prevType: e.type || 'New', prevCode: e.code || '' }
  const set: Record<string, unknown> = {
    year: to, type: 'Carry Over',
    carriedFrom: Number.isInteger(e.carriedFrom) ? e.carriedFrom : Number(e.year),
    carryLog: [...log(e), entry],
  }
  if (opt.code) set.code = opt.code
  if (opt.reschedule) {
    if (isCustom(e)) set.acts = reschedule(e.acts, to)
    else if (Array.isArray(e.phases) && e.phases.length) set.phases = reschedule(e.phases as EnhPhase[], to)
  }
  return set
}

/** Batalkan Carry Over terakhir (kembali ke tahun asal, jenis & kode semula). */
export function uncarryPatch(e: any): { ok: true; set: Record<string, unknown>; unset: string[] } | { ok: false; error: string } {
  const l = log(e), last = l[l.length - 1]
  if (!last) return { ok: false, error: 'Enhancement ini bukan hasil Carry Over' }
  if (Number(last.to) !== Number(e.year)) return { ok: false, error: 'Riwayat Carry Over tidak cocok dengan tahun sekarang' }
  const rest = l.slice(0, -1)
  const set: Record<string, unknown> = { year: Number(last.from), type: last.prevType || 'New', carryLog: rest }
  if (last.prevCode) set.code = last.prevCode
  return rest.length ? { ok: true, set, unset: [] } : { ok: true, set, unset: ['carriedFrom'] }
}

const APP_OF = (a: unknown) => ENH_APPS.find(x => x.toLowerCase() === String(a || '').trim().toLowerCase()) || 'Others'

/** Initiative (Progress Project) → dokumen Enhancement. Data initiative tidak diubah. */
export function initiativeToEnh(ini: any, nowYear: number) {
  const year = Number.isInteger(Number(ini?.year)) && Number(ini.year) > 2000 ? Number(ini.year) : nowYear
  const acts: CustomAct[] = actsFromPhases(ini?.phases || [], year).map(a => ({
    name: a.name, start: a.start || '', end: a.end || '', w: Number.isFinite(a.w) ? Math.round(a.w * 100) / 100 : 0,
    pct: Math.round((Number(a.pct) || 0) * 10) / 10, notes: a.notes || '',
  }))
  return {
    code: String(ini?.code || '').trim().slice(0, 20),
    app: APP_OF(ini?.app), year,
    title: String(ini?.title || 'Tanpa judul').trim().slice(0, 300),
    type: 'New', klas: klasOf({ urgency: ini?.urgency }),
    acts, items: [], stage: 1, pic: picArray(ini?.pic).flatMap(p => String(p).split(',')).map(p => p.trim()).filter(Boolean).slice(0, 20),
    notes: String(ini?.progressNotes || ''), hiddenGuest: !!ini?.hiddenGuest,
    fromInitiative: String(ini?._id || ''),
  }
}

/** Validasi aktivitas kustom dari klien. */
export function cleanActs(raw: unknown): { ok: true; acts: CustomAct[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) return { ok: false, error: 'Aktivitas tidak valid' }
  if (raw.length > 40) return { ok: false, error: 'Maksimal 40 aktivitas' }
  const out: CustomAct[] = []
  for (const [i, x] of raw.entries()) {
    const o = (x || {}) as Record<string, unknown>
    const name = typeof o.name === 'string' ? o.name.trim().slice(0, 120) : ''
    if (!name) return { ok: false, error: `Nama aktivitas ${i + 1} wajib diisi` }
    const start = typeof o.start === 'string' ? o.start.trim() : '', end = typeof o.end === 'string' ? o.end.trim() : ''
    if ((start && !Number.isFinite(dUTC(start))) || (end && !Number.isFinite(dUTC(end)))) return { ok: false, error: `Tanggal aktivitas ${i + 1} tidak valid` }
    if (!!start !== !!end) return { ok: false, error: `Isi tanggal mulai dan selesai aktivitas ${i + 1}` }
    if (start && dUTC(end) < dUTC(start)) return { ok: false, error: `Tanggal selesai aktivitas ${i + 1} sebelum tanggal mulai` }
    const num = (v: unknown) => (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '') ? Number(v) : 0)
    const w = num(o.w), pct = num(o.pct)
    if (!Number.isFinite(w) || w < 0 || w > 100) return { ok: false, error: `Bobot aktivitas ${i + 1} harus 0–100` }
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) return { ok: false, error: `% selesai aktivitas ${i + 1} harus 0–100` }
    const notes = typeof o.notes === 'string' ? o.notes.slice(0, 5000) : ''
    out.push({ name, start, end, w, pct, ...(notes ? { notes } : {}) })
  }
  return { ok: true, acts: out }
}

/** Template 5 aktivitas sebagai titik awal aktivitas kustom (saat beralih dari template). */
export function actsFromTemplate(acts: Act[]): CustomAct[] {
  return acts.map((a, i) => ({ name: a.name || TPL[i] || `Aktivitas ${i + 1}`, start: a.start || '', end: a.end || '', w: a.w, pct: Math.round(a.pct * 10) / 10 }))
}

