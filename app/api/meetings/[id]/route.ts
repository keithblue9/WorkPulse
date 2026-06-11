import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { MeetingReportModel } from '@/models/MeetingReport'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params; await connectDB()
    const body = await req.json()
    const item = await MeetingReportModel.findByIdAndUpdate(id, body, { new: true }).lean()
    return NextResponse.json({ data: item })
  } catch (e:any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params; await connectDB()
    await MeetingReportModel.findByIdAndDelete(id)
    return NextResponse.json({ success: true })
  } catch (e:any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}
