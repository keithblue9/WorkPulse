import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { ProjectModel } from '@/models/Project'

// PATCH /api/projects/recurring { groupId, patch, fromDate? } -> update semua occurrence dalam group
// (fromDate: hanya yg actionDate >= fromDate, mis. "ubah mulai occurrence ini ke depan")
export async function PATCH(req: NextRequest) {
  try {
    await connectDB()
    const { groupId, patch, fromDate } = await req.json()
    if (!groupId || !patch) return NextResponse.json({ error: 'groupId & patch wajib' }, { status: 400 })
    // Jangan timpa field per-occurrence (actionDate, showInList, _id)
    const safe: any = { ...patch }
    delete safe.actionDate; delete safe._id; delete safe.recurrenceGroupId
    const q: any = { recurrenceGroupId: groupId }
    if (fromDate) q.actionDate = { $gte: fromDate }
    const res = await ProjectModel.updateMany(q, { $set: safe })
    return NextResponse.json({ success: true, modified: res.modifiedCount })
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}

// DELETE /api/projects/recurring?groupId=...&fromDate=... -> hapus semua occurrence dalam group
export async function DELETE(req: NextRequest) {
  try {
    await connectDB()
    const { searchParams } = new URL(req.url)
    const groupId = searchParams.get('groupId')
    const fromDate = searchParams.get('fromDate')
    if (!groupId) return NextResponse.json({ error: 'groupId wajib' }, { status: 400 })
    const q: any = { recurrenceGroupId: groupId }
    if (fromDate) q.actionDate = { $gte: fromDate }
    const res = await ProjectModel.deleteMany(q)
    return NextResponse.json({ success: true, deleted: res.deletedCount })
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}
