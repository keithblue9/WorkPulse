import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { ThirdPartyEventModel } from '@/models/ThirdPartyEvent'

// GET /api/thirdparty?kind=rencana&year=2026&month=5
export async function GET(req:NextRequest) {
  try {
    await connectDB()
    const { searchParams } = new URL(req.url)
    const q:any = {}
    const kind = searchParams.get('kind'); if (kind) q.kind = kind
    const year = searchParams.get('year'); if (year) q.year = Number(year)
    const month = searchParams.get('month'); if (month) q.month = Number(month)
    const items = await ThirdPartyEventModel.find(q).sort({ year:-1, month:-1, createdAt:-1 }).lean()
    return NextResponse.json({ data: items })
  } catch (e:any) { return NextResponse.json({ error:e.message }, { status:500 }) }
}

export async function POST(req:NextRequest) {
  try {
    await connectDB()
    const body = await req.json()
    const item = await ThirdPartyEventModel.create(body)
    return NextResponse.json({ data:item }, { status:201 })
  } catch (e:any) { return NextResponse.json({ error:e.message }, { status:500 }) }
}
