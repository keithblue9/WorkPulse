// Server-only: notifikasi PIC baru, riwayat perubahan, identitas pengubah.
// Dipanggil dari route handler lewat `after()` supaya tetap terkirim setelah respons (serverless).
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { connectDB } from '@/lib/db'
import { UserModel } from '@/models/User'
import { AuditLogModel } from '@/models/AuditLog'
import { sendPushToUser } from '@/lib/push'
import { samePerson } from '@/lib/dashboard'
import type { Change } from '@/lib/changeLog'

export type Actor = { name: string; email: string }

export async function currentActor(): Promise<Actor> {
  try {
    const s: any = await getServerSession(authOptions)
    return { name: String(s?.user?.name || ''), email: String(s?.user?.email || '') }
  } catch { return { name: '', email: '' } }
}

/** Email member aktif (non-tamu) yang namanya cocok dengan daftar nama PIC. */
export async function emailsForNames(names: string[]): Promise<{ name: string; email: string }[]> {
  if (!names.length) return []
  await connectDB()
  const users: any[] = await UserModel.find({ active: { $ne: false } }, 'name email role roles').lean()
  const out: { name: string; email: string }[] = []
  for (const n of names) {
    const u = users.find(x => x.email && !(Array.isArray(x.roles) && x.roles.length && x.roles.every((r: string) => r === 'guest')) && samePerson(String(x.name || ''), n))
    if (u && !out.some(o => o.email === u.email)) out.push({ name: String(u.name), email: String(u.email) })
  }
  return out
}

const KIND_LABEL = { activity: 'activity', initiative: 'initiative', enhancement: 'enhancement' } as const

/** Push ke orang yang baru ditambahkan sebagai PIC (tidak ke dirinya sendiri). */
export async function notifyNewPics(opts: { kind: keyof typeof KIND_LABEL; title: string; names: string[]; actor: Actor; url: string; tagId: string }) {
  const targets = (await emailsForNames(opts.names)).filter(t => t.email.toLowerCase() !== opts.actor.email.toLowerCase())
  let sent = 0
  for (const t of targets) {
    const r: any = await sendPushToUser(t.email, {
      title: `Kamu jadi PIC ${KIND_LABEL[opts.kind]}`,
      body: `${opts.actor.name || 'Seseorang'} menambahkanmu sebagai PIC: "${opts.title || '(tanpa judul)'}".`,
      url: opts.url,
      tag: `pic-${opts.kind}-${opts.tagId}`,
    }).catch(() => null)
    if (r?.sent) sent++
  }
  return { targets: targets.length, sent }
}

export async function recordAudit(entity: 'activity' | 'reimbursement', entityId: string, action: 'create' | 'update' | 'delete', actor: Actor, changes: Change[] = [], note?: string) {
  if (action === 'update' && !changes.length) return
  try {
    await connectDB()
    await AuditLogModel.create({ entity, entityId: String(entityId), action, by: actor.name, byEmail: actor.email, changes, note })
  } catch { /* riwayat bersifat best-effort: jangan gagalkan simpan data utama */ }
}
