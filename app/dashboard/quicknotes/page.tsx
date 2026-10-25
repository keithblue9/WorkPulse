'use client'
import { useEffect, useState, useRef } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import { ensurePushSubscription } from '@/lib/pushClient'
import { reminderLabel } from '@/lib/reminderDue'
import { Empty, Icon, PageHeader, Pill, Sheet } from '@/components/ui'

type ItemType = 'bullet' | 'number' | 'text'
type Item = { id: string; text: string; checked: boolean; type: ItemType }
type Reminder = { enabled: boolean; mode: 'once' | 'daily' | 'weekly' | 'biweekly' | 'monthly'; datetime: string; time: string; weekday?: number | null; dayOfMonth?: number | null; anchorDate?: string }
type QuickNote = {
  _id: string; title: string; items: Item[]; reminder: Reminder
  ownerEmail: string; sharedWith: string[]; lastEditedBy: string; updatedAt: string
}

function uid() { return Math.random().toString(36).slice(2, 9) }
function emptyReminder(): Reminder { return { enabled: false, mode: 'once', datetime: '', time: '', weekday: null, dayOfMonth: null, anchorDate: '' } }

export default function QuickNotesPage() {
  const { data: session } = useSession()
  const user = session?.user as any
  const myEmail = user?.email

  const [notes, setNotes] = useState<QuickNote[]>([])
  const [members, setMembers] = useState<any[]>([])
  // Filter diri sendiri saat render, bukan saat load — sesi bisa belum siap
  // ketika data pertama kali diambil sehingga diri sendiri ikut muncul.
  const shareMembers = members.filter((m: any) => !myEmail || m.email !== myEmail)
  const [loading, setLoading] = useState(true)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [shareOpenId, setShareOpenId] = useState<string | null>(null)
  const [justCreatedId, setJustCreatedId] = useState<string | null>(null)
  const [reminderOpenId, setReminderOpenId] = useState<string | null>(null)
  const [confirmDelId, setConfirmDelId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'mine' | 'shared' | 'reminder'>('all')
  const checkedOnce = useRef(false)

  async function load() {
    try {
      const [n, u] = await Promise.all([
        fetch('/api/quicknotes').then(r => r.json()),
        fetch('/api/users').then(r => r.json()),
      ])
      setNotes(n.data || [])
      setMembers((u.data || []).filter((m: any) => m.active !== false))
    } catch { toast.error('Gagal memuat catatan personal') }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  useEffect(() => {
    if (checkedOnce.current) return
    checkedOnce.current = true
    ensurePushSubscription()
    const id = setInterval(() => { fetch('/api/quicknotes/check-reminders', { method: 'POST' }).catch(() => {}) }, 60000)
    fetch('/api/quicknotes/check-reminders', { method: 'POST' }).catch(() => {})
    return () => clearInterval(id)
  }, [])

  async function createNote() {
    // Judul sengaja dikosongkan supaya user langsung mengetik (input di-autofocus),
    // tidak perlu menghapus teks "Catatan baru" dulu.
    const res = await fetch('/api/quicknotes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: '', items: [{ id: uid(), text: '', checked: false, type: 'bullet' }] }) })
    const d = await res.json()
    if (d.data) { setNotes(n => [d.data, ...n]); setDetailId(d.data._id); setJustCreatedId(d.data._id) }
    else toast.error(d.error || 'Gagal membuat catatan')
  }

  // Perubahan per catatan dikirim berurutan; hanya respons permintaan TERAKHIR yang diterapkan,
  // supaya respons lama tidak menimpa ketikan yang lebih baru (mis. item hilang setelah menambah baris).
  const queue = useRef<Record<string, Promise<void>>>({})
  const seq = useRef<Record<string, number>>({})
  function patchNote(id: string, updates: Partial<QuickNote>, optimistic = true): Promise<void> {
    if (optimistic) setNotes(n => n.map(x => x._id === id ? { ...x, ...updates } as QuickNote : x))
    const mine = (seq.current[id] = (seq.current[id] || 0) + 1)
    const run = async () => {
      try {
        const res = await fetch('/api/quicknotes', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...updates }) })
        const d = await res.json().catch(() => ({}))
        // Judul & isi lokal tetap dipakai (bisa sudah diketik lagi sejak permintaan dikirim);
        // dari server hanya metadata (share, reminder, penyunting terakhir, waktu).
        if (d.data) { if (seq.current[id] === mine) setNotes(n => n.map(x => x._id === id ? { ...d.data, title: x.title, items: x.items } : x)) }
        else { toast.error(d.error || 'Gagal menyimpan catatan'); load() }
      } catch { toast.error('Gagal menyimpan catatan'); load() }
    }
    const p = (queue.current[id] || Promise.resolve()).then(run)
    queue.current[id] = p
    return p
  }

  async function deleteNote(id: string) {
    setConfirmDelId(null)
    const res = await fetch('/api/quicknotes', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    const d = await res.json()
    if (d.ok) { setNotes(n => n.filter(x => x._id !== id)); toast.success('Catatan dihapus') }
    else toast.error(d.error || 'Gagal menghapus')
  }

  function updateItems(note: QuickNote, items: Item[]) { patchNote(note._id, { items }) }
  function addItem(note: QuickNote, type: ItemType) {
    updateItems(note, [...note.items, { id: uid(), text: '', checked: false, type }])
  }
  function setItemText(note: QuickNote, itemId: string, text: string) {
    setNotes(n => n.map(x => x._id === note._id ? { ...x, items: x.items.map(i => i.id === itemId ? { ...i, text } : i) } : x))
  }
  function commitItemText(note: QuickNote) {
    const fresh = notes.find(x => x._id === note._id)
    if (fresh) patchNote(note._id, { items: fresh.items }, false)
  }
  function toggleItemChecked(note: QuickNote, itemId: string) {
    updateItems(note, note.items.map(i => i.id === itemId ? { ...i, checked: !i.checked } : i))
  }
  function removeItem(note: QuickNote, itemId: string) {
    updateItems(note, note.items.filter(i => i.id !== itemId))
  }

  async function saveReminder(note: QuickNote, r: Reminder) {
    if (r.enabled) {
      const perm = await ensurePushSubscription()
      if (!perm.ok) {
        const msg = perm.reason === 'denied'
          ? 'Notifikasi diblokir di browser. Reminder tetap tersimpan, tapi push notif tidak akan muncul sampai izin diaktifkan.'
          : 'Push notification tidak didukung di perangkat ini. Reminder tetap tersimpan sebagai pengingat di app.'
        toast(msg, { duration: 5000 })
      }
    }
    await patchNote(note._id, { reminder: r })
    setReminderOpenId(null)
    toast.success(r.enabled ? 'Reminder diset' : 'Reminder dimatikan')
  }

  async function saveShare(note: QuickNote, sharedWith: string[]) {
    await patchNote(note._id, { sharedWith })
    setShareOpenId(null)
    toast.success('Daftar share diperbarui')
  }

  const shown = notes.filter(n => filter === 'all' || (filter === 'mine' ? n.ownerEmail === myEmail : filter === 'shared' ? (n.ownerEmail !== myEmail || n.sharedWith?.length > 0) : n.reminder?.enabled))
  const counts = { all: notes.length, mine: notes.filter(n => n.ownerEmail === myEmail).length, shared: notes.filter(n => n.ownerEmail !== myEmail || n.sharedWith?.length > 0).length, reminder: notes.filter(n => n.reminder?.enabled).length }
  const closeDetail = () => { setDetailId(null); setReminderOpenId(null); setShareOpenId(null); setConfirmDelId(null) }

  return (
    <div className="au-page">
      <div className="au-view au-anim">
        <PageHeader eyebrow="Activities · pribadi, terlihat hanya oleh kamu & yang kamu share" title="[Personal] Notes" actions={
          <button type="button" className="btn btn-primary" onClick={createNote}><Icon name="plus" size={16} stroke={2.2} />Catatan baru</button>
        } />
        <div className="au-chips" role="group" aria-label="Filter catatan">
          {([['all', 'Semua'], ['mine', 'Milik saya'], ['shared', 'Dibagikan'], ['reminder', 'Ada reminder']] as const).map(([k, l]) => (
            <button key={k} type="button" className="au-chip" aria-pressed={filter === k} onClick={() => setFilter(k)}>{l} <span style={{ opacity: .6 }}>{counts[k]}</span></button>
          ))}
        </div>

        {loading ? <div className="au-grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 14 }}>{[0, 1, 2].map(k => <div key={k} className="au-card"><div className="au-skel" style={{ width: '55%' }} /><div className="au-skel" /><div className="au-skel" style={{ width: '35%' }} /></div>)}</div>
          : shown.length === 0 ? <div className="au-card"><Empty title={notes.length ? 'Tidak ada catatan di filter ini' : 'Belum ada catatan'} text={notes.length ? 'Pilih filter lain.' : 'Buat catatan atau to-do pertama kamu.'} action={<button type="button" className="btn btn-primary" onClick={createNote}>Catatan baru</button>} /></div>
          : <div className="au-grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 14 }}>
            {shown.map((note, k) => {
              const isOwner = note.ownerEmail === myEmail
              const isShared = note.sharedWith?.length > 0
              const checklist = note.items.filter(i => i.type !== 'text')
              const textCount = note.items.filter(i => i.type === 'text' && i.text.trim()).length
              const doneCount = checklist.filter(i => i.checked).length
              const total = checklist.length
              const progress = total > 0 ? Math.round((doneCount / total) * 100) : 0
              const preview = note.items.filter(i => i.text.trim()).slice(0, 3)
              return (
                <button type="button" key={note._id} className="au-qnote rise" style={{ ['--d' as any]: Math.min(k, 8) }} onClick={() => setDetailId(note._id)}>
                  <b className="t">{note.title || <span className="au-muted" style={{ fontStyle: 'italic', fontWeight: 500 }}>Tanpa judul</span>}</b>
                  {preview.length > 0 && <ul className="pv">{preview.map(i => <li key={i.id} className={i.checked ? 'done' : ''}><i className={i.type} />{i.text}</li>)}</ul>}
                  <span className="au-row au-wrap" style={{ gap: 6 }}>
                    {!isOwner && <span className="au-tag" style={{ background: 'var(--accent-soft)', color: 'var(--accent-ink)' }}><Icon name="user" size={12} />{note.ownerEmail.split('@')[0]}</span>}
                    {isOwner && isShared && <span className="au-tag"><Icon name="team" size={12} />{note.sharedWith.length} orang</span>}
                    {textCount > 0 && <span className="au-tag">{textCount} teks</span>}
                    {note.reminder?.enabled && <span className="au-tag" style={{ background: 'var(--warn-soft)', color: 'var(--warn)' }}><Icon name="bell" size={12} />{reminderLabel(note.reminder)}</span>}
                  </span>
                  {total > 0 && <span className="au-col" style={{ gap: 4, width: '100%' }}>
                    <span className="au-row au-between au-xs"><span className="au-muted">{doneCount}/{total} selesai</span><b style={{ color: doneCount === total ? 'var(--ok)' : 'var(--ink2)' }}>{doneCount === total ? 'Selesai' : `${progress}%`}</b></span>
                    <span className="au-track" style={{ height: 6 }}><i className="a" style={{ width: `${progress}%`, background: doneCount === total ? 'var(--ok)' : undefined }} /></span>
                  </span>}
                </button>
              )
            })}
          </div>}
      </div>

      {detailId && (() => {
        const note = notes.find(n => n._id === detailId)
        if (!note) return null
        const isOwner = note.ownerEmail === myEmail
        const canEdit = isOwner || note.sharedWith?.includes(myEmail)
        let numberCounter = 0
        return (
          <Sheet open title={isOwner ? 'Catatan' : `Catatan ${note.ownerEmail.split('@')[0]}`} onClose={closeDetail}>
            <input value={note.title} disabled={!canEdit} aria-label="Judul catatan"
              autoFocus={justCreatedId === note._id}
              onChange={e => setNotes(n => n.map(x => x._id === note._id ? { ...x, title: e.target.value } : x))}
              onBlur={e => { patchNote(note._id, { title: e.target.value }, false); if (justCreatedId === note._id) setJustCreatedId(null) }}
              placeholder="Judul catatan"
              style={{ border: 'none', background: 'transparent', font: '700 22px var(--disp)', color: 'var(--ink)', outline: 'none', padding: '2px 0', width: '100%' }} />
            <div className="au-col" style={{ gap: 6 }}>
              {note.items.length === 0 && <span className="au-small au-muted" style={{ padding: '12px 0' }}>Belum ada isi. Tambah teks atau checklist di bawah.</span>}
              {note.items.map(item => {
                if (item.type === 'number') numberCounter++
                const grow = (el: HTMLTextAreaElement) => { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' }
                if (item.type === 'text') {
                  return (
                    <div key={item.id} className="au-row" style={{ alignItems: 'flex-start', gap: 6 }}>
                      <textarea value={item.text} disabled={!canEdit} aria-label="Teks"
                        onChange={e => { setItemText(note, item.id, e.target.value); grow(e.target) }} onBlur={e => { commitItemText(note); grow(e.target) }} onFocus={e => grow(e.target)}
                        rows={1} placeholder="Tulis catatan"
                        style={{ flex: 1, border: 'none', background: 'var(--sunken)', borderRadius: 12, padding: '11px 13px', fontSize: 15, color: 'var(--ink)', outline: 'none', resize: 'none', overflow: 'hidden', lineHeight: 1.6, fontFamily: 'inherit' }} />
                      {canEdit && <button type="button" aria-label="Hapus baris" onClick={() => removeItem(note, item.id)} className="btn btn-icon btn-sm" style={{ border: 0, background: 'none', color: 'var(--muted)' }}><Icon name="x" size={14} /></button>}
                    </div>
                  )
                }
                return (
                  <div key={item.id} className="au-row" style={{ alignItems: 'flex-start', gap: 10 }}>
                    <button type="button" role="checkbox" aria-checked={item.checked} aria-label={item.text || 'Item'} onClick={() => canEdit && toggleItemChecked(note, item.id)} className={`au-qchk${item.type === 'number' ? ' num' : ''}${item.checked ? ' on' : ''}`} disabled={!canEdit}>
                      {item.checked ? <Icon name="check" size={14} stroke={3} /> : (item.type === 'number' ? numberCounter : '')}
                    </button>
                    <textarea value={item.text} disabled={!canEdit} aria-label="Item to-do"
                      onChange={e => { setItemText(note, item.id, e.target.value); grow(e.target) }} onBlur={e => { commitItemText(note); grow(e.target) }} onFocus={e => grow(e.target)}
                      rows={1} placeholder="Tulis item to-do"
                      style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 15, color: item.checked ? 'var(--muted)' : 'var(--ink)', textDecoration: item.checked ? 'line-through' : 'none', outline: 'none', padding: '4px 0', resize: 'none', overflow: 'hidden', lineHeight: 1.6, fontFamily: 'inherit' }} />
                    {canEdit && <button type="button" aria-label="Hapus item" onClick={() => removeItem(note, item.id)} className="btn btn-icon btn-sm" style={{ border: 0, background: 'none', color: 'var(--muted)' }}><Icon name="x" size={14} /></button>}
                  </div>
                )
              })}
            </div>
            {canEdit && <div className="au-row au-wrap" style={{ gap: 6 }}>
              <button type="button" onClick={() => addItem(note, 'text')} className="btn btn-sm">¶ Teks</button>
              <button type="button" onClick={() => addItem(note, 'bullet')} className="btn btn-sm">• Checklist</button>
              <button type="button" onClick={() => addItem(note, 'number')} className="btn btn-sm">1. Bernomor</button>
            </div>}
            <div className="au-row au-wrap" style={{ gap: 8, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
              <button type="button" onClick={() => { setReminderOpenId(reminderOpenId === note._id ? null : note._id); setShareOpenId(null) }} className="btn" aria-expanded={reminderOpenId === note._id}>
                <Icon name="bell" size={15} />{note.reminder?.enabled ? reminderLabel(note.reminder) : 'Reminder'}
              </button>
              {isOwner && <button type="button" onClick={() => { setShareOpenId(note._id); setReminderOpenId(null) }} className={`btn${note.sharedWith?.length ? ' btn-ghost' : ''}`}><Icon name="team" size={15} />{note.sharedWith?.length ? `Dishare ke ${note.sharedWith.length}` : 'Share'}</button>}
              {isOwner && (confirmDelId === note._id
                ? <span className="au-row p-bad" style={{ borderRadius: 12, padding: '6px 8px', gap: 6, marginLeft: 'auto' }}><span className="au-small">Hapus catatan?</span><button type="button" className="btn btn-sm" onClick={() => setConfirmDelId(null)}>Batal</button><button type="button" className="btn btn-danger btn-sm" onClick={() => { deleteNote(note._id); setDetailId(null) }}>Ya, hapus</button></span>
                : <button type="button" onClick={() => setConfirmDelId(note._id)} className="btn btn-danger" style={{ marginLeft: 'auto' }}><Icon name="trash" size={15} />Hapus</button>)}
            </div>
            {reminderOpenId === note._id && <ReminderEditor note={note} onSave={r => saveReminder(note, r)} onClose={() => setReminderOpenId(null)} />}
            {shareOpenId === note._id && <ShareEditor note={note} members={shareMembers} onSave={list => saveShare(note, list)} onClose={() => setShareOpenId(null)} />}
          </Sheet>
        )
      })()}
    </div>
  )
}

function ReminderEditor({ note, onSave, onClose }: { note: QuickNote; onSave: (r: Reminder) => void; onClose: () => void }) {
  const [r, setR] = useState<Reminder>(note.reminder?.enabled ? { ...note.reminder } : { ...emptyReminder(), mode: 'daily' })
  const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
  const recurring = r.mode !== 'once'

  function setMode(mode: Reminder['mode']) {
    setR(x => {
      const nx: Reminder = { ...x, mode }
      const now = new Date()
      if ((mode === 'weekly' || mode === 'biweekly') && (x.weekday === null || x.weekday === undefined)) nx.weekday = now.getDay()
      if (mode === 'monthly' && !x.dayOfMonth) nx.dayOfMonth = now.getDate()
      if (!x.time) nx.time = '08:00'
      return nx
    })
  }
  function save() {
    const out = { ...r }
    if (out.enabled && out.mode === 'once' && !out.datetime) { toast.error('Isi tanggal & jam reminder'); return }
    if (out.enabled && (out.mode === 'weekly' || out.mode === 'biweekly' || out.mode === 'monthly')) {
      const d = new Date(); out.anchorDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }
    onSave(out)
  }
  return (
    <div className="au-box rise" style={{ padding: 14, gap: 10 }}>
      <label className="au-row au-between" style={{ cursor: 'pointer' }}><b style={{ fontSize: 15 }}>Reminder</b><input type="checkbox" className="au-sw" checked={r.enabled} onChange={e => setR(x => ({ ...x, enabled: e.target.checked }))} aria-label="Aktifkan reminder" /></label>
      {r.enabled && (
        <div className="au-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
          <label className="au-col" style={{ gap: 6 }}><span className="lbl">Pengulangan</span>
            <select value={r.mode} onChange={e => setMode(e.target.value as Reminder['mode'])} className="input">
              <option value="once">Sekali</option><option value="daily">Tiap hari</option><option value="weekly">Tiap pekan</option><option value="biweekly">Tiap 2 pekan</option><option value="monthly">Tiap bulan</option>
            </select></label>
          {r.mode === 'once' && <label className="au-col" style={{ gap: 6 }}><span className="lbl">Tanggal & jam</span><input type="datetime-local" value={r.datetime} onChange={e => setR(x => ({ ...x, datetime: e.target.value }))} className="input" /></label>}
          {(r.mode === 'weekly' || r.mode === 'biweekly') && <label className="au-col" style={{ gap: 6 }}><span className="lbl">Hari</span>
            <select value={r.weekday ?? new Date().getDay()} onChange={e => setR(x => ({ ...x, weekday: Number(e.target.value) }))} className="input">{DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}</select></label>}
          {r.mode === 'monthly' && <label className="au-col" style={{ gap: 6 }}><span className="lbl">Tanggal (1–31)</span><input type="number" min={1} max={31} value={r.dayOfMonth ?? new Date().getDate()} onChange={e => setR(x => ({ ...x, dayOfMonth: Math.min(31, Math.max(1, Number(e.target.value) || 1)) }))} className="input" /></label>}
          {recurring && <label className="au-col" style={{ gap: 6 }}><span className="lbl">Jam</span><input type="time" value={r.time} onChange={e => setR(x => ({ ...x, time: e.target.value }))} className="input" /></label>}
        </div>
      )}
      <div className="au-row" style={{ gap: 8, justifyContent: 'flex-end' }}><button type="button" className="btn" onClick={onClose}>Batal</button><button type="button" onClick={save} className="btn btn-primary">Simpan reminder</button></div>
    </div>
  )
}

function ShareEditor({ note, members, onSave, onClose }: { note: QuickNote; members: any[]; onSave: (list: string[]) => void; onClose: () => void }) {
  const [selected, setSelected] = useState<string[]>(() => (note.sharedWith || []).filter(Boolean))
  const [q, setQ] = useState('')

  // Tutup dengan tombol Esc
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  function toggle(email: string) {
    if (!email) return   // member tanpa email tidak bisa di-share (sharedWith berbasis email)
    setSelected(s => s.includes(email) ? s.filter(x => x !== email) : [...s, email])
  }

  // Hanya member yang punya email yang bisa di-tag; sisanya ditampilkan tapi nonaktif
  const shown = members.filter(m => {
    const t = q.trim().toLowerCase()
    return !t || String(m.name || '').toLowerCase().includes(t) || String(m.email || '').toLowerCase().includes(t)
  })
  const taggable = shown.filter(m => !!m.email)
  const allShownSelected = taggable.length > 0 && taggable.every(m => selected.includes(m.email))
  const initial = (n: string) => String(n || '?').trim().charAt(0).toUpperCase()

  return (
    <Sheet open title="Share catatan" onClose={onClose} onSave={() => onSave(selected.filter(Boolean))}>
      <p className="au-small au-ink2" style={{ marginTop: -4 }}>Member terpilih bisa melihat &amp; mengedit catatan ini.</p>
      <label className="input au-row" style={{ gap: 8, padding: '0 12px' }}><Icon name="search" size={16} />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari nama member" aria-label="Cari member" style={{ border: 0, background: 'transparent', flex: 1, minHeight: 42, outline: 0, color: 'var(--ink)' }} /></label>
      <div className="au-row au-between au-wrap" style={{ gap: 8 }}>
        <span className="au-small au-ink2">{selected.length > 0 ? <><b style={{ color: 'var(--accent-ink)' }}>{selected.length}</b> member dipilih</> : 'Belum ada yang dipilih'}</span>
        <span className="au-row" style={{ gap: 6 }}>
          <button type="button" disabled={taggable.length === 0} className="btn btn-sm" onClick={() => setSelected(s => allShownSelected ? s.filter(e => !taggable.some(m => m.email === e)) : Array.from(new Set([...s, ...taggable.map(m => m.email)])))}>{allShownSelected ? 'Batal pilih semua' : 'Pilih semua'}</button>
          {selected.length > 0 && <button type="button" onClick={() => setSelected([])} className="btn btn-sm">Kosongkan</button>}
        </span>
      </div>
      <div className="au-ig">
        {shown.length === 0 && <div className="au-igr au-muted au-small">{members.length === 0 ? 'Tidak ada member lain.' : 'Tidak ada member yang cocok.'}</div>}
        {shown.map((m, i) => {
          const canTag = !!m.email, on = canTag && selected.includes(m.email)
          return (
            <label key={m.email || m._id || `m-${i}`} className="au-igr" style={{ opacity: canTag ? 1 : .5, cursor: canTag ? 'pointer' : 'not-allowed' }} title={canTag ? undefined : 'Member ini belum punya email, tidak bisa di-share'}>
              <span className={`au-av${on ? ' c1' : ''}`} style={on ? undefined : { background: 'var(--sunken)', color: 'var(--ink2)' }}>{initial(m.name)}</span>
              <span className="au-col" style={{ flex: 1, minWidth: 0 }}><b style={{ fontSize: 14 }}>{m.name || m.email || '(tanpa nama)'}</b><span className="au-xs au-muted">{m.email || 'belum punya email'}</span></span>
              <input type="checkbox" className="au-chk" checked={on} disabled={!canTag} onChange={() => toggle(m.email)} aria-label={`Share ke ${m.name || m.email}`} />
            </label>
          )
        })}
      </div>
    </Sheet>
  )
}
