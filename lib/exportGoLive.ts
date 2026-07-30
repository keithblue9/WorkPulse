// Export Go-Live ke Excel & PDF.
//
// Beda dgn lib/exportView.ts (screenshot/html2canvas), di sini data diexport
// APA ADANYA jadi tabel asli -> teks tetap tajam, bisa di-filter di Excel,
// dan font tidak mengecil walau kolomnya banyak.
//
// Tabel Go-Live sangat lebar (5 kolom identitas + tiap app punya 1 kolom
// tanggal + N sub-fitur). Jadi:
//  - Excel : 1 sheet lebar (Excel memang kuat utk tabel lebar) + sheet Ringkasan.
//  - PDF   : dipecah per aplikasi (dan per potongan sub-fitur kalau masih lebar),
//            kolom identitas selalu diulang, halaman menyesuaikan kebutuhan.
//            Ukuran font dijaga minimal 12pt.

export type GoLiveSub = { key: string; label: string }
export type GoLiveApp = { key: string; label: string; subFeatures?: GoLiveSub[] }
export type GoLiveEntity = {
  name?: string; cocd?: string; group?: string; client?: string
  apps?: Record<string, { date?: string; done?: boolean; subs?: Record<string, boolean> }>
}

const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']
const PALETTE = ['4F8EF7', '8B5CF6', '22C55E', 'F59E0B', 'EC4899', '14B8A6']

/** '2023-05' -> 'Mei-23'. 'Not Yet'/kosong dibiarkan apa adanya. */
export function fmtGoLiveDate(v?: string) {
  if (!v || v === 'Not Yet') return v || ''
  const [y, m] = String(v).split('-')
  const mi = parseInt(m, 10)
  return m && y && mi >= 1 && mi <= 12 ? `${MONTHS[mi - 1]}-${y.slice(2)}` : String(v)
}

const subsOf = (a: GoLiveApp) => a.subFeatures || []
const appState = (e: GoLiveEntity, key: string) => (e.apps || {})[key] || {}
const isDone = (e: GoLiveEntity, a: GoLiveApp) => {
  const ap: any = appState(e, a.key)
  return !!(ap.done || (ap.subs && Object.values(ap.subs).some(Boolean)))
}

/** Ringkasan: berapa entitas yang sudah go-live per aplikasi. */
export function goLiveSummary(apps: GoLiveApp[], entities: GoLiveEntity[]) {
  return apps.map((a, i) => {
    const done = entities.filter(e => isDone(e, a)).length
    const total = entities.length
    return { key: a.key, label: a.label, done, total, pct: total ? Math.round((done / total) * 100) : 0, color: PALETTE[i % PALETTE.length] }
  })
}

const stamp = () => {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}
const nowLabel = () => new Date().toLocaleString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

// ───────────────────────────── EXCEL ─────────────────────────────

export async function exportGoLiveExcel(apps: GoLiveApp[], entities: GoLiveEntity[], meta?: { filterLabel?: string }) {
  const mod: any = await import('exceljs')
  const ExcelJS = mod.default || mod
  const wb = new ExcelJS.Workbook()
  wb.creator = 'WorkPulse'
  wb.created = new Date()

  const ws = wb.addWorksheet('Go-Live', {
    views: [{ state: 'frozen', xSplit: 5, ySplit: 6 }],   // kunci kolom identitas + header
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
  })

  const IDENTITY = ['No', 'Company', 'CoCd', 'HSH', 'Client']
  const totalCols = IDENTITY.length + apps.reduce((s, a) => s + subsOf(a).length + 1, 0)

  // ── Judul ──
  ws.mergeCells(1, 1, 1, Math.max(totalCols, 6))
  const t1 = ws.getCell(1, 1)
  t1.value = 'Go-Live Status per Entitas'
  t1.font = { size: 18, bold: true, color: { argb: 'FF1F2937' } }
  t1.alignment = { vertical: 'middle' }
  ws.getRow(1).height = 26

  ws.mergeCells(2, 1, 2, Math.max(totalCols, 6))
  const t2 = ws.getCell(2, 1)
  t2.value = `WorkPulse · ${entities.length} entitas${meta?.filterLabel ? ` · ${meta.filterLabel}` : ''} · diekspor ${nowLabel()}`
  t2.font = { size: 12, color: { argb: 'FF6B7280' } }
  ws.getRow(2).height = 18

  // ── Ringkasan singkat di atas tabel ──
  const sum = goLiveSummary(apps, entities)
  ws.mergeCells(3, 1, 3, Math.max(totalCols, 6))
  const t3 = ws.getCell(3, 1)
  t3.value = sum.map(s => `${s.label}: ${s.done}/${s.total} (${s.pct}%)`).join('   |   ')
  t3.font = { size: 12, bold: true, color: { argb: 'FF374151' } }
  ws.getRow(3).height = 18
  ws.getRow(4).height = 6   // spasi

  // ── Header 2 baris (baris 5 & 6) ──
  const HR1 = 5, HR2 = 6
  IDENTITY.forEach((label, i) => {
    ws.mergeCells(HR1, i + 1, HR2, i + 1)
    const c = ws.getCell(HR1, i + 1)
    c.value = label
    c.font = { size: 12, bold: true, color: { argb: 'FFFFFFFF' } }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF374151' } }
    c.alignment = { horizontal: i === 1 ? 'left' : 'center', vertical: 'middle', wrapText: true }
  })

  let col = IDENTITY.length + 1
  apps.forEach((a, ai) => {
    const subs = subsOf(a)
    const span = subs.length + 1
    const color = PALETTE[ai % PALETTE.length]
    // Baris 1: nama aplikasi (merge)
    ws.mergeCells(HR1, col, HR1, col + span - 1)
    const h = ws.getCell(HR1, col)
    h.value = a.label
    h.font = { size: 13, bold: true, color: { argb: 'FFFFFFFF' } }
    h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${color}` } }
    h.alignment = { horizontal: 'center', vertical: 'middle' }
    // Baris 2: Tgl + sub-fitur
    const labels = ['Tgl Go-Live', ...subs.map(s => s.label)]
    labels.forEach((lb, k) => {
      const c = ws.getCell(HR2, col + k)
      c.value = lb
      c.font = { size: 12, bold: true, color: { argb: 'FF111827' } }
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `33${color}` } }
      c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    })
    col += span
  })
  ws.getRow(HR1).height = 22
  ws.getRow(HR2).height = 30

  // ── Data ──
  entities.forEach((e, i) => {
    const row: any[] = [i + 1, e.name || '', e.cocd || '', e.group || '', e.client || '']
    apps.forEach(a => {
      const ap: any = appState(e, a.key)
      row.push(fmtGoLiveDate(ap.date))
      subsOf(a).forEach(sf => row.push((ap.subs || {})[sf.key] ? '✓' : ''))
    })
    const r = ws.addRow(row)
    r.height = 20
    r.eachCell({ includeEmpty: true }, (cell: any, idx: number) => {
      cell.font = { size: 12, color: { argb: 'FF111827' } }
      cell.alignment = { horizontal: idx === 2 ? 'left' : 'center', vertical: 'middle' }
      if (i % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F8FA' } }
    })
    // Warnai tanda centang sesuai warna aplikasinya
    let c2 = IDENTITY.length + 1
    apps.forEach((a, ai) => {
      const color = PALETTE[ai % PALETTE.length]
      const dateCell = r.getCell(c2)
      if (dateCell.value) dateCell.font = { size: 12, bold: true, color: { argb: `FF${color}` } }
      subsOf(a).forEach((_s, k) => {
        const cc = r.getCell(c2 + 1 + k)
        if (cc.value === '✓') cc.font = { size: 12, bold: true, color: { argb: `FF${color}` } }
      })
      c2 += subsOf(a).length + 1
    })
  })

  // ── Lebar kolom & garis ──
  const widths = [6, 42, 9, 14, 12]
  apps.forEach(a => { widths.push(15); subsOf(a).forEach(s => widths.push(Math.max(9, Math.min(16, s.label.length + 4)))) })
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w })

  const lastRow = HR2 + entities.length
  for (let r = HR1; r <= lastRow; r++) {
    for (let c = 1; c <= totalCols; c++) {
      ws.getCell(r, c).border = {
        top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      }
    }
  }
  ws.autoFilter = { from: { row: HR2, column: 1 }, to: { row: lastRow, column: totalCols } }

  // ── Sheet Ringkasan ──
  const ws2 = wb.addWorksheet('Ringkasan', { pageSetup: { orientation: 'portrait', paperSize: 9 } })
  ws2.mergeCells(1, 1, 1, 4)
  const s1 = ws2.getCell(1, 1)
  s1.value = 'Ringkasan Go-Live per Aplikasi'
  s1.font = { size: 16, bold: true }
  ws2.getRow(1).height = 24
  ws2.getCell(2, 1).value = `Total entitas: ${entities.length} · diekspor ${nowLabel()}`
  ws2.getCell(2, 1).font = { size: 12, color: { argb: 'FF6B7280' } }

  const head2 = ['Aplikasi', 'Sudah Go-Live', 'Total Entitas', '% Progress']
  head2.forEach((h, i) => {
    const c = ws2.getCell(4, i + 1)
    c.value = h
    c.font = { size: 12, bold: true, color: { argb: 'FFFFFFFF' } }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF374151' } }
    c.alignment = { horizontal: 'center', vertical: 'middle' }
  })
  ws2.getRow(4).height = 22
  sum.forEach((s, i) => {
    const r = ws2.addRow([s.label, s.done, s.total, s.pct / 100])
    r.height = 20
    r.eachCell((cell: any) => { cell.font = { size: 12 }; cell.alignment = { horizontal: 'center', vertical: 'middle' } })
    r.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' }
    r.getCell(1).font = { size: 12, bold: true, color: { argb: `FF${s.color}` } }
    r.getCell(4).numFmt = '0%'
  })
  ws2.columns = [{ width: 26 }, { width: 18 }, { width: 16 }, { width: 14 }]
  for (let r = 4; r <= 4 + sum.length; r++) {
    for (let c = 1; c <= 4; c++) {
      ws2.getCell(r, c).border = {
        top: { style: 'thin', color: { argb: 'FFD1D5DB' } }, left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } }, right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      }
    }
  }

  const buf = await wb.xlsx.writeBuffer()
  download(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `golive-${stamp()}.xlsx`)
}

// ───────────────────────────── PDF ─────────────────────────────

/** Potong teks agar muat di lebar kolom (mm). */
function fit(doc: any, text: string, maxW: number) {
  let t = String(text ?? '')
  if (!t) return ''
  if (doc.getTextWidth(t) <= maxW) return t
  while (t.length > 1 && doc.getTextWidth(t + '…') > maxW) t = t.slice(0, -1)
  return t + '…'
}

/** Bangun dokumen PDF-nya saja (dipisah dari aksi simpan supaya bisa diuji). */
export async function buildGoLivePdfDoc(apps: GoLiveApp[], entities: GoLiveEntity[], meta?: { filterLabel?: string }) {
  const mod: any = await import('jspdf')
  const JsPDF = mod.jsPDF || mod.default
  const doc = new JsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  const PW = 297, PH = 210, M = 8
  const USABLE = PW - M * 2

  // Kolom identitas selalu ikut di tiap halaman detail
  const ID_COLS = [
    { label: 'No', w: 10, align: 'center' as const },
    { label: 'Company', w: 76, align: 'left' as const },
    { label: 'CoCd', w: 16, align: 'center' as const },
    { label: 'HSH', w: 26, align: 'left' as const },
    { label: 'Client', w: 20, align: 'center' as const },
  ]
  const ID_W = ID_COLS.reduce((s, c) => s + c.w, 0)
  const DATE_W = 26
  const MIN_SUB_W = 17          // jaga agar label sub-fitur tetap terbaca di 12pt
  const ROW_H = 7.6
  const HEAD_H = 9

  const FS_TITLE = 17, FS_SUB = 12, FS_HEAD = 12, FS_BODY = 12   // minimal 12 utk isi tabel

  const sum = goLiveSummary(apps, entities)
  let pageNo = 0

  const footer = () => {
    pageNo++
    doc.setFontSize(10); doc.setTextColor(150)
    doc.text('WorkPulse · Go-Live', M, PH - 4)
    doc.text(`Halaman ${pageNo}`, PW - M, PH - 4, { align: 'right' })
    doc.setTextColor(17)
  }

  // ── Halaman 1: Ringkasan ──
  doc.setFontSize(FS_TITLE); doc.setFont('helvetica', 'bold'); doc.setTextColor(31, 41, 55)
  doc.text('Go-Live Status per Entitas', M, M + 9)
  doc.setFontSize(FS_SUB); doc.setFont('helvetica', 'normal'); doc.setTextColor(107, 114, 128)
  doc.text(`WorkPulse · ${entities.length} entitas${meta?.filterLabel ? ` · ${meta.filterLabel}` : ''} · diekspor ${nowLabel()}`, M, M + 16)

  let y = M + 28
  doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(31, 41, 55)
  doc.text('Ringkasan per Aplikasi', M, y)
  y += 7

  const sumCols = [{ l: 'Aplikasi', w: 70 }, { l: 'Sudah Go-Live', w: 40 }, { l: 'Total', w: 30 }, { l: 'Progress', w: 30 }, { l: '', w: 90 }]
  doc.setFillColor(55, 65, 81)
  doc.rect(M, y, sumCols.reduce((s, c) => s + c.w, 0), HEAD_H, 'F')
  doc.setFontSize(FS_HEAD); doc.setTextColor(255, 255, 255)
  let sx = M
  sumCols.forEach(c => { if (c.l) doc.text(c.l, sx + 2, y + 6.2); sx += c.w })
  y += HEAD_H

  doc.setFont('helvetica', 'normal')
  sum.forEach((s, i) => {
    if (i % 2 === 1) { doc.setFillColor(247, 248, 250); doc.rect(M, y, sumCols.reduce((a, c) => a + c.w, 0), ROW_H, 'F') }
    const rgb = [parseInt(s.color.slice(0, 2), 16), parseInt(s.color.slice(2, 4), 16), parseInt(s.color.slice(4, 6), 16)]
    doc.setFontSize(FS_BODY)
    doc.setTextColor(rgb[0], rgb[1], rgb[2]); doc.setFont('helvetica', 'bold')
    doc.text(fit(doc, s.label, sumCols[0].w - 4), M + 2, y + 5.4)
    doc.setTextColor(17, 24, 39); doc.setFont('helvetica', 'normal')
    doc.text(String(s.done), M + sumCols[0].w + 2, y + 5.4)
    doc.text(String(s.total), M + sumCols[0].w + sumCols[1].w + 2, y + 5.4)
    doc.text(`${s.pct}%`, M + sumCols[0].w + sumCols[1].w + sumCols[2].w + 2, y + 5.4)
    // bar progress
    const bx = M + sumCols[0].w + sumCols[1].w + sumCols[2].w + sumCols[3].w + 2
    const bw = sumCols[4].w - 6
    doc.setFillColor(229, 231, 235); doc.rect(bx, y + 2.2, bw, 3.2, 'F')
    doc.setFillColor(rgb[0], rgb[1], rgb[2]); doc.rect(bx, y + 2.2, (bw * s.pct) / 100, 3.2, 'F')
    y += ROW_H
  })
  footer()

  // ── Halaman detail: per aplikasi (dipotong lagi kalau sub-fitur kebanyakan) ──
  const maxSubsPerChunk = Math.max(1, Math.floor((USABLE - ID_W - DATE_W) / MIN_SUB_W))

  apps.forEach((app, ai) => {
    const subs = subsOf(app)
    const chunks: GoLiveSub[][] = subs.length ? [] : [[]]
    for (let i = 0; i < subs.length; i += maxSubsPerChunk) chunks.push(subs.slice(i, i + maxSubsPerChunk))

    const color = PALETTE[ai % PALETTE.length]
    const rgb = [parseInt(color.slice(0, 2), 16), parseInt(color.slice(2, 4), 16), parseInt(color.slice(4, 6), 16)]
    const s = sum.find(x => x.key === app.key)

    chunks.forEach((chunk, ci) => {
      const subW = chunk.length ? Math.min(30, (USABLE - ID_W - DATE_W) / chunk.length) : 0
      const tableW = ID_W + DATE_W + subW * chunk.length

      let rowIdx = 0
      while (rowIdx < entities.length) {
        doc.addPage()

        // Judul halaman
        doc.setFontSize(15); doc.setFont('helvetica', 'bold'); doc.setTextColor(rgb[0], rgb[1], rgb[2])
        doc.text(app.label, M, M + 8)
        doc.setFontSize(FS_SUB); doc.setFont('helvetica', 'normal'); doc.setTextColor(107, 114, 128)
        const part = chunks.length > 1 ? ` · bagian ${ci + 1}/${chunks.length}` : ''
        doc.text(`${s ? `${s.done}/${s.total} entitas sudah go-live (${s.pct}%)` : ''}${part}${meta?.filterLabel ? ` · ${meta.filterLabel}` : ''}`, M, M + 14)

        let ty = M + 19

        // Header tabel
        doc.setFillColor(55, 65, 81); doc.rect(M, ty, ID_W, HEAD_H, 'F')
        doc.setFillColor(rgb[0], rgb[1], rgb[2]); doc.rect(M + ID_W, ty, tableW - ID_W, HEAD_H, 'F')
        doc.setFontSize(FS_HEAD); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255)
        let hx = M
        ID_COLS.forEach(c => {
          const tx = c.align === 'left' ? hx + 2 : hx + c.w / 2
          doc.text(fit(doc, c.label, c.w - 3), tx, ty + 6.2, { align: c.align === 'left' ? 'left' : 'center' })
          hx += c.w
        })
        doc.text('Tgl Go-Live', hx + DATE_W / 2, ty + 6.2, { align: 'center' })
        hx += DATE_W
        chunk.forEach(sf => { doc.text(fit(doc, sf.label, subW - 2), hx + subW / 2, ty + 6.2, { align: 'center' }); hx += subW })
        ty += HEAD_H

        // Baris data — berhenti saat halaman penuh
        doc.setFont('helvetica', 'normal'); doc.setFontSize(FS_BODY)
        while (rowIdx < entities.length && ty + ROW_H <= PH - 12) {
          const e = entities[rowIdx]
          const ap: any = appState(e, app.key)
          if (rowIdx % 2 === 1) { doc.setFillColor(247, 248, 250); doc.rect(M, ty, tableW, ROW_H, 'F') }

          doc.setTextColor(17, 24, 39)
          let cx = M
          const vals = [String(rowIdx + 1), e.name || '', e.cocd || '', e.group || '', e.client || '']
          ID_COLS.forEach((c, k) => {
            const tx = c.align === 'left' ? cx + 2 : cx + c.w / 2
            doc.text(fit(doc, vals[k], c.w - 3), tx, ty + 5.3, { align: c.align === 'left' ? 'left' : 'center' })
            cx += c.w
          })
          // tanggal
          const dv = fmtGoLiveDate(ap.date)
          if (dv) { doc.setTextColor(rgb[0], rgb[1], rgb[2]); doc.setFont('helvetica', 'bold') }
          doc.text(fit(doc, dv || '–', DATE_W - 3), cx + DATE_W / 2, ty + 5.3, { align: 'center' })
          doc.setFont('helvetica', 'normal'); doc.setTextColor(17, 24, 39)
          cx += DATE_W
          // centang sub-fitur
          chunk.forEach(sf => {
            const ok = !!(ap.subs || {})[sf.key]
            if (ok) { doc.setTextColor(rgb[0], rgb[1], rgb[2]); doc.setFont('helvetica', 'bold') }
            else doc.setTextColor(203, 213, 225)
            doc.text(ok ? 'V' : '–', cx + subW / 2, ty + 5.3, { align: 'center' })
            doc.setFont('helvetica', 'normal'); doc.setTextColor(17, 24, 39)
            cx += subW
          })

          doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.1)
          doc.line(M, ty + ROW_H, M + tableW, ty + ROW_H)
          ty += ROW_H
          rowIdx++
        }

        footer()
      }
    })
  })

  return doc
}

export async function exportGoLivePdf(apps: GoLiveApp[], entities: GoLiveEntity[], meta?: { filterLabel?: string }) {
  const doc = await buildGoLivePdfDoc(apps, entities, meta)
  doc.save(`golive-${stamp()}.pdf`)
}
