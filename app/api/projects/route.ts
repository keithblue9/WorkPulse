import { NextRequest, NextResponse, after } from 'next/server'
import { connectDB } from '@/lib/db'
import { ProjectModel } from '@/models/Project'
import { addedPics } from '@/lib/changeLog'
import { currentActor, notifyNewPics, recordAudit } from '@/lib/notifyServer'

export async function GET(req: NextRequest) {
  try {
    await connectDB()
    const { searchParams } = new URL(req.url)
    const pic = searchParams.get('pic')
    const status = searchParams.get('status')
    const query: any = {}
    if (pic) query.$or = [{ pic }, { members: pic }]
    if (status) query.status = status
    const projects = await ProjectModel.find(query).sort({ priority: 1, createdAt: -1 }).lean()
    return NextResponse.json({ data: projects })
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }) }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB()
    const body = await req.json()
    const project: any = await ProjectModel.create(body)
    const actor = await currentActor()
    // Setelah respons: notifikasi PIC + riwayat. Recurring membuat banyak occurrence — notifikasi sekali per grup (occurrence pertama).
    const firstOfGroup = !project.recurrenceGroupId || !(await ProjectModel.exists({ recurrenceGroupId: project.recurrenceGroupId, _id: { $ne: project._id } }))
    after(async () => {
      await recordAudit('activity', String(project._id), 'create', actor, [], 'Dibuat')
      if (firstOfGroup) await notifyNewPics({ kind: 'activity', title: project.title, names: addedPics([], project.pic), actor, url: '/dashboard/activities', tagId: String(project.recurrenceGroupId || project._id) })
    })
    return NextResponse.json({ data: project }, { status: 201 })
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}
