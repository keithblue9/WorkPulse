import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { AttendanceModel } from '@/models/Attendance'

// GET /api/attendance/overview?from=YYYY-MM-DD&to=YYYY-MM-DD -> semua attendance (semua member) di rentang
export async function GET(req: NextRequest) {
  try {
    await connectDB()
    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    if (!from || !to) return NextResponse.json({ error: 'from & to wajib' }, { status: 400 })
    const data = await AttendanceModel.find({ date: { $gte: from, $lte: to } }, 'userId date slots').lean()
    return NextResponse.json({ data })
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}
