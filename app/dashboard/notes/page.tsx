'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { getConfig } from '@/lib/configCache'
import { Empty, Icon, PageHeader, Sheet, Portal } from '@/components/ui'
import { useYear } from '@/lib/year'
import { groupNotes, matches, notesForYear } from '@/lib/notesView'

type Note = Record<string, any>
type Cat = { key: string; label: string; color?: string }
const COLLAPSE_KEY = 'wins-notes-collapsed'
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
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [sheet, setSheet] = useState<{ note: Note | null; cat: string } | null>(null)
  const [lightbox, setLightbox] = useState<string | null>(null)

  const load = useCallback(async () => {
    setFailed(false)
    try { const d = await send('/api/notes', 'GET'); setNotes(Array.isArray(d.data) ? d.data : []) } catch { setFailed(true); setNotes(n => n ?? []) }
  }, [])
  useEffect(() => {
    load()
    getConfig().then((c: any) => setCats((c?.activityCategories || []).filter((x: any) => x.active))).catch(() => {})
    fetch('/api/users').then(r => (r.ok ? r.json() : { data: [] })).then(d => setMembers((d.data || []).filter((u: any) => u.active !== false))).catch(() => {})
    try { setCollapsed(JSON.parse(localStorage.getItem(COLLAPSE_KEY) || '{}') || {}) } catch {}
  }, [load])
  const toggle = (k: string) => setCollapsed(c => { const n = { ...c, [k]: !c[k] }; try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify(n)) } catch {} return n })

  async function update(n: Note, patch: Record<string, unknown>, msg: string) {
    const prev = notes
    setNotes(list => (list || []).map(x => (x._id === n._id ? { ...x, ...patch } : x)))
    try { await send(`/api/notes/${n._id}`, 'PATCH', patch); toast.success(msg) } catch (e: any) { setNotes(prev); toast.error(e.message) }
  }

  const inYear = notesForYear(notes || [], year)
  const shown = inYear.filter(n => matches(n, q))
  const groups = groupNotes(shown, cats)
  const catName = (k: string) => cats.find(c => c.key === k)?.label || k
  const defaultCat = cats[0]?.key || 'Others'

  return (
    <div className="au-page">
      {sheet && <NoteSheet editing={sheet.note} defaultCat={sheet.cat} cats={cats} members={members} onClose={() => setSheet(null)} onSaved={load} />}
      <Lightbox src={lightbox} onClose={() => setLightbox(null)} />
      <div className="au-view au-anim">
        <PageHeader eyebrow={`Activities · ${inYear.length} catatan di ${year}`} title="[Team] Notes" actions={
          <button type="button" className="btn btn-primary" onClick={() => setSheet({ note: null, cat: defaultCat })}><Icon name="plus" size={16} stroke={2.2} />Catatan baru</button>
        } />
        <label className="input au-row rise" style={{ gap: 8, padding: '0 12px', maxWidth: 520 }}><Icon name="search" size={16} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari judul, isi atau PIC" aria-label="Cari catatan" style={{ border: 0, background: 'transparent', flex: 1, minHeight: 42, outline: 0, color: 'var(--ink)' }} /></label>
        {failed && <div className="au-row au-wrap p-bad" role="alert" style={{ borderRadius: 14, padding: 12 }}><span className="au-small" style={{ flex: 1 }}>Catatan gagal dimuat.</span><button type="button" className="btn btn-sm" onClick={load}>Coba lagi</button></div>}

        {notes === null ? <div className="au-col" style={{ gap: 10 }}>{[0, 1].map(k => <div key={k} className="au-card"><div className="au-skel" style={{ width: '40%' }} /><div className="au-skel" /></div>)}</div>
          : !groups.length ? <div className="au-card"><Empty title="Belum ada kategori" text="Tambahkan kategori activities di Configuration." /></div>
          : <>
            {q && !shown.length && <div className="au-card"><Empty title="Tidak ada yang cocok" text={`Tidak ada catatan di ${year} yang memuat “${q}”.`} action={<button type="button" className="btn" onClick={() => setQ('')}>Hapus pencarian</button>} /></div>}
            <div className="au-ngrid">
              {groups.filter(g => !q || g.items.length).map((g, gi) => {
                const col = !!collapsed[g.key]
                return (
                  <section key={g.key} className="au-ngrp rise" style={{ ['--d' as any]: Math.min(gi, 8) }}>
                    <button type="button" className="au-nhd" aria-expanded={!col} onClick={() => toggle(g.key)}>
                      <span className="au-row" style={{ gap: 10 }}><i className="tag" style={{ background: g.color }} /><b>{g.label}</b><span className="au-xs au-muted" style={{ fontFamily: 'var(--mono)' }}>{g.items.length}</span></span>
                      <span style={{ transform: `rotate(${col ? -90 : 0}deg)`, transition: 'transform .2s', display: 'grid' }}><Icon name="chev" size={18} /></span>
                    </button>
                    {!col && <>
                      {g.items.map(n => (
                        <article key={n._id} className="au-note">
                          <button type="button" className="au-note-main" onClick={() => setSheet({ note: n, cat: n.category })}>
                            <span className="au-row au-wrap" style={{ gap: 8 }}>{n.pinned && <span className="au-pin">PIN</span>}<b>{n.title}</b></span>
                            {n.content && <span className="au-note-body">{n.content}</span>}
                          </button>
                          <div className="au-note-side">
                            <button type="button" className="btn btn-icon btn-sm" aria-pressed={!!n.pinned} aria-label={n.pinned ? `Lepas sematan ${n.title}` : `Sematkan ${n.title}`} title={n.pinned ? 'Lepas sematan' : 'Sematkan'} onClick={() => update(n, { pinned: !n.pinned }, n.pinned ? 'Sematan dilepas' : 'Disematkan')} style={n.pinned ? { background: 'var(--volt)', color: 'var(--on-volt)', borderColor: 'var(--volt)' } : undefined}><Icon name="pin" size={15} /></button>
                            <label className="au-row au-xs au-muted" style={{ gap: 6 }}>Pindah
                              <select className="input input-sm" style={{ width: 'auto', minHeight: 32 }} value={n.category} aria-label={`Pindahkan ${n.title}`} onChange={e => update(n, { category: e.target.value }, `Dipindah ke ${catName(e.target.value)}`)}>
                                {(cats.some(c => c.key === n.category) ? cats : [...cats, { key: n.category, label: n.category }]).map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                              </select></label>
                          </div>
                          {n.images?.length > 0 && <div className="au-row au-wrap" style={{ gap: 6, gridColumn: '1 / -1' }}>
                            {n.images.slice(0, 4).map((img: string, i: number) => <button key={i} type="button" onClick={() => setLightbox(img)} aria-label={`Lihat gambar ${i + 1} dari ${n.title}`} style={{ border: 0, padding: 0, background: 'none', cursor: 'zoom-in' }}><img src={img} alt="" loading="lazy" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--line)' }} /></button>)}
                            {n.images.length > 4 && <span className="au-tag">+{n.images.length - 4}</span>}
                          </div>}
                          <div className="au-row au-wrap au-xs au-muted" style={{ gap: 8, gridColumn: '1 / -1' }}>
                            {n.picTags?.length > 0 && <span className="au-avs">{n.picTags.slice(0, 4).map((p: string, i: number) => <span key={p} className={`au-av s c${(i % 7) + 1}`} title={p}>{initials(p)}</span>)}</span>}
                            {n.categoryTags?.filter((k: string) => k !== n.category).slice(0, 3).map((k: string) => <span key={k} className="au-tag">{catName(k)}</span>)}
                            <span>{fmtD(n.date)}{n.authorName ? ` · ${String(n.authorName).split(' ')[0]}` : ''}</span>
                          </div>
                        </article>
                      ))}
                      {!g.items.length && <div className="au-note au-muted au-small" style={{ display: 'flex' }}>Belum ada catatan di {g.label}{year ? ` (${year})` : ''}.</div>}
                      {g.key !== '__orphan' && <button type="button" className="au-nadd" onClick={() => setSheet({ note: null, cat: g.key })}><Icon name="plus" size={14} />Tambah ke {g.label}</button>}
                    </>}
                  </section>
                )
              })}
            </div>
          </>}
      </div>
    </div>
  )
}
