import { NextRequest, NextResponse, after } from 'next/server'
import { addedPics } from '@/lib/changeLog'
import { currentActor, notifyNewPics } from '@/lib/notifyServer'
import { connectDB } from '@/lib/db'
import { EnhancementModel } from '@/models/Enhancement'
import { cleanEnhancement } from '@/lib/enhancementInput'
import { nextCode, sessionEmail } from '@/lib/enhancementServer'
import { currentRoles } from '@/lib/session'

// GET ?year=YYYY → enhancement tahun itu; tanpa year / year=all → semua (halaman memfilter lintas tahun).
export async function GET(req: NextRequest) {
  try {
    await connectDB()
    const yp = new URL(req.url).searchParams.get('year')
    const y = Number(yp)
    const filter: Record<string, unknown> = yp && yp !== 'all' && Number.isInteger(y) ? { year: y } : {}
    const roles = await currentRoles()
    if (!roles || roles.every(r => r === 'guest')) filter.hiddenGuest = { $ne: true }
    const data = await EnhancementModel.find(filter).sort({ app: 1, code: 1 }).lean()
    return NextResponse.json({ data })
  } catch {
    return NextResponse.json({ error: 'Gagal memuat enhancement' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB()
    const r = cleanEnhancement(await req.json().catch(() => ({})), false)
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 })
    const email = await sessionEmail()
    const code = r.data.code || await nextCode(r.data.app!, r.data.year!)
    const doc = await EnhancementModel.create({ ...r.data, code, createdBy: email, updatedBy: email })
    const added = addedPics([], (doc as any).pic)
    if (added.length) { const actor = await currentActor(); after(() => notifyNewPics({ kind: 'enhancement', title: (doc as any).title, names: added, actor, url: `/dashboard/enhancement?e=${doc._id}`, tagId: String(doc._id) })) }
    return NextResponse.json({ data: doc }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Gagal menyimpan enhancement' }, { status: 500 })
  }
}
