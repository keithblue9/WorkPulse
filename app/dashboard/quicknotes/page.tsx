'use client'
import { useEffect, useState, useRef } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import { ensurePushSubscription } from '@/lib/pushClient'

type Item = { id: string; text: string; checked: boolean; type: 'bullet' | 'number' }
type Reminder = { enabled: boolean; mode: 'once' | 'daily'; datetime: string; time: string }
type QuickNote = {
  _id: string; title: string; items: Item[]; reminder: Reminder
  ownerEmail: string; sharedWith: string[]; lastEditedBy: string; updatedAt: string
}

function uid() { return Math.random().toString(36).slice(2, 9) }
function emptyReminder(): Reminder { return { enabled: false, mode: 'once', datetime: '', time: '' } }

export default function QuickNotesPage() {
  const { data: session } = useSession()
  const user = session?.user as any
  const myEmail = user?.email

  const [notes, setNotes] = useState<QuickNote[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)
  const [shareOpenId, setShareOpenId] = useState<string | null>(null)
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
    const res = await fetch('/api/quicknotes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Catatan baru', items: [{ id: uid(), text: '', checked: false, type: 'bullet' }] }) })
    const d = await res.json()
    if (d.data) { setNotes(n => [d.data, ...n]); setOpenId(d.data._id) }
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
  function addItem(note: QuickNote, type: 'bullet' | 'number') {
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

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Memuat…</div>

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1100, margin: '0 auto' }}>
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {notes.map(note => {
          const isOwner = note.ownerEmail === myEmail
          const isShared = note.sharedWith?.length > 0
          const isOpen = openId === note._id
          const doneCount = note.items.filter(i => i.checked).length
          const total = note.items.length
          const progress = total > 0 ? Math.round((doneCount / total) * 100) : 0
          let numberCounter = 0

          return (
            <div key={note._id} className="card" style={{
              padding: 0, overflow: 'visible', display: 'flex', flexDirection: 'column',
              border: isOpen ? '1.5px solid var(--brand)' : '1px solid var(--border)',
              transition: 'border-color 0.15s, box-shadow 0.15s',
              boxShadow: isOpen ? '0 4px 16px rgba(0,0,0,0.10)' : '0 1px 4px rgba(0,0,0,0.05)',
            }}>

              {/* === CARD HEADER (always visible) === */}
              <div
                onClick={() => { setOpenId(isOpen ? null : note._id); setShareOpenId(null); setReminderOpenId(null) }}
                style={{ padding: '12px 14px 10px', cursor: 'pointer', userSelect: 'none' }}
              >
                {/* Title row */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', lineHeight: 1.3, flex: 1 }}>
                    {note.title || <span style={{ color: 'var(--text3)', fontStyle: 'italic' }}>Tanpa judul</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    {isOwner && (
                      <button
                        onClick={e => { e.stopPropagation(); deleteNote(note._id) }}
                        title="Hapus" className="btn btn-icon btn-sm"
                        style={{ opacity: 0.5, fontSize: 12 }}
                      >🗑️</button>
                    )}
                    <span style={{
                      fontSize: 11, color: 'var(--text3)', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s', display: 'inline-block', lineHeight: 1
                    }}>▾</span>
                  </div>
                </div>

                {/* Badges row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 7, flexWrap: 'wrap' }}>
                  {!isOwner && (
                    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: 'var(--brand-soft)', color: 'var(--brand)', fontWeight: 600 }}>
                      👤 {note.ownerEmail.split('@')[0]}
                    </span>
                  )}
                  {isOwner && isShared && (
                    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: 'var(--bg3)', color: 'var(--text3)' }}>
                      👥 {note.sharedWith.length} orang
                    </span>
                  )}
                  {note.reminder?.enabled && (
                    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: 'var(--amberbg)', color: 'var(--amber)', fontWeight: 600 }}>
                      🔔 {note.reminder.mode === 'daily' ? note.reminder.time : note.reminder.datetime ? new Date(note.reminder.datetime).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : 'Aktif'}
                    </span>
                  )}
                </div>

                {/* Progress bar */}
                {total > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 10, color: 'var(--text3)' }}>{doneCount}/{total} selesai</span>
                      <span style={{ fontSize: 10, color: doneCount === total ? 'var(--green)' : 'var(--text3)', fontWeight: doneCount === total ? 700 : 400 }}>
                        {doneCount === total ? '✓ Done!' : `${progress}%`}
                      </span>
                    </div>
                    <div style={{ height: 4, borderRadius: 4, background: 'var(--bg3)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 4, transition: 'width 0.3s',
                        width: `${progress}%`,
                        background: doneCount === total ? 'var(--green)' : 'var(--brand)'
                      }} />
                    </div>
                  </div>
                )}
              </div>

              {/* === EXPANDED CONTENT === */}
              {isOpen && (
                <>
                  {/* Title editor */}
                  <div style={{ padding: '4px 14px 8px', borderTop: '1px solid var(--border)' }}>
                    <input
                      value={note.title}
                      onChange={e => setNotes(n => n.map(x => x._id === note._id ? { ...x, title: e.target.value } : x))}
                      onBlur={e => patchNote(note._id, { title: e.target.value }, false)}
                      placeholder="Judul catatan"
                      disabled={!isOwner && !note.sharedWith.includes(myEmail)}
                      style={{ width: '100%', border: 'none', background: 'var(--bg2)', borderRadius: 6, padding: '6px 10px', fontSize: 13, fontWeight: 700, color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>

                  {/* Checklist items */}
                  <div style={{ padding: '4px 14px 0', display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <div style={{ maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 5, paddingRight: 2 }}>
                      {note.items.map(item => {
                        if (item.type === 'number') numberCounter++
                        return (
                          <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
                            <button onClick={() => toggleItemChecked(note, item.id)} style={{
                              marginTop: 2, width: 16, height: 16, borderRadius: item.type === 'number' ? 4 : '50%',
                              border: `1.5px solid ${item.checked ? 'var(--brand)' : 'var(--border)'}`,
                              background: item.checked ? 'var(--brand)' : 'transparent', color: '#fff', fontSize: 10,
                              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer', padding: 0,
                            }}>
                              {item.checked ? '✓' : (item.type === 'number' ? numberCounter : '')}
                            </button>
                            <input value={item.text} onChange={e => setItemText(note, item.id, e.target.value)} onBlur={() => commitItemText(note)}
                              placeholder="Tulis catatan…"
                              style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 12.5, color: item.checked ? 'var(--text3)' : 'var(--text)', textDecoration: item.checked ? 'line-through' : 'none', outline: 'none', padding: '2px 0' }} />
                            <button onClick={() => removeItem(note, item.id)} style={{ background: 'transparent', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 12, padding: '0 2px', opacity: 0.6 }}>✕</button>
                          </div>
                        )
                      })}
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 4, paddingBottom: 8 }}>
                      <button onClick={() => addItem(note, 'bullet')} className="btn btn-sm" style={{ fontSize: 11 }}>• Bullet</button>
                      <button onClick={() => addItem(note, 'number')} className="btn btn-sm" style={{ fontSize: 11 }}>1. Nomor</button>
                    </div>
                  </div>

                  {/* Footer actions */}
                  <div style={{ display: 'flex', gap: 6, padding: '8px 14px 12px', borderTop: '1px solid var(--border)', position: 'relative' }}>
                    <div style={{ position: 'relative' }}>
                      <button onClick={() => { setReminderOpenId(reminderOpenId === note._id ? null : note._id); setShareOpenId(null) }} className="btn btn-sm" style={{ fontSize: 11 }}>
                        🔔 {note.reminder?.enabled ? 'Reminder aktif' : 'Reminder'}
                      </button>
                      {reminderOpenId === note._id && <ReminderEditor note={note} onSave={r => saveReminder(note, r)} onClose={() => setReminderOpenId(null)} />}
                    </div>
                    {isOwner && (
                      <div style={{ position: 'relative' }}>
                        <button onClick={() => { setShareOpenId(shareOpenId === note._id ? null : note._id); setReminderOpenId(null) }} className="btn btn-sm" style={{ fontSize: 11 }}>
                          📤 Share
                        </button>
                        {shareOpenId === note._id && <ShareEditor note={note} members={members} onSave={list => saveShare(note, list)} onClose={() => setShareOpenId(null)} />}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ReminderEditor({ note, onSave, onClose }: { note: QuickNote; onSave: (r: Reminder) => void; onClose: () => void }) {
  const [r, setR] = useState<Reminder>(note.reminder?.enabled ? { ...note.reminder } : { ...emptyReminder(), mode: 'once' })
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [onClose])

  return (
    <div ref={ref} className="card scale-in" style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, width: 250, padding: 12, zIndex: 50, boxShadow: '0 12px 30px rgba(0,0,0,0.18)' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Atur Reminder</div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--text2)', marginBottom: 10, cursor: 'pointer' }}>
        <input type="checkbox" checked={r.enabled} onChange={e => setR(x => ({ ...x, enabled: e.target.checked }))} /> Aktifkan reminder
      </label>
      {r.enabled && (
        <>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <button onClick={() => setR(x => ({ ...x, mode: 'once' }))} className="btn btn-sm" style={{ flex: 1, fontSize: 10.5, background: r.mode === 'once' ? 'var(--brand)' : undefined, color: r.mode === 'once' ? '#fff' : undefined }}>Sekali</button>
            <button onClick={() => setR(x => ({ ...x, mode: 'daily' }))} className="btn btn-sm" style={{ flex: 1, fontSize: 10.5, background: r.mode === 'daily' ? 'var(--brand)' : undefined, color: r.mode === 'daily' ? '#fff' : undefined }}>Tiap hari</button>
          </div>
          {r.mode === 'once' ? (
            <input type="datetime-local" value={r.datetime} onChange={e => setR(x => ({ ...x, datetime: e.target.value }))} className="input" style={{ width: '100%', fontSize: 12 }} />
          ) : (
            <input type="time" value={r.time} onChange={e => setR(x => ({ ...x, time: e.target.value }))} className="input" style={{ width: '100%', fontSize: 12 }} />
          )}
        </>
      )}
      <button onClick={() => onSave(r)} className="btn btn-primary btn-sm" style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}>Simpan</button>
    </div>
  )
}

function ShareEditor({ note, members, onSave, onClose }: { note: QuickNote; members: any[]; onSave: (list: string[]) => void; onClose: () => void }) {
  const [selected, setSelected] = useState<string[]>(note.sharedWith || [])
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [onClose])

  function toggle(email: string) { setSelected(s => s.includes(email) ? s.filter(x => x !== email) : [...s, email]) }

  return (
    <div ref={ref} className="card scale-in" style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, width: 240, padding: 10, zIndex: 50, boxShadow: '0 12px 30px rgba(0,0,0,0.18)' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Share ke member</div>
      <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 8 }}>Member yang dipilih bisa lihat & edit catatan ini.</div>
      <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {members.map(m => (
          <label key={m.email} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--text2)', padding: '5px 4px', borderRadius: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={selected.includes(m.email)} onChange={() => toggle(m.email)} />
            {m.name}
          </label>
        ))}
        {members.length === 0 && <div style={{ fontSize: 11, color: 'var(--text3)', padding: 6 }}>Tidak ada member lain</div>}
      </div>
      <button onClick={() => onSave(selected)} className="btn btn-primary btn-sm" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}>Simpan</button>
    </div>
  )
}
