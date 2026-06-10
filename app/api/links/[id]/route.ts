import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { LinkHubModel } from '@/models/LinkHub'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params; await connectDB()
    const body = await req.json()
    const link = await LinkHubModel.findByIdAndUpdate(id, body, { new: true }).lean()
    return NextResponse.json({ data: link })
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }) }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params; await connectDB()
    await LinkHubModel.findByIdAndDelete(id)
    return NextResponse.json({ success: true })
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }) }
}
