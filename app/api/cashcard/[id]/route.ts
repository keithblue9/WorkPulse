import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { CashCardModel } from '@/models/CashCard'
export async function PATCH(req:NextRequest, ctx:{params:Promise<{id:string}>}) {
  try { await connectDB(); const { id } = await ctx.params; const body = await req.json(); const item = await CashCardModel.findByIdAndUpdate(id, body, { new:true }); return NextResponse.json({ data:item }) }
  catch (e:any) { return NextResponse.json({ error:e.message }, { status:500 }) }
}
export async function DELETE(req:NextRequest, ctx:{params:Promise<{id:string}>}) {
  try { await connectDB(); const { id } = await ctx.params; await CashCardModel.findByIdAndDelete(id); return NextResponse.json({ success:true }) }
  catch (e:any) { return NextResponse.json({ error:e.message }, { status:500 }) }
}
