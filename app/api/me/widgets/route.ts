import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { connectDB } from '@/lib/db'
import { UserModel } from '@/models/User'
import { ConfigModel } from '@/models/Config'
import { userRolesOf } from '@/lib/perms'
import { sanitizeLayoutInput } from '@/lib/widgets'

// GET  → { mine, guest } susunan widget tersimpan (null = belum pernah diatur → klien pakai bawaan)
// PUT  { layout, scope?: 'guest' } → simpan susunan pribadi; scope=guest khusus admin.
// DELETE ?scope=guest → kembali ke bawaan.
async function who() {
  const s: any = await getServerSession(authOptions)
  return s?.user?.email ? { email: String(s.user.email), roles: userRolesOf(s.user) } : null
}

export async function GET() {
  const me = await who(); if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  try {
    await connectDB()
    const isGuest = me.roles.every(r => r === 'guest')
    const [u, c]: any[] = await Promise.all([isGuest ? null : UserModel.findOne({ email: me.email }, 'dashboardLayout').lean(), ConfigModel.findOne({}, 'guestLayout').lean()])
    const arr = (x: any) => (Array.isArray(x) && x.length ? x.map((p: any) => ({ id: p.id, size: p.size })) : null)
    return NextResponse.json({ data: { mine: arr(u?.dashboardLayout), guest: arr(c?.guestLayout) } }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: any) { return NextResponse.json({ error: e?.message || 'Gagal memuat' }, { status: 500 }) }
}

export async function PUT(req: NextRequest) {
  const me = await who(); if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const layout = sanitizeLayoutInput(body?.layout)
  if (!layout) return NextResponse.json({ error: 'Susunan widget tidak valid' }, { status: 400 })
  try {
    await connectDB()
    if (body?.scope === 'guest') {
      if (!me.roles.includes('admin')) return NextResponse.json({ error: 'Khusus admin' }, { status: 403 })
      await ConfigModel.updateOne({}, { $set: { guestLayout: layout } }, { upsert: true })
    } else {
      if (me.roles.every(r => r === 'guest')) return NextResponse.json({ error: 'Akses tamu tidak diizinkan' }, { status: 403 })
      await UserModel.updateOne({ email: me.email }, { $set: { dashboardLayout: layout } })
    }
    return NextResponse.json({ data: layout })
  } catch (e: any) { return NextResponse.json({ error: e?.message || 'Gagal menyimpan' }, { status: 500 }) }
}

export async function DELETE(req: NextRequest) {
  const me = await who(); if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const guest = new URL(req.url).searchParams.get('scope') === 'guest'
  try {
    await connectDB()
    if (guest) {
      if (!me.roles.includes('admin')) return NextResponse.json({ error: 'Khusus admin' }, { status: 403 })
      await ConfigModel.updateOne({}, { $unset: { guestLayout: 1 } })
    } else await UserModel.updateOne({ email: me.email }, { $unset: { dashboardLayout: 1 } })
    return NextResponse.json({ ok: true })
  } catch (e: any) { return NextResponse.json({ error: e?.message || 'Gagal' }, { status: 500 }) }
}
