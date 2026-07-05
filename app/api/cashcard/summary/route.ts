import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import mongoose from 'mongoose'

// GET /api/cashcard/summary?year=YYYY -> { topup, settlement } totals
export async function GET(req: NextRequest) {
  try {
    await connectDB()
    const { searchParams } = new URL(req.url)
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))

    // CashCard model — may or may not exist yet; find collection directly
    const db = mongoose.connection.db
    if (!db) return NextResponse.json({ data: null })
    const colls = await db.listCollections().toArray()
    const ccColl = colls.find(c => /cashcard/i.test(c.name))
    if (!ccColl) return NextResponse.json({ data: null })
    const col = db.collection(ccColl.name)

    // Aggregate topup & settlement for the year
    const startOfYear = `${year}-01-01`
    const endOfYear = `${year}-12-31`
    const docs = await col.find({
      $or: [
        { date: { $gte: startOfYear, $lte: endOfYear } },
        { createdAt: { $gte: new Date(`${year}-01-01`), $lte: new Date(`${year+1}-01-01`) } },
      ]
    }).toArray()

    let topup = 0, settlement = 0
    for (const d of docs) {
      topup += Number(d.topup || d.topUp || d.amount || 0)
      settlement += Number(d.settlement || d.settledAmount || 0)
    }

    return NextResponse.json({ data: { topup, settlement } })
  } catch (e: any) { return NextResponse.json({ data: null, error: e.message }, { status: 200 }) }
}
