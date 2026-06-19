// Client-only export helpers (JPG / PDF / PPT).
// Each "section" node is captured separately so 1 project = 1 page / 1 slide / 1 image,
// rendered as large as possible instead of being crammed together.
// Heavy libs are dynamically imported (no SSR, lazy-loaded only on use).

type Restore = () => void

function prepareCapture(node: HTMLElement): Restore {
  const restores: Restore[] = []
  const candidates = [node, ...Array.from(node.querySelectorAll<HTMLElement>('*'))]
  candidates.forEach((el) => {
    const s = getComputedStyle(el)
    const clipped =
      s.overflow !== 'visible' || s.overflowX !== 'visible' || s.overflowY !== 'visible' || s.maxHeight !== 'none'
    if (clipped) {
      const prev = el.style.cssText
      restores.push(() => { el.style.cssText = prev })
      el.style.maxHeight = 'none'
      el.style.maxWidth = 'none'
      el.style.overflow = 'visible'
    }
  })
  node.querySelectorAll<HTMLElement>('[data-export-hide]').forEach((el) => {
    const prev = el.style.cssText
    restores.push(() => { el.style.cssText = prev })
    el.style.display = 'none'
  })
  return () => restores.forEach((r) => r())
}

function themeBg(): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
  return v || '#ffffff'
}

const raf2 = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

async function captureNode(node: HTMLElement, html2canvas: any): Promise<HTMLCanvasElement> {
  const restore = prepareCapture(node)
  await raf2()
  try {
    return await html2canvas(node, {
      scale: 2,
      backgroundColor: themeBg(),
      useCORS: true,
      logging: false,
      windowWidth: Math.max(node.scrollWidth, node.clientWidth),
    })
  } finally {
    restore()
  }
}

function dataUrlToBase64(d: string) { return d.split(',')[1] || '' }

export async function exportJpg(nodes: HTMLElement[], filename: string) {
  const html2canvas = (await import('html2canvas')).default
  if (nodes.length <= 1) {
    const c = await captureNode(nodes[0], html2canvas)
    const a = document.createElement('a')
    a.href = c.toDataURL('image/jpeg', 0.95)
    a.download = `${filename}.jpg`
    a.click()
    return
  }
  // Multiple sections -> bundle as a ZIP so each project is its own full-res image.
  const JSZip = (await import('jszip')).default
  const zip = new JSZip()
  for (let i = 0; i < nodes.length; i++) {
    const c = await captureNode(nodes[i], html2canvas)
    zip.file(`${filename}-${i + 1}.jpg`, dataUrlToBase64(c.toDataURL('image/jpeg', 0.95)), { base64: true })
  }
  const blob = await zip.generateAsync({ type: 'blob' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${filename}.zip`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}

export async function exportPdf(nodes: HTMLElement[], filename: string) {
  const html2canvas = (await import('html2canvas')).default
  const mod: any = await import('jspdf')
  const JsPDF = mod.jsPDF || mod.default
  let pdf: any = null
  for (let i = 0; i < nodes.length; i++) {
    const c = await captureNode(nodes[i], html2canvas)
    const landscape = c.width >= c.height
    if (!pdf) pdf = new JsPDF({ orientation: landscape ? 'l' : 'p', unit: 'pt', format: 'a4' })
    else pdf.addPage('a4', landscape ? 'l' : 'p')
    const pw = pdf.internal.pageSize.getWidth()
    const ph = pdf.internal.pageSize.getHeight()
    const img = c.toDataURL('image/jpeg', 0.95)
    const margin = 20
    const availW = pw - margin * 2
    const availH = ph - margin * 2
    const imgW = availW
    const imgH = (c.height * availW) / c.width
    if (imgH <= availH) {
      // Fits on one page: fill width, vertically centered -> as large as possible.
      pdf.addImage(img, 'JPEG', margin, margin + (availH - imgH) / 2, imgW, imgH)
    } else {
      // Too tall for one page (e.g. long table): paginate full-bleed by slicing height.
      const fbW = pw
      const fbH = (c.height * pw) / c.width
      let heightLeft = fbH
      let position = 0
      pdf.addImage(img, 'JPEG', 0, position, fbW, fbH)
      heightLeft -= ph
      while (heightLeft > 0) {
        position -= ph
        pdf.addPage('a4', landscape ? 'l' : 'p')
        pdf.addImage(img, 'JPEG', 0, position, fbW, fbH)
        heightLeft -= ph
      }
    }
  }
  pdf.save(`${filename}.pdf`)
}

export async function exportPpt(nodes: HTMLElement[], filename: string, title?: string) {
  const html2canvas = (await import('html2canvas')).default
  const mod: any = await import('pptxgenjs')
  const PptxGenJS = mod.default || mod
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE' // 13.33in x 7.5in
  const slideW = 13.33
  const slideH = 7.5
  const margin = 0.3
  const titleH = title ? 0.5 : 0
  const availW = slideW - margin * 2
  const availH = slideH - margin * 2 - titleH
  for (let i = 0; i < nodes.length; i++) {
    const c = await captureNode(nodes[i], html2canvas)
    const img = c.toDataURL('image/jpeg', 0.95)
    const ar = c.width / c.height
    let w = availW
    let h = availW / ar
    if (h > availH) { h = availH; w = availH * ar }
    const x = (slideW - w) / 2
    const y = margin + titleH + (availH - h) / 2
    const slide = pptx.addSlide()
    if (title) slide.addText(nodes.length > 1 ? `${title} (${i + 1}/${nodes.length})` : title, { x: margin, y: 0.15, w: availW, h: 0.4, fontSize: 16, bold: true, color: '363636' })
    slide.addImage({ data: img, x, y, w, h })
  }
  await pptx.writeFile({ fileName: `${filename}.pptx` })
}
