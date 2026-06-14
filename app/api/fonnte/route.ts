import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { ConfigModel } from '@/models/Config'
import { UserModel } from '@/models/User'

// POST /api/fonnte  body: { target: '08xx', message: '...', token?: 'override' }
export async function POST(req:NextRequest) {
  try {
    await connectDB()
    const body = await req.json()
    const { target, message, token: overrideToken } = body
    if (!target || !message) return NextResponse.json({ error:'target dan message wajib diisi' }, { status:400 })

    const cfg = await ConfigModel.findOne({}).lean() as any

    // Token resolution priority:
    // 1. explicit override token in request
    // 2. the user selected as cashierUserId in config (regardless of their role)
    // 3. any user with role/roles 'cashier'
    let token = overrideToken
    let resolvedFrom = 'override'
    if (!token && cfg?.fonnte?.cashierUserId) {
      const selected = await UserModel.findById(cfg.fonnte.cashierUserId).lean() as any
      if (selected?.fonnteToken) { token = selected.fonnteToken; resolvedFrom = `config cashierUserId (${selected.name})` }
    }
    if (!token) {
      const cashier = await UserModel.findOne({ $or:[{role:'cashier'},{roles:'cashier'}] }).lean() as any
      if (cashier?.fonnteToken) { token = cashier.fonnteToken; resolvedFrom = `role cashier (${cashier.name})` }
    }
    if (!token) return NextResponse.json({ error:'Token Fonnte belum diset. Pilih Cashier User di config, lalu edit user tsb di menu Member dan isi field Token Fonnte.' }, { status:400 })

    const url = cfg?.fonnte?.apiUrl || 'https://api.fonnte.com/send'

    // Normalize phone: Fonnte expects 628xxx or 08xxx. Strip spaces/dashes.
    let normTarget = String(target).replace(/[\s\-+]/g, '')
    if (normTarget.startsWith('0')) normTarget = '62' + normTarget.slice(1)

    const formData = new FormData()
    formData.append('target', normTarget)
    formData.append('message', message)

    const r = await fetch(url, { method:'POST', headers:{ Authorization: token }, body: formData })
    const data = await r.json().catch(()=>({status:false, reason:'invalid response from fonnte'}))

    // Fonnte returns { status: true/false, reason, id, ... }
    if (data.status === false || data.status === 'false') {
      return NextResponse.json({ error:`Fonnte menolak: ${data.reason || 'unknown'}. Cek token & nomor device aktif di fonnte.com`, fonnte:data, resolvedFrom }, { status:400 })
    }
    return NextResponse.json({ success:true, fonnte: data, resolvedFrom })
  } catch (e:any) { return NextResponse.json({ error:e.message }, { status:500 }) }
}
