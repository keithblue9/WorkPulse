import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { connectDB } from '@/lib/db'
import { QuickNoteModel } from '@/models/QuickNote'
import { sendPushToUser } from '@/lib/push'
import { computeReminderDue } from '@/lib/reminderDue'

// Called by the client (poll) while the app is open/active, so reminders fire promptly
// without needing a per-minute server cron (which Vercel Hobby plans don't allow —
// the vercel.json cron is a once-daily safety net for reminders missed while the app
// was closed). Only checks reminders relevant to the signed-in user.
export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    await connectDB()
    const email = session.user.email
    const now = new Date()

    const notes = await QuickNoteModel.find({
      'reminder.enabled': true,
      archived: { $ne: true },
      $or: [{ ownerEmail: email }, { sharedWith: email }],
    })

    let fired = 0
    for (const note of notes as any[]) {
      const r = note.reminder
      const { due, fireKey, disable } = computeReminderDue(r, now)
      if (due && fireKey && r.lastFiredKey !== fireKey) {
        const recipients = Array.from(new Set([note.ownerEmail, ...(note.sharedWith || [])]))
        const firstItem = (note.items || []).find((i: any) => !i.checked && i.text)
        const body = firstItem ? firstItem.text : `Kamu punya ${note.items?.length || 0} item di catatan ini`
        for (const r2 of recipients) await sendPushToUser(r2, { title: `📝 ${note.title}`, body, url: '/dashboard/quicknotes', tag: `quicknote-${note._id}` })
        note.reminder.lastFiredKey = fireKey
        if (disable) note.reminder.enabled = false
        await note.save()
        fired++
      }
    }
    return NextResponse.json({ ok: true, fired })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
