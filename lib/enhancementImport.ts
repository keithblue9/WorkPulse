// Reads the "IT Requirement" workbook: only sheets named "BPDP - <app>" (SSP and others are ignored).
// Layout per sheet (from row 3): A No · B New/Carry Over · C Enhancement · D Item ·
// E User · F Fulfiller (impact) · G Flow Aplikasi · H Proses Bisnis (effort), scores "0 - …" to "5 - …".
// The row below an item holds the narration for each score. Pure: no database access.
import type ExcelJS from 'exceljs'
import { CODE_PREFIX, ENH_APPS, ENH_TYPES, type EnhItem } from '@/lib/enhancement'

export type ParsedEnh = { app: string; code: string; title: string; type: string; items: EnhItem[]; sheet: string; row: number }
export type ParseResult = { sheets: string[]; ignored: string[]; groups: ParsedEnh[]; errors: string[] }

const SHEET_RE = /^\s*BPDP\s*-\s*(.+?)\s*$/i
const MAX_ROWS = 1000, MAX_TITLE = 300, MAX_TEXT = 2000

/** Plain text of any exceljs cell value (string, number, rich text, formula result, hyperlink). */
export function cellText(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === 'object') {
    const o = v as any
    if (Array.isArray(o.richText)) return o.richText.map((r: any) => r?.text ?? '').join('').trim()
    if ('result' in o) return cellText(o.result)
    if ('text' in o) return cellText(o.text)
  }
  return ''
}

/** Score cell → 0..5, null when empty, 'bad' when filled with something else. */
export function parseScore(v: unknown): number | null | 'bad' {
  if (typeof v === 'number') return Number.isInteger(v) && v >= 0 && v <= 5 ? v : 'bad'
  const s = cellText(v)
  if (!s) return null
  const m = /^(\d+)\b/.exec(s)
  if (!m) return 'bad'
  const n = Number(m[1])
  return n >= 0 && n <= 5 ? n : 'bad'
}

const appOf = (raw: string) => ENH_APPS.find(a => a.toLowerCase() === raw.toLowerCase()) || raw
const typeOf = (raw: string) => ENH_TYPES.find(t => t.toLowerCase() === raw.replace(/\s+/g, ' ').toLowerCase()) || (raw ? raw : 'New')

export function parseWorkbook(wb: ExcelJS.Workbook): ParseResult {
  const res: ParseResult = { sheets: [], ignored: [], groups: [], errors: [] }
  wb.eachSheet(ws => {
    const m = SHEET_RE.exec(ws.name)
    if (!m) { res.ignored.push(ws.name); return }
    res.sheets.push(ws.name)
    const app = appOf(m[1])
    const p16 = cellText(ws.getCell('P16').value)
    const prefix = /^[A-Z]{1,3}-[A-Z]{2,4}$/.test(p16) ? p16 : CODE_PREFIX[app] || `B-${app.slice(0, 2).toUpperCase()}`
    const byTitle = new Map<string, ParsedEnh>()
    const last = Math.min(ws.rowCount, MAX_ROWS)
    let lastTitle = '', lastType = '', prevItem = '', prevTitle = ''
    const isNum = (x: unknown) => typeof x === 'number'
    for (let r = 3; r <= last; r++) {
      const row = ws.getRow(r)
      const c = (i: number) => row.getCell(i).value
      const item = cellText(c(4))
      const title = cellText(c(3)).slice(0, MAX_TITLE)
      const raw = [c(5), c(6), c(7), c(8)]
      const sc = raw.map(parseScore)
      // Narration row of the previous item: merged A–D cells repeat the item and title values.
      if (item && item === prevItem && (!title || title === prevTitle) && !sc.some(isNum)) continue
      if (title) { lastTitle = title; lastType = cellText(c(2)) }
      if (!item) continue
      const t = title || lastTitle, at = r
      if (!t) { res.errors.push(`${ws.name} baris ${r}: item tanpa judul enhancement`); continue }
      prevItem = item; prevTitle = t
      const badIdx = sc.findIndex(x => x === 'bad')
      if (badIdx >= 0) { res.errors.push(`${ws.name} baris ${r}: skor "${cellText(raw[badIdx])}" harus 0–5`); continue }
      const it: EnhItem = { t: item.slice(0, MAX_TEXT), u: sc[0] as number | null, f: sc[1] as number | null, fl: sc[2] as number | null, pb: sc[3] as number | null }
      // Narration row directly below: no new item/title (or the merged copies), text instead of scores in E..H.
      if (r + 1 <= last) {
        const nx = ws.getRow(r + 1)
        const nd = cellText(nx.getCell(4).value), nc = cellText(nx.getCell(3).value)
        const nv = [5, 6, 7, 8].map(i => nx.getCell(i).value)
        if ((!nd || nd === item) && (!nc || nc === t) && !nv.map(parseScore).some(isNum)) {
          const d = nv.map(v => cellText(v).slice(0, MAX_TEXT))
          if (d.some(Boolean)) { Object.assign(it, { du: d[0], df: d[1], dfl: d[2], dpb: d[3] }); r++ }
        }
      }
      let g = byTitle.get(t)
      if (!g) {
        g = { app, code: `${prefix}-${String(byTitle.size + 1).padStart(2, '0')}`, title: t, type: typeOf(cellText(c(2)) || lastType), items: [], sheet: ws.name, row: at }
        byTitle.set(t, g)
      }
      g.items.push(it)
    }
    res.groups.push(...byTitle.values())
  })
  return res
}
