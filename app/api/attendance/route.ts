import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { AttendanceModel } from '@/models/Attendance'
import { isDuplicateSlot } from '@/lib/attendanceSlots'

export async function GET(req: NextRequest) {
  try {
    await connectDB()
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')
    const month = searchParams.get('month')
    const query: any = {}
    if (userId) query.userId = userId
    if (month) query.date = { $regex: `^${month}` }
    const records = await AttendanceModel.find(query).sort({ date: 1 }).lean()
    return NextResponse.json({ data: records })
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }) }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB()
    const body = await req.json()
    // Add a slot to existing record, or create new
    const existing = await AttendanceModel.findOne({ userId: body.userId, date: body.date })
    if (existing) {
      if (body.slot) {
        // Cegah entri dobel (mis. tombol tertekan 2x): tipe + jam sama sudah ada -> 409
        if (isDuplicateSlot(existing.slots, body.slot)) {
          return NextResponse.json({ error: 'Kehadiran ini sudah tercatat di tanggal tersebut', duplicate: true, data: existing }, { status: 409 })
        }
        existing.slots.push(body.slot)
        await existing.save()
        return NextResponse.json({ data: existing })
      }
      // Replace all slots
      existing.slots = body.slots || existing.slots
      existing.type = body.type || existing.type
      existing.note = body.note || existing.note
      await existing.save()
      return NextResponse.json({ data: existing })
    }
    const record = await AttendanceModel.create({
      userId: body.userId,
      date: body.date,
      type: body.type,
      note: body.note,
      slots: body.slot ? [body.slot] : (body.slots || []),
    })
    return NextResponse.json({ data: record })
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}

export async function DELETE(req: NextRequest) {
  try {
    await connectDB()
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')
    const date = searchParams.get('date')
    const slotId = searchParams.get('slotId')
    if (slotId) {
      const rec = await AttendanceModel.findOne({ userId, date })
      if (rec) { rec.slots = rec.slots.filter((s: any) => s._id.toString() !== slotId); await rec.save() }
      return NextResponse.json({ success: true })
    }
    await AttendanceModel.deleteOne({ userId, date })
    return NextResponse.json({ success: true })
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }) }
}
