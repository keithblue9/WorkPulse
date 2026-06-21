import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { QuickNoteModel } from '@/models/QuickNote'
import { sendPushToUser } from '@/lib/push'

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
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

    const notes = await QuickNoteModel.find({ 'reminder.enabled': true, archived: { $ne: true } })
    let fired = 0
    for (const note of notes as any[]) {
      const r = note.reminder
      let due = false
      let fireKey = ''

      if (r.mode === 'once' && r.datetime) {
        const target = new Date(r.datetime)
        // Fire once the target time has passed, within a 2-minute catch-up window
        // (cron runs every minute, so this tolerates minor scheduling drift).
        const diffMs = now.getTime() - target.getTime()
        if (diffMs >= 0 && diffMs < 120000) { due = true; fireKey = `once-${r.datetime}` }
      } else if (r.mode === 'daily' && r.time) {
        if (r.time === hhmm) { due = true; fireKey = `daily-${todayStr}-${r.time}` }
      }

      if (due && fireKey && r.lastFiredKey !== fireKey) {
        const recipients = Array.from(new Set([note.ownerEmail, ...(note.sharedWith || [])]))
        const firstItem = (note.items || []).find((i: any) => !i.checked)
        const body = firstItem ? firstItem.text : `Kamu punya ${note.items?.length || 0} item di catatan ini`
        for (const email of recipients) {
          await sendPushToUser(email, { title: `📝 ${note.title}`, body, url: '/dashboard/notes', tag: `quicknote-${note._id}` })
        }
        note.reminder.lastFiredKey = fireKey
        // One-time reminders auto-disable after firing; daily reminders stay enabled for tomorrow.
        if (r.mode === 'once') note.reminder.enabled = false
        await note.save()
        fired++
      }
    }
    return NextResponse.json({ ok: true, checked: notes.length, fired })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
