import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { SouvenirModel } from '@/models/Souvenir'

export async function PATCH(req:NextRequest, ctx:{params:Promise<{id:string}>}) {
  try {
    await connectDB(); const { id } = await ctx.params; const body = await req.json()
    // Aksi tambah pergerakan stok: { addMove: {type,qty,date,note,by} }
    if (body.addMove) {
      const m = body.addMove
      if (!['in','out'].includes(m.type) || !(Number(m.qty) > 0)) return NextResponse.json({ error:'Move tidak valid' }, { status:400 })
      const item = await SouvenirModel.findByIdAndUpdate(id, { $push:{ moves:{ ...m, qty:Number(m.qty) } } }, { new:true })
      return NextResponse.json({ data:item })
    }
    // Aksi hapus 1 pergerakan stok: { removeMoveId }
    if (body.removeMoveId) {
      const item = await SouvenirModel.findByIdAndUpdate(id, { $pull:{ moves:{ _id: body.removeMoveId } } }, { new:true })
      return NextResponse.json({ data:item })
    }
    const item = await SouvenirModel.findByIdAndUpdate(id, body, { new:true })
    return NextResponse.json({ data:item })
  } catch (e:any) { return NextResponse.json({ error:e.message }, { status:500 }) }
}

export async function DELETE(req:NextRequest, ctx:{params:Promise<{id:string}>}) {
  try {
    await connectDB(); const { id } = await ctx.params
    await SouvenirModel.findByIdAndDelete(id)
    return NextResponse.json({ success:true })
  } catch (e:any) { return NextResponse.json({ error:e.message }, { status:500 }) }
}
