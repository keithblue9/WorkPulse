import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { CashCardModel } from '@/models/CashCard'
export async function GET(req:NextRequest) {
  try {
    await connectDB()
    const { searchParams } = new URL(req.url)
    const year = searchParams.get('year')
    const q:any = {}
    if (year) q.year = Number(year)
    const items = await CashCardModel.find(q).sort({ year:-1, month:-1, date:-1, createdAt:-1 }).lean()
    return NextResponse.json({ data:items })
  } catch (e:any) { return NextResponse.json({ error:e.message }, { status:500 }) }
}
export async function POST(req:NextRequest) {
  try { await connectDB(); const body = await req.json(); const item = await CashCardModel.create(body); return NextResponse.json({ data:item }, { status:201 }) }
  catch (e:any) { return NextResponse.json({ error:e.message }, { status:500 }) }
}
