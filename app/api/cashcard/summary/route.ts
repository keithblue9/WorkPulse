import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { CashCardModel } from '@/models/CashCard'

// GET /api/cashcard/summary?year=YYYY -> { topup, settlement }
export async function GET(req: NextRequest) {
  try {
    await connectDB()
    const { searchParams } = new URL(req.url)
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))
    const docs = await CashCardModel.find({ year }).lean()
    let topup = 0, settlement = 0
    for (const d of docs as any[]) {
      topup += Number(d.topUpAmount || 0)
      settlement += Number(d.settlementAmount || 0)
    }
    return NextResponse.json({ data: { topup, settlement } })
  } catch (e: any) { return NextResponse.json({ data: null, error: e.message }, { status: 200 }) }
}
