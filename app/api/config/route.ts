import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { ConfigModel } from '@/models/Config'
import { DEFAULT_WIDGETS } from '@/lib/defaults'
import { mergeConfigDefaults, loginSlice, withoutLoginBackgrounds, configSizeReport } from '@/lib/configMerge'
import { jsonRevalidate } from '@/lib/httpCache'
import { currentRoles } from '@/lib/session'
import { guestConfigSlice, normalizeGuestAccess } from '@/lib/guestPolicy'
import { clearGuestPolicyCache, guestPolicyForRequest } from '@/lib/guestServer'

// GET is read-only: a missing or legacy config document is completed in memory
// (see lib/configMerge) and never written back. Only an explicit save (PATCH) writes.
// ?scope=login        → public slice for the login page (allowed without a session, see lib/access)
// ?include=loginBackgrounds → full config incl. login images (Configuration page)
// default              → full config without the heavy login images
// Respons memakai ETag + `private, no-cache` (lib/httpCache): browser menyimpan salinan tapi selalu validasi ulang,
// jadi perubahan dari admin langsung terlihat sementara config yang tidak berubah dibalas 304 (tanpa badan).
// Dulu `no-store` → config penuh terkirim ulang setiap kali.
let lastHeavyLog = 0
function reply(req: NextRequest, data: unknown) {
  // Penanda ukuran: kalau config > 64 KB, catat field terbesar (maks 1x/menit per instance) supaya sumbernya mudah dilacak di Vercel Logs.
  if (Date.now() - lastHeavyLog > 60_000) {
    const r = configSizeReport(data)
    if (r.total > 64_000) { lastHeavyLog = Date.now(); console.warn('[config] payload besar', r.total, 'bytes; field terbesar:', JSON.stringify(r.top)) }
  }
  return jsonRevalidate(req, { data })
}

export async function GET(req: NextRequest) {
  try {
    await connectDB()
    const { searchParams } = new URL(req.url)
    const doc = await ConfigModel.findOne({}).lean() as any
    const base = doc || (new ConfigModel({}) as any).toObject()
    const cfg = mergeConfigDefaults(base, DEFAULT_WIDGETS)
    if (searchParams.get('scope') === 'login') return reply(req, loginSlice(cfg))
    // Tamu: hanya potongan aman (tanpa WhatsApp/kasir/rekening/nilai anggaran), dengan menu efektif.
    const guest = await guestPolicyForRequest()
    if (guest) return reply(req, guestConfigSlice(cfg, guest.menus))
    if (searchParams.get('include') === 'loginBackgrounds') return reply(req, cfg)
    return reply(req, withoutLoginBackgrounds(cfg))
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
    if (body && 'guestAccess' in body) body.guestAccess = normalizeGuestAccess(body.guestAccess)
    const cfg = await ConfigModel.findOneAndUpdate({}, body, { new:true, upsert:true })
    if (body && ('roleDefs' in body || 'guestAccess' in body || 'guestLayout' in body)) clearGuestPolicyCache()
    return NextResponse.json({ data: cfg }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e:any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
