import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { KPIModel } from '@/models/KPI'

export async function GET(req: NextRequest) {
  try {
    await connectDB()
    const { searchParams } = new URL(req.url)
    const year = searchParams.get('year') || 2026
    const category = searchParams.get('category')
    const query: any = { year }
    if (category) query.category = category
    const items = await KPIModel.find(query).sort({ category: 1, weight: -1 }).lean()
    return NextResponse.json({ data: items })
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }) }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB()
    const body = await req.json()
    const item = await KPIModel.create(body)
    return NextResponse.json({ data: item }, { status: 201 })
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}
