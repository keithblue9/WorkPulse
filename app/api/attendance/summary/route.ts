import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { AttendanceModel } from '@/models/Attendance'
import { UserModel } from '@/models/User'

export async function GET(req: NextRequest) {
  try {
    await connectDB()
    const { searchParams } = new URL(req.url)
    const month = searchParams.get('month') || new Date().toISOString().slice(0, 7)

    const [users, records] = await Promise.all([
      UserModel.find({ role: { $in: ['manager', 'member'] } }).lean(),
      AttendanceModel.find({ date: { $regex: `^${month}` } }).lean(),
    ])

    // Build per-user summary
    const summary = users.map((u) => {
      const userRecords = records.filter((r) => r.userId === u._id.toString())
      const counts: Record<string, number> = {}
      userRecords.forEach((r) => {
        counts[r.type] = (counts[r.type] || 0) + 1
      })
      return {
        userId: u._id.toString(),
        name: u.name,
        division: u.division,
        counts,
        total: userRecords.length,
      }
    })

    // Team-level counts
    const teamCounts: Record<string, number> = {}
    records.forEach((r) => {
      teamCounts[r.type] = (teamCounts[r.type] || 0) + 1
    })

    return NextResponse.json({ data: { summary, teamCounts, month } })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
