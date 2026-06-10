import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { AnnouncementModel } from '@/models/Announcement'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await connectDB()
    const body = await req.json()
    const ann = await AnnouncementModel.findByIdAndUpdate(id, body, { new: true }).lean()
    return NextResponse.json({ data: ann })
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }) }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await connectDB()
    await AnnouncementModel.findByIdAndDelete(id)
    return NextResponse.json({ success: true })
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }) }
}
