import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { ConfigModel } from '@/models/Config'
import { DEFAULT_WIDGETS, DEFAULT_FONNTE } from '@/lib/defaults'
import { mergeConfigDefaults } from '@/lib/configMerge'

// GET is read-only: a missing or legacy config document is completed in memory
// (see lib/configMerge) and never written back. Only an explicit save (PATCH) writes.
export async function GET() {
  try {
    await connectDB()
    const doc = await ConfigModel.findOne({}).lean() as any
    const base = doc || (new ConfigModel({}) as any).toObject()
    const cfg = mergeConfigDefaults(base, DEFAULT_WIDGETS)
    if (!cfg.fonnte || !cfg.fonnte.apiUrl) cfg.fonnte = DEFAULT_FONNTE
    return NextResponse.json({ data: cfg }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e:any) {
    console.error('GET /api/config error', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await connectDB()
    const body = await req.json()
    const cfg = await ConfigModel.findOneAndUpdate({}, body, { new:true, upsert:true })
    return NextResponse.json({ data: cfg }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e:any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
