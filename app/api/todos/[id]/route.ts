import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { connectDB } from '@/lib/db'
import { TodoModel } from '@/models/Todo'
import { sendPushToUser } from '@/lib/push'
import { cleanTodoInput, mergeAssignees, isCreator, assigneeOf, isIsoDate, STATUS_LABEL, STATUSES, fmtDate, type TodoStatus } from '@/lib/todo'
import { memberNames, uid } from '@/lib/todoServer'

const lc = (s: unknown) => String(s || '').trim().toLowerCase()
type Ctx = { params: Promise<{ id: string }> }

async function load(ctx: Ctx) {
  const session = await getServerSession(authOptions)
  const email = lc(session?.user?.email)
  if (!email) return { err: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }
  const { id } = await ctx.params
  if (!mongoose.isValidObjectId(id)) return { err: NextResponse.json({ error: 'Tugas tidak ditemukan' }, { status: 404 }) }
  await connectDB()
  const doc: any = await TodoModel.findById(id)
  if (!doc || doc.archived) return { err: NextResponse.json({ error: 'Tugas tidak ditemukan' }, { status: 404 }) }
  if (!isCreator(doc, email) && !assigneeOf(doc, email)) return { err: NextResponse.json({ error: 'Kamu tidak punya akses ke tugas ini' }, { status: 403 }) }
  return { doc, email, name: String(session?.user?.name || email) }
}

/** Kirim push ke semua yang terlibat kecuali pelaku. */
async function notifyOthers(doc: any, actor: string, title: string, body: string) {
  const all = new Set<string>([lc(doc.createdByEmail), ...doc.assignees.map((a: any) => lc(a.email))])
  all.delete(actor)
  await Promise.all(Array.from(all).map(e => sendPushToUser(e, { title, body, url: `/dashboard/quicknotes?todo=${doc._id}`, tag: `todo-${doc._id}` }).catch(() => null)))
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const r = await load(ctx); if ('err' in r) return r.err
    const { doc, email, name } = r
    const body = await req.json().catch(() => ({}))
    const action = body.action
    const first = name.split(' ')[0]
    const text = typeof body.text === 'string' ? body.text.trim().slice(0, 1000) : ''

    if (action === 'progress') {
      const me = doc.assignees.find((a: any) => lc(a.email) === email)
      if (!me) return NextResponse.json({ error: 'Hanya penerima tugas yang bisa update progres' }, { status: 403 })
      const status = body.status as TodoStatus
      if (!STATUSES.includes(status)) return NextResponse.json({ error: 'Status tidak valid' }, { status: 400 })
      if (body.eta && !isIsoDate(body.eta)) return NextResponse.json({ error: 'Tanggal target tidak valid' }, { status: 400 })
      const changed = me.status !== status || (body.eta !== undefined && (me.eta || '') !== (body.eta || ''))
      if (!changed && !text) return NextResponse.json({ data: doc })
      me.status = status
      if (body.eta !== undefined) me.eta = status === 'done' ? '' : (body.eta || '')
      me.updatedAt = new Date()
      doc.updates.push({ id: uid(), byEmail: email, byName: name, kind: 'progress', text, status, eta: me.eta || '' })
      doc.markModified('assignees')
      await doc.save()
      const etaTxt = status !== 'done' && me.eta ? ` · target ${fmtDate(me.eta, true)}` : ''
      await notifyOthers(doc, email, `${status === 'done' ? '✅' : '🔄'} ${first}: ${STATUS_LABEL[status]}`, `${doc.title}${etaTxt}${text ? ` — “${text.slice(0, 120)}”` : ''}`)
      return NextResponse.json({ data: doc })
    }

    if (action === 'comment') {
      if (!text) return NextResponse.json({ error: 'Respon tidak boleh kosong' }, { status: 400 })
      doc.updates.push({ id: uid(), byEmail: email, byName: name, kind: 'comment', text })
      await doc.save()
      await notifyOthers(doc, email, `💬 ${first} merespon`, `${doc.title} — “${text.slice(0, 140)}”`)
      return NextResponse.json({ data: doc })
    }

    if (action === 'edit') {
      if (!isCreator(doc, email)) return NextResponse.json({ error: 'Hanya pemberi tugas yang bisa mengubah' }, { status: 403 })
      const c = cleanTodoInput(body, { partial: true })
      if ('error' in c) return NextResponse.json({ error: c.error }, { status: 400 })
      const { assignees, ...fields } = c.data as any
      if (fields.dueTime && !(fields.dueDate ?? doc.dueDate)) return NextResponse.json({ error: 'Isi tanggal tenggat sebelum jam' }, { status: 400 })
      Object.assign(doc, fields)
      let added: string[] = []
      if (assignees) {
        const names = await memberNames()
        const emails: string[] = assignees.length ? assignees : [email]
        if (emails.some(e => e !== email && !names.has(e))) return NextResponse.json({ error: 'Penerima tidak dikenal atau tidak aktif' }, { status: 400 })
        const before = new Set(doc.assignees.map((a: any) => lc(a.email)))
        added = emails.filter(e => !before.has(e) && e !== email)
        doc.assignees = mergeAssignees(doc.assignees.map((a: any) => a.toObject?.() ?? a), emails, e => (e === email ? name : names.get(e) || e))
      }
      doc.updates.push({ id: uid(), byEmail: email, byName: name, kind: 'edit', text: 'Detail tugas diperbarui' })
      await doc.save()
      await Promise.all(added.map(e => sendPushToUser(e, { title: `📌 ${first} memberi kamu tugas`, body: `${doc.title}${doc.dueDate ? ` · tenggat ${fmtDate(doc.dueDate, true)}` : ''}`, url: `/dashboard/quicknotes?todo=${doc._id}`, tag: `todo-${doc._id}` }).catch(() => null)))
      return NextResponse.json({ data: doc })
    }
    return NextResponse.json({ error: 'Aksi tidak dikenal' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const r = await load(ctx); if ('err' in r) return r.err
    if (!isCreator(r.doc, r.email)) return NextResponse.json({ error: 'Hanya pemberi tugas yang bisa menghapus' }, { status: 403 })
    r.doc.archived = true   // soft delete — bisa dipulihkan admin bila perlu
    await r.doc.save()
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
