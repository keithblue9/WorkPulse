import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { QuickNoteModel } from '@/models/QuickNote'
import { sendPushToUser } from '@/lib/push'
import { PushSubscriptionModel } from '@/models/PushSubscription'
import { UserModel } from '@/models/User'
import { DailyAgendaModel } from '@/models/DailyAgenda'
import { AttendanceModel } from '@/models/Attendance'
import { ProjectModel } from '@/models/Project'
import { ConfigModel } from '@/models/Config'
import { computeReminderDue } from '@/lib/reminderDue'

// Kirim pengingat harian (absen + agenda hari ini) ke SEMUA member yg subscribe push.
// Dipanggil 1x/hari (guard via Config.lastDailyBroadcast) saat endpoint diakses setelah ~08:00 WIB.
async function dailyBroadcast(jakartaToday: string) {
  const [subs, users, agendas, attToday, acts] = await Promise.all([
    PushSubscriptionModel.find({}, 'userEmail').lean(),
    UserModel.find({}, 'name email active').lean(),
    DailyAgendaModel.find({ date: jakartaToday }).lean(),
    AttendanceModel.find({ date: jakartaToday }, 'userId').lean(),
    ProjectModel.find({ $or: [{ actionDate: jakartaToday }, { actionDate: { $lte: jakartaToday }, actionDateEnd: { $gte: jakartaToday } }] }, 'title').lean(),
  ]) as any[]

  const emails = Array.from(new Set((subs as any[]).map(s => s.userEmail).filter(Boolean)))
  const userByEmail = new Map<string, any>((users as any[]).map(u => [String(u.email).toLowerCase(), u]))
  const agendaByUser = new Map<string, any>((agendas as any[]).map(a => [String(a.userId), a]))
  const attendedIds = new Set<string>((attToday as any[]).map(a => String(a.userId)))
  const teamCount = (acts as any[]).length
  const teamLine = teamCount > 0 ? ` 🗓 ${teamCount} agenda tim di calendar hari ini.` : ''

  let sent = 0
  for (const email of emails) {
    const u = userByEmail.get(String(email).toLowerCase())
    if (!u || u.active === false) continue
    const uid = String(u._id)
    const agenda = agendaByUser.get(uid)
    const items = (agenda?.items || []).filter((i: any) => i.status !== 'cancelled')
    const sudahAbsen = attendedIds.has(uid)

    let body = sudahAbsen ? '✅ Presensi hari ini sudah tercatat.' : '🙌 Jangan lupa isi presensi hari ini!'
    if (items.length) {
      const top = items.slice(0, 3).map((i: any) => `${i.time && i.time !== 'fullday' ? i.time + ' ' : ''}${i.title}`).join('; ')
      body += ` 📅 Agenda kamu (${items.length}): ${top}${items.length > 3 ? ', dll' : ''}.`
    } else {
      body += ' 📅 Belum ada agenda pribadi tercatat.'
    }
    body += teamLine

    const r = await sendPushToUser(email, { title: '⏰ WinS — Pengingat Hari Ini', body, url: '/dashboard/attendance', tag: `daily-${jakartaToday}` })
    if ((r as any)?.sent) sent++
  }
  return { recipients: emails.length, sent }
}

// POST = trigger manual (test) — kirim pengingat harian sekarang juga ke semua member.
// Hanya admin/manager. Tidak mengubah guard harian (broadcast otomatis tetap jalan).
export async function POST(req: NextRequest) {
  try {
    const { getServerSession } = await import('next-auth')
    const { authOptions } = await import('@/lib/authOptions')
    const session: any = await getServerSession(authOptions as any)
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    await connectDB()
    const me: any = await UserModel.findOne({ email: session.user.email }, 'roles role').lean()
    const roles = (me?.roles?.length ? me.roles : (me?.role ? [me.role] : [])).map((r: string) => String(r).toLowerCase())
    if (!roles.some((r: string) => r === 'admin' || r === 'manager')) return NextResponse.json({ error: 'Khusus admin/manager' }, { status: 403 })
    const now = new Date(); const jakarta = new Date(now.getTime() + 7 * 3600 * 1000)
    const jakartaToday = `${jakarta.getUTCFullYear()}-${String(jakarta.getUTCMonth() + 1).padStart(2, '0')}-${String(jakarta.getUTCDate()).padStart(2, '0')}`
    const result = await dailyBroadcast(jakartaToday)
    return NextResponse.json({ ok: true, ...result })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// Vercel Cron hits this every minute (see vercel.json). Protected by CRON_SECRET so
// it can't be triggered by random requests.
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  try {
    await connectDB()
    const now = new Date()

    const notes = await QuickNoteModel.find({ 'reminder.enabled': true, archived: { $ne: true } })
    let fired = 0
    for (const note of notes as any[]) {
      const r = note.reminder
      const { due, fireKey, disable } = computeReminderDue(r, now)
      if (due && fireKey && r.lastFiredKey !== fireKey) {
        const recipients = Array.from(new Set([note.ownerEmail, ...(note.sharedWith || [])]))
        const firstItem = (note.items || []).find((i: any) => !i.checked && i.text)
        const body = firstItem ? firstItem.text : `Kamu punya ${note.items?.length || 0} item di catatan ini`
        for (const email of recipients) {
          await sendPushToUser(email, { title: `📝 ${note.title}`, body, url: '/dashboard/quicknotes', tag: `quicknote-${note._id}` })
        }
        note.reminder.lastFiredKey = fireKey
        if (disable) note.reminder.enabled = false
        await note.save()
        fired++
      }
    }
    // ===== Pengingat harian (absen + agenda) — 1x/hari, setelah ~08:00 WIB =====
    let broadcast: any = null
    const jakarta = new Date(now.getTime() + 7 * 3600 * 1000)
    const jakartaToday = `${jakarta.getUTCFullYear()}-${String(jakarta.getUTCMonth() + 1).padStart(2, '0')}-${String(jakarta.getUTCDate()).padStart(2, '0')}`
    const jamWIB = jakarta.getUTCHours()
    if (jamWIB >= 8) {
      const cfg = await ConfigModel.findOne({}, 'lastDailyBroadcast').lean() as any
      if (!cfg || cfg.lastDailyBroadcast !== jakartaToday) {
        broadcast = await dailyBroadcast(jakartaToday)
        // Lock hanya kalau sudah ada penerima (biar hari pertama ga kelewat saat belum ada yg subscribe)
        if (broadcast && broadcast.recipients > 0) {
          await ConfigModel.updateOne({}, { $set: { lastDailyBroadcast: jakartaToday } }, { upsert: true })
        }
      }
    }

    return NextResponse.json({ ok: true, checked: notes.length, fired, broadcast })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}