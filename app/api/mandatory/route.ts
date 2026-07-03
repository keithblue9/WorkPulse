import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { MandatoryModel } from '@/models/Mandatory'

// GET /api/mandatory?year=YYYY -> semua record mandatory tahun itu
export async function GET(req: NextRequest) {
  try {
    await connectDB()
    const { searchParams } = new URL(req.url)
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))
    const data = await MandatoryModel.find({ year }).lean()
    return NextResponse.json({ data })
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}

// PATCH /api/mandatory -> upsert satu member (bisa diisi siapa saja)
// body: { userId, year, patch: { mcu?, trainings?, supportKpi? } }
export async function PATCH(req: NextRequest) {
  try {
    await connectDB()
    const { userId, year, patch } = await req.json()
    if (!userId || !year) return NextResponse.json({ error: 'userId & year wajib' }, { status: 400 })
    const set: any = {}
    if (patch?.mcu !== undefined) set.mcu = patch.mcu
    if (patch?.trainings !== undefined) set.trainings = patch.trainings
    if (patch?.supportKpi !== undefined) set.supportKpi = patch.supportKpi
    const doc = await MandatoryModel.findOneAndUpdate(
      { userId, year },
      { $set: set, $setOnInsert: { userId, year } },
      { new: true, upsert: true }
    ).lean()
    return NextResponse.json({ data: doc })
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}
