import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { MeetingReportModel } from '@/models/MeetingReport'

export async function GET(req: NextRequest) {
  try {
    await connectDB()
    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category')
    const query: any = {}
    if (category) query.category = category
    const items = await MeetingReportModel.find(query).sort({ meetingDate:-1 }).lean()
    return NextResponse.json({ data: items })
  } catch (e:any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB()
    const body = await req.json()
    const item = await MeetingReportModel.create(body)
    return NextResponse.json({ data: item }, { status: 201 })
  } catch (e:any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}
