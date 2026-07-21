import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { ThirdPartyEventModel } from '@/models/ThirdPartyEvent'

export async function PATCH(req:NextRequest, ctx:{params:Promise<{id:string}>}) {
  try {
    await connectDB(); const { id } = await ctx.params; const body = await req.json()
    const d = body.tanggalMulai || body.tanggalKegiatan
    if (d) {
      const dt = new Date(d)
      if (!isNaN(dt.getTime())) { body.year = dt.getFullYear(); body.month = dt.getMonth()+1 }
    }
    const item = await ThirdPartyEventModel.findByIdAndUpdate(id, body, { new:true })
    return NextResponse.json({ data:item })
  } catch (e:any) { return NextResponse.json({ error:e.message }, { status:500 }) }
}

export async function DELETE(req:NextRequest, ctx:{params:Promise<{id:string}>}) {
  try {
    await connectDB(); const { id } = await ctx.params
    await ThirdPartyEventModel.findByIdAndDelete(id)
    return NextResponse.json({ success:true })
  } catch (e:any) { return NextResponse.json({ error:e.message }, { status:500 }) }
}
