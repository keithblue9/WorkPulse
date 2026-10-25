import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { connectDB } from '@/lib/db'
import { EnhancementModel } from '@/models/Enhancement'
import { parseWorkbook } from '@/lib/enhancementImport'
import { cleanEnhancement } from '@/lib/enhancementInput'
import { score } from '@/lib/enhancement'
import { sessionEmail, titleKey } from '@/lib/enhancementServer'

// Upload Excel IT Requirement: mode=preview hanya membaca & mencocokkan (tidak menulis);
// mode=commit menyimpan sesuai keputusan per baris (tambah / perbarui / lewati).
const MAX_BYTES = 10 * 1024 * 1024
type Decision = 'tambah' | 'perbarui' | 'lewati'

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData().catch(() => null)
    const file = form?.get('file')
    if (!form || !(file instanceof Blob)) return NextResponse.json({ error: 'Pilih file .xlsx' }, { status: 400 })
    if (file.size > MAX_BYTES) return NextResponse.json({ error: 'File lebih dari 10 MB' }, { status: 400 })
    const buf = Buffer.from(await file.arrayBuffer())
    if (buf.length < 4 || buf[0] !== 0x50 || buf[1] !== 0x4b) return NextResponse.json({ error: 'File bukan .xlsx yang valid' }, { status: 400 })
    const year = Number(form.get('year'))
    if (!Number.isInteger(year) || year < 2020 || year > 2100) return NextResponse.json({ error: 'Tahun tidak valid' }, { status: 400 })
    const mode = form.get('mode') === 'commit' ? 'commit' : 'preview'
    let decisions: Record<string, Decision> = {}
    try { decisions = JSON.parse(String(form.get('decisions') || '{}')) || {} } catch {}

    const wb = new ExcelJS.Workbook()
    try { await wb.xlsx.load(buf as any) } catch { return NextResponse.json({ error: 'File tidak bisa dibaca sebagai Excel' }, { status: 400 }) }
    const parsed = parseWorkbook(wb)
    if (!parsed.sheets.length) return NextResponse.json({ error: 'Tidak ada sheet "BPDP - …" di file ini. Pastikan memakai format IT Requirement.', ignored: parsed.ignored }, { status: 400 })

    await connectDB()
    const existing = await EnhancementModel.find({ year }, { app: 1, title: 1, year: 1, code: 1 }).lean() as any[]
    const byKey = new Map(existing.map(e => [titleKey(e.app, e.title, e.year), e]))
    const groups = parsed.groups.map(g => {
      const key = titleKey(g.app, g.title, year), ex = byKey.get(key), s = score(g.items)
      return { key, app: g.app, code: g.code, title: g.title, type: g.type, sheet: g.sheet, row: g.row, n: g.items.length, cat: s.cat, impact: s.impact, effort: s.effort, existingId: ex ? String(ex._id) : null, existingCode: ex?.code || null, items: g.items }
    })

    if (mode === 'preview') {
      return NextResponse.json({ data: { sheets: parsed.sheets, ignored: parsed.ignored, errors: parsed.errors, year, groups: groups.map(({ items, ...g }) => g) } })
    }

    const email = await sessionEmail(), now = new Date(), fileName = String((file as File).name || '').slice(0, 200)
    let added = 0, updated = 0, skipped = 0
    for (const g of groups) {
      const d: Decision = decisions[g.key] || (g.existingId ? 'perbarui' : 'tambah')
      if (d === 'lewati') { skipped++; continue }
      const r = cleanEnhancement({ app: g.app, title: g.title, type: g.type, year, code: g.code, items: g.items }, false)
      if (!r.ok) { skipped++; continue }
      const source = { file: fileName, sheet: g.sheet, row: g.row, importedAt: now }
      if (g.existingId && d === 'perbarui') {
        // Hanya data dari Excel yang diperbarui; tahap BRD, timeline, PIC dan catatan tetap.
        await EnhancementModel.updateOne({ _id: g.existingId }, { $set: { items: r.data.items, type: r.data.type, code: r.data.code, source, updatedBy: email } })
        updated++
      } else {
        await EnhancementModel.create({ ...r.data, stage: 1, source, createdBy: email, updatedBy: email })
        added++
      }
    }
    return NextResponse.json({ data: { added, updated, skipped } })
  } catch {
    return NextResponse.json({ error: 'Gagal memproses file' }, { status: 500 })
  }
}
