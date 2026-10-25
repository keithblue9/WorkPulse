import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { EnhancementModel } from '@/models/Enhancement'
import { cleanEnhancement } from '@/lib/enhancementInput'
import { nextCode, sessionEmail } from '@/lib/enhancementServer'

// GET ?year=YYYY → enhancement tahun itu; tanpa year / year=all → semua (halaman memfilter lintas tahun).
export async function GET(req: NextRequest) {
  try {
    await connectDB()
    const yp = new URL(req.url).searchParams.get('year')
    const y = Number(yp)
    const filter = yp && yp !== 'all' && Number.isInteger(y) ? { year: y } : {}
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
    return NextResponse.json({ data: doc }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Gagal menyimpan enhancement' }, { status: 500 })
  }
}
