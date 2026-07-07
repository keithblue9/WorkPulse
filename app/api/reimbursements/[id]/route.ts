import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { ReimbursementModel } from '@/models/Reimbursement'
import { notifyReimburseTransferred } from '@/lib/reimburseNotif'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params; await connectDB()
    const item = await ReimbursementModel.findById(id).lean()
    return NextResponse.json({ data: item })
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }) }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params; await connectDB()
    const body = await req.json()
    const prev: any = await ReimbursementModel.findById(id, 'transferredAt').lean()
    const item: any = await ReimbursementModel.findByIdAndUpdate(id, body, { new: true }).lean()
    // Push notif: event transfer cashier (transisi transferredAt kosong -> terisi), non-blocking
    if (body.transferredAt && !prev?.transferredAt && item) {
      notifyReimburseTransferred(item).catch(() => {})
    }
    return NextResponse.json({ data: item })
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }) }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params; await connectDB()
    await ReimbursementModel.findByIdAndDelete(id)
    return NextResponse.json({ success: true })
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }) }
}
