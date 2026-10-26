import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { EnhancementModel } from '@/models/Enhancement'
import { InitiativeModel } from '@/models/Initiative'
import { currentRoles } from '@/lib/session'
import { initiativeToEnh } from '@/lib/enhancementFlow'
import { nextCode, sessionEmail } from '@/lib/enhancementServer'

// Pindahkan Progress Project (initiative) ke Enhancement. Khusus admin.
// GET = pratinjau (tanpa menulis) · POST = salin & sembunyikan initiative · DELETE = batalkan migrasi.
// Initiative TIDAK dihapus: hanya ditandai movedTo, sehingga pembatalan mengembalikan kondisi semula.
const denied = () => NextResponse.json({ error: 'Khusus admin' }, { status: 403 })
const isAdmin = async () => ((await currentRoles()) || []).includes('admin')

async function state() {
  const inis: any[] = await InitiativeModel.find({}, 'title app year urgency movedTo').sort({ year: 1, app: 1, title: 1 }).lean()
  const moved = await EnhancementModel.find({ fromInitiative: { $nin: [null, ''] } }, 'fromInitiative title year createdAt updatedAt').lean() as any[]
  const pending = inis.filter(i => !i.movedTo)
  return { inis, pending, moved }
}

export async function GET() {
  if (!(await isAdmin())) return denied()
  await connectDB()
  const { inis, pending, moved } = await state()
  return NextResponse.json({ data: {
    total: inis.length, pending: pending.length, moved: moved.length,
    edited: moved.filter(m => m.updatedAt && m.createdAt && +new Date(m.updatedAt) - +new Date(m.createdAt) > 5000).length,
    items: pending.map(i => ({ _id: String(i._id), title: i.title, app: i.app, year: i.year, klas: String(i.urgency || '').toUpperCase().replace(/[^A-Z]/g, '') === 'SI' ? 'SI' : 'Non-SI' })),
  } })
}

export async function POST() {
  if (!(await isAdmin())) return denied()
  try {
    await connectDB()
    const { pending } = await state()
    const full: any[] = await InitiativeModel.find({ _id: { $in: pending.map(p => p._id) } }).lean()
    const email = await sessionEmail(), now = new Date(), nowYear = now.getFullYear()
    let created = 0
    for (const ini of full) {
      // Idempoten: bila salinannya sudah ada (mis. proses sebelumnya terputus), cukup tandai initiative.
      const exist: any = await EnhancementModel.findOne({ fromInitiative: String(ini._id) }, '_id').lean()
      let id = exist ? String(exist._id) : ''
      if (!exist) {
        const doc = initiativeToEnh(ini, nowYear)
        const code = doc.code || await nextCode(doc.app, doc.year)
        const made: any = await EnhancementModel.create({ ...doc, code, source: { file: 'Progress Project', sheet: '', row: 0, importedAt: now }, createdBy: email, updatedBy: email })
        id = String(made._id); created++
      }
      await InitiativeModel.updateOne({ _id: ini._id }, { $set: { movedTo: id, movedAt: now } })
    }
    return NextResponse.json({ data: { created, moved: full.length } })
  } catch {
    return NextResponse.json({ error: 'Gagal memindahkan Progress Project' }, { status: 500 })
  }
}

export async function DELETE() {
  if (!(await isAdmin())) return denied()
  try {
    await connectDB()
    const r = await EnhancementModel.deleteMany({ fromInitiative: { $nin: [null, ''] } })
    const u = await InitiativeModel.updateMany({ movedTo: { $exists: true } }, { $unset: { movedTo: 1, movedAt: 1 } })
    return NextResponse.json({ data: { removed: r.deletedCount, restored: u.modifiedCount } })
  } catch {
    return NextResponse.json({ error: 'Gagal membatalkan' }, { status: 500 })
  }
}
