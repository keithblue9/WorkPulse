// Pure helpers: beban kerja per member & jumlah "perlu update" per orang (berdasarkan PIC).
import { picArray } from '@/lib/defaults'
import { isFinished, samePerson } from '@/lib/dashboard'
import { actsFromPhases, ptd, type Act } from '@/lib/progress'
import { enhActs } from '@/lib/enhancement'
import { enhRunning } from '@/lib/digest'

const isPic = (pic: unknown, name: string, legacy?: string) => !!name && (picArray(pic).some(p => samePerson(String(p), name)) || (!!legacy && samePerson(legacy, name)))
const late = (a: Act, today: number) => !!a.start && a.pct < 100 && ptd(a, today) > a.pct + 0.5

/** Aktivitas initiative/enhancement dengan PIC `name` yang tertinggal dari rencana hari ini. */
export function needsUpdate(name: string, data: { inits: any[]; enh: any[] }, today: number, tpl: number[], year?: number): { progress: number; enhancement: number } {
  let progress = 0, enhancement = 0
  for (const i of data.inits || []) {
    if (!isPic(i?.pic, name)) continue
    progress += actsFromPhases(i.phases || [], Number(i.year) || year || new Date(today).getUTCFullYear()).filter(a => late(a, today)).length
  }
  for (const e of data.enh || []) {
    if (!isPic(e?.pic, name)) continue
    enhancement += enhActs(e, tpl).filter(a => late(a, today)).length
  }
  return { progress, enhancement }
}

export type DueItem = { kind: 'progress' | 'enhancement'; id: string; title: string; act: string; href: string }
/** Rincian item di balik angka badge "perlu update" (urutan: Progress Project lama, lalu Enhancement). */
export function needsUpdateList(name: string, data: { inits: any[]; enh: any[] }, today: number, tpl: number[], year?: number): DueItem[] {
  const out: DueItem[] = []
  for (const i of data.inits || []) {
    if (!isPic(i?.pic, name)) continue
    for (const a of actsFromPhases(i.phases || [], Number(i.year) || year || new Date(today).getUTCFullYear())) if (late(a, today)) out.push({ kind: 'progress', id: String(i._id), title: String(i.title || ''), act: a.name, href: `/dashboard/progress?i=${i._id}` })
  }
  for (const e of data.enh || []) {
    if (!isPic(e?.pic, name)) continue
    for (const a of enhActs(e, tpl)) if (late(a, today)) out.push({ kind: 'enhancement', id: String(e._id), title: String(e.title || ''), act: a.name, href: `/dashboard/enhancement?e=${e._id}` })
  }
  return out
}

export type Load = { name: string; acts: number; inits: number; enh: number; late: number; total: number }

/** Beban kerja: activity terbuka, initiative & enhancement berjalan, dan tugas tertinggal — per member. */
export function workload(staff: { name?: string }[], data: { acts: any[]; inits: any[]; enh: any[] }, today: number, tpl: number[]): Load[] {
  return (staff || []).filter(m => m?.name).map(m => {
    const name = String(m.name)
    const acts = (data.acts || []).filter(a => a && a.showInList !== false && !isFinished(a) && isPic(a.pic, name, a.picName)).length
    const inits = (data.inits || []).filter(i => isPic(i?.pic, name)).length
    const enh = (data.enh || []).filter(e => isPic(e?.pic, name) && enhRunning(e)).length
    const nu = needsUpdate(name, { inits: data.inits, enh: data.enh }, today, tpl)
    return { name, acts, inits, enh, late: nu.progress + nu.enhancement, total: acts + inits + enh }
  }).sort((a, b) => b.total - a.total || b.late - a.late || a.name.localeCompare(b.name))
}
