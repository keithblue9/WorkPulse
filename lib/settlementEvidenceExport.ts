'use client'
// Renderer dokumen "Rincian Kuitansi/Nota Settlement Cash Card" ke PDF (jsPDF) dan Word (docx).
// Keduanya memakai rencana halaman yang sama (planPages) supaya isi & tata letak identik.
import {
  PAGE, MARGIN, COLS, TABLE_W, EVIDENCE_W, HEADER_H, ROW_H, CELL_PAD, IMG_GAP,
  planPages, type EvidenceItem, type PagePlan,
} from './settlementEvidence'
import type { EvidenceImage } from './settlementEvidenceImages'

export type ExportInput = { title: [string, string]; items: EvidenceItem[]; images: EvidenceImage[][] }

const HEADER_FILL = 'FFC000'           // kuning emas header tabel (sesuai template)
const HEADERS = ['No', 'Ket. Transaksi', 'Tanggal', 'Jumlah', 'Evidence']
const COL_W = [COLS.no, COLS.ket, COLS.tgl, COLS.jml, EVIDENCE_W]
const TEXT_PAD = 1.6

export function makePlans(input: ExportInput): PagePlan[] {
  return planPages(input.items, input.images.map(list => list.map(i => ({ w: i.w, h: i.h }))))
}

function fnv(bytes: Uint8Array): string {
  let h = 0x811c9dc5
  for (let i = 0; i < bytes.length; i++) { h ^= bytes[i]; h = Math.imul(h, 0x01000193) }
  return (h >>> 0).toString(36) + '_' + bytes.length
}

// =====================================================================
// PDF
// =====================================================================
export async function buildEvidencePdf(input: ExportInput): Promise<Blob> {
  const mod: any = await import('jspdf'); const JsPDF = mod.jsPDF || mod.default
  const doc = new JsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true })
  const plans = makePlans(input)
  const totalPages = plans.length + 1
  const lineH = (pt: number) => pt * 0.3528 * 1.18

  const footer = (n: number) => {
    const y = PAGE.h - 9
    let x = MARGIN.left
    doc.setFontSize(9); doc.setTextColor(0, 0, 0)
    const seg = (t: string, bold: boolean) => { doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.text(t, x, y); x += doc.getTextWidth(t) }
    seg('Page ', false); seg(String(n), true); seg(' of ', false); seg(String(totalPages), true)
  }

  // Halaman 1: judul
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(0, 0, 0)
  doc.text(input.title[0], PAGE.w / 2, 30, { align: 'center' })
  doc.text(input.title[1], PAGE.w / 2, 36, { align: 'center' })
  footer(1)

  const aliases = new Map<EvidenceImage, string>()
  const aliasOf = (img: EvidenceImage) => { let a = aliases.get(img); if (!a) { a = 'ev_' + fnv(img.data); aliases.set(img, a) } return a }

  plans.forEach((plan, pi) => {
    doc.addPage('a4', 'landscape')
    const x0 = MARGIN.left
    let y = MARGIN.top
    doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.25)

    if (plan.withHeader) {
      doc.setFillColor(0xFF, 0xC0, 0x00)
      doc.rect(x0, y, TABLE_W, HEADER_H, 'F')
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5)
      let cx = x0
      HEADERS.forEach((h, i) => { doc.rect(cx, y, COL_W[i], HEADER_H); doc.text(h, cx + COL_W[i] / 2, y + HEADER_H / 2 + 1.3, { align: 'center' }); cx += COL_W[i] })
      y += HEADER_H
    }
    const rowH = ROW_H - (plan.withHeader ? HEADER_H : 0)
    let cx = x0
    COL_W.forEach(w => { doc.rect(cx, y, w, rowH); cx += w })

    // Kolom teks
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5)
    const lh = lineH(10.5)
    const top = y + TEXT_PAD + 3.2
    const writeLines = (lines: string[], x: number, y0: number, align: 'left' | 'center' = 'left') => {
      lines.forEach((l, i) => doc.text(l, x, y0 + i * lh, { align }))
      return y0 + lines.length * lh
    }
    const it = plan.item
    writeLines([String(it.no)], x0 + COLS.no / 2, top, 'center')
    const ketX = x0 + COLS.no + TEXT_PAD, ketW = COLS.ket - TEXT_PAD * 2
    let ky = writeLines(doc.splitTextToSize(it.label, ketW), ketX, top)
    ky += lh * 0.9
    ky = writeLines(doc.splitTextToSize(it.keperluan, ketW), ketX, ky)
    if (plan.continued) { doc.setFont('helvetica', 'italic'); writeLines(['(lanjutan evidence)'], ketX, ky + lh * 0.6); doc.setFont('helvetica', 'normal') }
    const tglX = x0 + COLS.no + COLS.ket
    writeLines(doc.splitTextToSize(it.tanggal, COLS.tgl - TEXT_PAD * 2), tglX + TEXT_PAD, top)
    writeLines(doc.splitTextToSize(it.jumlah, COLS.jml - TEXT_PAD * 2), tglX + COLS.tgl + TEXT_PAD, top)

    // Evidence
    const ex = x0 + COLS.no + COLS.ket + COLS.tgl + COLS.jml + CELL_PAD
    const ey = y + CELL_PAD
    const imgs = input.images[input.items.indexOf(plan.item)] || []
    plan.layout.rows.forEach(row => row.items.forEach(p => {
      const img = imgs[plan.images[p.index]]
      if (img) doc.addImage(img.dataUrl, 'JPEG', ex + p.x, ey + p.y, p.w, p.h, aliasOf(img), 'NONE')
    }))
    footer(pi + 2)
  })
  return doc.output('blob')
}

// =====================================================================
// WORD (.docx)
// =====================================================================
const TW = (mm: number) => Math.round(mm * 56.6929)          // mm → twip
const PX = (mm: number) => Math.round(mm * 96 / 25.4)        // mm → px (docx ImageRun @96dpi)

export async function buildEvidenceDocx(input: ExportInput): Promise<Blob> {
  const d: any = await import('docx')
  const {
    Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType, BorderStyle,
    AlignmentType, VerticalAlign, HeightRule, TableLayoutType, ShadingType, PageOrientation, Footer, PageNumber, PageBreak,
  } = d
  const plans = makePlans(input)
  const border = { style: BorderStyle.SINGLE, size: 6, color: '000000' }
  const borders = { top: border, bottom: border, left: border, right: border }
  const font = 'Calibri'
  const txt = (t: string, o: any = {}) => new TextRun({ text: t, font, size: 21, ...o })
  const para = (children: any[], o: any = {}) => new Paragraph({ children, spacing: { before: 0, after: 0 }, ...o })
  const textMargins = { top: TW(TEXT_PAD), bottom: TW(TEXT_PAD), left: TW(TEXT_PAD), right: TW(TEXT_PAD) }

  const headerRow = () => new TableRow({
    height: { value: TW(HEADER_H), rule: HeightRule.EXACT }, cantSplit: true,
    children: HEADERS.map((h, i) => new TableCell({
      width: { size: TW(COL_W[i]), type: WidthType.DXA }, borders, verticalAlign: VerticalAlign.CENTER,
      shading: { type: ShadingType.CLEAR, color: 'auto', fill: HEADER_FILL },
      children: [para([new TextRun({ text: h, bold: true, font, size: 21 })], { alignment: AlignmentType.CENTER })],
    })),
  })

  const rows: any[] = []
  plans.forEach((plan, pi) => {
    if (plan.withHeader) rows.push(headerRow())
    const isLast = pi === plans.length - 1
    // -1 mm (dan -2 mm di baris terakhir) memberi ruang pembulatan supaya tak ada halaman kosong ekstra
    const rowH = ROW_H - (plan.withHeader ? HEADER_H : 0) - (isLast ? 2 : 1)
    const it = plan.item
    const imgs = input.images[input.items.indexOf(it)] || []
    const evidenceParas = plan.layout.rows.length ? plan.layout.rows.map((row, ri) => para(
      row.items.flatMap((p, k) => {
        const img = imgs[plan.images[p.index]]
        const run = new ImageRun({ type: 'jpg', data: img.data, transformation: { width: PX(p.w * 0.99), height: PX(p.h * 0.99) } })
        return k === 0 ? [run] : [new TextRun({ text: ' ', size: 12 }), run]
      }),
      { spacing: { before: 0, after: ri === plan.layout.rows.length - 1 ? 0 : TW(IMG_GAP) } },
    )) : [para([txt('')])]

    const ket = [para([txt(it.label)]), para([txt('')]), para([txt(it.keperluan)])]
    if (plan.continued) ket.push(para([txt('')]), para([txt('(lanjutan evidence)', { italics: true })]))
    const cell = (w: number, children: any[], o: any = {}) => new TableCell({
      width: { size: TW(w), type: WidthType.DXA }, borders, verticalAlign: VerticalAlign.TOP, margins: textMargins, children, ...o,
    })
    rows.push(new TableRow({
      height: { value: TW(rowH), rule: HeightRule.EXACT }, cantSplit: true,
      children: [
        cell(COLS.no, [para([txt(String(it.no))], { alignment: AlignmentType.CENTER })]),
        cell(COLS.ket, ket),
        cell(COLS.tgl, [para([txt(it.tanggal)])]),
        cell(COLS.jml, [para([txt(it.jumlah)])]),
        cell(EVIDENCE_W, evidenceParas, { margins: { top: TW(CELL_PAD), bottom: TW(CELL_PAD), left: TW(CELL_PAD), right: TW(CELL_PAD) } }),
      ],
    }))
  })

  const table = new Table({
    rows, layout: TableLayoutType.FIXED,
    width: { size: TW(TABLE_W), type: WidthType.DXA },
    columnWidths: COL_W.map(TW),
  })

  const title = (t: string) => para([new TextRun({ text: t, bold: true, font: 'Arial', size: 22 })], { alignment: AlignmentType.CENTER })
  const footer = new Footer({ children: [para([
    txt('Page ', { size: 18 }), new TextRun({ children: [PageNumber.CURRENT], font, size: 18, bold: true }),
    txt(' of ', { size: 18 }), new TextRun({ children: [PageNumber.TOTAL_PAGES], font, size: 18, bold: true }),
  ])] })

  const doc = new Document({
    creator: 'WorkPulse', title: input.title[0], description: input.title[1],
    sections: [{
      properties: { page: {
        size: { width: TW(PAGE.h), height: TW(PAGE.w), orientation: PageOrientation.LANDSCAPE },
        margin: { top: TW(MARGIN.top), bottom: TW(MARGIN.bottom), left: TW(MARGIN.left), right: TW(MARGIN.right), footer: TW(8), header: TW(8) },
      } },
      footers: { default: footer },
      children: [
        para([txt('')], { spacing: { before: TW(8 - 0), after: 0 } }),
        title(input.title[0]), title(input.title[1]),
        para([new PageBreak()]),
        table,
        // Word wajib punya paragraf setelah tabel → dibuat sekecil mungkin agar tidak membuat halaman kosong
        new Paragraph({ children: [new TextRun({ text: '', size: 2 })], spacing: { before: 0, after: 0, line: 20, lineRule: 'exact' } }),
      ],
    }],
  })
  return Packer.toBlob(doc)
}
