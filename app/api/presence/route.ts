import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { PresenceModel } from '@/models/Presence'

const ONLINE_WINDOW_MS = 90 * 1000 // considered "online" if seen within last 90s

export async function POST(req: NextRequest) {
  try {
    await connectDB()
    const { key, name, role, isGuest } = await req.json()
    if (!key || !name) return NextResponse.json({ error: 'missing key/name' }, { status: 400 })
    await PresenceModel.updateOne(
      { key: String(key) },
      { $set: { name: String(name).slice(0, 80), role: role || '', isGuest: !!isGuest, lastSeen: new Date() } },
      { upsert: true }
    )
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function GET() {
  try {
    await connectDB()
    const since = new Date(Date.now() - ONLINE_WINDOW_MS)
    const list = await PresenceModel.find({ lastSeen: { $gte: since } }).sort({ isGuest: 1, name: 1 }).lean()
    return NextResponse.json({ data: list.map((p: any) => ({ key: p.key, name: p.name, role: p.role, isGuest: p.isGuest, lastSeen: p.lastSeen })) })
  } catch (e: any) {
    return NextResponse.json({ error: e.message, data: [] }, { status: 200 })
  }
}
