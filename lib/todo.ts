// Logika murni To-do & tugas (tanpa DOM/DB) — dipakai UI, API, cron, dan diuji.

export type TodoStatus = 'todo' | 'in_progress' | 'done'
export type Assignee = { email: string; name?: string; status: TodoStatus; eta?: string; updatedAt?: string | Date | null }
export type TodoLike = {
  _id?: string; title: string; note?: string
  createdByEmail: string; createdByName?: string
  assignees: Assignee[]; dueDate?: string; dueTime?: string; priority?: 'normal' | 'high'
  updates?: { id: string; byEmail?: string; byName?: string; kind?: string; text?: string; status?: string; eta?: string; at?: string | Date }[]
  archived?: boolean; createdAt?: string | Date; updatedAt?: string | Date
}

export const STATUS_LABEL: Record<TodoStatus, string> = { todo: 'Belum mulai', in_progress: 'Dikerjakan', done: 'Selesai' }
export const STATUSES: TodoStatus[] = ['todo', 'in_progress', 'done']
const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
const ISO = /^\d{4}-\d{2}-\d{2}$/
const lc = (s: unknown) => String(s || '').trim().toLowerCase()

export const isIsoDate = (s: unknown): s is string => typeof s === 'string' && ISO.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z'))
export const isHHmm = (s: unknown): s is string => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s)

/** Tanggal hari ini di WIB (UTC+7) sebagai 'YYYY-MM-DD'. */
export function jakartaToday(now: Date = new Date()): string {
  return new Date(now.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10)
}
/** Selisih hari kalender b − a (keduanya 'YYYY-MM-DD'). */
export function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000)
}
export function addDays(iso: string, n: number): string {
  return new Date(Date.parse(iso + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10)
}

export function fmtDate(iso?: string, withDay = false): string {
  if (!isIsoDate(iso)) return ''
  const d = new Date(iso + 'T00:00:00Z')
  return `${withDay ? HARI[d.getUTCDay()] + ', ' : ''}${d.getUTCDate()} ${BLN[d.getUTCMonth()]}${d.getUTCFullYear() !== new Date().getFullYear() ? ' ' + d.getUTCFullYear() : ''}`
}

/** Label tenggat relatif: "Hari ini", "Besok", "3 hari lagi", "Lewat 2 hari". */
export function dueLabel(due: string | undefined, today: string): string {
  if (!isIsoDate(due)) return 'Tanpa tenggat'
  const n = dayDiff(today, due)
  if (n === 0) return 'Hari ini'
  if (n === 1) return 'Besok'
  if (n === -1) return 'Kemarin'
  if (n < 0) return `Lewat ${-n} hari`
  if (n < 7) return `${n} hari lagi`
  return fmtDate(due)
}

export type Bucket = 'overdue' | 'today' | 'tomorrow' | 'week' | 'later' | 'none' | 'done'
export const BUCKET_LABEL: Record<Bucket, string> = { overdue: 'Terlambat', today: 'Hari ini', tomorrow: 'Besok', week: '7 hari ke depan', later: 'Nanti', none: 'Tanpa tenggat', done: 'Selesai' }
export const BUCKET_ORDER: Bucket[] = ['overdue', 'today', 'tomorrow', 'week', 'later', 'none', 'done']

export function dueBucket(due: string | undefined, today: string): Exclude<Bucket, 'done'> {
  if (!isIsoDate(due)) return 'none'
  const n = dayDiff(today, due)
  if (n < 0) return 'overdue'
  if (n === 0) return 'today'
  if (n === 1) return 'tomorrow'
  if (n <= 7) return 'week'
  return 'later'
}

export const isCreator = (t: TodoLike, email: string) => lc(t.createdByEmail) === lc(email)
export const assigneeOf = (t: TodoLike, email: string) => (t.assignees || []).find(a => lc(a.email) === lc(email))
export const isAssignee = (t: TodoLike, email: string) => !!assigneeOf(t, email)
/** To-do pribadi: hanya pembuat sendiri yang mengerjakan. */
export const isPersonal = (t: TodoLike) => (t.assignees || []).length > 0 && (t.assignees || []).every(a => lc(a.email) === lc(t.createdByEmail))
export const othersAssigned = (t: TodoLike) => (t.assignees || []).filter(a => lc(a.email) !== lc(t.createdByEmail))

/** Status keseluruhan: selesai bila semua assignee selesai; dikerjakan bila ada yang mulai. */
export function overallStatus(t: TodoLike): TodoStatus {
  const a = t.assignees || []
  if (!a.length) return 'todo'
  if (a.every(x => x.status === 'done')) return 'done'
  if (a.some(x => x.status !== 'todo')) return 'in_progress'
  return 'todo'
}
export function progressRatio(t: TodoLike): [number, number] {
  const a = t.assignees || []
  return [a.filter(x => x.status === 'done').length, a.length]
}

/** Status dari sudut pandang `email`: progres sendiri bila assignee, selain itu status keseluruhan. */
export function viewStatus(t: TodoLike, email: string): TodoStatus {
  return assigneeOf(t, email)?.status || overallStatus(t)
}

export type Scope = 'mine' | 'given' | 'all'
/** mine = tugas untuk saya (termasuk pribadi); given = saya berikan ke orang lain. */
export function inScope(t: TodoLike, email: string, scope: Scope): boolean {
  if (scope === 'mine') return isAssignee(t, email)
  if (scope === 'given') return isCreator(t, email) && othersAssigned(t).length > 0
  return isAssignee(t, email) || isCreator(t, email)
}

/** Kelompokkan berdasar tenggat; yang selesai (dari sudut pandang email) masuk 'done'. Urut tenggat, prioritas, judul. */
export function groupTodos<T extends TodoLike>(list: T[], email: string, today: string): { key: Bucket; items: T[] }[] {
  const by = new Map<Bucket, T[]>()
  for (const t of list) {
    const b: Bucket = viewStatus(t, email) === 'done' ? 'done' : dueBucket(t.dueDate, today)
    by.set(b, [...(by.get(b) || []), t])
  }
  const cmp = (a: T, b: T) =>
    String(a.dueDate || '9999').localeCompare(String(b.dueDate || '9999')) ||
    String(a.dueTime || '99').localeCompare(String(b.dueTime || '99')) ||
    Number(b.priority === 'high') - Number(a.priority === 'high') ||
    a.title.localeCompare(b.title)
  const doneCmp = (a: T, b: T) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))
  return BUCKET_ORDER.filter(k => by.has(k)).map(k => ({ key: k, items: [...by.get(k)!].sort(k === 'done' ? doneCmp : cmp) }))
}

/** Perlu muncul di popup harian untuk `email`: tugas dari orang lain, belum selesai, punya tenggat. */
export function needsPopup(t: TodoLike, email: string): boolean {
  if (t.archived) return false
  const me = assigneeOf(t, email)
  return !!me && me.status !== 'done' && !isCreator(t, email) && isIsoDate(t.dueDate)
}

/** Isi notifikasi pagi untuk satu member; null bila tidak ada tugas aktif dari orang lain. */
export function morningDigest(list: TodoLike[], email: string, today: string): { title: string; body: string } | null {
  const open = list.filter(t => needsPopup(t, email)).sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)))
  if (!open.length) return null
  const late = open.filter(t => dayDiff(today, t.dueDate!) < 0).length
  const top = open.slice(0, 3).map(t => `${t.title} (${dueLabel(t.dueDate, today).toLowerCase()})`).join('; ')
  return {
    title: late ? `📌 ${open.length} tugas aktif · ${late} terlambat` : `📌 ${open.length} tugas aktif untukmu`,
    body: `${top}${open.length > 3 ? `, +${open.length - 3} lainnya` : ''}. Update progresnya di WinS.`,
  }
}

/** Validasi & normalisasi input pembuatan/edit. Mengembalikan pesan error pertama, atau data bersih. */
export function cleanTodoInput(body: any, opts: { partial?: boolean } = {}): { error: string } | { data: Record<string, unknown> } {
  const out: Record<string, unknown> = {}
  if (!opts.partial || 'title' in body) {
    if (typeof body.title !== 'string' || !body.title.trim()) return { error: 'Judul wajib diisi' }
    if (body.title.trim().length > 200) return { error: 'Judul maksimal 200 karakter' }
    out.title = body.title.trim()
  }
  if ('note' in body) {
    if (body.note != null && typeof body.note !== 'string') return { error: 'Catatan tidak valid' }
    const n = String(body.note || '')
    if (n.length > 4000) return { error: 'Catatan maksimal 4000 karakter' }
    out.note = n
  }
  if ('dueDate' in body) {
    if (body.dueDate && !isIsoDate(body.dueDate)) return { error: 'Tanggal tenggat tidak valid' }
    out.dueDate = body.dueDate || ''
  }
  if ('dueTime' in body) {
    if (body.dueTime && !isHHmm(body.dueTime)) return { error: 'Jam tenggat tidak valid' }
    out.dueTime = body.dueTime || ''
  }
  if (out.dueTime && !(out.dueDate ?? body.dueDate)) return { error: 'Isi tanggal tenggat sebelum jam' }
  if ('priority' in body) {
    if (!['normal', 'high'].includes(body.priority)) return { error: 'Prioritas tidak valid' }
    out.priority = body.priority
  }
  if ('assignees' in body) {
    if (!Array.isArray(body.assignees) || body.assignees.some((e: unknown) => typeof e !== 'string')) return { error: 'Daftar penerima tidak valid' }
    if (body.assignees.length > 30) return { error: 'Maksimal 30 penerima' }
    out.assignees = Array.from(new Set((body.assignees as string[]).map(lc).filter(Boolean)))
  }
  return { data: out }
}

/** Gabungkan daftar email penerima baru dengan progres yang sudah ada (progres lama dipertahankan). */
export function mergeAssignees(prev: Assignee[], emails: string[], nameOf: (e: string) => string): Assignee[] {
  return emails.map(e => {
    const old = prev.find(a => lc(a.email) === lc(e))
    return old ? { ...old, name: old.name || nameOf(e) } : { email: e, name: nameOf(e), status: 'todo' as TodoStatus, eta: '', updatedAt: null }
  })
}
