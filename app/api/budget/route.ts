import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { BudgetModel } from '@/models/Budget'

export async function GET(req: NextRequest) {
  try {
    await connectDB()
    const { searchParams } = new URL(req.url)
    if (searchParams.get('all')) {
      const all = await BudgetModel.find({}).sort({ year:1 }).lean()
      return NextResponse.json({ data: all }, { headers: { 'Cache-Control': 'no-store' } })
    }
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))
    const entries = await BudgetModel.find({ year }).lean()
    return NextResponse.json({ data: entries })
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }) }
}

// PUT: upsert one category's full budget for a year
export async function PUT(req: NextRequest) {
  try {
    await connectDB()
    const { year, category, budget } = await req.json()
    const set:any = { year, category, annualBudgetIDR: budget?.annualBudgetIDR||0, annualBudgetUSD: budget?.annualBudgetUSD||0, monthly: budget?.monthly||[] }
    if (budget?.annualRealIDR !== undefined) set.annualRealIDR = budget.annualRealIDR||0
    if (budget?.annualRealUSD !== undefined) set.annualRealUSD = budget.annualRealUSD||0
    const entry = await BudgetModel.findOneAndUpdate(
      { year, category }, set, { upsert: true, new: true }
    ).lean()
    return NextResponse.json({ data: entry })
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}

export async function POST(req: NextRequest) {
  // Legacy support
  try { await connectDB(); const body = await req.json(); const entry = await BudgetModel.create(body); return NextResponse.json({ data: entry }) }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}
