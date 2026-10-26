import { NextRequest, NextResponse } from 'next/server'
import { isValidObjectId } from 'mongoose'
import { connectDB } from '@/lib/db'
import { EnhancementModel } from '@/models/Enhancement'
import { canCarry, carryPatch, uncarryPatch } from '@/lib/enhancementFlow'
import { nextCode, sessionEmail } from '@/lib/enhancementServer'

// Carry Over = pindah ke tahun berikutnya (satu atau banyak sekaligus), atau batalkan (undo: true).
// Body: { ids: string[], to?: number, reschedule?: boolean, undo?: boolean }
export async function POST(req: NextRequest) {
  try {
    const b = await req.json().catch(() => ({})) as Record<string, unknown>
    const ids = (Array.isArray(b.ids) ? b.ids : []).map(String).filter(isValidObjectId)
    if (!ids.length || ids.length > 300) return NextResponse.json({ error: 'Pilih enhancement' }, { status: 400 })
    const undo = b.undo === true, to = Number(b.to)
    await connectDB()
    const docs: any[] = await EnhancementModel.find({ _id: { $in: ids } }).lean()
    if (!docs.length) return NextResponse.json({ error: 'Enhancement tidak ditemukan' }, { status: 404 })
    const email = await sessionEmail(), at = new Date()
    const done: string[] = [], skipped: { id: string; error: string }[] = []
    for (const e of docs) {
      const id = String(e._id)
      if (undo) {
        const u = uncarryPatch(e)
        if (!u.ok) { skipped.push({ id, error: u.error }); continue }
        const upd: Record<string, unknown> = { $set: { ...u.set, updatedBy: email } }
        if (u.unset.length) upd.$unset = Object.fromEntries(u.unset.map(k => [k, 1]))
        // Kode lama bisa sudah dipakai enhancement lain di tahun asal → beri kode baru.
        const code = String(u.set.code || '')
        if (code && await EnhancementModel.exists({ _id: { $ne: e._id }, app: e.app, year: u.set.year, code })) (upd.$set as any).code = await nextCode(e.app, Number(u.set.year))
        await EnhancementModel.updateOne({ _id: e._id }, upd)
      } else {
        const c = canCarry(e, to)
        if (!c.ok) { skipped.push({ id, error: c.error }); continue }
        const code = await nextCode(e.app, to)
        await EnhancementModel.updateOne({ _id: e._id }, { $set: { ...carryPatch(e, to, { by: email, at, code, reschedule: b.reschedule === true }), updatedBy: email } })
      }
      done.push(id)
    }
    if (!done.length) return NextResponse.json({ error: skipped[0]?.error || 'Tidak ada yang diproses', skipped }, { status: 400 })
    const data = await EnhancementModel.find({ _id: { $in: done } }).lean()
    return NextResponse.json({ data, skipped })
  } catch {
    return NextResponse.json({ error: 'Gagal memproses Carry Over' }, { status: 500 })
  }
}
