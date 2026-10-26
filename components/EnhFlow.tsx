'use client'
// Sheet untuk alur Enhancement terpadu: aktivitas kustom, update cepat, Carry Over, dan pemindahan Progress Project.
import { useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Icon, Pill, Ring, Seg, Sheet } from '@/components/ui'
import { DAY, calc, dUTC, ptd, statusOf, type Act } from '@/lib/progress'
import { isDone, reschedule, type CustomAct } from '@/lib/enhancementFlow'

const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const fmtD = (s: string) => { const t = dUTC(s); if (!Number.isFinite(t)) return '–'; const d = new Date(t); return `${d.getUTCDate()} ${BLN[d.getUTCMonth()]} ${d.getUTCFullYear()}` }
const P = (v: number) => `${Math.round(v)}%`
const n1 = (v: number) => (Math.round(v * 10) / 10).toLocaleString('id-ID')

export async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error || 'Gagal menyimpan, coba lagi')
  return data
}

type Draft = CustomAct & { key: number }
function draftErr(d: Draft): string | null {
  if (!d.name.trim()) return 'Nama aktivitas wajib diisi'
  if (!d.start && !d.end) return null
  if (!d.start || !d.end) return 'Isi tanggal mulai dan selesai'
  if (dUTC(d.end) < dUTC(d.start)) return 'Tanggal selesai sebelum tanggal mulai'
  return null
}

/* ───────────── Editor aktivitas kustom ───────────── */
export function ActsSheet({ title, initial, year, today, canReset, onClose, onSave }: {
  title: string; initial: CustomAct[]; year: number; today: number; canReset: boolean
  onClose: () => void; onSave: (acts: CustomAct[]) => Promise<void>
}) {
  const nextKey = useRef(1000)
  const [ds, setDs] = useState<Draft[]>(() => (initial.length ? initial : [{ name: 'Analysis & Design', start: `${year}-01-01`, end: `${year}-03-31`, w: 0, pct: 0 }]).map((a, k) => ({ ...a, notes: a.notes || '', key: k })))
  const [tried, setTried] = useState(false), [saving, setSaving] = useState(false), [confirmReset, setConfirmReset] = useState(false)
  const acts: Act[] = ds.map(d => ({ name: d.name || 'Aktivitas', start: d.start, end: d.end, w: d.w, pct: d.pct }))
  const c = calc(acts, today), st = statusOf(c.spi)
  const errs = ds.map(draftErr)
  const given = ds.filter(d => d.w > 0), totalW = given.reduce((s, d) => s + d.w, 0)
  const setD = (i: number, p: Partial<Draft>) => setDs(x => x.map((d, k) => (k === i ? { ...d, ...p } : d)))
  const add = () => setDs(x => {
    const last = x[x.length - 1], e = last ? dUTC(last.end) : NaN
    return [...x, { key: nextKey.current++, name: `Aktivitas ${x.length + 1}`, start: Number.isFinite(e) ? new Date(e + DAY).toISOString().slice(0, 10) : '', end: '', w: 0, pct: 0, notes: '' }]
  })
  const move = (i: number, dir: -1 | 1) => setDs(x => { const j = i + dir; if (j < 0 || j >= x.length) return x; const n = [...x]; [n[i], n[j]] = [n[j], n[i]]; return n })
  const even = () => setDs(x => x.map(d => ({ ...d, w: Math.round((100 / x.length) * 100) / 100 })))
  async function save(list: CustomAct[]) {
    setSaving(true)
    try { await onSave(list); onClose() } catch (e: any) { toast.error(e.message) } finally { setSaving(false) }
  }
  function submit() {
    setTried(true)
    const bad = errs.find(Boolean)
    if (bad || !ds.length) { toast.error(bad || 'Tambahkan minimal satu aktivitas'); return }
    save(ds.map(({ key, ...a }) => ({ ...a, name: a.name.trim() })))
  }
  return (
    <Sheet open wide title={title} onClose={onClose} onSave={submit} saveDisabled={saving} saveLabel={saving ? 'Menyimpan…' : 'Simpan'}>
      <div className="au-box" style={{ padding: 14, gap: 16, flexDirection: 'row', alignItems: 'center' }}>
        <Ring value={c.actual} plan={c.spi == null ? null : c.plan} size={76} stroke={9} label={`Realisasi ${P(c.actual)}, rencana ${P(c.plan)}`}><b style={{ fontSize: 17 }}>{P(c.actual)}</b></Ring>
        <div className="au-col" style={{ gap: 6, minWidth: 0 }}>
          <span><Pill tone={st.key}>{st.label}</Pill></span>
          <span className="au-small au-muted">Plan hari ini {P(c.plan)} · SPI {c.spi == null ? '–' : n1(c.spi)} · dihitung dari tanggal, bobot dan % selesai</span>
        </div>
      </div>
      <div className="au-row au-between"><h3 style={{ font: '700 17px var(--disp)' }}>Aktivitas</h3><button type="button" className="btn btn-sm" onClick={add}><Icon name="plus" size={14} />Aktivitas</button></div>
      {given.length === 0
        ? <span className="au-xs au-muted">Bobot opsional. Bila dikosongkan, semua aktivitas dihitung sama rata.</span>
        : Math.abs(totalW - 100) > 0.05 && <div className="au-row au-wrap p-warn" style={{ borderRadius: 12, padding: '10px 12px', gap: 8 }}><span className="au-small">Total bobot {n1(totalW)}%, idealnya 100%.</span><button type="button" className="au-link" onClick={even}>Ratakan</button></div>}
      {ds.map((d, i) => {
        const err = errs[i], show = err && (tried || err.includes('sebelum'))
        return (
          <div key={d.key} className="au-box" style={{ padding: 14, gap: 10 }}>
            <div className="au-row" style={{ gap: 8 }}>
              <span className="lbl" style={{ width: 18 }}>{i + 1}</span>
              <input className="input" aria-label={`Nama aktivitas ${i + 1}`} value={d.name} maxLength={120} onChange={e => setD(i, { name: e.target.value })} />
              <button type="button" className="btn btn-icon btn-sm" aria-label={`Naikkan aktivitas ${i + 1}`} disabled={i === 0} onClick={() => move(i, -1)}><Icon name="up" size={14} /></button>
              <button type="button" className="btn btn-icon btn-sm" aria-label={`Hapus aktivitas ${i + 1}`} onClick={() => setDs(x => x.filter((_, k) => k !== i))}><Icon name="trash" size={14} /></button>
            </div>
            <div className="au-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10 }}>
              <label className="au-col" style={{ gap: 4 }}><span className="lbl">Mulai</span><input type="date" className="input" value={d.start} onChange={e => setD(i, { start: e.target.value })} /></label>
              <label className="au-col" style={{ gap: 4 }}><span className="lbl">Selesai</span><input type="date" className="input" value={d.end} min={d.start || undefined} onChange={e => setD(i, { end: e.target.value })} /></label>
              <label className="au-col" style={{ gap: 4 }}><span className="lbl">Bobot %</span><input type="number" inputMode="decimal" min={0} max={100} className="input" placeholder="opsional" value={d.w > 0 ? Math.round(d.w * 100) / 100 : ''} onChange={e => setD(i, { w: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })} /></label>
              <label className="au-col" style={{ gap: 4 }}><span className="lbl">% selesai</span><input type="number" inputMode="numeric" min={0} max={100} className="input" value={Math.round(d.pct * 10) / 10} onChange={e => setD(i, { pct: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })} /></label>
            </div>
            <textarea className="input" rows={2} maxLength={5000} value={d.notes || ''} onChange={e => setD(i, { notes: e.target.value })} placeholder="Catatan aktivitas (opsional)" aria-label={`Catatan aktivitas ${i + 1}`} />
            {show && <span className="au-xs" role="alert" style={{ color: 'var(--bad)', fontWeight: 600 }}>{err}</span>}
          </div>
        )
      })}
      {ds.length === 0 && <span className="au-small au-muted">Belum ada aktivitas. Tambahkan minimal satu.</span>}
      {canReset && (confirmReset
        ? <div className="au-row au-wrap p-warn" style={{ borderRadius: 14, padding: 12, gap: 10 }}>
            <span className="au-small" style={{ flex: 1 }}>Kembali ke template 5 aktivitas (BRD → Stabilisasi)? Aktivitas di atas tidak dipakai lagi.</span>
            <button type="button" className="btn btn-sm" onClick={() => setConfirmReset(false)}>Batal</button>
            <button type="button" className="btn btn-sm btn-primary" disabled={saving} onClick={() => save([])}>Ya, pakai template</button>
          </div>
        : <button type="button" className="au-link" style={{ alignSelf: 'flex-start' }} onClick={() => setConfirmReset(true)}>Kembali ke template 5 aktivitas</button>)}
    </Sheet>
  )
}

/* ───────────── Update cepat satu aktivitas kustom ───────────── */
export function QuickActSheet({ act, today, onClose, onSave }: { act: CustomAct; today: number; onClose: () => void; onSave: (pct: number, notes: string) => Promise<void> }) {
  const [pct, setPct] = useState(Math.round(act.pct)), [notes, setNotes] = useState(act.notes || ''), [saving, setSaving] = useState(false)
  const due = act.start ? ptd(act, today) : 0
  async function save() { setSaving(true); try { await onSave(pct, notes); onClose() } catch (e: any) { toast.error(e.message) } finally { setSaving(false) } }
  return (
    <Sheet open title={act.name} onClose={onClose} onSave={save} saveDisabled={saving} saveLabel={saving ? 'Menyimpan…' : 'Simpan'}>
      <p className="au-small au-muted">{act.start ? `${fmtD(act.start)} – ${fmtD(act.end)}` : 'Belum ada jadwal'}{act.w > 0 ? ` · bobot ${n1(act.w)}%` : ''}</p>
      <div className="au-row au-between" style={{ alignItems: 'flex-end' }}>
        <div className="au-col"><span className="lbl">Selesai</span><b className="au-bigpct" aria-live="polite">{pct}%</b></div>
        <div className="au-col" style={{ alignItems: 'flex-end' }}><span className="lbl">Seharusnya hari ini</span><b style={{ font: '700 22px var(--disp)' }}>{P(due)}</b></div>
      </div>
      <input type="range" min={0} max={100} step={5} value={pct} onChange={e => setPct(Number(e.target.value))} aria-label="Persen selesai" style={{ width: '100%', accentColor: 'var(--accent)' }} />
      <div className="au-quick" role="group" aria-label="Pilih cepat">{[0, 25, 50, 75, 100].map(v => <button key={v} type="button" aria-pressed={pct === v} onClick={() => setPct(v)}>{v}%</button>)}</div>
      <label className="au-col" style={{ gap: 6 }}><span className="lbl">Catatan</span><textarea className="input" rows={3} maxLength={5000} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Update singkat aktivitas ini" /></label>
    </Sheet>
  )
}

/* ───────────── Carry Over (satu atau banyak) ───────────── */
export type CarryRow = { id: string; code: string; title: string; app: string; klas: string; actual: number; acts: Act[] }
export function CarrySheet({ rows, year, preselect, onClose, onDone }: { rows: CarryRow[]; year: number; preselect?: string[]; onClose: () => void; onDone: (ids: string[], to: number) => void }) {
  const open = rows.filter(r => !isDone(r.actual))
  const [sel, setSel] = useState<Set<string>>(() => new Set(preselect?.length ? preselect : open.map(r => r.id)))
  const [to, setTo] = useState(year + 1)
  const [resched, setResched] = useState(false)
  const [saving, setSaving] = useState(false)
  const single = rows.length === 1
  const chosen = rows.filter(r => sel.has(r.id))
  const lateActs = chosen.reduce((n, r) => n + reschedule(r.acts, to).filter((a, i) => a.start !== r.acts[i].start).length, 0)
  const toggle = (id: string) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  async function go() {
    if (!chosen.length) { toast.error('Pilih minimal satu enhancement'); return }
    setSaving(true)
    try {
      const out = await send('/api/enhancements/carry', 'POST', { ids: chosen.map(r => r.id), to, reschedule: resched })
      const skipped = (out.skipped || []).length
      toast.success(`${(out.data || []).length} enhancement dibawa ke ${to}${skipped ? ` · ${skipped} dilewati` : ''}`)
      onDone(chosen.map(r => r.id), to); onClose()
    } catch (e: any) { toast.error(e.message) } finally { setSaving(false) }
  }
  return (
    <Sheet open wide={!single} title={single ? 'Carry Over' : `Carry Over ${year}`} onClose={onClose} onSave={go} saveDisabled={saving || !chosen.length} saveLabel={saving ? 'Memproses…' : `Bawa ${chosen.length || ''} ke ${to}`}>
      <p className="au-small au-ink2">Enhancement yang tidak selesai di {year} dipindah ke tahun tujuan dengan jenis <b>Carry Over</b>. Progress, item, PIC dan catatan ikut terbawa. Di {year} tetap tercatat sebagai “dibawa ke {to}”, dan bisa dibatalkan kapan saja.</p>
      <div className="au-row au-wrap" style={{ gap: 10 }}>
        <span className="lbl">Ke tahun</span>
        <Seg label="Tahun tujuan" value={to} onChange={setTo} options={[year + 1, year + 2] as const} />
      </div>
      {!single && <div className="au-row au-between au-wrap">
        <span className="au-small"><b>{chosen.length}</b> dari {rows.length} dipilih{open.length < rows.length ? ` · ${rows.length - open.length} sudah selesai` : ''}</span>
        <span className="au-row" style={{ gap: 6 }}>
          <button type="button" className="btn btn-sm" onClick={() => setSel(new Set(open.map(r => r.id)))}>Pilih yang belum selesai</button>
          <button type="button" className="btn btn-sm" onClick={() => setSel(new Set())}>Kosongkan</button>
        </span>
      </div>}
      <div className="au-ig" style={{ maxHeight: single ? undefined : '42dvh', overflow: 'auto' }}>
        {rows.map(r => (
          <label key={r.id} className="au-igr" style={{ gap: 12, flexShrink: 0 }}>
            {!single && <input type="checkbox" checked={sel.has(r.id)} onChange={() => toggle(r.id)} aria-label={`Pilih ${r.title}`} style={{ width: 20, height: 20, accentColor: 'var(--accent)' }} />}
            <span className="au-col" style={{ gap: 2, minWidth: 0, flex: 1 }}>
              <b style={{ fontSize: 14.5 }}>{r.title}</b>
              <span className="au-xs au-muted">{[r.code, r.app, r.klas].filter(Boolean).join(' · ')}</span>
            </span>
            <span className="au-col" style={{ alignItems: 'flex-end', gap: 2 }}><b>{P(r.actual)}</b>{isDone(r.actual) && <Pill tone="ok">Selesai</Pill>}</span>
          </label>
        ))}
      </div>
      <label className="au-igr" style={{ border: '1px solid var(--line)', borderRadius: 16, gap: 12 }}>
        <span className="au-col" style={{ gap: 2, flex: 1 }}><span className="k">Jadwal ulang aktivitas yang tertinggal</span>
          <span className="au-xs au-muted">{resched ? (lateActs ? `${lateActs} aktivitas yang belum selesai digeser mulai 1 Januari ${to}, durasi tetap.` : 'Tidak ada aktivitas yang perlu digeser.') : 'Mati: tanggal aktivitas tetap seperti sekarang.'}</span></span>
        <input type="checkbox" className="au-sw" checked={resched} onChange={e => setResched(e.target.checked)} />
      </label>
    </Sheet>
  )
}

/* ───────────── Pemindahan Progress Project (admin) ───────────── */
type MigState = { total: number; pending: number; moved: number; edited: number; items: { _id: string; title: string; app: string; year: number; klas: string }[] }
export function useMigration(enabled: boolean) {
  const [st, setSt] = useState<MigState | null>(null)
  const load = useMemo(() => async () => {
    if (!enabled) return
    try { const r = await fetch('/api/enhancements/migrate'); if (r.ok) setSt((await r.json()).data) } catch {}
  }, [enabled])
  useEffect(() => { load() }, [load])
  return { st, reload: load }
}

export function MigrateSheet({ st, onClose, onDone }: { st: MigState; onClose: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false), [confirmUndo, setConfirmUndo] = useState(false)
  const bySI = st.items.filter(i => i.klas === 'SI').length
  async function go() {
    setBusy(true)
    try { const out = await send('/api/enhancements/migrate', 'POST'); toast.success(`${out.data.moved} Progress Project dipindah ke Enhancement`); onDone(); onClose() }
    catch (e: any) { toast.error(e.message) } finally { setBusy(false) }
  }
  async function undo() {
    setBusy(true)
    try { const out = await send('/api/enhancements/migrate', 'DELETE'); toast.success(`Dibatalkan · ${out.data.restored} initiative kembali ke Progress Project`); onDone(); onClose() }
    catch (e: any) { toast.error(e.message) } finally { setBusy(false) }
  }
  return (
    <Sheet open wide title="Pindahkan Progress Project" onClose={onClose} onSave={st.pending ? go : undefined} saveDisabled={busy || !st.pending} saveLabel={busy ? 'Memindahkan…' : `Pindahkan ${st.pending}`}>
      <p className="au-small au-ink2">Progress Project digabung ke Enhancement. Setiap initiative disalin menjadi enhancement dengan aktivitas, bobot, % selesai, PIC dan catatan yang sama, jadi progress dan kurva S tidak berubah. Urgensi <b>SI</b> jadi klasifikasi SI (KPI); <b>Non SI</b> dan <b>Others</b> jadi Non-SI.</p>
      <p className="au-xs au-muted">Data initiative tidak dihapus, hanya disembunyikan. Pemindahan bisa dibatalkan.</p>
      {st.pending > 0 && <>
        <div className="au-row au-wrap" style={{ gap: 8 }}><Pill tone="accent">{st.pending} initiative</Pill><Pill tone="ok">{bySI} SI</Pill><Pill tone="none">{st.pending - bySI} Non-SI</Pill></div>
        <div className="au-ig" style={{ maxHeight: '40dvh', overflow: 'auto' }}>
          {st.items.map(i => <div key={i._id} className="au-igr" style={{ flexShrink: 0 }}><span className="au-col" style={{ gap: 2, minWidth: 0, flex: 1 }}><b style={{ fontSize: 14 }}>{i.title}</b><span className="au-xs au-muted">{i.app || 'Others'} · {i.year}</span></span><span className="au-tag">{i.klas}</span></div>)}
        </div>
      </>}
      {st.moved > 0 && (confirmUndo
        ? <div className="au-row au-wrap p-bad" style={{ borderRadius: 14, padding: 12, gap: 10 }}>
            <span className="au-small" style={{ flex: 1 }}>Batalkan pemindahan? {st.moved} enhancement hasil pindahan dihapus dan initiative tampil lagi di Progress Project.{st.edited ? ` ${st.edited} di antaranya sudah diubah setelah dipindah; perubahan itu ikut hilang.` : ''}</span>
            <button type="button" className="btn btn-sm" onClick={() => setConfirmUndo(false)}>Batal</button>
            <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={undo}>Ya, batalkan</button>
          </div>
        : <button type="button" className="au-link" style={{ alignSelf: 'flex-start' }} onClick={() => setConfirmUndo(true)}>Batalkan pemindahan ({st.moved} enhancement)</button>)}
    </Sheet>
  )
}
