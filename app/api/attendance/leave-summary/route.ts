import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { AttendanceModel } from '@/models/Attendance'

// Ringkasan cuti (default type 'cuti') per user dalam 1 tahun.
// Return: [{ userId, dates:[{date, note, fullDay}], total }]
export async function GET(req: NextRequest) {
  try {
    await connectDB()
    const { searchParams } = new URL(req.url)
    const year = searchParams.get('year') || String(new Date().getFullYear())
    const type = searchParams.get('type') || 'cuti'

    const recs = await AttendanceModel.find({ date: { $regex: `^${year}-` }, 'slots.type': type }).lean()
    const byUser: Record<string, { userId: string; dates: any[]; total: number }> = {}
    for (const rec of recs as any[]) {
      const slots = (rec.slots || []).filter((s: any) => s.type === type)
      if (!slots.length) continue
      if (!byUser[rec.userId]) byUser[rec.userId] = { userId: rec.userId, dates: [], total: 0 }
      const s0 = slots[0]
      const fullDay = !s0.startTime || !s0.endTime || s0.startTime === 'fullday' || s0.endTime === 'fullday' || s0.isFullDay === true
      byUser[rec.userId].dates.push({ date: rec.date, note: s0.note || '', fullDay })
      byUser[rec.userId].total += 1
    }
    const data = Object.values(byUser).map(u => ({ ...u, dates: u.dates.sort((a, b) => a.date.localeCompare(b.date)) }))
    return NextResponse.json({ data })
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}
