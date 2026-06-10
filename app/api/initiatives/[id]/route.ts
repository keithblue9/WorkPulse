import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { InitiativeModel } from '@/models/Initiative'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    await connectDB()
    const initiative = await InitiativeModel.findById(params.id).lean()
    if (!initiative) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ data: initiative })
  } catch (e) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await connectDB()
    const body = await req.json()
    const updated = await InitiativeModel.findByIdAndUpdate(params.id, body, { new: true }).lean()
    return NextResponse.json({ data: updated })
  } catch (e) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    await connectDB()
    await InitiativeModel.findByIdAndDelete(params.id)
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
