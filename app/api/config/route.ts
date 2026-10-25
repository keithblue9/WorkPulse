import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { ConfigModel } from '@/models/Config'
import { DEFAULT_WIDGETS } from '@/lib/defaults'
import { mergeConfigDefaults, loginSlice, withoutLoginBackgrounds } from '@/lib/configMerge'
import { currentRoles } from '@/lib/session'

// GET is read-only: a missing or legacy config document is completed in memory
// (see lib/configMerge) and never written back. Only an explicit save (PATCH) writes.
// ?scope=login        → public slice for the login page (allowed without a session, see lib/access)
// ?include=loginBackgrounds → full config incl. login images (Configuration page)
// default              → full config without the heavy login images
export async function GET(req: NextRequest) {
  try {
    await connectDB()
    const { searchParams } = new URL(req.url)
    const doc = await ConfigModel.findOne({}).lean() as any
    const base = doc || (new ConfigModel({}) as any).toObject()
    const cfg = mergeConfigDefaults(base, DEFAULT_WIDGETS)
    const headers = { 'Cache-Control': 'no-store' }
    if (searchParams.get('scope') === 'login') return NextResponse.json({ data: loginSlice(cfg) }, { headers })
    if (searchParams.get('include') === 'loginBackgrounds') return NextResponse.json({ data: cfg }, { headers })
    return NextResponse.json({ data: withoutLoginBackgrounds(cfg) }, { headers })
  } catch (e:any) {
    console.error('GET /api/config error', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await connectDB()
    const body = await req.json()
    // Only admins change configuration; other internal users may only save the dashboard layout.
    const roles = (await currentRoles()) || []
    if (!roles.includes('admin') && Object.keys(body || {}).some(k => k !== 'dashboardWidgets')) {
      return NextResponse.json({ error: 'Khusus admin' }, { status: 403 })
    }
    const cfg = await ConfigModel.findOneAndUpdate({}, body, { new:true, upsert:true })
    return NextResponse.json({ data: cfg }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e:any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
