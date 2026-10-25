import { NextRequest, NextResponse, after } from 'next/server'
import { connectDB } from '@/lib/db'
import { ProjectModel } from '@/models/Project'
import { ACTIVITY_FIELDS, addedPics, diffFields } from '@/lib/changeLog'
import { currentActor, notifyNewPics, recordAudit } from '@/lib/notifyServer'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params; await connectDB()
    const body = await req.json()
    const prev: any = await ProjectModel.findById(id).lean()
    const project: any = await ProjectModel.findByIdAndUpdate(id, body, { new: true }).lean()
    if (project) {
      const actor = await currentActor()
      const changes = diffFields(prev, body, ACTIVITY_FIELDS)
      const added = 'pic' in body ? addedPics(prev?.pic, project.pic) : []
      after(async () => {
        await recordAudit('activity', id, 'update', actor, changes)
        if (added.length) await notifyNewPics({ kind: 'activity', title: project.title, names: added, actor, url: '/dashboard/activities', tagId: id })
      })
    }
    return NextResponse.json({ data: project })
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }) }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params; await connectDB()
    const prev: any = await ProjectModel.findByIdAndDelete(id).lean()
    if (prev) { const actor = await currentActor(); after(() => recordAudit('activity', id, 'delete', actor, [], `Dihapus: ${prev.title || ''}`)) }
    return NextResponse.json({ success: true })
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }) }
}
