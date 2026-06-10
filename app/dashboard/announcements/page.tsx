'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  info:    { label: 'Info',    color: 'var(--blue)',   bg: 'var(--bluebg)',   icon: 'ℹ' },
  meeting: { label: 'Meeting', color: 'var(--purple)', bg: 'var(--purplebg)', icon: '📅' },
  urgent:  { label: 'Urgent',  color: 'var(--red)',    bg: 'var(--redbg)',    icon: '🚨' },
  event:   { label: 'Event',   color: 'var(--green)',  bg: 'var(--greenbg)',  icon: '🎉' },
}

const PLATFORM_ICONS: Record<string,string> = { teams:'💼', meet:'🟢', zoom:'🔵', other:'🔗' }

function AnnouncementForm({ onClose, onSave, editing }: { onClose: ()=>void; onSave: ()=>void; editing?: any }) {
  const { data: session } = useSession(); const user = session?.user as any
  const [form, setForm] = useState({ title: editing?.title||'', content: editing?.content||'', type: editing?.type||'info', meetingLink: editing?.meetingLink||'', meetingPlatform: editing?.meetingPlatform||'teams', meetingDate: editing?.meetingDate||'', meetingTime: editing?.meetingTime||'', pinned: editing?.pinned||false })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: any) => setForm(f => ({...f, [k]: v}))

  async function save() {
    if (!form.title || !form.content) { toast.error('Judul dan konten wajib diisi'); return }
    setSaving(true)
    try {
      const url = editing ? `/api/announcements/${editing._id}` : '/api/announcements'
      await fetch(url, { method: editing ? 'PATCH' : 'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ ...form, authorId: user?.id, authorName: user?.name }) })
      toast.success(editing ? 'Diperbarui!' : 'Pengumuman dibuat!'); onSave(); onClose()
    } catch { toast.error('Gagal') } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 560 }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontSize:14, fontWeight:600, color:'var(--text)' }}>{editing ? 'Edit Pengumuman' : '+ Buat Pengumuman'}</span>
          <button onClick={onClose} className="btn btn-icon">×</button>
        </div>
        <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:12, overflowY:'auto', maxHeight:'70vh' }}>
          <div><label style={lbl}>Tipe</label>
            <div style={{ display:'flex', gap:6 }}>
              {Object.entries(TYPE_CONFIG).map(([k,v]) => (
                <button key={k} onClick={() => set('type', k)} style={{ padding:'5px 12px', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer', border:`1px solid ${form.type===k ? v.color : 'var(--border)'}`, background: form.type===k ? v.bg : 'var(--bg3)', color: form.type===k ? v.color : 'var(--text3)' }}>{v.icon} {v.label}</button>
              ))}
            </div></div>
          <div><label style={lbl}>Judul</label><input className="input" value={form.title} onChange={e => set('title', e.target.value)} placeholder="Judul pengumuman..." /></div>
          <div><label style={lbl}>Konten</label><textarea className="input" value={form.content} onChange={e => set('content', e.target.value)} rows={3} style={{ resize:'vertical' }} placeholder="Isi pengumuman..." /></div>
          {form.type === 'meeting' && (
            <div style={{ background:'var(--bg3)', borderRadius:8, padding:12, display:'flex', flexDirection:'column', gap:10 }}>
              <div style={{ fontSize:12, fontWeight:600, color:'var(--text)', marginBottom:2 }}>Detail Meeting</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <div><label style={lbl}>Tanggal</label><input type="date" className="input" value={form.meetingDate} onChange={e => set('meetingDate', e.target.value)} /></div>
                <div><label style={lbl}>Waktu</label><input type="time" className="input" value={form.meetingTime} onChange={e => set('meetingTime', e.target.value)} /></div>
              </div>
              <div><label style={lbl}>Platform</label>
                <div style={{ display:'flex', gap:6 }}>
                  {(['teams','meet','zoom','other'] as const).map(p => (
                    <button key={p} onClick={() => set('meetingPlatform', p)} style={{ padding:'4px 10px', borderRadius:6, fontSize:11, cursor:'pointer', border:`1px solid ${form.meetingPlatform===p ? 'var(--blue)' : 'var(--border)'}`, background: form.meetingPlatform===p ? 'var(--bluebg)' : 'var(--bg3)', color: form.meetingPlatform===p ? 'var(--blue)' : 'var(--text3)' }}>{PLATFORM_ICONS[p]} {p}</button>
                  ))}
                </div></div>
              <div><label style={lbl}>Link Meeting</label><input className="input" value={form.meetingLink} onChange={e => set('meetingLink', e.target.value)} placeholder="https://teams.microsoft.com/..." /></div>
            </div>
          )}
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div className={`toggle-wrap${form.pinned?' on':''}`} onClick={() => set('pinned', !form.pinned)} />
            <span style={{ fontSize:12, color:'var(--text2)' }}>Pin di atas</span>
          </div>
        </div>
        <div style={{ padding:'12px 20px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'flex-end', gap:8 }}>
          <button onClick={onClose} className="btn">Batal</button>
          <button onClick={save} disabled={saving} className="btn btn-primary">{saving ? 'Menyimpan...' : editing ? 'Simpan' : 'Kirim Pengumuman'}</button>
        </div>
      </div>
    </div>
  )
}

export default function AnnouncementsPage() {
  const { data: session } = useSession(); const user = session?.user as any
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)

  async function load() { const d = await fetch('/api/announcements').then(r => r.json()); setItems(d.data || []); setLoading(false) }
  useEffect(() => { load() }, [])

  async function del(id: string) {
    if (!confirm('Hapus pengumuman ini?')) return
    await fetch(`/api/announcements/${id}`, { method:'DELETE' })
    toast.success('Dihapus'); load()
  }

  async function togglePin(item: any) {
    await fetch(`/api/announcements/${item._id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ pinned: !item.pinned }) })
    load()
  }

  async function markRead(id: string) {
    if (!user?.id) return
    await fetch(`/api/announcements/${id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ $addToSet: { readBy: user.id } }) })
  }

  const canManage = ['admin','manager'].includes(user?.role)

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {(showForm || editing) && <AnnouncementForm onClose={() => { setShowForm(false); setEditing(null) }} onSave={load} editing={editing} />}
      <div style={{ padding:'12px 20px', borderBottom:'1px solid var(--border)', background:'var(--bg2)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div><div style={{ fontSize:14, fontWeight:600 }}>Pengumuman</div><div style={{ fontSize:11, color:'var(--text3)' }}>Info & undangan meeting tim</div></div>
        {canManage && <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>+ Buat Pengumuman</button>}
      </div>
      <div style={{ flex:1, overflowY:'auto', padding:'16px 20px' }}>
        {loading ? <div style={{ textAlign:'center', padding:40, color:'var(--text3)' }}>Memuat...</div> : (
          items.length === 0 ? (
            <div style={{ textAlign:'center', padding:60, color:'var(--text3)' }}>
              <div style={{ fontSize:32, marginBottom:12 }}>📢</div>
              <div style={{ fontSize:13 }}>Belum ada pengumuman</div>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {items.map((item, i) => {
                const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.info
                const isUnread = !item.readBy?.includes(user?.id)
                return (
                  <div key={item._id} className="card fade-in" style={{ padding:'16px 20px', borderLeft:`3px solid ${cfg.color}`, animationDelay:`${i*0.05}s` }} onClick={() => markRead(item._id)}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        {item.pinned && <span style={{ fontSize:11, color:'var(--amber)' }}>📌</span>}
                        {isUnread && <span style={{ width:7, height:7, borderRadius:'50%', background:'var(--blue)', display:'inline-block' }} />}
                        <span style={{ padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:600, background: cfg.bg, color: cfg.color }}>{cfg.icon} {cfg.label}</span>
                        <span style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{item.title}</span>
                      </div>
                      <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                        <span style={{ fontSize:11, color:'var(--text3)' }}>{item.authorName} · {item.createdAt ? new Date(item.createdAt).toLocaleDateString('id') : ''}</span>
                        {canManage && <>
                          <button className="btn btn-icon btn-sm" onClick={e => { e.stopPropagation(); togglePin(item) }} title={item.pinned ? 'Unpin' : 'Pin'} style={{ fontSize:12 }}>📌</button>
                          <button className="btn btn-icon btn-sm" onClick={e => { e.stopPropagation(); setEditing(item) }} style={{ fontSize:12 }}>✏️</button>
                          <button className="btn btn-icon btn-sm" onClick={e => { e.stopPropagation(); del(item._id) }} style={{ fontSize:12 }}>🗑</button>
                        </>}
                      </div>
                    </div>
                    <div style={{ fontSize:13, color:'var(--text2)', lineHeight:1.6, marginBottom: item.meetingLink ? 10 : 0 }}>{item.content}</div>
                    {item.meetingLink && (
                      <div style={{ marginTop:10, padding:'10px 14px', background:'var(--bg3)', borderRadius:8, display:'flex', alignItems:'center', gap:10 }}>
                        <span style={{ fontSize:18 }}>{PLATFORM_ICONS[item.meetingPlatform] || '🔗'}</span>
                        <div style={{ flex:1 }}>
                          {item.meetingDate && <div style={{ fontSize:11, color:'var(--text3)', marginBottom:3 }}>📅 {item.meetingDate} {item.meetingTime && `· ⏰ ${item.meetingTime}`}</div>}
                          <a href={item.meetingLink} target="_blank" rel="noopener noreferrer" style={{ color:'var(--blue)', fontSize:13, fontWeight:500, textDecoration:'none' }} onClick={e => e.stopPropagation()}>
                            🔗 Join Meeting →
                          </a>
                        </div>
                        <button className="btn btn-primary btn-sm" onClick={e => { e.stopPropagation(); window.open(item.meetingLink, '_blank') }}>Join</button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        )}
      </div>
    </div>
  )
}
const lbl: React.CSSProperties = { display:'block', fontSize:11, fontWeight:500, color:'var(--text2)', marginBottom:5 }
