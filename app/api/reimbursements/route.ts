import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { ReimbursementModel } from '@/models/Reimbursement'
import { notifyReimburseSubmitted } from '@/lib/reimburseNotif'

export async function GET(req: NextRequest) {
  try {
    await connectDB()
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')
    const status = searchParams.get('status')
    const query: any = {}
    if (userId) query.userId = userId
    if (status) query.status = status

    // PENTING: jangan ikutkan isi file.
    // - documents.url : evidence base64 inline (bisa puluhan MB kalau semua diambil)
    // - receiptUrl    : field lama yang juga bisa berisi base64 dan TIDAK dipakai di UI
    // Metadata (nama/tipe/ukuran/slot) tetap dikirim supaya jumlah lampiran tetap tampil.
    // Isi file diambil belakangan lewat GET /api/reimbursements/[id] saat detail dibuka.
    const items = await ReimbursementModel.find(query)
      .select({ 'documents.url': 0, receiptUrl: 0 })
      .sort({ createdAt: -1 })
      .lean()

    return NextResponse.json({ data: items })
  } catch (e: any) {
    console.error('[reimbursements GET] gagal:', e?.message, e)
    return NextResponse.json({ error: e?.message || 'Gagal memuat data reimbursement' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB()
    const body = await req.json()
    const item = await ReimbursementModel.create(body)
    // Push notif: pengajuan baru -> member pengaju + cashier (non-blocking, jangan gagalin create)
    notifyReimburseSubmitted(item).catch(() => {})
    return NextResponse.json({ data: item }, { status: 201 })
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}
