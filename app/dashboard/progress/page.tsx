'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import RichTextarea from '@/components/RichTextarea'
import ExportMenu from '@/components/ExportMenu'
import { Gantt } from '@/components/Gantt'
import { SCurve } from '@/components/SCurve'
import { Empty, Icon, PageHeader, Pill, Ring, Sheet, Tile } from '@/components/ui'
import { picArray } from '@/lib/defaults'
import { userRolesOf } from '@/lib/perms'
import { isInternalUser } from '@/lib/nav'
import { useYear } from '@/lib/year'
import { DAY, actsFromPhases, calc, dUTC, ptd, statusOf, todayUTC, type Act, type StatusKey } from '@/lib/progress'
import { phasesForSave, showInYear, type Draft } from '@/lib/initiativeView'

const APPS = ['iVendor', 'iPRO', 'PAL', 'KIMs', 'Others']
const URGENCY = ['SI', 'Non SI', 'Others']
const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const n1 = (v: number) => (Math.round(v * 10) / 10).toLocaleString('id-ID')
const P = (v: number) => `${Math.round(v)}%`
const fmtD = (s: string) => { const t = dUTC(s); if (!Number.isFinite(t)) return '–'; const d = new Date(t); return `${d.getUTCDate()} ${BLN[d.getUTCMonth()]} ${d.getUTCFullYear()}` }

type Ini = Record<string, any>
type View = { ini: Ini; acts: Act[]; c: ReturnType<typeof calc>; st: ReturnType<typeof statusOf>; cur: Act | undefined }

const baseYear = (i: Ini, fallback: number) => (Number.isFinite(Number(i?.year)) ? Number(i.year) : fallback)
const toDrafts = (i: Ini, fallback: number): Draft[] =>
  actsFromPhases(i?.phases || [], baseYear(i, fallback)).map((a, k) => ({ key: k, name: a.name, start: a.start, end: a.end, w: a.w, pct: a.pct, notes: a.notes || '' }))
const draftActs = (d: Draft[]): Act[] => d.map(x => ({ name: x.name || 'Aktivitas', start: x.start, end: x.end, w: x.w, pct: x.pct }))

function viewOf(ini: Ini, year: number, today: number): View {
  const acts = actsFromPhases(ini.phases || [], baseYear(ini, year))
  const c = calc(acts, today)
  const cur = acts.find(a => dUTC(a.start) <= today && dUTC(a.end) + DAY > today) || acts.find(a => a.pct < 100) || acts[acts.length - 1]
  return { ini, acts, c, st: statusOf(c.spi), cur }
}

function draftErrors(d: Draft): string | null {
  if (!d.name.trim()) return 'Nama aktivitas wajib diisi'
  if (!d.start && !d.end) return null
  if (!d.start || !d.end) return 'Isi tanggal mulai dan selesai'
  const s = dUTC(d.start), e = dUTC(d.end)
  if (!Number.isFinite(s) || !Number.isFinite(e)) return 'Tanggal tidak valid'
  if (e < s) return 'Tanggal selesai sebelum tanggal mulai'
  return null
}

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error || 'Gagal menyimpan, coba lagi')
  return data
}

function bodyFor(meta: Ini, original: any[], drafts: Draft[], today: number) {
  const phases = phasesForSave(original, drafts)
  const c = calc(draftActs(drafts), today)
  return { ...meta, phases, planProgress: c.plan, actualProgress: c.actual, spi: c.spi }
}

/* ───────────── Update cepat satu aktivitas (ketuk bar Gantt) ───────────── */
function QuickSheet({ ini, idx, year, today, onClose, onSaved }: { ini: Ini; idx: number; year: number; today: number; onClose: () => void; onSaved: () => void }) {
  const drafts = useMemo(() => toDrafts(ini, year), [ini, year])
  const a = drafts[idx]
  const [pct, setPct] = useState(Math.round(a?.pct ?? 0))
  const [notes, setNotes] = useState(a?.notes ?? '')
  const [saving, setSaving] = useState(false)
  if (!a) return null
  const due = ptd(a, today)
  async function save() {
    setSaving(true)
    try {
      const next = drafts.map((d, i) => (i === idx ? { ...d, pct, notes } : d))
      await send(`/api/initiatives/${ini._id}`, 'PATCH', bodyFor({}, ini.phases || [], next, today))
      toast.success('Progress diperbarui'); onSaved(); onClose()
    } catch (e: any) { toast.error(e.message) } finally { setSaving(false) }
  }
  return (
    <Sheet open title={a.name} onClose={onClose} onSave={save} saveDisabled={saving} saveLabel={saving ? 'Menyimpan…' : 'Simpan'}>
      <p className="au-small au-muted">{a.start ? `${fmtD(a.start)} – ${fmtD(a.end)}` : 'Belum ada jadwal'}{a.w > 0 ? ` · bobot ${n1(a.w)}%` : ''}</p>
      <div className="au-row au-between" style={{ alignItems: 'flex-end' }}>
        <div className="au-col"><span className="lbl">Selesai</span><b className="au-bigpct" aria-live="polite">{pct}%</b></div>
        <div className="au-col" style={{ alignItems: 'flex-end' }}><span className="lbl">Seharusnya hari ini</span><b style={{ font: '700 22px var(--disp)' }}>{P(due)}</b></div>
      </div>
      <input type="range" min={0} max={100} step={5} value={pct} onChange={e => setPct(Number(e.target.value))} aria-label="Persen selesai" style={{ width: '100%', accentColor: 'var(--accent)' }} />
      <div className="au-quick" role="group" aria-label="Pilih cepat">
        {[0, 25, 50, 75, 100].map(v => <button key={v} type="button" aria-pressed={pct === v} onClick={() => setPct(v)}>{v}%</button>)}
      </div>
      <div><label className="lbl" style={{ display: 'block', marginBottom: 6 }}>Catatan</label><RichTextarea rows={3} value={notes} onChange={setNotes} placeholder="Update singkat aktivitas ini" /></div>
    </Sheet>
  )
}

/* ───────────── Editor initiative (data + aktivitas) ───────────── */
function Editor({ ini, year, today, members, onClose, onSaved, onDeleted }: { ini: Ini | null; year: number; today: number; members: any[]; onClose: () => void; onSaved: (id?: string) => void; onDeleted: () => void }) {
  const [meta, setMeta] = useState({
    app: ini?.app || '', urgency: ini?.urgency || '', title: ini?.title || '', code: ini?.code || '',
    pic: picArray(ini?.pic), hiddenGuest: !!ini?.hiddenGuest, progressNotes: ini?.progressNotes || '',
  })
  const [drafts, setDrafts] = useState<Draft[]>(() => ini ? toDrafts(ini, year) : [
    { key: -1, name: 'Analysis & Design', start: `${year}-01-01`, end: `${year}-03-31`, w: 0, pct: 0, notes: '' },
  ])
  const [picInput, setPicInput] = useState('')
  const [tried, setTried] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const nextKey = useRef(-2)

  const acts = draftActs(drafts)
  const c = calc(acts, today), st = statusOf(c.spi)
  const errs = drafts.map(draftErrors)
  const metaErr = !meta.app ? 'Pilih app' : !meta.title.trim() ? 'Judul wajib diisi' : null
  const invalid = !!metaErr || errs.some(Boolean) || drafts.length === 0
  const given = drafts.filter(d => +d.w > 0), totalW = given.reduce((s, d) => s + +d.w, 0)

  const setD = (i: number, p: Partial<Draft>) => setDrafts(ds => ds.map((d, k) => (k === i ? { ...d, ...p } : d)))
  const addAct = () => setDrafts(ds => {
    const last = ds[ds.length - 1], e = last ? dUTC(last.end) : NaN
    const start = Number.isFinite(e) ? new Date(e + DAY).toISOString().slice(0, 10) : ''
    return [...ds, { key: nextKey.current--, name: `Aktivitas ${ds.length + 1}`, start, end: '', w: 0, pct: 0, notes: '' }]
  })
  const move = (i: number, dir: -1 | 1) => setDrafts(ds => { const j = i + dir; if (j < 0 || j >= ds.length) return ds; const n = [...ds]; [n[i], n[j]] = [n[j], n[i]]; return n })
  const even = () => setDrafts(ds => ds.map(d => ({ ...d, w: Math.round((100 / ds.length) * 100) / 100 })))
  const addPic = (name: string) => { const v = name.trim(); if (v && !meta.pic.includes(v)) setMeta(m => ({ ...m, pic: [...m.pic, v] })); setPicInput('') }
  const sugg = picInput ? members.filter(m => (m.name || '').toLowerCase().includes(picInput.toLowerCase()) && !meta.pic.includes(m.name)).slice(0, 5) : []

  async function save() {
    setTried(true)
    if (invalid) { toast.error(metaErr || errs.find(Boolean) || 'Tambahkan minimal satu aktivitas'); return }
    setSaving(true)
    try {
      const starts = drafts.map(d => dUTC(d.start)).filter(Number.isFinite)
      const yr = ini ? baseYear(ini, year) : (starts.length ? new Date(Math.min(...starts)).getUTCFullYear() : year)
      const body = bodyFor({ ...meta, title: meta.title.trim(), year: yr }, ini?.phases || [], drafts, today)
      const out = await send(ini ? `/api/initiatives/${ini._id}` : '/api/initiatives', ini ? 'PATCH' : 'POST', body)
      toast.success(ini ? 'Initiative diperbarui' : 'Initiative dibuat'); onSaved(out?.data?._id); onClose()
    } catch (e: any) { toast.error(e.message) } finally { setSaving(false) }
  }
  async function del() {
    if (!ini) return
    setSaving(true)
    try { await send(`/api/initiatives/${ini._id}`, 'DELETE'); toast.success('Initiative dihapus'); onDeleted(); onClose() }
    catch (e: any) { toast.error(e.message) } finally { setSaving(false) }
  }

  return (
    <Sheet open wide title={ini ? 'Edit initiative' : 'Initiative baru'} onClose={onClose} onSave={save} saveDisabled={saving} saveLabel={saving ? 'Menyimpan…' : 'Simpan'}>
      <div className="au-box" style={{ padding: 14, gap: 16, flexDirection: 'row', alignItems: 'center' }}>
        <Ring value={c.actual} plan={c.spi == null ? null : c.plan} size={76} stroke={9} label={`Realisasi ${P(c.actual)}, rencana ${P(c.plan)}`}><b style={{ fontSize: 17 }}>{P(c.actual)}</b></Ring>
        <div className="au-col" style={{ gap: 6, minWidth: 0 }}>
          <span><Pill tone={st.key}>{st.label}</Pill></span>
          <span className="au-small au-muted">Plan hari ini {P(c.plan)} · SPI {c.spi == null ? '–' : n1(c.spi)} · dihitung otomatis dari tanggal, bobot dan % selesai</span>
        </div>
      </div>

      <div className="au-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12 }}>
        <label className="au-col" style={{ gap: 6 }}><span className="lbl">App *</span>
          <select className="input" value={meta.app} onChange={e => setMeta(m => ({ ...m, app: e.target.value }))} aria-invalid={tried && !meta.app}>
            <option value="">Pilih app</option>{APPS.map(a => <option key={a}>{a}</option>)}
          </select></label>
        <label className="au-col" style={{ gap: 6 }}><span className="lbl">Urgensi</span>
          <select className="input" value={meta.urgency} onChange={e => setMeta(m => ({ ...m, urgency: e.target.value }))}>
            <option value="">Belum dipilih</option>{URGENCY.map(u => <option key={u}>{u}</option>)}
          </select></label>
      </div>
      <label className="au-col" style={{ gap: 6 }}><span className="lbl">Judul *</span>
        <input className="input" value={meta.title} maxLength={200} onChange={e => setMeta(m => ({ ...m, title: e.target.value }))} aria-invalid={tried && !meta.title.trim()} placeholder="Nama initiative" /></label>

      <div className="au-col" style={{ gap: 6 }}>
        <span className="lbl">PIC</span>
        <div className="input au-row au-wrap" style={{ gap: 6, minHeight: 44 }}>
          {meta.pic.map(p => <span key={p} className="au-tag">{p}<button type="button" className="au-link" style={{ padding: 0, minHeight: 0 }} aria-label={`Hapus ${p}`} onClick={() => setMeta(m => ({ ...m, pic: m.pic.filter(x => x !== p) }))}><Icon name="x" size={12} /></button></span>)}
          <input aria-label="Tambah PIC" value={picInput} onChange={e => setPicInput(e.target.value)} placeholder={meta.pic.length ? '' : 'Ketik nama lalu Enter'}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addPic(sugg[0]?.name || picInput) } }}
            style={{ border: 0, outline: 0, background: 'transparent', flex: 1, minWidth: 120, color: 'var(--ink)', minHeight: 28 }} />
        </div>
        {sugg.length > 0 && <div className="au-ig">{sugg.map(m => <button type="button" key={m._id || m.name} className="au-igr" onClick={() => addPic(m.name)}>{m.name}</button>)}</div>}
      </div>

      <label className="au-igr" style={{ border: '1px solid var(--line)', borderRadius: 16 }}>
        <span className="k">Sembunyikan dari tamu (eksternal)</span>
        <input type="checkbox" className="au-sw" style={{ marginLeft: 'auto' }} checked={meta.hiddenGuest} onChange={e => setMeta(m => ({ ...m, hiddenGuest: e.target.checked }))} />
      </label>

      <div className="au-col" style={{ gap: 6 }}><span className="lbl">Catatan initiative</span>
        <RichTextarea rows={2} value={meta.progressNotes} onChange={v => setMeta(m => ({ ...m, progressNotes: v }))} placeholder="Ringkasan progress, risiko, keputusan" /></div>

      <div className="au-row au-between" style={{ marginTop: 6 }}>
        <h3 style={{ font: '700 17px var(--disp)' }}>Aktivitas</h3>
        <button type="button" className="btn btn-sm" onClick={addAct}><Icon name="plus" size={14} />Aktivitas</button>
      </div>
      {given.length === 0
        ? <span className="au-xs au-muted">Bobot opsional. Bila dikosongkan, semua aktivitas dihitung sama rata.</span>
        : Math.abs(totalW - 100) > 0.05 && <div className="au-row au-wrap p-warn" style={{ borderRadius: 12, padding: '10px 12px', gap: 8 }}>
            <span className="au-small">Total bobot {n1(totalW)}%, idealnya 100%. Aktivitas tanpa bobot dihitung 0.</span>
            <button type="button" className="au-link" onClick={even}>Ratakan</button>
          </div>}

      {drafts.map((d, i) => {
        const err = errs[i], showErr = err && (tried || err.includes('sebelum') || err.includes('valid'))
        return (
          <div key={d.key} className="au-box" style={{ padding: 14, gap: 10 }}>
            <div className="au-row" style={{ gap: 8 }}>
              <span className="lbl" style={{ width: 18 }}>{i + 1}</span>
              <input className="input" aria-label={`Nama aktivitas ${i + 1}`} value={d.name} maxLength={120} onChange={e => setD(i, { name: e.target.value })} />
              <button type="button" className="btn btn-icon btn-sm" aria-label="Naikkan" disabled={i === 0} onClick={() => move(i, -1)}><Icon name="up" size={14} /></button>
              <button type="button" className="btn btn-icon btn-sm" aria-label="Hapus aktivitas" onClick={() => setDrafts(ds => ds.filter((_, k) => k !== i))}><Icon name="trash" size={14} /></button>
            </div>
            <div className="au-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10 }}>
              <label className="au-col" style={{ gap: 4 }}><span className="lbl">Mulai</span><input type="date" className="input" value={d.start} onChange={e => setD(i, { start: e.target.value })} /></label>
              <label className="au-col" style={{ gap: 4 }}><span className="lbl">Selesai</span><input type="date" className="input" value={d.end} min={d.start || undefined} onChange={e => setD(i, { end: e.target.value })} /></label>
              <label className="au-col" style={{ gap: 4 }}><span className="lbl">Bobot %</span><input type="number" inputMode="decimal" min={0} max={100} className="input" placeholder="opsional" value={d.w > 0 ? Math.round(d.w * 100) / 100 : ''} onChange={e => setD(i, { w: Math.max(0, Number(e.target.value) || 0) })} /></label>
              <label className="au-col" style={{ gap: 4 }}><span className="lbl">% selesai</span><input type="number" inputMode="numeric" min={0} max={100} className="input" value={Math.round(d.pct * 10) / 10} onChange={e => setD(i, { pct: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })} /></label>
            </div>
            <input type="range" min={0} max={100} step={5} value={d.pct} aria-label={`Persen selesai ${d.name}`} onChange={e => setD(i, { pct: Number(e.target.value) })} style={{ accentColor: 'var(--accent)' }} />
            <RichTextarea rows={2} value={d.notes} onChange={v => setD(i, { notes: v })} placeholder="Catatan aktivitas (opsional)" />
            {showErr && <span className="au-xs" role="alert" style={{ color: 'var(--bad)', fontWeight: 600 }}>{err}</span>}
          </div>
        )
      })}
      {drafts.length === 0 && <span className="au-small au-muted">Belum ada aktivitas. Tambahkan minimal satu.</span>}

      {ini && (confirmDel
        ? <div className="au-row au-wrap p-bad" style={{ borderRadius: 14, padding: 12, gap: 10 }}>
            <span className="au-small" style={{ flex: 1 }}>Hapus “{ini.title}”? Tindakan ini tidak bisa dibatalkan.</span>
            <button type="button" className="btn btn-sm" onClick={() => setConfirmDel(false)}>Batal</button>
            <button type="button" className="btn btn-danger btn-sm" disabled={saving} onClick={del}>Ya, hapus</button>
          </div>
        : <button type="button" className="btn btn-danger" style={{ alignSelf: 'flex-start' }} onClick={() => setConfirmDel(true)}><Icon name="trash" size={15} />Hapus initiative</button>)}
    </Sheet>
  )
}

/* ───────────── Halaman ───────────── */
export default function ProgressPage() {
  const { data: session } = useSession()
  const internal = isInternalUser(userRolesOf(session?.user))
  const { year } = useYear()
  const today = useMemo(() => todayUTC(), [])
  const [all, setAll] = useState<Ini[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [members, setMembers] = useState<any[]>([])
  const [app, setApp] = useState('all')
  const [urg, setUrg] = useState('all')
  const [stF, setStF] = useState<StatusKey | 'all'>('all')
  const [selId, setSelId] = useState<string | null>(null)
  const [editor, setEditor] = useState<{ ini: Ini | null } | null>(null)
  const [quick, setQuick] = useState<{ id: string; idx: number } | null>(null)
  const exportRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    setFailed(false)
    try {
      const r = await fetch('/api/initiatives?year=all')
      if (!r.ok) throw new Error()
      const d = await r.json(); setAll(Array.isArray(d.data) ? d.data : [])
    } catch { setFailed(true); setAll(a => a ?? []) }
  }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (!internal) return
    fetch('/api/users').then(r => (r.ok ? r.json() : { data: [] })).then(d => setMembers((d.data || []).filter((u: any) => u.active !== false))).catch(() => {})
  }, [internal])
  useEffect(() => { try { const id = new URLSearchParams(location.search).get('i'); if (id) setSelId(id) } catch {} }, [])
  const select = (id: string | null) => {
    setSelId(id)
    try { const u = new URL(location.href); id ? u.searchParams.set('i', id) : u.searchParams.delete('i'); history.replaceState(history.state, '', u) } catch {}
    if (id) requestAnimationFrame(() => document.querySelector('.au-page')?.scrollTo({ top: 0, behavior: 'smooth' }))
  }

  const inYear = useMemo(() => (all || []).filter(i => (internal || !i.hiddenGuest) && showInYear(i, year)).map(i => viewOf(i, year, today)), [all, internal, year, today])
  const byMeta = inYear.filter(v => (app === 'all' || v.ini.app === app) && (urg === 'all' || v.ini.urgency === urg))
  const list = byMeta.filter(v => stF === 'all' || v.st.key === stF)
  const count = (k: StatusKey) => byMeta.filter(v => v.st.key === k).length
  const sel = list.find(v => v.ini._id === selId) || inYear.find(v => v.ini._id === selId) || null
  const quickIni = quick ? (all || []).find(i => i._id === quick.id) : null

  return (
    <div className="au-page">
      {editor && <Editor ini={editor.ini} year={year} today={today} members={members} onClose={() => setEditor(null)} onSaved={id => { load(); if (id) select(id) }} onDeleted={() => { select(null); load() }} />}
      {quick && quickIni && <QuickSheet ini={quickIni} idx={quick.idx} year={year} today={today} onClose={() => setQuick(null)} onSaved={load} />}

      <div className="au-view au-anim" ref={exportRef}>
        <PageHeader eyebrow={`Dashboard & Overview · ${year}`} title="Progress Project" actions={<>
          <ExportMenu getNodes={() => exportRef.current ? Array.from(exportRef.current.querySelectorAll<HTMLElement>('[data-export-card]')) : []} filename={`progress-initiatives-${year}`} title="Progress Initiative — WINS" />
          {internal && <button type="button" className="btn btn-primary" onClick={() => setEditor({ ini: null })}><Icon name="plus" size={16} stroke={2.2} />Initiative baru</button>}
        </>} />

        <div className="au-grid g4 au-tiles">
          <Tile icon="prog" color="var(--accent)" value={byMeta.length} label="Initiative" hint={String(year)} active={stF === 'all'} onClick={() => setStF('all')} />
          <Tile icon="check" color="var(--ok)" value={count('ok')} label="On track" active={stF === 'ok'} onClick={() => setStF(stF === 'ok' ? 'all' : 'ok')} />
          <Tile icon="clock" color="var(--warn)" value={count('warn')} label="Perlu perhatian" active={stF === 'warn'} onClick={() => setStF(stF === 'warn' ? 'all' : 'warn')} />
          <Tile icon="bolt" color="var(--bad)" value={count('bad')} label="Terlambat" active={stF === 'bad'} onClick={() => setStF(stF === 'bad' ? 'all' : 'bad')} />
        </div>

        <div className="au-row au-wrap" style={{ gap: 8 }}>
          <div className="au-chips" role="group" aria-label="Filter app">
            {['all', ...APPS].map(a => <button key={a} type="button" className="au-chip" aria-pressed={app === a} onClick={() => setApp(a)}>{a === 'all' ? 'Semua app' : a}</button>)}
          </div>
          <div className="au-chips" role="group" aria-label="Filter urgensi">
            {['all', ...URGENCY].map(u => <button key={u} type="button" className="au-chip" aria-pressed={urg === u} onClick={() => setUrg(u)}>{u === 'all' ? 'Semua urgensi' : u}</button>)}
          </div>
        </div>

        {failed && <div className="au-row au-wrap p-bad" role="alert" style={{ borderRadius: 14, padding: 12 }}><span className="au-small" style={{ flex: 1 }}>Data initiative gagal dimuat.</span><button type="button" className="btn btn-sm" onClick={load}>Coba lagi</button></div>}

        {all === null ? (
          <div className="au-col" style={{ gap: 10 }}>{[0, 1, 2].map(k => <div key={k} className="au-card"><div className="au-skel" style={{ width: '60%' }} /><div className="au-skel" style={{ width: '35%' }} /></div>)}</div>
        ) : list.length === 0 ? (
          <div className="au-card"><Empty title={inYear.length ? 'Tidak ada yang cocok' : `Belum ada initiative di ${year}`}
            text={inYear.length ? 'Ubah filter app, urgensi atau status.' : 'Initiative bisa melewati pergantian tahun. Pilih tahun lain di atas atau buat yang baru.'}
            action={inYear.length ? <button type="button" className="btn" onClick={() => { setApp('all'); setUrg('all'); setStF('all') }}>Reset filter</button> : internal ? <button type="button" className="btn btn-primary" onClick={() => setEditor({ ini: null })}>Buat initiative</button> : undefined} /></div>
        ) : (
          <div className={`au-split${sel ? ' has' : ''}`}>
            <div className="au-lp au-lpane">
              {list.map((v, k) => (
                <button type="button" key={v.ini._id} className="au-icard rise" style={{ ['--d' as any]: Math.min(k, 8) }} aria-current={sel?.ini._id === v.ini._id} onClick={() => select(v.ini._id)} data-export-card={sel ? undefined : ''}>
                  <Ring value={v.c.actual} plan={v.c.spi == null ? null : v.c.plan} size={88} stroke={10} label={`Realisasi ${P(v.c.actual)} dari rencana ${P(v.c.plan)}`}><b>{P(v.c.actual)}</b><span>plan {P(v.c.plan)}</span></Ring>
                  <span className="au-col" style={{ gap: 6, minWidth: 0 }}>
                    <span className="au-row au-wrap" style={{ gap: 5 }}>
                      {v.ini.app && <span className="au-tag">{v.ini.app}</span>}
                      {v.ini.urgency && <span className="au-tag">{v.ini.urgency}</span>}
                      {internal && v.ini.hiddenGuest && <span className="au-tag">Disembunyikan dari tamu</span>}
                    </span>
                    <h3>{v.ini.title}</h3>
                    <span><Pill tone={v.st.key}>{v.st.label}</Pill></span>
                    <span className="au-xs au-muted" style={{ overflowWrap: 'anywhere' }}>{v.cur ? `Sekarang: ${v.cur.name}` : 'Belum ada aktivitas'}{picArray(v.ini.pic).length ? ` · PIC ${picArray(v.ini.pic).join(', ')}` : ''}</span>
                  </span>
                </button>
              ))}
            </div>
            <div className="au-dp au-col" style={{ gap: 16, minWidth: 0 }}>
              {sel ? <Detail v={sel} today={today} internal={internal} onBack={() => select(null)} onEdit={() => setEditor({ ini: sel.ini })} onAct={i => setQuick({ id: sel.ini._id, idx: i })} />
                : <div className="au-card"><Empty title="Pilih initiative" text="Kurva S, timeline dan update progress tampil di sini." /></div>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Detail({ v, today, internal, onBack, onEdit, onAct }: { v: View; today: number; internal: boolean; onBack: () => void; onEdit: () => void; onAct: (i: number) => void }) {
  const { ini, acts, c, st } = v
  const ends = acts.map(a => dUTC(a.end)).filter(Number.isFinite)
  const left = ends.length ? Math.ceil((Math.max(...ends) + DAY - today) / DAY) : null
  const given = acts.filter(a => a.w > 0), totalW = given.reduce((s, a) => s + a.w, 0)
  const gap = c.actual - c.plan
  const pics = picArray(ini.pic)
  return (
    <>
      <button type="button" className="au-link au-row" style={{ alignSelf: 'flex-start', gap: 4 }} onClick={onBack}><Icon name="back" size={14} />Semua initiative</button>
      <section className="au-hero ini rise" data-export-card="">
        <div className="au-col" style={{ gap: 14, minWidth: 0 }}>
          <span className="lbl">{[ini.app, ini.urgency].filter(Boolean).join(' · ') || 'Initiative'}{pics.length ? ` · PIC ${pics.join(', ')}` : ''}</span>
          <h1 style={{ fontSize: 'clamp(24px,3vw,38px)', overflowWrap: 'anywhere' }}>{ini.title}</h1>
          <div className="au-hchips">
            <div className="au-hchip"><b>{P(c.plan)}</b><span>Plan hari ini</span></div>
            <div className="au-hchip"><b>{c.spi == null ? '–' : n1(c.spi)}</b><span>SPI</span></div>
            <div className="au-hchip"><b>{left == null ? '–' : Math.max(0, left)}</b><span>Hari tersisa</span></div>
          </div>
          <div className="au-row au-wrap"><Pill tone={st.key}>{st.label}</Pill>
            {c.spi != null && <span className="au-small au-ink2">{gap < 0 ? `Tertinggal ${n1(-gap)} poin dari rencana` : `Unggul ${n1(gap)} poin dari rencana`}</span>}
            {internal && <button type="button" className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={onEdit}><Icon name="pnote" size={14} />Edit</button>}
          </div>
        </div>
        <Ring value={c.actual} plan={c.spi == null ? null : c.plan} size={190} stroke={18} label={`Realisasi ${P(c.actual)}`}><b style={{ fontSize: 40 }}>{P(c.actual)}</b><span>realisasi</span></Ring>
      </section>

      <div className="au-grid g2">
        <section className="au-card rise" data-export-card="" style={{ ['--d' as any]: 1 }}>
          <div className="au-row au-between"><h2>Kurva S</h2><span className="lbl">plan kumulatif</span></div>
          {acts.some(a => a.start && a.end) ? <SCurve acts={acts} today={today} /> : <p className="au-small au-muted">Isi tanggal aktivitas untuk melihat kurva S.</p>}
          <p className="au-xs au-muted">Area = rencana kumulatif dari tanggal & bobot. Titik coral = realisasi hari ini.</p>
        </section>
        <section className="au-card rise" style={{ ['--d' as any]: 2 }}>
          <h2>Cara hitung</h2>
          <div className="au-col" style={{ gap: 4, fontSize: 14 }}>
            <div className="au-row au-between"><span className="au-ink2">Plan s.d. hari ini</span><b>{n1(c.plan)}%</b></div><span className="au-xs au-muted">Σ bobot × % waktu berjalan (linear per hari)</span>
            <div className="au-row au-between" style={{ marginTop: 8 }}><span className="au-ink2">Realisasi</span><b>{n1(c.actual)}%</b></div><span className="au-xs au-muted">Σ bobot × % selesai yang diisi tim</span>
            <div className="au-row au-between" style={{ marginTop: 8 }}><span className="au-ink2">SPI</span><b>{c.spi == null ? '–' : n1(c.spi)}</b></div><span className="au-xs au-muted">≥ 1 on track · 0,9–1 perlu perhatian · &lt; 0,9 terlambat</span>
          </div>
          {given.length === 0 ? <span className="au-pill p-none" style={{ alignSelf: 'flex-start', whiteSpace: 'normal' }}>Bobot kosong, dihitung sama rata</span>
            : Math.abs(totalW - 100) > 0.05 ? <span className="au-pill p-warn" style={{ alignSelf: 'flex-start', whiteSpace: 'normal' }}>Total bobot {n1(totalW)}%, idealnya 100%</span>
            : <span className="au-pill p-ok" style={{ alignSelf: 'flex-start' }}><Icon name="check" size={14} stroke={2.4} />Bobot total 100%</span>}
        </section>
      </div>

      <section className="au-card rise" data-export-card="" style={{ ['--d' as any]: 3 }}>
        <div className="au-row au-between au-wrap"><h2>Timeline aktivitas</h2>{internal && <span className="au-xs au-muted">Ketuk bar untuk update % selesai</span>}</div>
        <Gantt acts={acts} today={today} onSelect={internal ? onAct : undefined} />
      </section>

      <section className="au-ig rise" style={{ ['--d' as any]: 4 }} aria-label="Daftar aktivitas">
        {acts.map((a, i) => {
          const due = ptd(a, today), late = a.start && due > a.pct + 0.5 && today > dUTC(a.start)
          const body = <>
            <span className="au-col" style={{ minWidth: 0, gap: 2, flex: 1 }}>
              <b style={{ fontSize: 14.5 }}>{a.name}</b>
              <span className="au-xs au-muted">{a.start ? `${fmtD(a.start)} – ${fmtD(a.end)}` : 'Belum ada jadwal'}{a.w > 0 ? ` · bobot ${n1(a.w)}%` : ''} · plan {P(due)}</span>
              {a.notes && <span className="au-xs au-ink2" style={{ whiteSpace: 'pre-wrap', marginTop: 2 }}>{a.notes}</span>}
            </span>
            <span className="au-col" style={{ alignItems: 'flex-end', gap: 4 }}>
              <b style={{ font: '700 18px var(--disp)' }}>{P(a.pct)}</b>
              {late ? <Pill tone="bad">Tertinggal</Pill> : a.pct >= 100 ? <Pill tone="ok">Selesai</Pill> : null}
            </span>
          </>
          return internal
            ? <button type="button" key={i} className="au-igr" onClick={() => onAct(i)}>{body}</button>
            : <div key={i} className="au-igr">{body}</div>
        })}
        {acts.length === 0 && <div className="au-igr au-muted">Belum ada aktivitas</div>}
      </section>

      {ini.progressNotes && <section className="au-card rise" style={{ ['--d' as any]: 5 }}><h2>Catatan</h2><p className="au-small au-ink2" style={{ whiteSpace: 'pre-wrap' }}>{ini.progressNotes}</p></section>}
    </>
  )
}
