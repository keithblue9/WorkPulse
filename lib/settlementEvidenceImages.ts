'use client'
// Ubah evidence reimbursement (data URL / URL blob, gambar atau PDF) menjadi JPEG siap tempel
// ke dokumen. Hanya berjalan di browser (canvas). PDF dirender per halaman lewat pdf.js.

export type EvidenceImage = { data: Uint8Array; dataUrl: string; w: number; h: number; name: string }

const MAX_SIDE = 1800          // px — cukup tajam untuk cetak A4, ukuran file tetap wajar
const JPEG_QUALITY = 0.82
const MAX_PDF_PAGES = 6        // batas halaman PDF per lampiran (cegah dokumen meledak)

function mimeOf(d: any): string {
  const m = /^data:([^;,]+)/.exec(String(d?.url || ''))
  return String(d?.type || (m ? m[1] : '')).toLowerCase()
}
export function isPdfDoc(d: any): boolean { return mimeOf(d).includes('pdf') || /\.pdf$/i.test(d?.name || '') }
export function isImageDoc(d: any): boolean { return mimeOf(d).startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp)$/i.test(d?.name || '') }

async function toBlob(url: string): Promise<Blob> {
  const res = await fetch(url)            // fetch juga menangani data: URL
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.blob()
}

function canvasToJpeg(canvas: HTMLCanvasElement, name: string): EvidenceImage {
  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
  const bin = atob(dataUrl.split(',')[1])
  const data = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) data[i] = bin.charCodeAt(i)
  return { data, dataUrl, w: canvas.width, h: canvas.height, name }
}

function drawScaled(src: CanvasImageSource, sw: number, sh: number, name: string): EvidenceImage {
  const k = Math.min(1, MAX_SIDE / Math.max(sw, sh))
  const w = Math.max(1, Math.round(sw * k)), h = Math.max(1, Math.round(sh * k))
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h)   // PNG transparan → latar putih (JPEG tak punya alfa)
  ctx.drawImage(src, 0, 0, w, h)
  return canvasToJpeg(c, name)
}

async function imageFromBlob(blob: Blob, name: string): Promise<EvidenceImage> {
  // createImageBitmap menghormati orientasi EXIF foto HP
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' } as any)
      try { return drawScaled(bmp, bmp.width, bmp.height, name) } finally { bmp.close?.() }
    } catch { /* fallback ke <img> */ }
  }
  const url = URL.createObjectURL(blob)
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => bad(new Error('gambar tidak bisa dibaca')); i.src = url })
    return drawScaled(img, img.naturalWidth, img.naturalHeight, name)
  } finally { URL.revokeObjectURL(url) }
}

let pdfjsPromise: Promise<any> | null = null
function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then((m: any) => {
      const lib = m.default?.getDocument ? m.default : m
      lib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
      return lib
    }).catch(e => { pdfjsPromise = null; throw e })
  }
  return pdfjsPromise
}

async function pdfPages(blob: Blob, name: string): Promise<EvidenceImage[]> {
  const pdfjs = await loadPdfjs()
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise
  const out: EvidenceImage[] = []
  try {
    const n = Math.min(doc.numPages, MAX_PDF_PAGES)
    for (let p = 1; p <= n; p++) {
      const page = await doc.getPage(p)
      const base = page.getViewport({ scale: 1 })
      const scale = Math.min(3, MAX_SIDE / Math.max(base.width, base.height))
      const vp = page.getViewport({ scale })
      const c = document.createElement('canvas'); c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height)
      const ctx = c.getContext('2d')!
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height)
      await page.render({ canvasContext: ctx, viewport: vp }).promise
      out.push(canvasToJpeg(c, doc.numPages > 1 ? `${name} (hal. ${p})` : name))
      page.cleanup?.()
    }
  } finally { doc.destroy?.() }
  return out
}

/** Kotak abu-abu bertuliskan nama file untuk lampiran yang tak bisa ditampilkan. */
export function placeholderImage(name: string, reason: string): EvidenceImage {
  const c = document.createElement('canvas'); c.width = 900; c.height = 300
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#f3f4f6'; ctx.fillRect(0, 0, 900, 300)
  ctx.strokeStyle = '#9ca3af'; ctx.lineWidth = 4; ctx.setLineDash([16, 10]); ctx.strokeRect(6, 6, 888, 288)
  ctx.fillStyle = '#374151'; ctx.textAlign = 'center'
  ctx.font = 'bold 34px Arial, sans-serif'; ctx.fillText(reason, 450, 130)
  ctx.font = '28px Arial, sans-serif'
  const label = name.length > 52 ? name.slice(0, 49) + '…' : name
  ctx.fillText(label, 450, 185)
  return canvasToJpeg(c, name)
}

/** Konversi semua dokumen satu transaksi (urutan dipertahankan). Tidak pernah melempar error. */
export async function docsToImages(docs: any[]): Promise<{ images: EvidenceImage[]; failed: string[] }> {
  const images: EvidenceImage[] = []; const failed: string[] = []
  for (const d of docs || []) {
    const name = String(d?.name || 'lampiran')
    if (!d?.url) { images.push(placeholderImage(name, 'Lampiran tidak tersedia')); failed.push(name); continue }
    try {
      const blob = await toBlob(d.url)
      const type = (blob.type || mimeOf(d)).toLowerCase()
      if (type.includes('pdf') || isPdfDoc(d)) images.push(...await pdfPages(blob, name))
      else if (type.startsWith('image/') || isImageDoc(d)) images.push(await imageFromBlob(blob, name))
      else { images.push(placeholderImage(name, 'Format lampiran tidak dapat ditampilkan')); failed.push(name) }
    } catch {
      images.push(placeholderImage(name, 'Lampiran gagal dimuat')); failed.push(name)
    }
  }
  return { images, failed }
}
