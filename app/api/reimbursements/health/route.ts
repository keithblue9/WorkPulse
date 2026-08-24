import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { ReimbursementModel } from '@/models/Reimbursement'

// Diagnostik: cek apakah data reimbursement benar-benar masih ada di database.
// Dipakai saat halaman tampak kosong, untuk memastikan itu masalah koneksi/tampilan
// dan BUKAN data yang hilang. Hanya mengembalikan ringkasan (tanpa isi dokumen).
export async function GET() {
  try {
    await connectDB()
    const total = await ReimbursementModel.countDocuments({})
    const byStatus = await ReimbursementModel.aggregate([
      { $group: { _id: '$status', jumlah: { $sum: 1 } } },
      { $sort: { jumlah: -1 } },
    ])
    const terbaru = await ReimbursementModel.find({}, 'title amount status billDate createdAt')
      .sort({ createdAt: -1 }).limit(5).lean()

    return NextResponse.json({
      ok: true,
      totalDokumen: total,
      pesan: total > 0
        ? `Data AMAN: ada ${total} pengajuan tersimpan di database.`
        : 'Koleksi reimbursement benar-benar kosong di database ini.',
      perStatus: byStatus,
      contohTerbaru: terbaru,
    })
  } catch (e: any) {
    return NextResponse.json({
      ok: false,
      pesan: 'Gagal terhubung ke database — ini penyebab halaman tampak kosong.',
      error: e?.message || String(e),
    }, { status: 500 })
  }
}
