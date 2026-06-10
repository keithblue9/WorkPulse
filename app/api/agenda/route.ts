import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { DailyAgendaModel } from '@/models/DailyAgenda'

export async function GET(req: NextRequest) {
  try {
    await connectDB()
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')
    const dateFrom = searchParams.get('from')
    const dateTo = searchParams.get('to')
    const query: any = {}
    if (userId) query.userId = userId
    if (dateFrom && dateTo) query.date = { $gte: dateFrom, $lte: dateTo }
    else if (dateFrom) query.date = { $gte: dateFrom }
    const agendas = await DailyAgendaModel.find(query).sort({ date: 1 }).lean()
    return NextResponse.json({ data: agendas })
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }) }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB()
    const body = await req.json()
    // Upsert per userId+date
    const agenda = await DailyAgendaModel.findOneAndUpdate(
      { userId: body.userId, date: body.date },
      body.addItem ? { $push: { items: body.addItem }, dayNote: body.dayNote } : body,
      { upsert: true, new: true }
    ).lean()
    return NextResponse.json({ data: agenda })
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}
