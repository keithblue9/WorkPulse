import { NextRequest, NextResponse, after } from 'next/server'
import { addedPics } from '@/lib/changeLog'
import { currentActor, notifyNewPics } from '@/lib/notifyServer'
import { isValidObjectId } from 'mongoose'
import { connectDB } from '@/lib/db'
import { EnhancementModel } from '@/models/Enhancement'
import { cleanEnhancement } from '@/lib/enhancementInput'
import { sessionEmail } from '@/lib/enhancementServer'

type Ctx = { params: Promise<{ id: string }> }
const notFound = () => NextResponse.json({ error: 'Enhancement tidak ditemukan' }, { status: 404 })

export async function GET(_: NextRequest, { params }: Ctx) {
  const { id } = await params
  if (!isValidObjectId(id)) return notFound()
  await connectDB()
  const doc = await EnhancementModel.findById(id).lean()
  return doc ? NextResponse.json({ data: doc }) : notFound()
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    if (!isValidObjectId(id)) return notFound()
    const r = cleanEnhancement(await req.json().catch(() => ({})), true)
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 })
    if (!Object.keys(r.data).length) return NextResponse.json({ error: 'Tidak ada perubahan' }, { status: 400 })
    await connectDB()
    const prev: any = 'pic' in r.data ? await EnhancementModel.findById(id, 'pic').lean() : null
    const doc: any = await EnhancementModel.findByIdAndUpdate(id, { $set: { ...r.data, updatedBy: await sessionEmail() } }, { new: true }).lean()
    const added = prev && doc ? addedPics(prev.pic, doc.pic) : []
    if (added.length) { const actor = await currentActor(); after(() => notifyNewPics({ kind: 'enhancement', title: doc.title, names: added, actor, url: `/dashboard/enhancement?e=${id}`, tagId: id })) }
    return doc ? NextResponse.json({ data: doc }) : notFound()
  } catch {
    return NextResponse.json({ error: 'Gagal menyimpan enhancement' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    if (!isValidObjectId(id)) return notFound()
    await connectDB()
    const doc = await EnhancementModel.findByIdAndDelete(id).lean()
    return doc ? NextResponse.json({ success: true }) : notFound()
  } catch {
    return NextResponse.json({ error: 'Gagal menghapus enhancement' }, { status: 500 })
  }
}
