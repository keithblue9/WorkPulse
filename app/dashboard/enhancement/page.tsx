'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import ExportMenu from '@/components/ExportMenu'
import { Gantt } from '@/components/Gantt'
import { Empty, Icon, PageHeader, Pill, Ring, Seg, Sheet, Tile } from '@/components/ui'
import { getConfig } from '@/lib/configCache'
import { userRolesOf } from '@/lib/perms'
import { isInternalUser } from '@/lib/nav'
import { useYear } from '@/lib/year'
import { DAY, calc, dUTC, inYear, isoDay, ptd, statusOf, todayUTC, type Act } from '@/lib/progress'
import { CATS, ENH_APPS, ENH_TYPES, INITIATORS, STAGES, STAGES_SHORT, TPL, brdPct, enhActs, normWeights, rankPrio, score, type Cat, type EnhItem, type EnhPhase } from '@/lib/enhancement'

type Enh = Record<string, any>
type View = { e: Enh; s: ReturnType<typeof score>; acts: Act[]; c: ReturnType<typeof calc>; prio?: number }
type Mode = 'list' | 'matrix' | 'road'

const n1 = (v: number) => (Math.round(v * 100) / 100).toLocaleString('id-ID')
const P = (v: number) => `${Math.round(v)}%`
const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const fmtD = (s: string) => { const t = dUTC(s); if (!Number.isFinite(t)) return '–'; const d = new Date(t); return `${d.getUTCDate()} ${BLN[d.getUTCMonth()]} ${d.getUTCFullYear()}` }
const CAT_K: Record<string, string> = { 'Quick Win': 'qw', Strategis: 'st', Minor: 'mi', 'To Be Consider': 'tc' }
const catK = (c: string) => `k-${CAT_K[c] || 'none'}`
const CAT_ORD: Record<string, number> = { 'Quick Win': 1, Strategis: 2, Minor: 3, 'To Be Consider': 4 }
const TPL_COLORS = ['var(--accent)', '#7B6BFF', 'var(--aqua)', 'var(--warn-bar)', 'var(--muted)']
const SCORE_KEYS = [['u', 'User'], ['f', 'Fulfiller'], ['fl', 'Flow aplikasi'], ['pb', 'Proses bisnis']] as const

async function send(url: string, method: string, body?: unknown) {
  const isForm = body instanceof FormData
  const res = await fetch(url, { method, headers: body && !isForm ? { 'Content-Type': 'application/json' } : undefined, body: isForm ? body : body ? JSON.stringify(body) : undefined })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error || 'Gagal menyimpan, coba lagi')
  return data
}
const addMonths = (iso: string, m: number) => { const t = new Date(dUTC(iso)); t.setUTCMonth(t.getUTCMonth() + m); return isoDay(t.getTime()) }

/* ───────────── Sheet: update satu aktivitas timeline ───────────── */
function PhaseSheet({ v, idx, today, onClose, onSave }: { v: View; idx: number; today: number; onClose: () => void; onSave: (p: EnhPhase) => Promise<void> }) {
  const a = v.acts[idx], isBrd = a.name === 'BRD'
  const [start, setStart] = useState(a.start), [end, setEnd] = useState(a.end), [pct, setPct] = useState(Math.round(a.pct))
  const [saving, setSaving] = useState(false)
  const bad = (!!start !== !!end) ? 'Isi tanggal mulai dan selesai' : start && end && dUTC(end) < dUTC(start) ? 'Tanggal selesai sebelum tanggal mulai' : ''
  const due = !bad && start ? ptd({ start, end }, today) : 0
  const spi = due > 0 ? (isBrd ? a.pct : pct) / due : null
  async function save() { setSaving(true); try { await onSave({ key: a.name, start, end, pct: isBrd ? 0 : pct }); onClose() } catch (e: any) { toast.error(e.message) } finally { setSaving(false) } }
  return (
    <Sheet open title={a.name} onClose={onClose} onSave={save} saveDisabled={saving || !!bad} saveLabel={saving ? 'Menyimpan…' : 'Simpan'}>
      <p className="au-xs au-muted" style={{ textAlign: 'center', marginTop: -6 }}>{v.e.code} · bobot {n1(a.w)}%</p>
      <div className="au-ig">
        <label className="au-igr"><span className="k">Mulai</span><input className="input" type="date" value={start} onChange={e => setStart(e.target.value)} style={{ marginLeft: 'auto', maxWidth: 190 }} /></label>
        <label className="au-igr"><span className="k">Selesai</span><input className="input" type="date" value={end} min={start || undefined} onChange={e => setEnd(e.target.value)} style={{ marginLeft: 'auto', maxWidth: 190 }} /></label>
      </div>
      {isBrd
        ? <div className="au-box" style={{ padding: 14, gap: 6 }}><span className="lbl">Selesai</span><b className="au-bigpct">{P(a.pct)}</b><span className="au-small au-muted">Otomatis dari tahap BRD ({v.e.stage}/7). Ubah lewat kartu Tahap BRD.</span></div>
        : <div className="au-box" style={{ padding: 14, gap: 10 }}>
            <div className="au-row au-between"><span className="lbl">Sudah selesai</span><b className="au-bigpct" aria-live="polite">{pct}%</b></div>
            <input type="range" min={0} max={100} step={5} value={pct} onChange={e => setPct(Number(e.target.value))} aria-label="Persen selesai" style={{ accentColor: 'var(--accent)' }} />
            <div className="au-quick" role="group" aria-label="Pilih cepat">{[0, 25, 50, 75, 100].map(x => <button key={x} type="button" aria-pressed={pct === x} onClick={() => setPct(x)}>{x}%</button>)}</div>
          </div>}
      <div className="au-box" style={{ padding: 14, gap: 8 }}>
        <div className="au-row au-between au-small"><span className="au-ink2">Seharusnya per hari ini</span><b>{P(due)}</b></div>
        <div className="au-row au-between au-small"><span className="au-ink2">Status</span><Pill tone={statusOf(spi).key}>{statusOf(spi).label}</Pill></div>
      </div>
      {bad && <span role="alert" className="au-xs" style={{ color: 'var(--bad)', fontWeight: 600 }}>{bad}</span>}
    </Sheet>
  )
}

/* ───────────── Sheet: bobot per enhancement ───────────── */
function WeightSheet({ v, tpl, onClose, onSave }: { v: View; tpl: number[]; onClose: () => void; onSave: (w: number[] | null) => Promise<void> }) {
  const [w, setW] = useState<number[]>(v.acts.map(a => a.w))
  const [saving, setSaving] = useState(false)
  const total = Math.round(w.reduce((a, b) => a + b, 0) * 100) / 100
  const even = () => { const b = Math.floor(100 / TPL.length); setW(TPL.map((_, i) => b + (i < 100 - b * TPL.length ? 1 : 0))) }
  async function go(x: number[] | null) { setSaving(true); try { await onSave(x); onClose() } catch (e: any) { toast.error(e.message) } finally { setSaving(false) } }
  return (
    <Sheet open title="Bobot aktivitas" onClose={onClose} onSave={() => go(w)} saveDisabled={saving || total !== 100}>
      <div className="au-stack" aria-hidden="true">{TPL.map((k, i) => <i key={k} style={{ flex: Math.max(0.0001, w[i]), background: TPL_COLORS[i] }} />)}</div>
      <div className="au-ig">
        {TPL.map((k, i) => (
          <label key={k} className="au-igr"><span className="k">{k}</span>
            <span className="au-row" style={{ marginLeft: 'auto', gap: 4 }}><input className="input" type="number" inputMode="numeric" min={0} max={100} value={w[i]} onChange={e => setW(ws => ws.map((x, j) => (j === i ? Math.max(0, Math.min(100, Number(e.target.value) || 0)) : x)))} style={{ width: 84, textAlign: 'right' }} />%</span>
          </label>
        ))}
      </div>
      <div className="au-row au-between au-wrap">
        <b style={{ color: total === 100 ? 'var(--ok)' : 'var(--bad)' }}>Total {total}%{total === 100 ? '' : ' · harus 100%'}</b>
        <span className="au-row" style={{ gap: 6 }}>
          <button type="button" className="btn btn-sm" onClick={even}>Ratakan</button>
          <button type="button" className="btn btn-sm" disabled={saving} onClick={() => go(null)} title={`Template: ${tpl.join('/')}`}>Pakai template</button>
        </span>
      </div>
    </Sheet>
  )
}

/* ───────────── Sheet: isi jadwal otomatis ───────────── */
function ScheduleSheet({ v, onClose, onSave }: { v: View; onClose: () => void; onSave: (p: EnhPhase[]) => Promise<void> }) {
  const [start, setStart] = useState(v.acts.find(a => a.start)?.start || `${v.e.year}-01-01`)
  const [dur, setDur] = useState([3, 5, 1, 1, 1])
  const [saving, setSaving] = useState(false)
  const plan = useMemo(() => {
    if (!Number.isFinite(dUTC(start))) return []
    let s = start
    return TPL.map((k, i) => { const e = isoDay(dUTC(addMonths(s, dur[i])) - DAY); const r = { key: k, start: s, end: e }; s = isoDay(dUTC(e) + DAY); return r })
  }, [start, dur])
  async function save() {
    setSaving(true)
    try { await onSave(plan.map(p => ({ ...p, pct: p.key === 'BRD' ? 0 : v.acts.find(a => a.name === p.key)?.pct || 0 }))); onClose() } catch (e: any) { toast.error(e.message) } finally { setSaving(false) }
  }
  return (
    <Sheet open title="Isi jadwal otomatis" onClose={onClose} onSave={save} saveDisabled={saving || !plan.length}>
      <p className="au-small au-ink2">Aktivitas disusun berurutan dari tanggal mulai. Durasi dalam bulan; tanggal bisa diubah lagi per aktivitas.</p>
      <label className="au-col" style={{ gap: 6 }}><span className="lbl">Mulai BRD</span><input className="input" type="date" value={start} onChange={e => setStart(e.target.value)} /></label>
      <div className="au-ig">
        {TPL.map((k, i) => (
          <label key={k} className="au-igr"><span className="k" style={{ minWidth: 96 }}>{k}</span>
            <span className="au-xs au-muted" style={{ flex: 1 }}>{plan[i] ? `${fmtD(plan[i].start)} – ${fmtD(plan[i].end)}` : ''}</span>
            <span className="au-row" style={{ gap: 4 }}><input className="input" type="number" inputMode="numeric" min={1} max={24} value={dur[i]} onChange={e => setDur(d => d.map((x, j) => (j === i ? Math.max(1, Math.min(24, Number(e.target.value) || 1)) : x)))} style={{ width: 64, textAlign: 'right' }} />bln</span>
          </label>
        ))}
      </div>
    </Sheet>
  )
}

/* ───────────── Sheet: tambah / edit enhancement ───────────── */
type Draft = { app: string; type: string; initiator: string; year: number; title: string; notes: string; pic: string; items: (EnhItem & { open?: boolean })[] }
function EditSheet({ e, year, years, onClose, onSaved, onDeleted }: { e: Enh | null; year: number; years: number[]; onClose: () => void; onSaved: (id?: string) => void; onDeleted: () => void }) {
  const [d, setD] = useState<Draft>(() => ({
    app: e?.app || 'iVendor', type: e?.type || 'New', initiator: e?.initiator || '', year: e?.year || year, title: e?.title || '', notes: e?.notes || '',
    pic: (e?.pic || []).join(', '), items: (e?.items?.length ? e.items : [{ t: '', u: null, f: null, fl: null, pb: null }]).map((i: EnhItem) => ({ ...i })),
  }))
  const [tried, setTried] = useState(false), [saving, setSaving] = useState(false), [confirmDel, setConfirmDel] = useState(false)
  const s = score(d.items)
  const titleErr = d.title.trim().length < 3 ? 'Judul minimal 3 karakter' : ''
  const setI = (i: number, p: Partial<EnhItem & { open?: boolean }>) => setD(x => ({ ...x, items: x.items.map((it, k) => (k === i ? { ...it, ...p } : it)) }))
  const yearOpts = Array.from(new Set([...years, d.year, year + 1])).sort()
  async function save() {
    setTried(true)
    if (titleErr) { toast.error(titleErr); return }
    setSaving(true)
    try {
      const body = { app: d.app, type: d.type, initiator: d.initiator, year: d.year, title: d.title, notes: d.notes, pic: d.pic.split(',').map(x => x.trim()).filter(Boolean), items: d.items.map(({ open, ...it }) => it) }
      const out = await send(e ? `/api/enhancements/${e._id}` : '/api/enhancements', e ? 'PATCH' : 'POST', body)
      toast.success(e ? 'Enhancement diperbarui' : `Enhancement ${out?.data?.code || ''} dibuat`); onSaved(out?.data?._id); onClose()
    } catch (err: any) { toast.error(err.message) } finally { setSaving(false) }
  }
  async function del() {
    if (!e) return
    setSaving(true)
    try { await send(`/api/enhancements/${e._id}`, 'DELETE'); toast.success('Enhancement dihapus'); onDeleted(); onClose() } catch (err: any) { toast.error(err.message) } finally { setSaving(false) }
  }
  const sel = (v: number | null | undefined) => (v == null ? '' : String(v))
  return (
    <Sheet open wide title={e ? `Edit ${e.code || 'enhancement'}` : 'Enhancement baru'} onClose={onClose} onSave={save} saveDisabled={saving} saveLabel={saving ? 'Menyimpan…' : 'Simpan'}>
      <div className="au-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
        <label className="au-col" style={{ gap: 6 }}><span className="lbl">Aplikasi</span><select className="input" value={d.app} onChange={x => setD({ ...d, app: x.target.value })}>{Array.from(new Set([...ENH_APPS, d.app])).map(a => <option key={a}>{a}</option>)}</select></label>
        <label className="au-col" style={{ gap: 6 }}><span className="lbl">Jenis</span><select className="input" value={d.type} onChange={x => setD({ ...d, type: x.target.value })}>{ENH_TYPES.map(a => <option key={a}>{a}</option>)}</select></label>
        <label className="au-col" style={{ gap: 6 }}><span className="lbl">Initiator</span><select className="input" value={d.initiator} onChange={x => setD({ ...d, initiator: x.target.value })}><option value="">Belum diisi</option>{INITIATORS.map(a => <option key={a}>{a}</option>)}</select></label>
        <label className="au-col" style={{ gap: 6 }}><span className="lbl">Tahun</span><select className="input" value={d.year} onChange={x => setD({ ...d, year: Number(x.target.value) })}>{yearOpts.map(y => <option key={y} value={y}>{y}</option>)}</select></label>
      </div>
      <label className="au-col" style={{ gap: 6 }}><span className="lbl">Judul *</span>
        <input className="input" value={d.title} maxLength={300} placeholder="Mis. Integrasi e-Sign pada iVendor" aria-invalid={tried && !!titleErr} onChange={x => setD({ ...d, title: x.target.value })} />
        {tried && titleErr && <span role="alert" className="au-xs" style={{ color: 'var(--bad)', fontWeight: 600 }}>{titleErr}</span>}</label>
      <label className="au-col" style={{ gap: 6 }}><span className="lbl">PIC (pisahkan dengan koma)</span><input className="input" value={d.pic} onChange={x => setD({ ...d, pic: x.target.value })} placeholder="Nama PIC" /></label>

      <div className="au-row au-between" style={{ marginTop: 4 }}>
        <h3 style={{ font: '700 17px var(--disp)' }}>Item &amp; skor 0–5</h3>
        <button type="button" className="btn btn-sm" onClick={() => setD(x => ({ ...x, items: [...x.items, { t: '', u: null, f: null, fl: null, pb: null }] }))}><Icon name="plus" size={14} />Item</button>
      </div>
      {d.items.map((it, i) => (
        <div key={i} className="au-box" style={{ padding: 14, gap: 10 }}>
          <div className="au-row" style={{ gap: 8 }}>
            <span className="lbl" style={{ width: 18 }}>{i + 1}</span>
            <input className="input" aria-label={`Item ${i + 1}`} placeholder="Deskripsi item" value={it.t || ''} maxLength={2000} onChange={x => setI(i, { t: x.target.value })} />
            <button type="button" className="btn btn-icon btn-sm" aria-label={`Hapus item ${i + 1}`} onClick={() => setD(x => ({ ...x, items: x.items.filter((_, k) => k !== i) }))}><Icon name="trash" size={14} /></button>
          </div>
          <div className="au-grid" style={{ gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 8 }}>
            {SCORE_KEYS.map(([k, l]) => (
              <label key={k} className="au-col au-xs au-muted" style={{ gap: 4 }}>{l}
                <select className="input" value={sel(it[k] as number | null)} onChange={x => setI(i, { [k]: x.target.value === '' ? null : Number(x.target.value) })}>
                  <option value="">–</option>{[0, 1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                </select></label>
            ))}
          </div>
          <button type="button" className="au-link" style={{ alignSelf: 'flex-start', padding: 0 }} aria-expanded={!!it.open} onClick={() => setI(i, { open: !it.open })}>{it.open ? 'Sembunyikan narasi' : 'Narasi skor (opsional)'}</button>
          {it.open && <div className="au-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 8 }}>
            {([['du', 'Narasi user'], ['df', 'Narasi fulfiller'], ['dfl', 'Narasi flow'], ['dpb', 'Narasi proses bisnis']] as const).map(([k, l]) => (
              <label key={k} className="au-col au-xs au-muted" style={{ gap: 4 }}>{l}<textarea className="input" rows={2} value={(it[k] as string) || ''} maxLength={2000} onChange={x => setI(i, { [k]: x.target.value })} /></label>
            ))}
          </div>}
        </div>
      ))}
      <div className="au-box" style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 10, textAlign: 'center' }}>
        <div><span className="lbl">Impact</span><div style={{ font: '700 28px var(--disp)' }}>{n1(s.impact)}</div></div>
        <div><span className="lbl">Effort</span><div style={{ font: '700 28px var(--disp)' }}>{n1(s.effort)}</div></div>
        <div><span className="lbl">Kategori</span><div className={`au-cat ${catK(s.cat)}`} style={{ marginTop: 10, justifyContent: 'center' }}>{s.cat}</div></div>
      </div>
      <label className="au-col" style={{ gap: 6 }}><span className="lbl">Catatan</span><textarea className="input" rows={3} value={d.notes} maxLength={5000} onChange={x => setD({ ...d, notes: x.target.value })} /></label>
      {e && (confirmDel
        ? <div className="au-row au-wrap p-bad" style={{ borderRadius: 14, padding: 12, gap: 10 }}>
            <span className="au-small" style={{ flex: 1 }}>Hapus {e.code} “{e.title}”? Tidak bisa dibatalkan.</span>
            <button type="button" className="btn btn-sm" onClick={() => setConfirmDel(false)}>Batal</button>
            <button type="button" className="btn btn-danger btn-sm" disabled={saving} onClick={del}>Ya, hapus</button>
          </div>
        : <button type="button" className="btn btn-danger" style={{ alignSelf: 'flex-start' }} onClick={() => setConfirmDel(true)}><Icon name="trash" size={15} />Hapus enhancement</button>)}
    </Sheet>
  )
}

/* ───────────── Sheet: upload Excel (preview → simpan) ───────────── */
type Preview = { sheets: string[]; ignored: string[]; errors: string[]; year: number; groups: { key: string; app: string; code: string; title: string; n: number; cat: Cat; existingId: string | null; existingCode: string | null }[] }
function UploadSheet({ year, years, onClose, onDone }: { year: number; years: number[]; onClose: () => void; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [yr, setYr] = useState(year)
  const [pv, setPv] = useState<Preview | null>(null)
  const [dec, setDec] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<'' | 'read' | 'save'>('')
  const [err, setErr] = useState('')
  const yearOpts = Array.from(new Set([...years, year + 1, yr])).sort()

  async function read(f: File, y: number) {
    setErr(''); setPv(null); setBusy('read')
    try {
      if (!/\.xlsx$/i.test(f.name)) throw new Error('Pilih file .xlsx')
      if (f.size > 10 * 1024 * 1024) throw new Error('File lebih dari 10 MB')
      const fd = new FormData(); fd.append('file', f); fd.append('year', String(y)); fd.append('mode', 'preview')
      const out = await send('/api/enhancements/import', 'POST', fd)
      setPv(out.data); setDec(Object.fromEntries(out.data.groups.map((g: any) => [g.key, g.existingId ? 'perbarui' : 'tambah'])))
    } catch (e: any) { setErr(e.message) } finally { setBusy('') }
  }
  function pick(f: File | undefined) {
    if (!f) return
    setFile(f)
    const m = /(20\d\d)/.exec(f.name), y = m ? Number(m[1]) : yr
    setYr(y); read(f, y)
  }
  async function commit() {
    if (!file || !pv) return
    setBusy('save')
    try {
      const fd = new FormData(); fd.append('file', file); fd.append('year', String(yr)); fd.append('mode', 'commit'); fd.append('decisions', JSON.stringify(dec))
      const out = await send('/api/enhancements/import', 'POST', fd)
      const r = out.data
      toast.success(`${r.added} ditambah · ${r.updated} diperbarui${r.skipped ? ` · ${r.skipped} dilewati` : ''}`)
      onDone(); onClose()
    } catch (e: any) { toast.error(e.message) } finally { setBusy('') }
  }
  const toSave = pv ? pv.groups.filter(g => dec[g.key] !== 'lewati').length : 0
  return (
    <Sheet open wide title="Upload Excel" onClose={onClose}>
      <p className="au-small au-ink2">Format IT Requirement: hanya sheet <b>BPDP - …</b> yang dibaca, sheet SSP diabaikan. Data dicek dulu sebelum disimpan; tahap BRD, timeline, PIC dan catatan enhancement yang sudah ada tidak berubah.</p>
      <label className="au-drop">
        <Icon name="file" size={30} /><b>{file ? file.name : 'Pilih file .xlsx'}</b><span className="au-xs au-muted">{busy === 'read' ? 'Membaca file…' : 'Maks. 10 MB'}</span>
        <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" aria-label="Pilih file Excel" onChange={x => pick(x.target.files?.[0])} />
      </label>
      <label className="au-row au-small" style={{ gap: 8 }}>Tahun enhancement
        <select className="input" style={{ width: 'auto' }} value={yr} onChange={x => { const y = Number(x.target.value); setYr(y); if (file) read(file, y) }}>{yearOpts.map(y => <option key={y} value={y}>{y}</option>)}</select>
      </label>
      {err && <div role="alert" className="p-bad" style={{ borderRadius: 12, padding: 12, fontSize: 13.5 }}>{err}</div>}
      {pv && <>
        <div className="au-row au-wrap" style={{ gap: 8 }}>
          <Pill tone="ok">{pv.groups.length} enhancement terbaca</Pill>
          <Pill tone="none">{pv.sheets.length} sheet BPDP</Pill>
          {pv.groups.some(g => g.existingId) && <Pill tone="accent">{pv.groups.filter(g => g.existingId).length} sudah ada</Pill>}
          {pv.errors.length > 0 && <Pill tone="bad">{pv.errors.length} baris dilewati</Pill>}
        </div>
        {pv.errors.length > 0 && <details className="au-small"><summary style={{ cursor: 'pointer', color: 'var(--bad)', fontWeight: 600 }}>Lihat baris yang dilewati</summary><ul style={{ paddingLeft: 18, marginTop: 6 }}>{pv.errors.map(x => <li key={x}>{x}</li>)}</ul></details>}
        {pv.ignored.length > 0 && <span className="au-xs au-muted">Diabaikan: {pv.ignored.join(', ')}</span>}
        <div className="au-tblw" style={{ maxHeight: '42dvh', overflow: 'auto' }}>
          <table className="au-tbl">
            <thead><tr><th>Kode</th><th>Enhancement</th><th>Item</th><th>Kategori</th><th>Aksi</th></tr></thead>
            <tbody>{pv.groups.map(g => (
              <tr key={g.key}>
                <td style={{ whiteSpace: 'nowrap', fontFamily: 'var(--mono)', fontSize: 12 }}>{g.code}</td>
                <td>{g.title}<div className="au-xs au-muted">{g.app}{g.existingCode && g.existingCode !== g.code ? ` · sekarang ${g.existingCode}` : ''}</div></td>
                <td className="n">{g.n}</td>
                <td><span className={`au-cat ${catK(g.cat)}`}>{g.cat}</span></td>
                <td><select className="input input-sm" style={{ width: 'auto' }} aria-label={`Aksi ${g.title}`} value={dec[g.key]} onChange={x => setDec(o => ({ ...o, [g.key]: x.target.value }))}>
                  {g.existingId ? <option value="perbarui">Perbarui</option> : <option value="tambah">Tambah</option>}<option value="lewati">Lewati</option>
                </select></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <button type="button" className="btn btn-primary" style={{ width: '100%', minHeight: 46 }} disabled={!!busy || !toSave} onClick={commit}>{busy === 'save' ? 'Menyimpan…' : `Simpan ${toSave} enhancement ke ${yr}`}</button>
      </>}
    </Sheet>
  )
}

/* ───────────── Matriks impact vs effort ───────────── */
function Matrix({ list, onOpen, small }: { list: View[]; onOpen: (id: string) => void; small?: boolean }) {
  // Posisi 8–92% agar label tidak terpotong; skor yang sama disusun bertingkat supaya tidak saling menutupi.
  const seen = new Map<string, number>()
  const placed = list.filter(v => CAT_ORD[v.s.cat]).map(v => {
    const key = `${v.s.impact.toFixed(2)}|${v.s.effort.toFixed(2)}`, k = seen.get(key) || 0
    seen.set(key, k + 1)
    return { v, x: 8 + (Math.min(v.s.effort, 5) / 5) * 84, y: Math.min(94, 6 + (Math.min(v.s.impact, 5) / 5) * 84 + k * 7) }
  })
  return (
    <div className="au-col" style={{ gap: 8 }}>
      <div className="au-matrix" role="group" aria-label="Matriks impact dan effort" style={small ? { height: 220 } : undefined}>
        <div className="qd k-qw" style={{ left: 0, top: 0, background: 'color-mix(in srgb,var(--qw) 12%,transparent)' }}>QUICK WIN</div>
        <div className="qd k-st" style={{ right: 0, top: 0, textAlign: 'right', background: 'color-mix(in srgb,var(--st) 10%,transparent)' }}>STRATEGIS</div>
        <div className="qd k-mi" style={{ left: 0, bottom: 0, display: 'flex', alignItems: 'flex-end' }}>MINOR</div>
        <div className="qd k-tc" style={{ right: 0, bottom: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', background: 'color-mix(in srgb,var(--tc) 9%,transparent)' }}>TO BE CONSIDER</div>
        {placed.map(({ v, x, y }) => (
          <button key={v.e._id} type="button" className={`dot ${catK(v.s.cat)}`} style={{ left: `${x}%`, bottom: `${y}%` }}
            title={`${v.e.code} · ${v.e.title}`} aria-label={`${v.e.code} ${v.e.title}: impact ${n1(v.s.impact)}, effort ${n1(v.s.effort)}`} onClick={() => onOpen(v.e._id)}>{String(v.e.code || '').replace(/^B-/, '')}</button>
        ))}
      </div>
      <div className="au-row au-between au-xs au-muted"><span>← Effort rendah</span><span>Impact naik ke atas · ambang 2,5</span><span>Effort tinggi →</span></div>
    </div>
  )
}

/* ───────────── Halaman ───────────── */
export default function EnhancementPage() {
  const { data: session } = useSession()
  const internal = isInternalUser(userRolesOf(session?.user))
  const { year, years } = useYear()
  const today = useMemo(() => todayUTC(), [])
  const [all, setAll] = useState<Enh[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [tpl, setTpl] = useState<number[]>(normWeights(null))
  const [mode, setMode] = useState<Mode>('list')
  const [q, setQ] = useState(''), [app, setApp] = useState('Semua'), [cat, setCat] = useState('Semua')
  const [selId, setSelId] = useState<string | null>(null)
  const [sheet, setSheet] = useState<null | { k: 'edit'; e: Enh | null } | { k: 'upload' } | { k: 'phase'; idx: number } | { k: 'weights' } | { k: 'schedule' }>(null)
  const exportRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    setFailed(false)
    try { const d = await send('/api/enhancements?year=all', 'GET'); setAll(Array.isArray(d.data) ? d.data : []) } catch { setFailed(true); setAll(a => a ?? []) }
  }, [])
  useEffect(() => { load(); getConfig().then(c => setTpl(normWeights(c?.enhancementTemplate))).catch(() => {}) }, [load])
  useEffect(() => { try { const id = new URLSearchParams(location.search).get('e'); if (id) setSelId(id) } catch {} }, [])
  const select = (id: string | null) => {
    setSelId(id)
    try { const u = new URL(location.href); id ? u.searchParams.set('e', id) : u.searchParams.delete('e'); history.replaceState(history.state, '', u) } catch {}
    if (id) requestAnimationFrame(() => document.querySelector('.au-page')?.scrollTo({ top: 0, behavior: 'smooth' }))
  }

  const views = useMemo(() => {
    const list = all || []
    const pr = rankPrio(list.map(e => ({ _id: String(e._id), app: `${e.app}|${e.year}`, items: e.items || [] })))
    return list.map(e => { const acts = enhActs(e, tpl); return { e, s: score(e.items), acts, c: calc(acts, today), prio: pr.get(String(e._id)) } as View })
  }, [all, tpl, today])
  const yr = views.filter(v => v.e.year === year || inYear(v.acts, year))
  const ql = q.trim().toLowerCase()
  const list = yr
    .filter(v => (app === 'Semua' || v.e.app === app) && (cat === 'Semua' || v.s.cat === cat) && (!ql || `${v.e.code} ${v.e.title}`.toLowerCase().includes(ql)))
    .sort((a, b) => a.e.app.localeCompare(b.e.app) || (CAT_ORD[a.s.cat] || 9) - (CAT_ORD[b.s.cat] || 9) || b.s.impact - a.s.impact || a.s.effort - b.s.effort || String(a.e.code).localeCompare(String(b.e.code)))
  const apps = ['Semua', ...Array.from(new Set(yr.map(v => v.e.app))).sort()]
  const sel = views.find(v => String(v.e._id) === selId) || null
  const avg = yr.length ? yr.reduce((a, v) => a + v.c.actual, 0) / yr.length : 0

  async function patch(id: string, body: Record<string, unknown>, msg?: string) {
    const out = await send(`/api/enhancements/${id}`, 'PATCH', body)
    setAll(a => (a || []).map(x => (String(x._id) === id ? out.data : x)))
    if (msg) toast.success(msg)
  }
  async function setStage(v: View, stage: number) {
    try { await patch(v.e._id, { stage }, `Tahap BRD: ${STAGES[stage - 1]}`) } catch (e: any) { toast.error(e.message) }
  }
  async function savePhase(v: View, p: EnhPhase) {
    const phases = TPL.map(k => (k === p.key ? p : (v.e.phases || []).find((x: EnhPhase) => x.key === k))).filter(Boolean)
    await patch(v.e._id, { phases }, `${p.key} diperbarui`)
  }

  const head = (
    <PageHeader eyebrow={`IT Requirement BPDP · ${year}`} title="Enhancement" actions={<>
      <Seg label="Tampilan" value={mode} onChange={m => setMode(m)} options={[['list', <><Icon name="list" size={15} />Daftar</>], ['matrix', <><Icon name="grid" size={15} />Matriks</>], ['road', <><Icon name="road" size={15} />Roadmap</>]] as const} />
      <ExportMenu getNodes={() => exportRef.current ? Array.from(exportRef.current.querySelectorAll<HTMLElement>('[data-export-card]')) : []} filename={`enhancement-${year}`} title="Enhancement — WINS" />
      {internal && <button type="button" className="btn btn-ghost" onClick={() => setSheet({ k: 'upload' })}><Icon name="up" size={16} stroke={2.2} />Upload Excel</button>}
      {internal && <button type="button" className="btn btn-primary" onClick={() => setSheet({ k: 'edit', e: null })}><Icon name="plus" size={16} stroke={2.2} />Tambah</button>}
    </>} />
  )
  const filters = (
    <div className="au-col" style={{ gap: 10 }}>
      <label className="input au-row" style={{ gap: 8, padding: '0 12px' }}><Icon name="search" size={16} />
        <input value={q} onChange={x => setQ(x.target.value)} placeholder="Cari kode atau judul" aria-label="Cari enhancement" style={{ border: 0, background: 'transparent', flex: 1, minHeight: 40, outline: 0, color: 'var(--ink)' }} /></label>
      <div className="au-chips wrap" role="group" aria-label="Filter aplikasi">{apps.map(a => <button key={a} type="button" className="au-chip" aria-pressed={app === a} onClick={() => setApp(a)}>{a} <span style={{ opacity: .65 }}>{a === 'Semua' ? yr.length : yr.filter(v => v.e.app === a).length}</span></button>)}</div>
      <div className="au-chips wrap" role="group" aria-label="Filter kategori">{['Semua', ...CATS].map(c => <button key={c} type="button" className="au-chip" aria-pressed={cat === c} onClick={() => setCat(c)}>{c === 'Semua' ? 'Semua kategori' : c}</button>)}</div>
    </div>
  )

  let body: React.ReactNode
  if (all === null) body = <div className="au-col" style={{ gap: 10 }}>{[0, 1, 2].map(k => <div key={k} className="au-card"><div className="au-skel" style={{ width: '50%' }} /><div className="au-skel" style={{ width: '80%' }} /></div>)}</div>
  else if (!yr.length) body = <div className="au-card"><Empty title={`Belum ada enhancement di ${year}`} text="Upload file IT Requirement atau tambah satu per satu. Pilih tahun lain di atas untuk melihat data lain." action={internal ? <div className="au-row"><button type="button" className="btn" onClick={() => setSheet({ k: 'upload' })}>Upload Excel</button><button type="button" className="btn btn-primary" onClick={() => setSheet({ k: 'edit', e: null })}>Tambah</button></div> : undefined} /></div>
  else if (mode === 'matrix') body = (
    <div className="au-grid au-mgrid">
      <section className="au-card rise" data-export-card=""><div className="au-row au-between au-wrap"><h2>Impact vs Effort</h2><span className="au-xs au-muted">{list.length} enhancement · ketuk titik</span></div><Matrix list={list} onOpen={id => { setMode('list'); select(id) }} /></section>
      <section className="au-card rise" style={{ ['--d' as any]: 1 }}>{filters}</section>
    </div>
  )
  else if (mode === 'road') {
    const rows = list.slice(0, 30)
    const ra: Act[] = rows.map(v => { const st = v.acts.map(a => dUTC(a.start)).filter(Number.isFinite), en = v.acts.map(a => dUTC(a.end)).filter(Number.isFinite); return { name: `${v.e.code} · ${v.e.title}`, start: st.length ? isoDay(Math.min(...st)) : '', end: en.length ? isoDay(Math.max(...en)) : '', w: 1, pct: v.c.actual } })
    body = (
      <section className="au-card rise" data-export-card="">
        <div className="au-row au-between au-wrap"><h2>Roadmap {app === 'Semua' ? 'semua aplikasi' : app}</h2><div className="au-chips">{apps.map(a => <button key={a} type="button" className="au-chip" aria-pressed={app === a} onClick={() => setApp(a)}>{a}</button>)}</div></div>
        {ra.some(a => a.start) ? <Gantt acts={ra} today={today} labels={rows.map((v, i) => `${v.e.app} · ${STAGES_SHORT[(v.e.stage || 1) - 1]} · ${ra[i].start ? P(v.c.actual) : 'belum dijadwal'}`)} onSelect={i => { setMode('list'); select(rows[i].e._id) }} />
          : <Empty title="Belum ada jadwal" text="Isi timeline di detail enhancement (atau pakai Isi jadwal otomatis) agar tampil di roadmap." />}
        {list.length > rows.length && <span className="au-xs au-muted">{rows.length} dari {list.length} ditampilkan. Persempit dengan filter.</span>}
      </section>
    )
  } else body = (
    <div className={`au-split${sel ? ' has' : ''}`}>
      <div className="au-lp au-lpane au-card" style={{ padding: 14, gap: 12 }}>
        {filters}
        <div className="au-col" style={{ gap: 4 }}>
          {list.map(v => (
            <button type="button" key={v.e._id} className="au-erow" aria-current={sel?.e._id === v.e._id} onClick={() => select(v.e._id)}>
              <span className="au-row au-between au-xs" style={{ width: '100%' }}><span style={{ fontFamily: 'var(--mono)' }} className="au-muted">{v.e.code} · {v.e.app}{v.prio ? ` · P${v.prio}` : ''}</span><span className={`au-cat ${catK(v.s.cat)}`}>{v.s.cat}</span></span>
              <b>{v.e.title}</b>
              <span className="au-dots" aria-label={`Tahap ${v.e.stage || 1} dari 7`}>{STAGES.map((_, k) => <i key={k} className={k < (v.e.stage || 1) ? 'on' : ''} />)}</span>
              <span className="au-row au-xs au-ink2" style={{ width: '100%' }}><span className="au-mini"><i style={{ width: `${v.c.actual}%` }} /></span><b>{P(v.c.actual)}</b><span>{STAGES_SHORT[(v.e.stage || 1) - 1]}</span></span>
            </button>
          ))}
          {!list.length && <span className="au-small au-muted" style={{ padding: 14 }}>Tidak ada yang cocok dengan filter.</span>}
        </div>
      </div>
      <div className="au-dp au-col" style={{ gap: 16, minWidth: 0 }}>
        {sel ? <Detail v={sel} today={today} internal={internal} onBack={() => select(null)} onEdit={() => setSheet({ k: 'edit', e: sel.e })} onStage={s => setStage(sel, s)} onPhase={i => setSheet({ k: 'phase', idx: i })} onWeights={() => setSheet({ k: 'weights' })} onSchedule={() => setSheet({ k: 'schedule' })} />
          : <div className="au-card"><Empty title="Pilih enhancement" text="Detail, tahap BRD, timeline dan skor tampil di sini. Coba juga tampilan Matriks dan Roadmap." /></div>}
      </div>
    </div>
  )

  return (
    <div className="au-page">
      {sheet?.k === 'edit' && <EditSheet e={sheet.e} year={year} years={years} onClose={() => setSheet(null)} onSaved={id => { load(); if (id) { setMode('list'); select(id) } }} onDeleted={() => { select(null); load() }} />}
      {sheet?.k === 'upload' && <UploadSheet year={year} years={years} onClose={() => setSheet(null)} onDone={load} />}
      {sheet?.k === 'phase' && sel && <PhaseSheet v={sel} idx={sheet.idx} today={today} onClose={() => setSheet(null)} onSave={p => savePhase(sel, p)} />}
      {sheet?.k === 'weights' && sel && <WeightSheet v={sel} tpl={tpl} onClose={() => setSheet(null)} onSave={w => patch(sel.e._id, { weights: w }, w ? 'Bobot disimpan' : 'Kembali ke bobot template')} />}
      {sheet?.k === 'schedule' && sel && <ScheduleSheet v={sel} onClose={() => setSheet(null)} onSave={ph => patch(sel.e._id, { phases: ph }, 'Jadwal dibuat')} />}

      <div className="au-view au-anim" ref={exportRef}>
        {head}
        {!sel && yr.length > 0 && mode === 'list' && (
          <div className="au-grid g4 au-tiles" data-export-card="">
            <Tile icon="enh" color="var(--accent)" value={yr.length} label="Enhancement" hint={String(year)} />
            <Tile icon="bolt" color="var(--qw)" value={yr.filter(v => v.s.cat === 'Quick Win').length} label="Quick Win" active={cat === 'Quick Win'} onClick={() => setCat(cat === 'Quick Win' ? 'Semua' : 'Quick Win')} />
            <Tile icon="prog" color="#7B6BFF" value={`${Math.round(avg)}%`} label="Rata-rata progress" />
            <Tile icon="rocket" color="var(--hot)" value={yr.filter(v => (v.e.stage || 1) >= 7).length} label="Sudah Development" />
          </div>
        )}
        {failed && <div className="au-row au-wrap p-bad" role="alert" style={{ borderRadius: 14, padding: 12 }}><span className="au-small" style={{ flex: 1 }}>Data enhancement gagal dimuat.</span><button type="button" className="btn btn-sm" onClick={load}>Coba lagi</button></div>}
        {body}
      </div>
    </div>
  )
}

function Detail({ v, today, internal, onBack, onEdit, onStage, onPhase, onWeights, onSchedule }: { v: View; today: number; internal: boolean; onBack: () => void; onEdit: () => void; onStage: (s: number) => void; onPhase: (i: number) => void; onWeights: () => void; onSchedule: () => void }) {
  const { e, s, acts, c } = v
  const stage = e.stage || 1
  const st = statusOf(c.spi)
  const noDates = !acts.some(a => a.start)
  return (
    <>
      <button type="button" className="au-link au-row" style={{ alignSelf: 'flex-start', gap: 4 }} onClick={onBack}><Icon name="back" size={14} />Semua enhancement</button>
      <section className="au-hero ini rise" data-export-card="">
        <span className="au-sticker" aria-hidden="true">{e.code}</span>
        <div className="au-col" style={{ gap: 12, minWidth: 0 }}>
          <span className="lbl">{[e.app, e.type, e.initiator].filter(Boolean).join(' · ')} · {e.year}</span>
          <h1 style={{ fontSize: 'clamp(22px,2.6vw,34px)', overflowWrap: 'anywhere', paddingRight: 60 }}>{e.title}</h1>
          <div className="au-row au-wrap" style={{ gap: 8 }}>
            <span className={`au-pill p-none ${catK(s.cat)}`}><span className={`au-cat ${catK(s.cat)}`}>{s.cat}</span>{v.prio ? ` · prioritas ${v.prio}` : ''}</span>
            <Pill tone={st.key}>{st.label}</Pill>
          </div>
          <div className="au-hchips">
            <div className="au-hchip"><b>{n1(s.impact)}</b><span>Impact</span></div>
            <div className="au-hchip"><b>{n1(s.effort)}</b><span>Effort</span></div>
            <div className="au-hchip"><b>{s.n}</b><span>Item</span></div>
          </div>
          {internal && <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={onEdit}><Icon name="pnote" size={14} />Edit data & skor</button>}
        </div>
        <Ring value={c.actual} plan={c.spi == null ? null : c.plan} size={170} stroke={16} label={`Progress gabungan ${P(c.actual)}`}><b style={{ fontSize: 36 }}>{P(c.actual)}</b><span>gabungan</span></Ring>
      </section>

      <section className="au-card rise" style={{ ['--d' as any]: 1 }} data-export-card="">
        <div className="au-row au-between au-wrap"><h2>Tahap BRD</h2><span className="au-xs au-muted" style={{ fontFamily: 'var(--mono)' }}>{stage}/7 · BRD {P(brdPct(stage))} · bobot {n1(acts[0].w)}%</span></div>
        <ol className="au-stepper">{STAGES_SHORT.map((x, i) => <li key={x} className={`${i < stage ? 'done' : ''} ${i === stage - 1 ? 'cur' : ''}`} aria-current={i === stage - 1 ? 'step' : undefined}>{x}</li>)}</ol>
        {internal && <div className="au-row au-wrap">
          <button type="button" className="btn btn-sm" disabled={stage <= 1} onClick={() => onStage(stage - 1)}>Mundur</button>
          <button type="button" className="btn btn-primary btn-sm" disabled={stage >= 7} onClick={() => onStage(stage + 1)}>{stage < 7 ? `Naikkan ke ${STAGES_SHORT[stage]}` : 'BRD selesai'}{stage < 7 && <Icon name="arrow" size={14} stroke={2.2} />}</button>
        </div>}
      </section>

      <section className="au-card rise" style={{ ['--d' as any]: 2 }} data-export-card="">
        <div className="au-row au-between au-wrap"><h2>Timeline</h2>
          {internal && <span className="au-row" style={{ gap: 6 }}>
            <button type="button" className="btn btn-sm" onClick={onSchedule}>{noDates ? 'Isi jadwal otomatis' : 'Susun ulang jadwal'}</button>
            <button type="button" className="btn btn-sm" onClick={onWeights}>Atur bobot</button>
          </span>}
        </div>
        <div className="au-stack" aria-label="Bobot aktivitas">{acts.map((a, i) => <i key={a.name} style={{ flex: Math.max(0.0001, a.w), background: TPL_COLORS[i] }} title={`${a.name} ${n1(a.w)}%`} />)}</div>
        <div className="au-key">{acts.map((a, i) => <span key={a.name}><i style={{ background: TPL_COLORS[i] }} />{a.name} {n1(a.w)}%</span>)}{!(e.weights && e.weights.length) && <span className="au-muted">· template</span>}</div>
        {noDates ? <p className="au-small au-muted">Belum ada tanggal. {internal ? 'Pakai “Isi jadwal otomatis” atau ketuk aktivitas di bawah.' : ''}</p> : <Gantt acts={acts} today={today} onSelect={internal ? onPhase : undefined} />}
        {noDates && internal && <div className="au-ig">{acts.map((a, i) => <button key={a.name} type="button" className="au-igr" onClick={() => onPhase(i)}><span className="k">{a.name}</span><span className="v au-muted">Atur tanggal</span></button>)}</div>}
      </section>

      <section className="au-card rise" style={{ ['--d' as any]: 3 }} data-export-card="">
        <h2>Item &amp; penilaian</h2>
        {e.items?.length ? <div className="au-tblw" style={{ border: 0 }}>
          <table className="au-tbl">
            <thead><tr><th>Item</th><th>User</th><th>Fulfiller</th><th>Flow</th><th>Proses</th></tr></thead>
            <tbody>{e.items.map((it: EnhItem, i: number) => (
              <tr key={i}>
                <td style={{ minWidth: 220 }}>{it.t}{[it.du, it.df, it.dfl, it.dpb].some(Boolean) && <details className="au-xs au-muted" style={{ marginTop: 4 }}><summary style={{ cursor: 'pointer' }}>Narasi</summary>
                  <ul style={{ paddingLeft: 16, marginTop: 4 }}>{SCORE_KEYS.map(([k, l], j) => { const d = [it.du, it.df, it.dfl, it.dpb][j]; return d ? <li key={k}><b>{l}:</b> {d}</li> : null })}</ul></details>}</td>
                {SCORE_KEYS.map(([k]) => { const x = it[k] as number | null | undefined; return <td key={k} className="n"><span className={`au-sc s${x ?? 'x'}`}>{x ?? '–'}</span></td> })}
              </tr>
            ))}</tbody>
          </table>
        </div> : <p className="au-small au-muted">Belum ada item.</p>}
        <span className="au-xs au-muted">Impact = rata-rata skor User &amp; Fulfiller. Effort = rata-rata (Flow + Proses bisnis) ÷ 2{s.n > 10 ? ', +1 karena item lebih dari 10' : ''}. Ambang tinggi 2,5.</span>
      </section>

      {(e.notes || e.pic?.length || e.source?.file) && <section className="au-card rise" style={{ ['--d' as any]: 4 }}>
        <h2>Info</h2>
        {e.pic?.length > 0 && <span className="au-small"><b>PIC:</b> {e.pic.join(', ')}</span>}
        {e.notes && <p className="au-small au-ink2" style={{ whiteSpace: 'pre-wrap' }}>{e.notes}</p>}
        {e.source?.file && <span className="au-xs au-muted">Diimpor dari {e.source.file} · {e.source.sheet} baris {e.source.row}</span>}
      </section>}
    </>
  )
}
