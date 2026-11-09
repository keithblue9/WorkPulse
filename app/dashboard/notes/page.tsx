'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { getConfig } from '@/lib/configCache'
import { Empty, Icon, PageHeader, Sheet, Portal } from '@/components/ui'
import { useYear } from '@/lib/year'
import { matches, notesForYear, sortNotes } from '@/lib/notesView'
import { monthGroups, catCounts } from '@/lib/notesFeed'

type Note = Record<string, any>
type Cat = { key: string; label: string; color?: string }
const CAT_KEY = 'wins-notes-cat'
const HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
const initials = (s: string) => s.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('')
const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const fmtD = (s?: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? `${Number(m[3])} ${BLN[Number(m[2]) - 1]} ${m[1]}` : '' }

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error || 'Gagal menyimpan, coba lagi')
  return data
}

// Fullscreen image preview. Click backdrop or × to close.
function Lightbox({ src, onClose }: { src: string | null; onClose: () => void }) {
  useEffect(() => {
    if (!src) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [src, onClose])
  if (!src) return null
  return (
    <Portal>
    <div role="dialog" aria-label="Pratinjau gambar" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, cursor: 'zoom-out' }}>
      <button type="button" aria-label="Tutup" onClick={onClose} style={{ position: 'absolute', top: 16, right: 20, width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,.15)', color: '#fff', border: 0, cursor: 'pointer' }}><Icon name="x" size={20} /></button>
      <img src={src} alt="Gambar catatan" onClick={e => e.stopPropagation()} style={{ maxWidth: '95vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 12, cursor: 'default' }} />
    </div>
    </Portal>
  )
}

function NoteSheet({ editing, defaultCat, cats, members, onClose, onSaved }: { editing: Note | null; defaultCat: string; cats: Cat[]; members: any[]; onClose: () => void; onSaved: () => void }) {
  const { data: session } = useSession(); const user = session?.user as any
  const [form, setForm] = useState({
    title: editing?.title || '', category: editing?.category || defaultCat, date: editing?.date || format(new Date(), 'yyyy-MM-dd'),
    content: editing?.content || '', picTags: (editing?.picTags || []) as string[], images: (editing?.images || []) as string[], pinned: !!editing?.pinned,
  })
  const [saving, setSaving] = useState(false), [tried, setTried] = useState(false), [confirmDel, setConfirmDel] = useState(false)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const ref = useRef<HTMLTextAreaElement>(null)
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
  const catOpts = cats.some(c => c.key === form.category) ? cats : [...cats, { key: form.category, label: form.category }]

  function onPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    for (const item of Array.from(e.clipboardData?.items || [])) {
      if (!item.type.startsWith('image/')) continue
      e.preventDefault()
      const blob = item.getAsFile()
      if (!blob) continue
      if (blob.size > 3 * 1024 * 1024) { toast.error('Gambar maksimal 3 MB'); continue }
      const reader = new FileReader()
      reader.onload = ev => { setForm(f => ({ ...f, images: [...f.images, ev.target?.result as string] })); toast.success('Gambar ditempel') }
      reader.readAsDataURL(blob)
    }
  }
  function bullet(prefix: string) {
    const ta = ref.current; if (!ta) return
    const text = form.content || '', start = ta.selectionStart, ls = text.lastIndexOf('\n', start - 1) + 1
    set('content', text.slice(0, ls) + prefix + ' ' + text.slice(ls))
    setTimeout(() => { ta.focus(); ta.setSelectionRange(ls + prefix.length + 1, ls + prefix.length + 1) }, 0)
  }
  const togglePic = (n: string) => set('picTags', form.picTags.includes(n) ? form.picTags.filter(p => p !== n) : [...form.picTags, n])

  async function save() {
    setTried(true)
    if (!form.title.trim()) { toast.error('Judul wajib diisi'); return }
    setSaving(true)
    try {
      const body: Record<string, unknown> = { ...form, title: form.title.trim() }
      if (!editing) Object.assign(body, { authorId: user?.id || user?.email, authorName: user?.name })
      await send(editing ? `/api/notes/${editing._id}` : '/api/notes', editing ? 'PATCH' : 'POST', body)
      toast.success(editing ? 'Catatan diperbarui' : 'Catatan dibuat'); onSaved(); onClose()
    } catch (e: any) { toast.error(e.message) } finally { setSaving(false) }
  }
  async function del() {
    if (!editing) return
    setSaving(true)
    try { await send(`/api/notes/${editing._id}`, 'DELETE'); toast.success('Catatan dihapus'); onSaved(); onClose() } catch (e: any) { toast.error(e.message) } finally { setSaving(false) }
  }

  return (
    <Sheet open title={editing ? 'Edit catatan' : 'Catatan baru'} onClose={onClose} onSave={save} saveDisabled={saving} saveLabel={saving ? 'Menyimpan…' : 'Simpan'}>
      <label className="au-col" style={{ gap: 6 }}><span className="lbl">Judul *</span>
        <input className="input" value={form.title} maxLength={200} onChange={e => set('title', e.target.value)} aria-invalid={tried && !form.title.trim()} />
        {tried && !form.title.trim() && <span role="alert" className="au-xs" style={{ color: 'var(--bad)', fontWeight: 600 }}>Judul wajib diisi</span>}</label>
      <div className="au-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
        <label className="au-col" style={{ gap: 6 }}><span className="lbl">Kategori</span><select className="input" value={form.category} onChange={e => set('category', e.target.value)}>{catOpts.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}</select></label>
        <label className="au-col" style={{ gap: 6 }}><span className="lbl">Tanggal</span><input type="date" className="input" value={form.date} onChange={e => set('date', e.target.value)} /></label>
      </div>
      <div className="au-col" style={{ gap: 6 }}>
        <div className="au-row au-between"><span className="lbl">Isi catatan</span>
          <span className="au-row" style={{ gap: 4 }}><button type="button" className="btn btn-sm btn-icon" aria-label="Bullet" onClick={() => bullet('•')}>•</button><button type="button" className="btn btn-sm btn-icon" aria-label="Penomoran" onClick={() => bullet('1.')}>1.</button></span></div>
        <textarea ref={ref} className="input" rows={7} value={form.content} onChange={e => set('content', e.target.value)} onPaste={onPaste} placeholder="Tulis catatan. Gambar bisa ditempel langsung (Ctrl/Cmd + V)." />
        {form.images.length > 0 && <div className="au-row au-wrap" style={{ gap: 8 }}>
          {form.images.map((img, i) => (
            <span key={i} style={{ position: 'relative' }}>
              <button type="button" onClick={() => setLightbox(img)} aria-label={`Lihat gambar ${i + 1}`} style={{ border: 0, padding: 0, background: 'none', cursor: 'zoom-in' }}><img src={img} alt="" style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: 12, border: '1px solid var(--line)' }} /></button>
              <button type="button" aria-label={`Hapus gambar ${i + 1}`} onClick={() => set('images', form.images.filter((_, k) => k !== i))} style={{ position: 'absolute', top: -8, right: -8, width: 26, height: 26, borderRadius: '50%', background: 'var(--bad)', color: '#fff', border: '2px solid var(--surface)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}><Icon name="x" size={12} stroke={2.6} /></button>
            </span>
          ))}
        </div>}
      </div>
      {members.length > 0 && <div className="au-col" style={{ gap: 6 }}><span className="lbl">PIC</span>
        <div className="au-row au-wrap" style={{ gap: 6 }}>{members.map(m => <button key={m._id || m.name} type="button" className="au-chip" aria-pressed={form.picTags.includes(m.name)} onClick={() => togglePic(m.name)}>{m.name}</button>)}</div></div>}
      <label className="au-igr" style={{ border: '1px solid var(--line)', borderRadius: 16 }}><span className="k">Sematkan di atas grup</span><input type="checkbox" className="au-sw" style={{ marginLeft: 'auto' }} checked={form.pinned} onChange={e => set('pinned', e.target.checked)} /></label>
      {editing && (confirmDel
        ? <div className="au-row au-wrap p-bad" style={{ borderRadius: 14, padding: 12, gap: 10 }}><span className="au-small" style={{ flex: 1 }}>Hapus “{editing.title}”?</span><button type="button" className="btn btn-sm" onClick={() => setConfirmDel(false)}>Batal</button><button type="button" className="btn btn-danger btn-sm" disabled={saving} onClick={del}>Ya, hapus</button></div>
        : <button type="button" className="btn btn-danger" style={{ alignSelf: 'flex-start' }} onClick={() => setConfirmDel(true)}><Icon name="trash" size={15} />Hapus catatan</button>)}
      <Lightbox src={lightbox} onClose={() => setLightbox(null)} />
    </Sheet>
  )
}

export default function NotesPage() {
  const { year } = useYear()
  const [notes, setNotes] = useState<Note[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [cats, setCats] = useState<Cat[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<string>('all')
  const [sel, setSel] = useState<string | null>(null)
  const [readerOpen, setReaderOpen] = useState(false)   // HP: pembaca sebagai sheet
  const [sheet, setSheet] = useState<{ note: Note | null; cat: string } | null>(null)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [wide, setWide] = useState(false)

  const load = useCallback(async () => {
    setFailed(false)
    try { const d = await send('/api/notes', 'GET'); setNotes(Array.isArray(d.data) ? d.data : []) } catch { setFailed(true); setNotes(n => n ?? []) }
  }, [])
  useEffect(() => {
    load()
    getConfig().then((c: any) => setCats((c?.activityCategories || []).filter((x: any) => x.active))).catch(() => {})
    fetch('/api/users').then(r => (r.ok ? r.json() : { data: [] })).then(d => setMembers((d.data || []).filter((u: any) => u.active !== false))).catch(() => {})
    try { const c = localStorage.getItem(CAT_KEY); if (c) setCat(c) } catch {}
    const mq = window.matchMedia('(min-width: 1000px)')
    const on = () => setWide(mq.matches); on(); mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [load])
  const pickCat = (k: string) => { setCat(k); try { localStorage.setItem(CAT_KEY, k) } catch {} }

  async function update(n: Note, patch: Record<string, unknown>, msg: string) {
    const prev = notes
    setNotes(list => (list || []).map(x => (x._id === n._id ? { ...x, ...patch } : x)))
    try { await send(`/api/notes/${n._id}`, 'PATCH', patch); toast.success(msg) } catch (e: any) { setNotes(prev); toast.error(e.message) }
  }

  const catOf = (k: string) => cats.find(c => c.key === k)
  const catName = (k: string) => catOf(k)?.label || k || 'Lainnya'
  const catColor = (k: string) => catOf(k)?.color || 'var(--muted)'
  const inYear = notesForYear(notes || [], year)
  const searched = inYear.filter(n => matches(n, q))
  const counts = catCounts(searched)
  const shown = searched.filter(n => cat === 'all' || n.category === cat || (cat === '__orphan' && !catOf(n.category)))
  const pinned = sortNotes(shown.filter(n => n.pinned))
  const months = monthGroups(shown.filter(n => !n.pinned))
  const orphanCount = searched.filter(n => !catOf(n.category)).length
  const defaultCat = (cat !== 'all' && cat !== '__orphan' ? cat : cats[0]?.key) || 'Others'
  const current = shown.find(n => n._id === sel) || (wide ? pinned[0] || months[0]?.items[0] : null) || null

  function openNote(n: Note) { setSel(n._id); if (!wide) setReaderOpen(true) }

  const card = (n: Note, i: number) => {
    const d = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(n.date || ''))
    const wd = d ? HARI[new Date(Number(d[1]), Number(d[2]) - 1, Number(d[3])).getDay()] : ''
    return (
      <li key={n._id} style={{ ['--i' as any]: Math.min(i, 12), ['--cc' as any]: catColor(n.category) }}>
        <button type="button" className={`nt-item${current?._id === n._id && wide ? ' on' : ''}`} aria-current={current?._id === n._id && wide ? 'true' : undefined} onClick={() => openNote(n)}>
          <span className="nt-stamp" aria-hidden="true"><b>{d ? Number(d[3]) : '–'}</b><small>{wd}</small></span>
          <span className="nt-body">
            <span className="nt-cat"><i />{catName(n.category)}</span>
            <b className="nt-ttl">{n.title}</b>
            {n.content && <span className="nt-ex">{n.content}</span>}
            <span className="nt-foot">
              {n.picTags?.length > 0 && <span className="au-avs">{n.picTags.slice(0, 3).map((p: string, k: number) => <span key={p} className={`au-av s c${(k % 7) + 1}`} title={p}>{initials(p)}</span>)}</span>}
              {n.images?.length > 0 && <span className="nt-img">{n.images.length} gambar</span>}
              {n.authorName && <span>{String(n.authorName).split(' ')[0]}</span>}
            </span>
          </span>
          {n.images?.[0] && <img className="nt-thumb" src={n.images[0]} alt="" loading="lazy" />}
        </button>
      </li>
    )
  }

  const reader = current && (
    <article className="nt-reader" style={{ ['--cc' as any]: catColor(current.category) }} aria-label={current.title}>
      <div className="nt-rtop">
        <span className="nt-cat"><i />{catName(current.category)}{current.pinned ? ' · disematkan' : ''}</span>
        <div className="au-row" style={{ gap: 6 }}>
          <button type="button" className="btn btn-icon btn-sm au-tap" aria-pressed={!!current.pinned} aria-label={current.pinned ? 'Lepas sematan' : 'Sematkan'} title={current.pinned ? 'Lepas sematan' : 'Sematkan'} onClick={() => update(current, { pinned: !current.pinned }, current.pinned ? 'Sematan dilepas' : 'Disematkan')}><Icon name="pin" size={15} /></button>
          <button type="button" className="btn btn-sm au-tap" onClick={() => { setReaderOpen(false); setSheet({ note: current, cat: current.category }) }}><Icon name="edit" size={15} />Edit</button>
        </div>
      </div>
      <h2 className="nt-rttl">{current.title}</h2>
      <div className="nt-rmeta">
        <span>{fmtD(current.date) || 'Tanpa tanggal'}</span>
        {current.authorName && <span>Ditulis {current.authorName}</span>}
      </div>
      {current.picTags?.length > 0 && <div className="au-row au-wrap" style={{ gap: 6 }}>{current.picTags.map((p: string, k: number) => <span key={p} className="nt-pic"><span className={`au-av s c${(k % 7) + 1}`}>{initials(p)}</span>{p}</span>)}</div>}
      {current.content ? <div className="nt-rtext">{current.content}</div> : <p className="au-muted au-small">Belum ada isi catatan.</p>}
      {current.images?.length > 0 && <div className="nt-gal">{current.images.map((img: string, i: number) => <button key={i} type="button" onClick={() => setLightbox(img)} aria-label={`Perbesar gambar ${i + 1}`}><img src={img} alt="" loading="lazy" /></button>)}</div>}
      <label className="au-row au-xs au-muted nt-move" style={{ gap: 8 }}>Pindah kategori
        <select className="input input-sm" style={{ width: 'auto', minHeight: 34 }} value={current.category} onChange={e => update(current, { category: e.target.value }, `Dipindah ke ${catName(e.target.value)}`)}>
          {(catOf(current.category) ? cats : [...cats, { key: current.category, label: current.category }]).map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select></label>
    </article>
  )

  return (
    <div className="au-page">
      {sheet && <NoteSheet editing={sheet.note} defaultCat={sheet.cat} cats={cats} members={members} onClose={() => setSheet(null)} onSaved={load} />}
      <Lightbox src={lightbox} onClose={() => setLightbox(null)} />
      {!wide && readerOpen && current && <Sheet open title="Catatan" onClose={() => setReaderOpen(false)}>{reader}</Sheet>}
      <div className="au-view au-anim">
        <PageHeader eyebrow={`Activities · ${inYear.length} catatan di ${year}`} title="[Team] Notes" actions={
          <button type="button" className="btn btn-primary" onClick={() => setSheet({ note: null, cat: defaultCat })}><Icon name="plus" size={16} stroke={2.2} />Catatan baru</button>
        } />
        <div className="nt-tools">
          <label className="input au-row" style={{ gap: 8, padding: '0 12px' }}><Icon name="search" size={16} />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari judul, isi atau PIC" aria-label="Cari catatan" style={{ border: 0, background: 'transparent', flex: 1, minHeight: 42, outline: 0, color: 'var(--ink)' }} />
            {q && <button type="button" className="au-link au-xs" onClick={() => setQ('')}>Hapus</button>}</label>
          <div className="au-chips" role="group" aria-label="Kategori">
            <button type="button" className="au-chip" aria-pressed={cat === 'all'} onClick={() => pickCat('all')}>Semua <span style={{ opacity: .6 }}>{searched.length}</span></button>
            {cats.map(c => <button key={c.key} type="button" className="au-chip nt-chip" aria-pressed={cat === c.key} onClick={() => pickCat(c.key)} style={{ ['--cc' as any]: c.color || 'var(--muted)' }}><i />{c.label} <span style={{ opacity: .6 }}>{counts[c.key] || 0}</span></button>)}
            {orphanCount > 0 && <button type="button" className="au-chip" aria-pressed={cat === '__orphan'} onClick={() => pickCat('__orphan')}>Lainnya <span style={{ opacity: .6 }}>{orphanCount}</span></button>}
          </div>
        </div>
        {failed && <div className="au-row au-wrap p-bad" role="alert" style={{ borderRadius: 14, padding: 12 }}><span className="au-small" style={{ flex: 1 }}>Catatan gagal dimuat.</span><button type="button" className="btn btn-sm" onClick={load}>Coba lagi</button></div>}

        {notes === null ? <div className="au-card">{[0, 1, 2].map(k => <div key={k} className="au-skel" style={{ width: `${85 - k * 20}%` }} />)}</div>
          : !shown.length ? <div className="au-card"><Empty
              title={q ? 'Tidak ada yang cocok' : cat !== 'all' ? `Belum ada catatan ${catName(cat)}` : `Belum ada catatan di ${year}`}
              text={q ? `Tidak ada catatan di ${year} yang memuat “${q}”.` : 'Catat hasil rapat, keputusan, atau temuan supaya seluruh tim bisa membacanya.'}
              action={q ? <button type="button" className="btn" onClick={() => setQ('')}>Hapus pencarian</button> : <button type="button" className="btn btn-primary" onClick={() => setSheet({ note: null, cat: defaultCat })}>Catatan baru</button>} /></div>
          : <div className="nt-split">
            <div className="nt-feed">
              {pinned.length > 0 && <section aria-label="Disematkan">
                <h3 className="nt-mh"><Icon name="pin" size={14} />Disematkan<span>{pinned.length}</span></h3>
                <ul className="nt-list">{pinned.map(card)}</ul>
              </section>}
              {months.map(m => <section key={m.key} aria-label={m.label}>
                <h3 className="nt-mh">{m.label}<span>{m.items.length}</span></h3>
                <ul className="nt-list">{m.items.map(card)}</ul>
              </section>)}
            </div>
            {wide && <div className="nt-pane">{reader || <div className="nt-reader au-muted">Pilih catatan untuk dibaca.</div>}</div>}
          </div>}
      </div>
    </div>
  )
}
