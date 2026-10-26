// Pure helpers for the dashboard (Manajemen / Fokus saya). No React, no fetch.
export function greeting(hour: number): 'Pagi' | 'Siang' | 'Sore' | 'Malam' {
  if (hour >= 4 && hour < 11) return 'Pagi'
  if (hour >= 11 && hour < 15) return 'Siang'
  if (hour >= 15 && hour < 18) return 'Sore'
  return 'Malam'
}

// Status yang berarti activity sudah tidak berjalan (selesai atau batal). Key status bisa diubah di
// Configuration, jadi penulisannya dinormalkan: "Completed", "COMPLETE", "Dibatalkan" → dikenali.
const DONE = ['completed', 'complete', 'done', 'finished', 'closed', 'selesai', 'cancelled', 'canceled', 'batal', 'dibatalkan']
const norm0 = (s: unknown) => String(s || '').toLowerCase().replace(/[^a-z]/g, '')
export const isFinished = (a: { status?: string }) => DONE.includes(norm0(a?.status))

/** Activity belongs to year Y; unfinished older or undated ones carry into the current year. */
export function activityInYear(a: { actionDate?: string; status?: string }, y: number, nowYear: number): boolean {
  const m = /^(\d{4})-/.exec(String(a?.actionDate || ''))
  if (!m) return y === nowYear
  const d = Number(m[1])
  if (d === y) return true
  return y === nowYear && d < y && !isFinished(a)
}

/** IDs of people working from the office on a date (new slot format or legacy type). */
export function wfoUserIds(rows: any[], date: string): Set<string> {
  const ids = new Set<string>()
  for (const r of rows || []) {
    if (r?.date !== date) continue
    const wfo = (Array.isArray(r.slots) && r.slots.some((s: any) => String(s?.type).toLowerCase() === 'wfo')) || String(r.type || '').toLowerCase() === 'wfo'
    if (wfo && r.userId) ids.add(String(r.userId))
  }
  return ids
}

/** Agenda berikutnya: belum selesai/batal, tampil di daftar, dan belum lewat (termasuk yang sedang berlangsung). */
export function upcoming<T extends { actionDate?: string; actionDateEnd?: string; showInList?: boolean; status?: string }>(list: T[], today: string, n: number): T[] {
  return (list || [])
    .filter(a => a && a.showInList !== false && !isFinished(a) && a.actionDate && String(a.actionDateEnd && a.actionDateEnd > a.actionDate ? a.actionDateEnd : a.actionDate) >= today)
    .sort((a, b) => String(a.actionDate).localeCompare(String(b.actionDate)))
    .slice(0, n)
}

/** Portfolio = average of initiatives (each initiative counts once, whatever its weights). */
export function portfolio(cs: { plan: number; actual: number }[]): { plan: number; actual: number; spi: number | null } {
  if (!cs.length) return { plan: 0, actual: 0, spi: null }
  const plan = cs.reduce((s, c) => s + c.plan, 0) / cs.length, actual = cs.reduce((s, c) => s + c.actual, 0) / cs.length
  return { plan, actual, spi: plan > 0 ? actual / plan : null }
}

const norm = (s: string) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase()
/** Same person by name; a single first name matches the full name. */
export function samePerson(a: string, b: string): boolean {
  const x = norm(a), y = norm(b)
  if (!x || !y) return false
  if (x === y) return true
  const [fx] = x.split(' '), [fy] = y.split(' ')
  return (!x.includes(' ') && x === fy) || (!y.includes(' ') && y === fx)
}

export function activityStats(list: any[]) {
  const open = (list || []).filter(a => a.showInList !== false && !isFinished(a))
  const by = (k: string) => open.filter(a => a.subType === k).length
  return { total: open.length, kpi: by('KPI'), nonKpi: by('Non-KPI'), goLive: by('Go-Live'), anggaran: by('Anggaran'), others: by('Others'), highPriority: open.filter(a => a.priority === 'high').length, open }
}
