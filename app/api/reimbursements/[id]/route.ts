import { NextRequest, NextResponse, after } from 'next/server'
import { REIMBURSE_FIELDS, diffFields } from '@/lib/changeLog'
import { currentActor, recordAudit } from '@/lib/notifyServer'
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
    const prev: any = await ReimbursementModel.findById(id, '-documents').lean()
    const item: any = await ReimbursementModel.findByIdAndUpdate(id, body, { new: true }).lean()
    if (item) {
      const actor = await currentActor()
      const changes = diffFields(prev, body, REIMBURSE_FIELDS)
      const transferred = !!(body.transferredAt && !prev?.transferredAt)
      // Setelah respons: riwayat + push notif transfer (after() = tetap jalan di serverless)
      after(async () => {
        await recordAudit('reimbursement', id, 'update', actor, changes, transferred ? 'Ditandai sudah ditransfer' : undefined)
        if (transferred) await notifyReimburseTransferred(item).catch(() => {})
      })
    }
    return NextResponse.json({ data: item })
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }) }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params; await connectDB()
    const del: any = await ReimbursementModel.findByIdAndDelete(id, { projection: { title: 1 } }).lean()
    if (del) { const actor = await currentActor(); after(() => recordAudit('reimbursement', id, 'delete', actor, [], `Dihapus: ${del.title || ''}`)) }
    return NextResponse.json({ success: true })
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }) }
}
