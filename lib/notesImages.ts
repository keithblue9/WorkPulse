import type { PipelineStage } from 'mongoose'

// Helper murni untuk gambar di catatan (Team Notes).
//
// Latar belakang: gambar yang di-paste disimpan sebagai data URL base64 DI DALAM dokumen catatan.
// GET /api/notes dulu mengirim semuanya (≈ 490 KB per panggilan) → biaya transfer Vercel membengkak.
// Sekarang daftar catatan hanya membawa ALAMAT gambar kecil; gambarnya dimuat lazy lewat
// GET /api/notes/<id>/image/<n> dan di-cache browser. Gambar yang sudah berupa URL (Vercel Blob) tidak diubah.

/** Penanda sementara di pipeline MongoDB untuk "gambar ini inline (data URL)". */
export const INLINE_MARK = '__inline__'

const SELF_REF = /^\/api\/notes\/([a-f0-9]{24})\/image\/(\d+)(?:\?.*)?$/i
const DATA_URL = /^data:(image\/(?:png|jpe?g|gif|webp|avif|bmp));base64,([a-z0-9+/=\s]+)$/i

export const isDataUrl = (s: unknown): s is string => typeof s === 'string' && s.startsWith('data:')

/** Alamat gambar ke-`index` milik catatan `id`. `v` = penanda versi (updatedAt) supaya cache browser aman. */
export function noteImageUrl(id: string, index: number, v?: string | number | Date | null): string {
  const t = v ? new Date(v).getTime() : NaN
  return `/api/notes/${id}/image/${index}${Number.isFinite(t) ? `?v=${t}` : ''}`
}

/** Ganti penanda inline hasil pipeline dengan alamat gambar. Elemen lain (URL Blob) dibiarkan. */
export function withImageRefs<T extends { _id?: unknown; images?: unknown; updatedAt?: unknown }>(note: T): T & { images: unknown[] } {
  const id = String(note?._id ?? '')
  const imgs = Array.isArray(note?.images) ? (note.images as unknown[]) : []
  return { ...note, images: imgs.map((x, i) => (x === INLINE_MARK ? noteImageUrl(id, i, note.updatedAt as string | number | Date | null | undefined) : x)) }
}

/**
 * Saat catatan disimpan, klien mengirim kembali `images` yang berisi alamat gambar (bukan base64).
 * Pulihkan ke nilai aslinya dari dokumen tersimpan; gambar baru (data URL / URL Blob) dipakai apa adanya.
 * Alamat yang tidak cocok (id lain / indeks tidak ada) dibuang supaya tidak ada rujukan menggantung.
 */
export function restoreImages(incoming: unknown, noteId: string, stored: unknown): string[] {
  const old = Array.isArray(stored) ? (stored as unknown[]) : []
  const out: string[] = []
  for (const it of Array.isArray(incoming) ? incoming : []) {
    if (typeof it !== 'string') continue
    const m = SELF_REF.exec(it)
    if (!m) { out.push(it); continue }
    if (m[1].toLowerCase() !== String(noteId).toLowerCase()) continue
    const prev = old[Number(m[2])]
    if (typeof prev === 'string' && prev) out.push(prev)
  }
  return out
}

/** Urai data URL raster menjadi byte + mime. SVG sengaja ditolak (bisa membawa skrip pada origin yang sama). */
export function decodeDataUrl(s: unknown): { mime: string; bytes: Buffer } | null {
  if (typeof s !== 'string') return null
  const m = DATA_URL.exec(s)
  if (!m) return null
  const bytes = Buffer.from(m[2].replace(/\s+/g, ''), 'base64')
  return bytes.length ? { mime: m[1].toLowerCase().replace('image/jpg', 'image/jpeg'), bytes } : null
}

/**
 * Pipeline MongoDB untuk daftar catatan. Base64 TIDAK pernah keluar dari database:
 * elemen `images` yang berupa data URL diganti penanda di sisi server.
 * `pinned` = mode ringan untuk widget dashboard (hanya yang disematkan, maksimal 5).
 */
export function notesListPipeline(pinned: boolean): PipelineStage[] {
  return [
    ...(pinned ? [{ $match: { pinned: true } }] : []),
    { $sort: { date: -1, createdAt: -1 } },
    ...(pinned ? [{ $limit: 5 }] : []),
    { $addFields: { images: { $map: {
      input: { $ifNull: ['$images', []] }, as: 'img',
      in: { $cond: [{ $eq: [{ $substrCP: [{ $toString: '$$img' }, 0, 5] }, 'data:'] }, INLINE_MARK, '$$img'] },
    } } } },
  ]
}
