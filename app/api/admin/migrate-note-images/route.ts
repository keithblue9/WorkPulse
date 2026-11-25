import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { connectDB } from '@/lib/db'
import { NotesModel } from '@/models/Notes'
import { currentRoles } from '@/lib/session'
import { decodeDataUrl, isDataUrl } from '@/lib/notesImages'

// Pindahkan gambar base64 di catatan lama ke Vercel Blob. Khusus admin.
//   GET                           = pratinjau (tidak menulis apa pun): berapa catatan & berapa MB masih base64
//   POST ?confirm=yes&limit=5     = pindahkan sampai `limit` catatan (maks 20) per panggilan.
//        Ulangi dengan &after=<nilai `next` dari balasan sebelumnya> sampai `next` kosong (catatan yang dilewati tidak menghalangi).
//
// Aman: gambar baru DIUNGGAH dulu; dokumen catatan baru diubah SETELAH semua gambar catatan itu sukses.
// Penulisan memakai kunci `updatedAt` (kalau catatan diedit orang lain di tengah jalan → dilewati, dicoba lagi nanti)
// dan tidak mengubah `updatedAt`. Tidak ada yang dihapus. Idempotent: yang sudah berupa URL tidak disentuh.
// Disarankan membuat snapshot/backup database sebelum POST pertama.
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e))
const denied = () => NextResponse.json({ error: 'Khusus admin' }, { status: 403 })
const isAdmin = async () => ((await currentRoles()) || []).includes('admin')
const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/avif': 'avif', 'image/bmp': 'bmp' }

const HAS_INLINE = { images: { $regex: '^data:' } }

async function summary() {
  const rows: { _id: unknown; title?: string; bytes: number }[] = await NotesModel.aggregate([
    { $match: HAS_INLINE },
    { $project: { title: 1, bytes: { $sum: { $map: { input: '$images', as: 'i', in: { $strLenCP: { $toString: '$$i' } } } } } } },
  ])
  return { notes: rows.length, megabytes: Math.round(rows.reduce((n, r) => n + (r.bytes || 0), 0) / 1048576 * 10) / 10, top: rows.sort((a, b) => b.bytes - a.bytes).slice(0, 5).map(r => ({ _id: String(r._id), title: r.title, kb: Math.round(r.bytes / 1024) })) }
}

export async function GET() {
  if (!(await isAdmin())) return denied()
  try { await connectDB(); return NextResponse.json({ data: await summary() }) }
  catch (e) { return NextResponse.json({ error: msg(e) }, { status: 500 }) }
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return denied()
  const q = new URL(req.url).searchParams
  if (q.get('confirm') !== 'yes') return NextResponse.json({ error: 'Tambahkan ?confirm=yes untuk menjalankan. Lihat pratinjau lewat GET dulu.' }, { status: 400 })
  const limit = Math.min(Math.max(Number(q.get('limit')) || 5, 1), 20)
  const after = /^[a-f0-9]{24}$/i.test(q.get('after') || '') ? q.get('after')! : ''
  try {
    await connectDB()
    const notes = await NotesModel.find(after ? { ...HAS_INLINE, _id: { $gt: after } } : HAS_INLINE).sort({ _id: 1 }).select('images updatedAt title').limit(limit).lean<{ _id: unknown; images: string[]; updatedAt: Date }[]>()
    const report: { _id: string; moved: number; status: 'ok' | 'dilewati'; reason?: string }[] = []
    for (const n of notes) {
      const id = String(n._id)
      const next: string[] = []
      let moved = 0, failed = ''
      for (let i = 0; i < n.images.length && !failed; i++) {
        const img = n.images[i]
        if (!isDataUrl(img)) { next.push(img); continue }
        const d = decodeDataUrl(img)
        if (!d) { failed = `gambar ${i} bukan raster yang didukung`; break }
        try {
          const r = await put(`notes/${id}-${i}.${EXT[d.mime] || 'png'}`, d.bytes, { access: 'public', contentType: d.mime, addRandomSuffix: true })
          next.push(r.url); moved++
        } catch (e) { failed = `upload gambar ${i} gagal: ${msg(e)}` }
      }
      if (failed) { report.push({ _id: id, moved: 0, status: 'dilewati', reason: failed }); continue }
      // Hanya tulis kalau catatan belum berubah sejak dibaca; updatedAt tidak disentuh.
      const res = await NotesModel.updateOne({ _id: n._id, updatedAt: n.updatedAt }, { $set: { images: next } }, { timestamps: false })
      report.push(res.matchedCount ? { _id: id, moved, status: 'ok' } : { _id: id, moved: 0, status: 'dilewati', reason: 'catatan berubah saat dimigrasi; jalankan lagi' })
    }
    const remaining = await NotesModel.countDocuments(HAS_INLINE)
    return NextResponse.json({ data: { processed: notes.length, remaining, next: notes.length === limit ? String(notes[notes.length - 1]._id) : '', report } })
  } catch (e) { return NextResponse.json({ error: msg(e) }, { status: 500 }) }
}
