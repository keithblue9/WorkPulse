// Client-only export helpers (JPG / PDF / PPT) built by capturing a DOM node.
// All heavy libs are dynamically imported so they never run on the server and
// stay out of the initial JS bundle.

type Restore = () => void

// Temporarily expand clipped/scrollable descendants and hide elements marked
// with [data-export-hide] so the captured image is the full, clean content.
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

async function capture(node: HTMLElement): Promise<HTMLCanvasElement> {
  const html2canvas = (await import('html2canvas')).default
  const restore = prepareCapture(node)
  // Let layout settle after expanding before snapshotting
  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
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

export async function exportJpg(node: HTMLElement, filename: string) {
  const canvas = await capture(node)
  const a = document.createElement('a')
  a.href = canvas.toDataURL('image/jpeg', 0.95)
  a.download = `${filename}.jpg`
  a.click()
}

export async function exportPdf(node: HTMLElement, filename: string) {
  const canvas = await capture(node)
  const mod: any = await import('jspdf')
  const JsPDF = mod.jsPDF || mod.default
  const img = canvas.toDataURL('image/jpeg', 0.95)
  const landscape = canvas.width > canvas.height
  const pdf = new JsPDF({ orientation: landscape ? 'l' : 'p', unit: 'pt', format: 'a4' })
  const pw = pdf.internal.pageSize.getWidth()
  const ph = pdf.internal.pageSize.getHeight()
  const imgW = pw
  const imgH = (canvas.height * pw) / canvas.width
  let heightLeft = imgH
  let position = 0
  pdf.addImage(img, 'JPEG', 0, position, imgW, imgH)
  heightLeft -= ph
  while (heightLeft > 0) {
    position -= ph
    pdf.addPage()
    pdf.addImage(img, 'JPEG', 0, position, imgW, imgH)
    heightLeft -= ph
  }
  pdf.save(`${filename}.pdf`)
}

export async function exportPpt(node: HTMLElement, filename: string, title?: string) {
  const canvas = await capture(node)
  const mod: any = await import('pptxgenjs')
  const PptxGenJS = mod.default || mod
  const img = canvas.toDataURL('image/jpeg', 0.95)
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE' // 13.33in x 7.5in
  const slide = pptx.addSlide()
  const slideW = 13.33
  const slideH = 7.5
  const margin = 0.35
  const titleH = title ? 0.6 : 0
  const availW = slideW - margin * 2
  const availH = slideH - margin * 2 - titleH
  const ar = canvas.width / canvas.height
  let w = availW
  let h = availW / ar
  if (h > availH) { h = availH; w = availH * ar }
  const x = (slideW - w) / 2
  const y = margin + titleH + (availH - h) / 2
  if (title) slide.addText(title, { x: margin, y: 0.18, w: availW, h: 0.45, fontSize: 18, bold: true, color: '363636' })
  slide.addImage({ data: img, x, y, w, h })
  await pptx.writeFile({ fileName: `${filename}.pptx` })
}
