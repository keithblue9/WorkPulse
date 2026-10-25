'use client'
import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import { getConfig } from '@/lib/configCache'
import { userRolesOf } from '@/lib/perms'
import { Empty, Icon, PageHeader, Sheet } from '@/components/ui'

type Link = Record<string, any>
type Cat = { key: string; label: string; color?: string }
const DEFAULT_CATS = ['General', 'Files', 'Tools', 'References', 'Reports', 'Social', 'Other']

// Disimpan di field `icon` seperti sebelumnya (kompatibel dengan data lama); tidak lagi ditampilkan.
function getIcon(url: string) {
  const u = String(url || '')
  if (u.includes('drive.google')) return '📁'
  if (u.includes('docs.google')) return '📄'
  if (u.includes('sheets.google') || u.includes('slides.google')) return '📊'
  if (u.includes('notion')) return '📓'
  if (u.includes('figma')) return '🎨'
  if (u.includes('github')) return '💻'
  if (u.includes('teams') || u.includes('microsoft')) return '💼'
  if (u.includes('zoom')) return '🔵'
  if (u.includes('youtube')) return '▶️'
  if (u.includes('slack')) return '💬'
  return '🔗'
}
function host(url: string) { try { return new URL(url).hostname.replace(/^www\./, '') } catch { return String(url || '') } }
const mono = (l: Link) => (String(l.title || host(l.url) || '?').trim()[0] || '?').toUpperCase()
const isHttp = (u: string) => /^https?:\/\//i.test(u.trim())

async function send(url: string, method: string, body?: unknown) {
  // no-store: GET /api/links boleh di-cache browser 30 dtk; setelah tambah/ubah daftar harus segar.
  const res = await fetch(url, { method, cache: 'no-store', headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error || 'Gagal menyimpan, coba lagi')
  return data
}

function LinkSheet({ editing, cats, userName, onClose, onSaved }: { editing: Link | null; cats: Cat[]; userName?: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    title: editing?.title || '', url: editing?.url || '', description: editing?.description || '',
    category: editing ? (editing.category || 'General') : (cats[0]?.label || 'General'), pinned: !!editing?.pinned,
  })
  const [saving, setSaving] = useState(false), [tried, setTried] = useState(false), [confirmDel, setConfirmDel] = useState(false)
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
  const opts = form.category && !cats.some(c => c.label === form.category) ? [...cats, { key: form.category, label: form.category }] : cats
  const titleErr = tried && !form.title.trim() ? 'Judul wajib diisi' : ''
  const urlErr = tried ? (!form.url.trim() ? 'URL wajib diisi' : !isHttp(form.url) ? 'URL harus diawali http:// atau https://' : '') : ''

  async function save() {
    setTried(true)
    if (!form.title.trim() || !form.url.trim() || !isHttp(form.url)) { toast.error('Periksa judul dan URL'); return }
    setSaving(true)
    try {
      const body = { ...form, title: form.title.trim(), url: form.url.trim(), icon: getIcon(form.url), ...(editing ? {} : { addedBy: userName }) }
      await send(editing ? `/api/links/${editing._id}` : '/api/links', editing ? 'PATCH' : 'POST', body)
      toast.success(editing ? 'Link diperbarui' : 'Link ditambahkan'); onSaved(); onClose()
    } catch (e: any) { toast.error(e.message) } finally { setSaving(false) }
  }
  async function del() {
    if (!editing) return
    setSaving(true)
    try { await send(`/api/links/${editing._id}`, 'DELETE'); toast.success('Link dihapus'); onSaved(); onClose() } catch (e: any) { toast.error(e.message) } finally { setSaving(false) }
  }

  return (
    <Sheet open title={editing ? 'Edit link' : 'Link baru'} onClose={onClose} onSave={save} saveDisabled={saving} saveLabel={saving ? 'Menyimpan…' : 'Simpan'}>
      <label className="au-col" style={{ gap: 6 }}><span className="lbl">Judul *</span>
        <input className="input" value={form.title} maxLength={200} onChange={e => set('title', e.target.value)} aria-invalid={!!titleErr} placeholder="Nama link" />
        {titleErr && <span role="alert" className="au-xs" style={{ color: 'var(--bad)', fontWeight: 600 }}>{titleErr}</span>}</label>
      <label className="au-col" style={{ gap: 6 }}><span className="lbl">URL *</span>
        <input className="input" type="url" inputMode="url" value={form.url} onChange={e => set('url', e.target.value)} aria-invalid={!!urlErr} placeholder="https://" />
        {urlErr && <span role="alert" className="au-xs" style={{ color: 'var(--bad)', fontWeight: 600 }}>{urlErr}</span>}</label>
      <label className="au-col" style={{ gap: 6 }}><span className="lbl">Deskripsi</span>
        <input className="input" value={form.description} maxLength={300} onChange={e => set('description', e.target.value)} placeholder="Deskripsi singkat" /></label>
      <div className="au-col" style={{ gap: 6 }}><span className="lbl">Kategori</span>
        <div className="au-chips wrap" role="group" aria-label="Kategori">{opts.map(c => <button key={c.key} type="button" className="au-chip" aria-pressed={form.category === c.label} onClick={() => set('category', c.label)}>{c.label}</button>)}</div></div>
      <label className="au-igr" style={{ border: '1px solid var(--line)', borderRadius: 16 }}><span className="k">Sematkan di atas</span><input type="checkbox" className="au-sw" style={{ marginLeft: 'auto' }} checked={form.pinned} onChange={e => set('pinned', e.target.checked)} /></label>
      {isHttp(form.url) && <div className="au-lcard" style={{ pointerEvents: 'none' }} aria-label="Pratinjau">
        <div className="main"><span className="au-lic" style={{ background: tintOf(cats, form.category), color: inkOf(cats, form.category) }}>{mono(form)}</span>
          <span className="au-col" style={{ gap: 2, minWidth: 0 }}><b className="t">{form.title || 'Pratinjau link'}</b><span className="h">{host(form.url)}</span></span></div>
      </div>}
      {editing && (confirmDel
        ? <div className="au-row au-wrap p-bad" style={{ borderRadius: 14, padding: 12, gap: 10 }}><span className="au-small" style={{ flex: 1 }}>Hapus “{editing.title}”?</span><button type="button" className="btn btn-sm" onClick={() => setConfirmDel(false)}>Batal</button><button type="button" className="btn btn-danger btn-sm" disabled={saving} onClick={del}>Ya, hapus</button></div>
        : <button type="button" className="btn btn-danger" style={{ alignSelf: 'flex-start' }} onClick={() => setConfirmDel(true)}><Icon name="trash" size={15} />Hapus link</button>)}
    </Sheet>
  )
}

const colorOf = (cats: Cat[], label: string) => cats.find(c => c.label === label || c.key === label)?.color || 'var(--accent)'
const tintOf = (cats: Cat[], label: string) => `color-mix(in srgb, ${colorOf(cats, label)} 18%, var(--surface))`
const inkOf = (cats: Cat[], label: string) => `color-mix(in srgb, ${colorOf(cats, label)} 75%, var(--ink))`

export default function LinksPage() {
  const { data: session } = useSession(); const user = session?.user as any
  const guest = !!user && userRolesOf(user).every(r => r === 'guest')
  const [links, setLinks] = useState<Link[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [cats, setCats] = useState<Cat[]>([])
  const [sheet, setSheet] = useState<{ link: Link | null } | null>(null)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('Semua')

  const load = useCallback(async () => {
    setFailed(false)
    try { const d = await send('/api/links', 'GET'); setLinks(Array.isArray(d?.data) ? d.data : []) } catch { setFailed(true); setLinks(l => l ?? []) }
  }, [])
  useEffect(() => {
    load()
    getConfig().then((c: any) => {
      const list = Array.isArray(c?.linkCategories) ? c.linkCategories.filter((x: any) => x?.active) : []
      setCats(list.length ? list : DEFAULT_CATS.map(k => ({ key: k, label: k })))
    }).catch(() => setCats(DEFAULT_CATS.map(k => ({ key: k, label: k }))))
  }, [load])

  async function togglePin(l: Link) {
    const prev = links
    setLinks(list => (list || []).map(x => (x._id === l._id ? { ...x, pinned: !l.pinned } : x)))
    try { await send(`/api/links/${l._id}`, 'PATCH', { pinned: !l.pinned }); toast.success(l.pinned ? 'Sematan dilepas' : 'Disematkan') } catch (e: any) { setLinks(prev); toast.error(e.message) }
  }
  function trackClick(l: Link) {
    const n = (l.clickCount || 0) + 1
    setLinks(list => (list || []).map(x => (x._id === l._id ? { ...x, clickCount: n } : x)))
    fetch(`/api/links/${l._id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clickCount: n }), keepalive: true }).catch(() => {})
  }

  const all = links || []
  const used = Array.from(new Set(all.map(l => l?.category || 'General')))
  const chips = ['Semua', ...cats.map(c => c.label).filter(l => used.includes(l)), ...used.filter(u => !cats.some(c => c.label === u))]
  const needle = q.trim().toLowerCase()
  const shown = all.filter(l => (cat === 'Semua' || (l?.category || 'General') === cat)
    && (!needle || [l?.title, l?.description, l?.url].some(s => String(s || '').toLowerCase().includes(needle))))
  const pinned = shown.filter(l => l.pinned), rest = shown.filter(l => !l.pinned)

  const card = (l: Link, i: number) => {
    const c = l?.category || 'General'
    return (
      <article key={l._id || i} className="au-lcard rise" style={{ ['--d' as any]: Math.min(i, 8) }}>
        <a className="main" href={l.url} target="_blank" rel="noopener noreferrer" onClick={() => trackClick(l)} aria-label={`Buka ${l.title || host(l.url)} di tab baru`}>
          <span className="au-lic" style={{ background: tintOf(cats, c), color: inkOf(cats, c) }}>{mono(l)}</span>
          <span className="au-col" style={{ gap: 2, minWidth: 0 }}><b className="t">{l.title || '(tanpa judul)'}</b><span className="h">{host(l.url)}</span></span>
          <Icon name="ext" size={16} style={{ marginLeft: 'auto', color: 'var(--muted)' }} />
        </a>
        {l.description && <p className="d">{l.description}</p>}
        <div className="ft">
          <span className="au-tag"><i style={{ background: colorOf(cats, c) }} />{c}</span>
          {l.clickCount > 0 && <span className="au-xs au-muted" style={{ fontFamily: 'var(--mono)' }}>{l.clickCount}× dibuka</span>}
          {!guest && <span className="au-row" style={{ gap: 4, marginLeft: 'auto' }}>
            <button type="button" className="btn btn-icon btn-sm" aria-pressed={!!l.pinned} aria-label={l.pinned ? `Lepas sematan ${l.title}` : `Sematkan ${l.title}`} title={l.pinned ? 'Lepas sematan' : 'Sematkan'} onClick={() => togglePin(l)} style={l.pinned ? { background: 'var(--volt)', color: 'var(--on-volt)', borderColor: 'var(--volt)' } : undefined}><Icon name="pin" size={15} /></button>
            <button type="button" className="btn btn-icon btn-sm" aria-label={`Edit ${l.title}`} title="Edit" onClick={() => setSheet({ link: l })}><Icon name="edit" size={15} /></button>
          </span>}
        </div>
      </article>
    )
  }

  return (
    <div className="au-page">
      {sheet && <LinkSheet editing={sheet.link} cats={cats} userName={user?.name} onClose={() => setSheet(null)} onSaved={load} />}
      <div className="au-view au-anim">
        <PageHeader eyebrow={`Workspace · ${all.length} link`} title="Link Hub" actions={!guest &&
          <button type="button" className="btn btn-primary" onClick={() => setSheet({ link: null })}><Icon name="plus" size={16} stroke={2.2} />Link baru</button>} />
        <div className="au-col rise" style={{ gap: 10 }}>
          <label className="input au-row" style={{ gap: 8, padding: '0 12px', maxWidth: 520 }}><Icon name="search" size={16} />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari judul, deskripsi atau alamat" aria-label="Cari link" style={{ border: 0, background: 'transparent', flex: 1, minHeight: 42, outline: 0, color: 'var(--ink)' }} /></label>
          {chips.length > 2 && <div className="au-chips" role="group" aria-label="Filter kategori">{chips.map(c => <button key={c} type="button" className="au-chip" aria-pressed={cat === c} onClick={() => setCat(c)}>{c}</button>)}</div>}
        </div>
        {failed && <div className="au-row au-wrap p-bad" role="alert" style={{ borderRadius: 14, padding: 12 }}><span className="au-small" style={{ flex: 1 }}>Link gagal dimuat.</span><button type="button" className="btn btn-sm" onClick={load}>Coba lagi</button></div>}

        {links === null ? <div className="au-lgrid">{[0, 1, 2].map(k => <div key={k} className="au-lcard"><div className="au-skel" style={{ width: '50%' }} /><div className="au-skel" /></div>)}</div>
          : !shown.length ? <div className="au-card">{all.length
            ? <Empty title="Tidak ada yang cocok" text="Ubah kata kunci atau kategori." action={<button type="button" className="btn" onClick={() => { setQ(''); setCat('Semua') }}>Reset filter</button>} />
            : <Empty title="Belum ada link" text={guest ? 'Link tim akan tampil di sini.' : 'Simpan dokumen, tools dan referensi tim di satu tempat.'} action={!guest ? <button type="button" className="btn btn-primary" onClick={() => setSheet({ link: null })}>Tambah link pertama</button> : undefined} />}</div>
          : <>
            {pinned.length > 0 && <section className="au-col" style={{ gap: 10 }}><span className="lbl">Disematkan</span><div className="au-lgrid">{pinned.map(card)}</div></section>}
            {rest.length > 0 && <section className="au-col" style={{ gap: 10 }}>{pinned.length > 0 && <span className="lbl">Semua link</span>}<div className="au-lgrid">{rest.map(card)}</div></section>}
          </>}
      </div>
    </div>
  )
}
