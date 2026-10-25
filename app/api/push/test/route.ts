import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { connectDB } from '@/lib/db'
import { PushSubscriptionModel } from '@/models/PushSubscription'
import { sendPushToUser } from '@/lib/push'

// Status notifikasi milik user yang login: server siap (VAPID) & berapa perangkat terdaftar.
export async function GET() {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  try {
    await connectDB()
    const devices = await PushSubscriptionModel.countDocuments({ userEmail: email })
    const serverReady = !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)
    return NextResponse.json({ data: { devices, serverReady } })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Gagal memuat status' }, { status: 500 })
  }
}

// Kirim notifikasi uji ke semua perangkat user yang login (hanya ke dirinya sendiri).
export async function POST() {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  try {
    const r: any = await sendPushToUser(email, { title: 'Tes notifikasi WINS', body: 'Notifikasi berjalan di perangkat ini.', url: '/dashboard/profile', tag: 'wins-test' })
    if (r?.error) return NextResponse.json({ error: r.error }, { status: 503 })
    return NextResponse.json({ data: { sent: r?.sent || 0, total: r?.total || 0 } })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Gagal mengirim' }, { status: 500 })
  }
}
