import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { DailyAgendaModel } from '@/models/DailyAgenda'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params; await connectDB()
    const body = await req.json()
    // Remove item from agenda
    if (body.removeItemId) {
      const agenda = await DailyAgendaModel.findByIdAndUpdate(id,
        { $pull: { items: { _id: body.removeItemId } } }, { new: true }).lean()
      return NextResponse.json({ data: agenda })
    }
    // Update item
    if (body.updateItem) {
      const agenda = await DailyAgendaModel.findOneAndUpdate(
        { _id: id, 'items._id': body.updateItem._id },
        { $set: { 'items.$': body.updateItem } }, { new: true }
      ).lean()
      return NextResponse.json({ data: agenda })
    }
    const agenda = await DailyAgendaModel.findByIdAndUpdate(id, body, { new: true }).lean()
    return NextResponse.json({ data: agenda })
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }) }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params; await connectDB()
    await DailyAgendaModel.findByIdAndDelete(id)
    return NextResponse.json({ success: true })
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }) }
}
