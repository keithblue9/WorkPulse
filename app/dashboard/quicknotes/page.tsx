'use client'
import { useEffect, useState, useRef } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import { ensurePushSubscription } from '@/lib/pushClient'
import { reminderLabel } from '@/lib/reminderDue'

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
  const [loading, setLoading] = useState(true)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [shareOpenId, setShareOpenId] = useState<string | null>(null)
  const [justCreatedId, setJustCreatedId] = useState<string | null>(null)
  const [reminderOpenId, setReminderOpenId] = useState<string | null>(null)
  const checkedOnce = useRef(false)

  async function load() {
    try {
      const [n, u] = await Promise.all([
        fetch('/api/quicknotes').then(r => r.json()),
        fetch('/api/users').then(r => r.json()),
      ])
      setNotes(n.data || [])
      setMembers((u.data || []).filter((m: any) => m.email !== myEmail && m.active !== false))
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

  async function patchNote(id: string, updates: Partial<QuickNote>, optimistic = true) {
    if (optimistic) setNotes(n => n.map(x => x._id === id ? { ...x, ...updates } as QuickNote : x))
    const res = await fetch('/api/quicknotes', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...updates }) })
    const d = await res.json()
    if (d.data) setNotes(n => n.map(x => x._id === id ? d.data : x))
    else if (d.error) { toast.error(d.error); load() }
  }

  async function deleteNote(id: string) {
    if (!confirm('Hapus catatan ini?')) return
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
        toast(msg, { icon: '⚠️', duration: 5000 })
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

  if (loading) return <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color: 'var(--text3)' }}>Memuat…</div>

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }} className="safe-bottom page-pad">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 19, fontWeight: 700, color: 'var(--text)', margin: 0 }}>📝 [Personal] Notes</h1>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Catatan & to-do pribadi kamu. Tidak terlihat oleh member lain kecuali kamu share.</div>
        </div>
        <button className="btn btn-primary" onClick={createNote}>+ Catatan Baru</button>
      </div>

      {notes.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text3)' }}>
          <div style={{ fontSize: 38, marginBottom: 10 }}>🗒️</div>
          Belum ada catatan. Buat yang pertama yuk!
        </div>
      )}

      {/* Card Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
        {notes.map(note => {
          const isOwner = note.ownerEmail === myEmail
          const isShared = note.sharedWith?.length > 0
          const checklist = note.items.filter(i => i.type !== 'text')
          const textCount = note.items.filter(i => i.type === 'text' && i.text.trim()).length
          const doneCount = checklist.filter(i => i.checked).length
          const total = checklist.length
          const progress = total > 0 ? Math.round((doneCount / total) * 100) : 0
          const preview = note.items.find(i => i.text.trim())?.text || ''

          return (
            <div key={note._id} className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}
              onClick={() => setDetailId(note._id)}>
              <div style={{ padding: '12px 14px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', lineHeight: 1.3, flex: 1 }}>
                    {note.title || <span style={{ color: 'var(--text3)', fontStyle: 'italic' }}>Tanpa judul</span>}
                  </div>
                  {isOwner && (
                    <button onClick={e => { e.stopPropagation(); deleteNote(note._id) }} title="Hapus" className="btn btn-icon btn-sm" style={{ opacity: 0.5, fontSize: 12 }}>🗑️</button>
                  )}
                </div>

                {preview && <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 6, lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{preview}</div>}

                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 8, flexWrap: 'wrap' }}>
                  {!isOwner && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: 'var(--brand-soft)', color: 'var(--brand)', fontWeight: 600 }}>👤 {note.ownerEmail.split('@')[0]}</span>}
                  {isOwner && isShared && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: 'var(--bg3)', color: 'var(--text3)' }}>👥 {note.sharedWith.length} orang</span>}
                  {textCount > 0 && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: 'var(--bg3)', color: 'var(--text3)' }}>📄 {textCount} teks</span>}
                  {note.reminder?.enabled && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: 'var(--amberbg)', color: 'var(--amber)', fontWeight: 600 }}>🔔 {reminderLabel(note.reminder)}</span>}
                </div>

                {total > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 10, color: 'var(--text3)' }}>{doneCount}/{total} selesai</span>
                      <span style={{ fontSize: 10, color: doneCount === total ? 'var(--green)' : 'var(--text3)', fontWeight: doneCount === total ? 700 : 400 }}>{doneCount === total ? '✓ Done!' : `${progress}%`}</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 4, background: 'var(--bg3)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 4, transition: 'width 0.3s', width: `${progress}%`, background: doneCount === total ? 'var(--green)' : 'var(--brand)' }} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {detailId && (() => {
        const note = notes.find(n => n._id === detailId)
        if (!note) return null
        const isOwner = note.ownerEmail === myEmail
        const canEdit = isOwner || note.sharedWith?.includes(myEmail)
        let numberCounter = 0
        return (
          <div className="modal-overlay" onClick={() => { setDetailId(null); setReminderOpenId(null); setShareOpenId(null) }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div className="card scale-in" onClick={e => e.stopPropagation()} style={{ width: 560, maxWidth: '100%', maxHeight: '88vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
              {/* header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
                <input value={note.title} disabled={!canEdit}
                  autoFocus={justCreatedId === note._id}
                  onChange={e => setNotes(n => n.map(x => x._id === note._id ? { ...x, title: e.target.value } : x))}
                  onBlur={e => { patchNote(note._id, { title: e.target.value }, false); if (justCreatedId === note._id) setJustCreatedId(null) }}
                  placeholder="Judul catatan…"
                  style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 18, fontWeight: 700, color: 'var(--text)', outline: 'none', padding: '2px 0' }} />
                <button onClick={() => { setDetailId(null); setReminderOpenId(null); setShareOpenId(null) }} className="btn btn-icon btn-sm" style={{ marginLeft: 8 }}>✕</button>
              </div>

              {/* body */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {note.items.length === 0 && <div style={{ fontSize: 12, color: 'var(--text3)', padding: '20px 0', textAlign: 'center' }}>Belum ada isi. Tambah teks atau checklist di bawah.</div>}
                {note.items.map(item => {
                  if (item.type === 'number') numberCounter++
                  if (item.type === 'text') {
                    return (
                      <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
                        <textarea value={item.text} disabled={!canEdit}
                          onChange={e => { setItemText(note, item.id, e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
                          onBlur={e => { commitItemText(note); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
                          onFocus={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
                          rows={1} placeholder="Tulis catatan…"
                          style={{ flex: 1, border: 'none', background: 'var(--bg2)', borderRadius: 8, padding: '11px 13px', fontSize: 14.5, color: 'var(--text)', outline: 'none', resize: 'none', overflow: 'hidden', lineHeight: 1.65, fontFamily: 'inherit', minHeight: '1.6em' }} />
                        {canEdit && <button onClick={() => removeItem(note, item.id)} style={{ background: 'transparent', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 12, padding: '4px 2px', opacity: 0.6 }}>✕</button>}
                      </div>
                    )
                  }
                  return (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <button onClick={() => canEdit && toggleItemChecked(note, item.id)} style={{
                        marginTop: 3, width: 21, height: 21, borderRadius: item.type === 'number' ? 5 : '50%',
                        border: `1.5px solid ${item.checked ? 'var(--brand)' : 'var(--border)'}`,
                        background: item.checked ? 'var(--brand)' : 'transparent', color: '#fff', fontSize: 12,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: canEdit ? 'pointer' : 'default', padding: 0,
                      }}>{item.checked ? '✓' : (item.type === 'number' ? numberCounter : '')}</button>
                      <textarea value={item.text} disabled={!canEdit}
                        onChange={e => { setItemText(note, item.id, e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
                        onBlur={e => { commitItemText(note); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
                        onFocus={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
                        rows={1} placeholder="Tulis item to-do…"
                        style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 14.5, color: item.checked ? 'var(--text3)' : 'var(--text)', textDecoration: item.checked ? 'line-through' : 'none', outline: 'none', padding: '3px 0', resize: 'none', overflow: 'hidden', lineHeight: 1.6, fontFamily: 'inherit', minHeight: '1.6em' }} />
                      {canEdit && <button onClick={() => removeItem(note, item.id)} style={{ background: 'transparent', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 12, padding: '2px', opacity: 0.6, marginTop: 2 }}>✕</button>}
                    </div>
                  )
                })}
              </div>

              {/* add buttons */}
              {canEdit && (
                <div style={{ display: 'flex', gap: 6, padding: '8px 18px', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
                  <button onClick={() => addItem(note, 'text')} className="btn btn-sm" style={{ fontSize: 11 }}>¶ Teks</button>
                  <button onClick={() => addItem(note, 'bullet')} className="btn btn-sm" style={{ fontSize: 11 }}>• Bullet</button>
                  <button onClick={() => addItem(note, 'number')} className="btn btn-sm" style={{ fontSize: 11 }}>1. Nomor</button>
                </div>
              )}

              {/* footer: reminder + share */}
              <div style={{ display: 'flex', gap: 8, padding: '12px 18px 16px', borderTop: '1px solid var(--border)', position: 'relative', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative' }}>
                  <button onClick={() => { setReminderOpenId(reminderOpenId === note._id ? null : note._id); setShareOpenId(null) }} className="btn btn-sm" style={{ fontSize: 12.5, padding: '7px 13px' }}>
                    🔔 {note.reminder?.enabled ? reminderLabel(note.reminder) : 'Reminder'}
                  </button>
                  {reminderOpenId === note._id && <ReminderEditor note={note} onSave={r => saveReminder(note, r)} onClose={() => setReminderOpenId(null)} />}
                </div>
                {isOwner && (
                  <>
                    <button onClick={() => { setShareOpenId(note._id); setReminderOpenId(null) }} className="btn btn-sm"
                      style={{ fontSize: 12.5, padding: '7px 13px', background: note.sharedWith?.length ? 'var(--brand-soft)' : undefined, color: note.sharedWith?.length ? 'var(--brand)' : undefined, borderColor: note.sharedWith?.length ? 'var(--brand)' : undefined }}>
                      📤 {note.sharedWith?.length ? `Dishare ke ${note.sharedWith.length}` : 'Share'}
                    </button>
                    {shareOpenId === note._id && <ShareEditor note={note} members={members} onSave={list => saveShare(note, list)} onClose={() => setShareOpenId(null)} />}
                  </>
                )}
                {isOwner && <button onClick={() => { deleteNote(note._id); setDetailId(null) }} className="btn btn-sm" style={{ fontSize: 12.5, padding: '7px 13px', marginLeft: 'auto', color: 'var(--red)' }}>🗑️ Hapus</button>}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

function ReminderEditor({ note, onSave, onClose }: { note: QuickNote; onSave: (r: Reminder) => void; onClose: () => void }) {
  const [r, setR] = useState<Reminder>(note.reminder?.enabled ? { ...note.reminder } : { ...emptyReminder(), mode: 'daily' })
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [onClose])

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
    if (out.enabled && (out.mode === 'weekly' || out.mode === 'biweekly' || out.mode === 'monthly')) {
      const d = new Date(); out.anchorDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }
    onSave(out)
  }

  return (
    <div ref={ref} className="card scale-in" style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, width: 270, padding: 12, zIndex: 60, boxShadow: '0 12px 30px rgba(0,0,0,0.18)' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Atur Reminder</div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--text2)', marginBottom: 10, cursor: 'pointer' }}>
        <input type="checkbox" checked={r.enabled} onChange={e => setR(x => ({ ...x, enabled: e.target.checked }))} /> Aktifkan reminder
      </label>
      {r.enabled && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div>
            <label style={{ fontSize: 10.5, color: 'var(--text3)', display: 'block', marginBottom: 3 }}>Pengulangan</label>
            <select value={r.mode} onChange={e => setMode(e.target.value as Reminder['mode'])} className="input" style={{ width: '100%', fontSize: 12 }}>
              <option value="once">Sekali</option>
              <option value="daily">Tiap hari</option>
              <option value="weekly">Tiap pekan</option>
              <option value="biweekly">Tiap 2 pekan sekali</option>
              <option value="monthly">Tiap bulan</option>
            </select>
          </div>

          {r.mode === 'once' && (
            <div>
              <label style={{ fontSize: 10.5, color: 'var(--text3)', display: 'block', marginBottom: 3 }}>Tanggal & jam</label>
              <input type="datetime-local" value={r.datetime} onChange={e => setR(x => ({ ...x, datetime: e.target.value }))} className="input" style={{ width: '100%', fontSize: 12 }} />
            </div>
          )}

          {(r.mode === 'weekly' || r.mode === 'biweekly') && (
            <div>
              <label style={{ fontSize: 10.5, color: 'var(--text3)', display: 'block', marginBottom: 3 }}>Hari</label>
              <select value={r.weekday ?? new Date().getDay()} onChange={e => setR(x => ({ ...x, weekday: Number(e.target.value) }))} className="input" style={{ width: '100%', fontSize: 12 }}>
                {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>
          )}

          {r.mode === 'monthly' && (
            <div>
              <label style={{ fontSize: 10.5, color: 'var(--text3)', display: 'block', marginBottom: 3 }}>Tanggal (1–31)</label>
              <input type="number" min={1} max={31} value={r.dayOfMonth ?? new Date().getDate()} onChange={e => setR(x => ({ ...x, dayOfMonth: Math.min(31, Math.max(1, Number(e.target.value) || 1)) }))} className="input" style={{ width: '100%', fontSize: 12 }} />
            </div>
          )}

          {recurring && (
            <div>
              <label style={{ fontSize: 10.5, color: 'var(--text3)', display: 'block', marginBottom: 3 }}>Jam</label>
              <input type="time" value={r.time} onChange={e => setR(x => ({ ...x, time: e.target.value }))} className="input" style={{ width: '100%', fontSize: 12 }} />
            </div>
          )}
        </div>
      )}
      <button onClick={save} className="btn btn-primary btn-sm" style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}>Simpan</button>
    </div>
  )
}

function ShareEditor({ note, members, onSave, onClose }: { note: QuickNote; members: any[]; onSave: (list: string[]) => void; onClose: () => void }) {
  const [selected, setSelected] = useState<string[]>(note.sharedWith || [])
  const [q, setQ] = useState('')

  // Tutup dengan tombol Esc
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  function toggle(email: string) { setSelected(s => s.includes(email) ? s.filter(x => x !== email) : [...s, email]) }

  const shown = members.filter(m => {
    const t = q.trim().toLowerCase()
    return !t || String(m.name || '').toLowerCase().includes(t) || String(m.email || '').toLowerCase().includes(t)
  })
  const allShownSelected = shown.length > 0 && shown.every(m => selected.includes(m.email))
  const initial = (n: string) => String(n || '?').trim().charAt(0).toUpperCase()

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" style={{ width: 460, maxWidth: '100%', display: 'flex', flexDirection: 'column', maxHeight: '85vh' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>📤 Share Catatan</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>Member terpilih bisa melihat &amp; mengedit catatan ini.</div>
          </div>
          <button onClick={onClose} className="btn btn-icon">×</button>
        </div>

        <div style={{ padding: '12px 20px 0' }}>
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="🔍 Cari nama member…"
            style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 9, padding: '10px 12px', fontSize: 13.5, background: 'var(--bg)', color: 'var(--text)', outline: 'none' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--text2)' }}>
              {selected.length > 0 ? <><b style={{ color: 'var(--brand)' }}>{selected.length}</b> member dipilih</> : 'Belum ada yang dipilih'}
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setSelected(s => allShownSelected ? s.filter(e => !shown.some(m => m.email === e)) : Array.from(new Set([...s, ...shown.map(m => m.email)])))}
                className="btn btn-sm" style={{ fontSize: 11.5 }} disabled={shown.length === 0}>
                {allShownSelected ? 'Batal pilih semua' : 'Pilih semua'}
              </button>
              {selected.length > 0 && <button onClick={() => setSelected([])} className="btn btn-sm" style={{ fontSize: 11.5 }}>Kosongkan</button>}
            </div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px 4px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {shown.length === 0 && (
            <div style={{ fontSize: 12.5, color: 'var(--text3)', padding: '24px 6px', textAlign: 'center' }}>
              {members.length === 0 ? 'Tidak ada member lain.' : 'Tidak ada member yang cocok dengan pencarian.'}
            </div>
          )}
          {shown.map(m => {
            const on = selected.includes(m.email)
            return (
              <label key={m.email} onClick={e => e.preventDefault()} role="button"
                onMouseDown={() => toggle(m.email)}
                style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                  background: on ? 'var(--brand-soft)' : 'transparent', border: `1px solid ${on ? 'var(--brand)' : 'transparent'}` }}>
                <span style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: on ? 'var(--brand)' : 'var(--bg3)', color: on ? '#fff' : 'var(--text2)', fontSize: 14, fontWeight: 700 }}>{initial(m.name)}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name || m.email}</span>
                  {m.email && <span style={{ display: 'block', fontSize: 11, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.email}</span>}
                </span>
                <span style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: `2px solid ${on ? 'var(--brand)' : 'var(--border2)'}`, background: on ? 'var(--brand)' : 'transparent', color: '#fff', fontSize: 13, fontWeight: 700 }}>{on ? '✓' : ''}</span>
              </label>
            )
          })}
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} className="btn">Batal</button>
          <button onClick={() => onSave(selected)} className="btn btn-primary">Simpan</button>
        </div>
      </div>
    </div>
  )
}
