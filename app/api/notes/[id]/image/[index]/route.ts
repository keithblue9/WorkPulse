import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { NotesModel } from '@/models/Notes'
import { decodeDataUrl } from '@/lib/notesImages'

// Menyajikan satu gambar catatan sebagai file biasa (bukan base64 di dalam JSON).
// Alamatnya memuat ?v=<updatedAt>, jadi aman di-cache lama oleh browser: kalau catatan berubah, alamatnya ikut berubah.
// Akses tetap lewat proxy.ts (harus login) — cache `private` supaya CDN tidak menyimpannya.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string; index: string }> }) {
  const { id, index } = await ctx.params
  const i = Number(index)
  if (!/^[a-f0-9]{24}$/i.test(id) || !Number.isInteger(i) || i < 0 || i > 99) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 })
  try {
    await connectDB()
    // $slice: hanya satu elemen array yang dibaca dari database.
    const note = await NotesModel.findById(id).select({ images: { $slice: [i, 1] } }).lean<{ images?: unknown[] }>()
    const raw = note?.images?.[0]
    if (typeof raw !== 'string' || !raw) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 })
    if (/^https?:\/\//i.test(raw)) return NextResponse.redirect(raw, 307)   // gambar sudah di Vercel Blob
    const img = decodeDataUrl(raw)
    if (!img) return NextResponse.json({ error: 'Format gambar tidak didukung' }, { status: 415 })
    return new Response(new Uint8Array(img.bytes), { headers: {
      'Content-Type': img.mime,
      'Content-Length': String(img.bytes.length),
      'Cache-Control': 'private, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    } })
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 }) }
}
