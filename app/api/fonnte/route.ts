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
    if (!target || !message) return NextResponse.json({ error:'target and message required' }, { status:400 })

    // Find cashier token from user with role cashier (or override)
    let token = overrideToken
    if (!token) {
      const cashier = await UserModel.findOne({ $or:[{role:'cashier'},{roles:'cashier'}] }).lean() as any
      token = cashier?.fonnteToken
    }
    if (!token) return NextResponse.json({ error:'No Fonnte token configured for any cashier user. Set fonnteToken on a cashier user.' }, { status:400 })

    const cfg = await ConfigModel.findOne({}).lean() as any
    const url = cfg?.fonnte?.apiUrl || 'https://api.fonnte.com/send'

    const formData = new FormData()
    formData.append('target', target)
    formData.append('message', message)

    const r = await fetch(url, { method:'POST', headers:{ Authorization: token }, body: formData })
    const data = await r.json().catch(()=>({status:'unknown'}))
    return NextResponse.json({ success:true, fonnte: data })
  } catch (e:any) { return NextResponse.json({ error:e.message }, { status:500 }) }
}
