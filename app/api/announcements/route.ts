import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { AnnouncementModel } from '@/models/Announcement'

export async function GET(req: NextRequest) {
  try {
    await connectDB()
    const announcements = await AnnouncementModel.find({}).sort({ pinned: -1, createdAt: -1 }).lean()
    return NextResponse.json({ data: announcements })
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }) }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB()
    const body = await req.json()
    const ann = await AnnouncementModel.create(body)
    return NextResponse.json({ data: ann }, { status: 201 })
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }) }
}
