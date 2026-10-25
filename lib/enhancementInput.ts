// Whitelist + validation for enhancement writes (POST/PATCH and Excel import). Pure.
import { dUTC } from '@/lib/progress'
import { ENH_APPS, ENH_TYPES, TPL, type EnhItem, type EnhPhase } from '@/lib/enhancement'

export type EnhInput = {
  app?: string; code?: string; title?: string; type?: string; initiator?: string; year?: number
  items?: EnhItem[]; stage?: number; weights?: number[] | null; phases?: EnhPhase[]
  pic?: string[]; notes?: string
}
type Result = { ok: true; data: EnhInput } | { ok: false; error: string }

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const MAX_ITEMS = 100

function score(v: unknown): number | null | 'bad' {
  if (v === '' || v == null) return null
  // Hanya angka atau teks angka; [] / true / {} tidak boleh lolos sebagai skor (Number([]) === 0).
  if (typeof v !== 'number' && !(typeof v === 'string' && /^\s*\d+\s*$/.test(v))) return 'bad'
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isInteger(n) && n >= 0 && n <= 5 ? n : 'bad'
}

export function cleanEnhancement(body: Record<string, unknown>, partial: boolean): Result {
  const b = body || {}
  const out: EnhInput = {}
  const has = (k: string) => Object.prototype.hasOwnProperty.call(b, k)

  if (has('app') || !partial) {
    const app = str(b.app, 40)
    if (!app) return { ok: false, error: 'Pilih aplikasi' }
    out.app = ENH_APPS.find(a => a.toLowerCase() === app.toLowerCase()) || app
  }
  if (has('title') || !partial) {
    const t = str(b.title, 300)
    if (t.length < 3) return { ok: false, error: 'Judul minimal 3 karakter' }
    out.title = t
  }
  if (has('year') || !partial) {
    const y = Number(b.year)
    if (!Number.isInteger(y) || y < 2020 || y > 2100) return { ok: false, error: 'Tahun tidak valid' }
    out.year = y
  }
  if (has('type') || !partial) out.type = ENH_TYPES.includes(str(b.type, 20)) ? str(b.type, 20) : 'New'
  if (has('code')) out.code = str(b.code, 20)
  if (has('initiator')) out.initiator = str(b.initiator, 60)
  if (has('notes')) out.notes = str(b.notes, 5000)
  if (has('pic')) out.pic = (Array.isArray(b.pic) ? b.pic : []).map(p => str(p, 80)).filter(Boolean).slice(0, 20)

  if (has('items') || !partial) {
    const raw = Array.isArray(b.items) ? b.items.slice(0, MAX_ITEMS) : []
    const items: EnhItem[] = []
    for (const [i, it] of raw.entries()) {
      const o = (it || {}) as Record<string, unknown>
      const sc = [o.u, o.f, o.fl, o.pb].map(score)
      if (sc.includes('bad')) return { ok: false, error: `Skor item ${i + 1} harus 0–5` }
      const t = str(o.t, 2000)
      if (!t && sc.every(v => v == null)) continue
      const x: EnhItem = { t, u: sc[0] as number | null, f: sc[1] as number | null, fl: sc[2] as number | null, pb: sc[3] as number | null }
      for (const k of ['du', 'df', 'dfl', 'dpb'] as const) { const d = str(o[k], 2000); if (d) x[k] = d }
      items.push(x)
    }
    out.items = items
  }
  if (has('stage') || !partial) {
    const s = has('stage') ? Number(b.stage) : 1
    if (!Number.isInteger(s) || s < 1 || s > 7) return { ok: false, error: 'Tahap BRD harus 1–7' }
    out.stage = s
  }
  if (has('weights')) {
    if (b.weights === null) out.weights = null
    else {
      const w = b.weights
      if (!Array.isArray(w) || w.length !== TPL.length || !w.every(v => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100) || !w.some(v => v > 0)) {
        return { ok: false, error: 'Bobot harus 5 angka 0–100' }
      }
      out.weights = w as number[]
    }
  }
  if (has('phases')) {
    const raw = Array.isArray(b.phases) ? b.phases : []
    const phases: EnhPhase[] = []
    for (const p of raw.slice(0, TPL.length)) {
      const o = (p || {}) as Record<string, unknown>
      const key = str(o.key, 20)
      if (!(TPL as readonly string[]).includes(key)) return { ok: false, error: 'Aktivitas timeline tidak dikenal' }
      const start = str(o.start, 10), end = str(o.end, 10)
      if ((start && !Number.isFinite(dUTC(start))) || (end && !Number.isFinite(dUTC(end)))) return { ok: false, error: `Tanggal ${key} tidak valid` }
      if (start && end && dUTC(end) < dUTC(start)) return { ok: false, error: `Tanggal selesai ${key} sebelum tanggal mulai` }
      const pct = Math.min(100, Math.max(0, Number(o.pct) || 0))
      phases.push({ key, start, end, pct })
    }
    out.phases = phases
  }
  return { ok: true, data: out }
}
