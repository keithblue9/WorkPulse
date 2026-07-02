import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { connectDB } from '@/lib/db'
import { ReimbursementModel } from '@/models/Reimbursement'
import { UserModel } from '@/models/User'
import { sendPushToUser } from '@/lib/push'

const fmt = (n: number) => new Intl.NumberFormat('id-ID').format(n || 0)

// CC Holder membalikan reimburse ke member karena evidence kurang.
// Status done -> clarification, simpan catatan, lalu push notif ke member pengaju.
export async function POST(req: NextRequest) {
  try {
    await connectDB()
    const { id, note, clarifiedBy } = await req.json()
    if (!id || !note?.trim()) return NextResponse.json({ error: 'Catatan klarifikasi wajib diisi' }, { status: 400 })

    const item: any = await ReimbursementModel.findById(id)
    if (!item) return NextResponse.json({ error: 'Reimburse tidak ditemukan' }, { status: 404 })
    if (!['done', 'paid'].includes(item.status)) {
      return NextResponse.json({ error: 'Hanya item yang sudah dibayar (Waiting for Verification) yang bisa diklarifikasi' }, { status: 400 })
    }

    item.status = 'clarification'
    item.clarifyNote = note.trim()
    item.clarifiedBy = clarifiedBy || '-'
    item.clarifiedAt = new Date().toISOString()
    item.clarifyCount = (item.clarifyCount || 0) + 1
    await item.save()

    // Cari email member pengaju (userId bisa email atau _id; fallback ke userName)
    let email: string | null = null
    const uid = item.userId
    try {
      let u: any = null
      if (uid && /@/.test(uid)) u = await UserModel.findOne({ email: uid }, 'email').lean()
      if (!u && uid && mongoose.Types.ObjectId.isValid(uid)) u = await UserModel.findById(uid, 'email').lean()
      if (!u && item.userName) u = await UserModel.findOne({ name: item.userName }, 'email').lean()
      email = u?.email || (uid && /@/.test(uid) ? uid : null)
    } catch { email = uid && /@/.test(uid) ? uid : null }

    let pushed = false
    if (email) {
      const r = await sendPushToUser(email, {
        title: '🔄 Reimburse perlu klarifikasi',
        body: `"${item.title}" (Rp ${fmt(item.amount)}) dibalikin oleh ${item.clarifiedBy}. Catatan: ${item.clarifyNote}`,
        url: '/dashboard/reimbursements',
        tag: `clarify-${item._id}`,
      })
      pushed = !!(r as any)?.sent
    }

    return NextResponse.json({ data: item, pushed, email })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}
