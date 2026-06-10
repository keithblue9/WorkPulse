import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { BudgetModel } from '@/models/Budget'

export async function GET(req: NextRequest) {
  try {
    await connectDB()
    const { searchParams } = new URL(req.url)
    const year = parseInt(searchParams.get('year') || '2026')
    const entries = await BudgetModel.find({ year }).sort({ month: 1, categoryKey: 1 }).lean()
    return NextResponse.json({ data: entries })
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }) }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB()
    const body = await req.json()
    const entry = await BudgetModel.findOneAndUpdate(
      { categoryKey: body.categoryKey, year: body.year, month: body.month },
      body,
      { upsert: true, new: true }
    ).lean()
    return NextResponse.json({ data: entry })
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}
