import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { AttendanceModel } from '@/models/Attendance'

export async function GET(req: NextRequest) {
  try {
    await connectDB()
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')
    const month = searchParams.get('month') // "YYYY-MM"
    const query: any = {}
    if (userId) query.userId = userId
    if (month) query.date = { $regex: `^${month}` }
    const records = await AttendanceModel.find(query).sort({ date: 1 }).lean()
    return NextResponse.json({ data: records })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB()
    const body = await req.json()
    // Upsert: one record per user per day
    const record = await AttendanceModel.findOneAndUpdate(
      { userId: body.userId, date: body.date },
      { type: body.type, note: body.note || '' },
      { upsert: true, new: true }
    ).lean()
    return NextResponse.json({ data: record })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await connectDB()
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')
    const date = searchParams.get('date')
    await AttendanceModel.deleteOne({ userId, date })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
