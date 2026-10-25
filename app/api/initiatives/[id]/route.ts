import { NextRequest, NextResponse, after } from 'next/server'
import { addedPics } from '@/lib/changeLog'
import { currentActor, notifyNewPics } from '@/lib/notifyServer'
import { connectDB } from '@/lib/db'
import { InitiativeModel } from '@/models/Initiative'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await connectDB()
    const initiative = await InitiativeModel.findById(id).lean()
    if (!initiative) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ data: initiative })
  } catch (e) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await connectDB()
    const body = await req.json()
    const prev: any = 'pic' in (body || {}) ? await InitiativeModel.findById(id, 'pic').lean() : null
    const updated: any = await InitiativeModel.findByIdAndUpdate(id, body, { new: true }).lean()
    const added = prev && updated ? addedPics(prev.pic, updated.pic) : []
    if (added.length) { const actor = await currentActor(); after(() => notifyNewPics({ kind: 'initiative', title: updated.title, names: added, actor, url: `/dashboard/progress?i=${id}`, tagId: id })) }
    return NextResponse.json({ data: updated })
  } catch (e) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await connectDB()
    await InitiativeModel.findByIdAndDelete(id)
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
