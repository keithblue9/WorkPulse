// Daftar reimbursement sengaja dimuat TANPA isi file (documents.url) supaya ringan —
// evidence lama tersimpan base64 inline dan bisa puluhan MB kalau diambil sekaligus.
// Saat detail/evidence dibuka, isi file diambil per item lewat helper ini.

const cache = new Map<string, any>()

/** Ambil 1 reimbursement lengkap (termasuk documents.url). Hasilnya di-cache. */
export async function fetchFullReimbursement(id: string): Promise<any | null> {
  if (!id) return null
  const hit = cache.get(id)
  if (hit) return hit
  try {
    const res = await fetch(`/api/reimbursements/${id}`)
    if (!res.ok) return null
    const d = await res.json().catch(() => null)
    const full = d?.data || null
    if (full) cache.set(id, full)
    return full
  } catch { return null }
}

/** Buang cache (panggil setelah item diubah/hapus supaya tidak stale). */
export function invalidateReimbursement(id?: string) {
  if (id) cache.delete(id); else cache.clear()
}

/** Apakah dokumen sudah punya isi file (url), bukan sekadar metadata dari list. */
export function docsHaveUrl(docs: any[]): boolean {
  return Array.isArray(docs) && docs.length > 0 && docs.every(d => !!d?.url)
}
