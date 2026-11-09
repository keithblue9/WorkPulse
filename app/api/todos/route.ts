import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { connectDB } from '@/lib/db'
import { TodoModel } from '@/models/Todo'
import { memberNames, uid } from '@/lib/todoServer'
import { sendPushToUser } from '@/lib/push'
import { cleanTodoInput, mergeAssignees, fmtDate } from '@/lib/todo'

const lc = (s: unknown) => String(s || '').trim().toLowerCase()

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const email = lc(session?.user?.email)
    if (!email) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    await connectDB()
    const data = await TodoModel.find({ archived: { $ne: true }, $or: [{ createdByEmail: email }, { 'assignees.email': email }] })
      .sort({ updatedAt: -1 }).limit(500).lean()
    return NextResponse.json({ data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const email = lc(session?.user?.email)
    if (!email) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    const body = await req.json().catch(() => ({}))
    const r = cleanTodoInput(body)
    if ('error' in r) return NextResponse.json({ error: r.error }, { status: 400 })
    await connectDB()
    const names = await memberNames()
    const myName = String(session?.user?.name || names.get(email) || email)
    const emails = (r.data.assignees as string[] | undefined)?.length ? (r.data.assignees as string[]) : [email]
    const unknown = emails.filter(e => e !== email && !names.has(e))
    if (unknown.length) return NextResponse.json({ error: 'Penerima tidak dikenal atau tidak aktif' }, { status: 400 })

    const doc = await TodoModel.create({
      ...r.data,
      createdByEmail: email, createdByName: myName,
      assignees: mergeAssignees([], emails, e => (e === email ? myName : names.get(e) || e)),
      updates: [{ id: uid(), byEmail: email, byName: myName, kind: 'created', text: '' }],
    })
    // Beri tahu penerima (selain diri sendiri) segera
    const others = emails.filter(e => e !== email)
    await Promise.all(others.map(e => sendPushToUser(e, {
      title: `📌 ${myName.split(' ')[0]} memberi kamu tugas`,
      body: `${doc.title}${doc.dueDate ? ` · tenggat ${fmtDate(doc.dueDate, true)}` : ''}`,
      url: `/dashboard/quicknotes?todo=${doc._id}`, tag: `todo-${doc._id}`,
    }).catch(() => null)))
    return NextResponse.json({ data: doc })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
