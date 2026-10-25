// Pure helpers for the grouped Team Notes list.
export type NoteLike = { _id?: string; title?: string; content?: string; category?: string; date?: string; createdAt?: string | Date; pinned?: boolean; picTags?: string[] }

/** Year a note belongs to: its date, else when it was created. */
export function noteYear(n: NoteLike): number | null {
  const d = /^(\d{4})-/.exec(String(n.date || ''))
  if (d) return Number(d[1])
  const c = n.createdAt ? new Date(n.createdAt) : null
  return c && !Number.isNaN(c.getTime()) ? c.getFullYear() : null
}

/** Notes shown for a year: that year's notes plus every pinned note. */
export function notesForYear<T extends NoteLike>(list: T[], year: number): T[] {
  return list.filter(n => n.pinned || noteYear(n) === year)
}

export function matches(n: NoteLike, q: string): boolean {
  const s = q.trim().toLowerCase()
  if (!s) return true
  return [n.title, n.content, ...(n.picTags || [])].some(x => String(x || '').toLowerCase().includes(s))
}

/** Pinned first, then newest date, then newest created. */
export function sortNotes<T extends NoteLike>(list: T[]): T[] {
  const t = (n: NoteLike) => (n.createdAt ? new Date(n.createdAt).getTime() : 0)
  return [...list].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || String(b.date || '').localeCompare(String(a.date || '')) || t(b) - t(a))
}

/** Groups in category order; notes with an unknown category go to "Lainnya". */
export function groupNotes<T extends NoteLike>(list: T[], cats: { key: string; label: string; color?: string }[]) {
  const known = new Set(cats.map(c => c.key))
  const groups = cats.map(c => ({ key: c.key, label: c.label, color: c.color || 'var(--muted)', items: sortNotes(list.filter(n => n.category === c.key)) }))
  const orphans = list.filter(n => !known.has(String(n.category)))
  if (orphans.length) groups.push({ key: '__orphan', label: 'Lainnya', color: 'var(--muted)', items: sortNotes(orphans) })
  return groups
}
