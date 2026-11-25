// Upload gambar catatan (client). Gambar disimpan sebagai FILE di Vercel Blob dan catatan hanya menyimpan URL-nya,
// bukan base64 di dalam dokumen (dulu: dokumen & JSON membengkak → transfer Vercel mahal, mendekati batas 4,5 MB / 16 MB).
// Kalau Blob tidak tersedia (mis. token belum ada di lingkungan lokal), jatuh kembali ke data URL seperti sebelumnya.

const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp' }

export function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = e => resolve(String(e.target?.result || ''))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

export async function uploadNoteImage(blob: Blob): Promise<{ url: string; stored: 'blob' | 'inline' }> {
  try {
    const { upload } = await import('@vercel/blob/client')
    const ext = EXT[blob.type] || 'png'
    const res = await upload(`notes/${Date.now()}.${ext}`, blob, { access: 'public', handleUploadUrl: '/api/blob/upload', contentType: blob.type || 'image/png' })
    return { url: res.url, stored: 'blob' }
  } catch {
    return { url: await readAsDataUrl(blob), stored: 'inline' }
  }
}
