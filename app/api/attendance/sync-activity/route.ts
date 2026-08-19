import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { AttendanceModel } from '@/models/Attendance'
import { UserModel } from '@/models/User'

// Sinkronisasi presensi PIC dari aktivitas OFFLINE.
//  - offlineScope 'luar'    -> tipe 'dinas' (Dinas Luar Kota)
//  - offlineScope 'jakarta' -> tipe 'izin'  (Izin / Meeting Luar Kantor)
//
// Slot yang dibuat ditandai sourceActivityId supaya:
//  1) tidak dobel kalau aktivitas disimpan berulang kali,
//  2) bisa dicabut lagi kalau aktivitas diubah jadi online / dihapus.
//
// POST /api/attendance/sync-activity
// body: { activityId, pics:[nama], dates:[YYYY-MM-DD], offlineScope, mode, title, startTime, endTime }

const typeFor = (scope: string) => scope === 'luar' ? 'dinas' : scope === 'jakarta' ? 'izin' : ''

function norm(s: any) { return String(s ?? '').trim().toLowerCase() }

export async function POST(req: NextRequest) {
  try {
    await connectDB()
    const body = await req.json()
    const activityId = String(body?.activityId || '')
    if (!activityId) return NextResponse.json({ error: 'activityId wajib' }, { status: 400 })

    // Selalu bersihkan slot lama milik aktivitas ini dulu (idempoten).
    // $pull aman walau tidak ada yang cocok.
    await AttendanceModel.updateMany(
      { 'slots.sourceActivityId': activityId },
      { $pull: { slots: { sourceActivityId: activityId } } as any }
    )

    const scope = String(body?.offlineScope || '')
    const slotType = typeFor(scope)
    const isOffline = String(body?.mode || '') === 'offline'
    const pics: string[] = Array.isArray(body?.pics) ? body.pics.filter(Boolean) : []
    const dates: string[] = Array.isArray(body?.dates)
      ? Array.from(new Set(body.dates.filter((d: any) => /^\d{4}-\d{2}-\d{2}$/.test(String(d)))))
      : []

    // Bukan offline / scope belum dipilih / tidak ada PIC atau tanggal -> cukup bersih-bersih saja.
    if (!isOffline || !slotType || pics.length === 0 || dates.length === 0) {
      return NextResponse.json({ data: { created: 0, cleared: true } })
    }

    // Petakan nama PIC -> userId (cocokkan nama, fallback email)
    const users = await UserModel.find({}, '_id name email').lean()
    const byName = new Map<string, string>()
    for (const u of users as any[]) {
      if (u.name) byName.set(norm(u.name), String(u._id))
      if (u.email) byName.set(norm(u.email), String(u._id))
    }
    const userIds = Array.from(new Set(
      pics.map(p => byName.get(norm(p))).filter(Boolean) as string[]
    ))
    const unmatched = pics.filter(p => !byName.get(norm(p)))

    if (userIds.length === 0) {
      return NextResponse.json({ data: { created: 0, unmatched } })
    }

    const slotBase = {
      type: slotType,
      label: String(body?.title || '').slice(0, 120),
      startTime: body?.startTime || 'fullday',
      endTime: body?.endTime || 'fullday',
      isFullDay: !(body?.startTime && body?.endTime),
      sourceActivityId: activityId,
    }

    let created = 0
    for (const userId of userIds) {
      for (const date of dates) {
        const existing = await AttendanceModel.findOne({ userId, date })
        if (existing) {
          existing.slots.push(slotBase as any)
          await existing.save()
        } else {
          await AttendanceModel.create({ userId, date, slots: [slotBase] })
        }
        created++
      }
    }

    return NextResponse.json({ data: { created, userIds: userIds.length, dates: dates.length, unmatched, slotType } })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
