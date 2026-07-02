import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { AttendanceModel } from '@/models/Attendance'

// Hari Libur berlaku untuk SEMUA member → tambah/hapus slot libur di semua userId pada tanggal itu.
export async function POST(req: NextRequest) {
  try {
    await connectDB()
    const { date, slot, userIds } = await req.json()
    if (!date || !slot || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ error: 'date, slot, userIds wajib' }, { status: 400 })
    }
    let applied = 0
    for (const userId of userIds) {
      const existing = await AttendanceModel.findOne({ userId, date })
      if (existing) {
        // hindari duplikat libur di tanggal sama
        const hasHoliday = (existing.slots || []).some((s: any) => s.type === slot.type)
        if (!hasHoliday) { existing.slots.push(slot); await existing.save(); applied++ }
      } else {
        await AttendanceModel.create({ userId, date, slots: [slot] }); applied++
      }
    }
    return NextResponse.json({ success: true, applied })
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}

export async function DELETE(req: NextRequest) {
  try {
    await connectDB()
    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date')
    const type = searchParams.get('type') // key tipe libur
    if (!date || !type) return NextResponse.json({ error: 'date & type wajib' }, { status: 400 })
    const recs = await AttendanceModel.find({ date, 'slots.type': type })
    for (const rec of recs) {
      rec.slots = rec.slots.filter((s: any) => s.type !== type)
      await rec.save()
    }
    return NextResponse.json({ success: true, cleared: recs.length })
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}
