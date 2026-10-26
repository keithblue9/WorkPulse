// Pure helpers (no DB) untuk notifikasi terjadwal: ringkasan mingguan per member & reimburse menggantung.
import { picArray } from '@/lib/defaults'
import { isFinished, samePerson } from '@/lib/dashboard'
import { DAY, actsFromPhases, dUTC, ptd } from '@/lib/progress'

/** Enhancement masih berjalan: aktivitas kustom belum 100%, atau (template) tahap BRD belum Development. */
export const enhRunning = (e: any) => Array.isArray(e?.acts) && e.acts.length ? e.acts.some((a: any) => (Number(a?.pct) || 0) < 100) : (Number(e?.stage) || 1) < 7

const isPic = (pic: unknown, name: string, legacy?: string) => picArray(pic).some(p => samePerson(String(p), name)) || (!!legacy && samePerson(legacy, name))

export type Digest = { openActs: number; dueWeek: number; lateTasks: number; enh: number; body: string } | null

/** Ringkasan pekan ini untuk satu orang (berdasarkan PIC). null bila tidak ada apa pun untuknya. */
export function weeklyDigest(name: string, data: { acts: any[]; inits: any[]; enh: any[] }, todayIso: string): Digest {
  const t = dUTC(todayIso); if (!Number.isFinite(t) || !name) return null
  const weekEnd = t + 6 * DAY
  const mine = (data.acts || []).filter(a => a && a.showInList !== false && !isFinished(a) && isPic(a.pic, name, a.picName))
  const dueWeek = mine.filter(a => { const d = dUTC(String(a.actionDateEnd || a.actionDate || '')); return Number.isFinite(d) && d >= t && d <= weekEnd }).length
  let lateTasks = 0
  for (const i of data.inits || []) {
    if (!isPic(i?.pic, name)) continue
    for (const a of actsFromPhases(i.phases || [], Number(i.year) || new Date(t).getUTCFullYear())) if (a.start && a.pct < 100 && ptd(a, t) > a.pct + 0.5) lateTasks++
  }
  for (const e of data.enh || []) {
    if (!isPic(e?.pic, name) || !Array.isArray(e?.acts)) continue
    for (const a of e.acts) if (a?.start && (Number(a.pct) || 0) < 100 && ptd(a, t) > (Number(a.pct) || 0) + 0.5) lateTasks++
  }
  const enh = (data.enh || []).filter(e => isPic(e?.pic, name) && enhRunning(e)).length
  if (!mine.length && !lateTasks && !enh) return null
  const parts = [`${mine.length} activity terbuka${dueWeek ? ` (${dueWeek} jatuh tempo pekan ini)` : ''}`]
  if (lateTasks) parts.push(`${lateTasks} tugas perlu update`)
  if (enh) parts.push(`${enh} enhancement berjalan`)
  return { openActs: mine.length, dueWeek, lateTasks, enh, body: `Pekan ini: ${parts.join(', ')}.` }
}

const PENDING = ['submitted', 'approved']
/** Reimburse yang belum ditransfer lebih dari `days` hari sejak diajukan. */
export function staleReimburses<T extends { status?: string; submittedAt?: string; createdAt?: string | Date }>(items: T[], nowMs: number, days: number): T[] {
  if (!(days > 0)) return []
  const limit = nowMs - days * DAY
  return (items || []).filter(r => {
    if (!PENDING.includes(String(r?.status))) return false
    const at = new Date((r.submittedAt || r.createdAt || '') as any).getTime()
    return Number.isFinite(at) && at <= limit
  })
}

/** Jakarta (WIB) — tanggal ISO & hari (0 = Minggu). */
export function wib(now: Date): { iso: string; dow: number; hour: number } {
  const j = new Date(now.getTime() + 7 * 3600 * 1000)
  return { iso: `${j.getUTCFullYear()}-${String(j.getUTCMonth() + 1).padStart(2, '0')}-${String(j.getUTCDate()).padStart(2, '0')}`, dow: j.getUTCDay(), hour: j.getUTCHours() }
}
