'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

function NoteForm({ editing, onClose, onSave, config, members }: { editing?:any; onClose:()=>void; onSave:()=>void; config:any; members:any[] }) {
  const { data:session } = useSession(); const user = session?.user as any
  const [form, setForm] = useState({
    title: editing?.title || '',
    category: editing?.category || (config?.activityCategories?.[0]?.key || 'Others'),
    date: editing?.date || format(new Date(),'yyyy-MM-dd'),
    content: editing?.content || '',
    picTags: editing?.picTags || [],
    categoryTags: editing?.categoryTags || [],
    tags: editing?.tags?.join(',') || '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k:string,v:any) => setForm(f=>({...f,[k]:v}))

  function togglePic(name:string) { setForm(f=>({...f, picTags: f.picTags.includes(name) ? f.picTags.filter((p:string)=>p!==name) : [...f.picTags, name] })) }
  function toggleCat(key:string) { setForm(f=>({...f, categoryTags: f.categoryTags.includes(key) ? f.categoryTags.filter((c:string)=>c!==key) : [...f.categoryTags, key] })) }

  async function save() {
    if (!form.title) { toast.error('Title wajib'); return }
    setSaving(true)
    try {
      const url = editing ? `/api/notes/${editing._id}` : '/api/notes'
      await fetch(url, { method: editing?'PATCH':'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          ...form, tags: form.tags.split(',').map((s:string)=>s.trim()).filter(Boolean),
          authorId: user?.id||user?.email, authorName: user?.name,
        })
      })
      toast.success(editing?'Diperbarui':'Note dibuat'); onSave(); onClose()
    } catch { toast.error('Gagal') } finally { setSaving(false) }
  }
  async function del() {
    if (!confirm('Hapus note?')) return
    await fetch(`/api/notes/${editing._id}`, { method:'DELETE' })
    toast.success('Dihapus'); onSave(); onClose()
  }

  const cats = config?.activityCategories?.filter((c:any)=>c.active) || []

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ width:580 }}>
        <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between' }}>
          <span style={{ fontSize:14, fontWeight:600 }}>{editing?'Edit Note':'+ Note Baru'}</span>
          <button onClick={onClose} className="btn btn-icon">×</button>
        </div>
        <div style={{ padding:'14px 20px', overflowY:'auto', maxHeight:'72vh', display:'flex', flexDirection:'column', gap:11 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 140px', gap:10 }}>
            <div><label style={lbl}>Title *</label><input className="input" value={form.title} onChange={e=>set('title',e.target.value)} /></div>
            <div><label style={lbl}>Tanggal</label><input type="date" className="input" value={form.date} onChange={e=>set('date',e.target.value)} /></div>
          </div>
          <div><label style={lbl}>Kategori (Kolom Kanban)</label>
            <select className="input" value={form.category} onChange={e=>set('category',e.target.value)}>
              {cats.map((c:any)=><option key={c.key} value={c.key}>{c.label}</option>)}
            </select></div>
          <div><label style={lbl}>Konten / Catatan</label>
            <textarea className="input" rows={6} value={form.content} onChange={e=>set('content',e.target.value)} placeholder="Isi catatan, point-point, narasi..." /></div>
          <div>
            <label style={lbl}>PIC (klik untuk tag)</label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
              {members.map(m => (
                <button key={m._id} onClick={()=>togglePic(m.name)} className="btn btn-sm" style={{ background:form.picTags.includes(m.name)?'var(--brand)':'var(--bg3)', color:form.picTags.includes(m.name)?'#fff':'var(--text2)', borderColor:form.picTags.includes(m.name)?'var(--brand)':'var(--border2)', fontSize:11 }}>{m.name}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={lbl}>Kategori Activities terkait (klik untuk tag)</label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
              {cats.map((c:any) => (
                <button key={c.key} onClick={()=>toggleCat(c.key)} className="btn btn-sm" style={{ background:form.categoryTags.includes(c.key)?c.color:'var(--bg3)', color:form.categoryTags.includes(c.key)?'#fff':'var(--text2)', borderColor:form.categoryTags.includes(c.key)?c.color:'var(--border2)', fontSize:11 }}>{c.label}</button>
              ))}
            </div>
          </div>
          <div><label style={lbl}>Tags (comma)</label><input className="input" value={form.tags} onChange={e=>set('tags',e.target.value)} /></div>
        </div>
        <div style={{ padding:'12px 20px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'space-between' }}>
          {editing ? <button onClick={del} className="btn btn-danger btn-sm">🗑 Hapus</button> : <div/>}
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={onClose} className="btn">Batal</button>
            <button onClick={save} disabled={saving} className="btn btn-primary">{saving?'...':editing?'Simpan':'Buat'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function NotesPage() {
  const [notes, setNotes] = useState<any[]>([])
  const [config, setConfig] = useState<any>(null)
  const [members, setMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [search, setSearch] = useState('')

  async function load() {
    setLoading(true)
    const [n,c,m] = await Promise.all([fetch('/api/notes').then(r=>r.json()), fetch('/api/config').then(r=>r.json()), fetch('/api/users').then(r=>r.json())])
    setNotes(n.data||[]); setConfig(c.data); setMembers((m.data||[]).filter((u:any)=>u.active!==false)); setLoading(false)
  }
  useEffect(() => { load() }, [])
  const cats = config?.activityCategories?.filter((c:any)=>c.active) || []
  function catColor(key:string) { return cats.find((c:any)=>c.key===key)?.color || 'var(--brand)' }
  function catLabel(key:string) { return cats.find((c:any)=>c.key===key)?.label || key }

  // Group notes by category (Kanban columns) + filter by search
  const visible = search ? notes.filter(n => (n.title||'').toLowerCase().includes(search.toLowerCase()) || (n.content||'').toLowerCase().includes(search.toLowerCase())) : notes

  const columns = cats.map((c:any) => ({
    key: c.key, label: c.label, color: c.color,
    items: visible.filter(n => n.category === c.key),
  }))
  // Add "Uncategorized" column for notes whose category isn't in current cats
  const knownKeys = new Set(cats.map((c:any)=>c.key))
  const orphans = visible.filter(n => !knownKeys.has(n.category))
  if (orphans.length > 0) columns.push({ key:'__orphan', label:'Lainnya', color:'#9aa6b3', items: orphans })

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {(showForm||editing) && <NoteForm editing={editing} onClose={()=>{setShowForm(false);setEditing(null)}} onSave={load} config={config} members={members} />}

      <div style={{ padding:'12px 20px', borderBottom:'1px solid var(--border)', background:'var(--bg2)', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
        <div>
          <div style={{ fontSize:14, fontWeight:600 }}>Notes — Kanban</div>
          <div style={{ fontSize:11, color:'var(--text3)' }}>{notes.length} note · Kolom = kategori dari Activities</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <input className="input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Cari..." style={{ width:180 }} />
          <button onClick={()=>setShowForm(true)} className="btn btn-primary btn-sm">+ Note Baru</button>
        </div>
      </div>

      <div style={{ flex:1, overflow:'auto', padding:'14px 20px' }} className="safe-bottom">
        {loading ? <div style={{ textAlign:'center', padding:40, color:'var(--text3)' }}>Memuat...</div> : (
          <div style={{ display:'flex', gap:12, alignItems:'flex-start', minHeight:'100%' }}>
            {columns.map(col => (
              <div key={col.key} style={{ flex:'0 0 280px', display:'flex', flexDirection:'column', gap:8 }}>
                {/* Column header */}
                <div className="card" style={{ padding:'10px 12px', borderTop:`3px solid ${col.color}`, display:'flex', justifyContent:'space-between', alignItems:'center', position:'sticky', top:0, zIndex:2 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ width:8, height:8, borderRadius:'50%', background:col.color }} />
                    <div style={{ fontSize:12, fontWeight:700 }}>{col.label}</div>
                  </div>
                  <div style={{ fontSize:11, color:'var(--text3)', fontWeight:600, background:'var(--bg3)', padding:'2px 8px', borderRadius:10 }}>{col.items.length}</div>
                </div>
                {/* Cards */}
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {col.items.length === 0 ? (
                    <div style={{ padding:'18px 10px', textAlign:'center', color:'var(--text3)', fontSize:10, border:'1px dashed var(--border)', borderRadius:7, background:'var(--bg)' }}>Belum ada note</div>
                  ) : col.items.map(n => (
                    <div key={n._id} className="card glass-hover" onClick={()=>setEditing(n)} style={{ padding:11, cursor:'pointer' }}>
                      <div style={{ fontSize:12, fontWeight:600, marginBottom:5, lineHeight:1.3 }}>{n.title}</div>
                      {n.content && <div style={{ fontSize:10, color:'var(--text2)', lineHeight:1.5, marginBottom:7, whiteSpace:'pre-wrap', maxHeight:60, overflow:'hidden', textOverflow:'ellipsis' }}>{n.content.substring(0,120)}{n.content.length>120?'...':''}</div>}
                      {/* PIC tags */}
                      {n.picTags?.length > 0 && (
                        <div style={{ display:'flex', flexWrap:'wrap', gap:3, marginBottom:5 }}>
                          {n.picTags.slice(0,3).map((p:string) => (
                            <div key={p} style={{ width:20, height:20, borderRadius:'50%', background:'var(--brand)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700, color:'#fff' }} title={p}>{p[0]}</div>
                          ))}
                          {n.picTags.length > 3 && <div style={{ width:20, height:20, borderRadius:'50%', background:'var(--bg3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, color:'var(--text3)' }}>+{n.picTags.length-3}</div>}
                        </div>
                      )}
                      {/* Cross-category tags */}
                      {n.categoryTags?.length > 0 && (
                        <div style={{ display:'flex', flexWrap:'wrap', gap:3, marginBottom:5 }}>
                          {n.categoryTags.filter((k:string)=>k!==n.category).slice(0,3).map((k:string) => (
                            <span key={k} className="badge" style={{ fontSize:8, background:catColor(k)+'22', color:catColor(k) }}>{catLabel(k)}</span>
                          ))}
                        </div>
                      )}
                      <div style={{ fontSize:9, color:'var(--text3)', display:'flex', justifyContent:'space-between' }}>
                        <span>📅 {n.date}</span>
                        {n.authorName && <span>· {n.authorName.split(' ')[0]}</span>}
                      </div>
                    </div>
                  ))}
                </div>
                {/* Quick add at bottom of column */}
                <button onClick={()=>setShowForm(true)} className="btn btn-sm" style={{ width:'100%', justifyContent:'center', borderStyle:'dashed', fontSize:11, color:'var(--text3)' }}>+ Tambah ke {col.label}</button>
              </div>
            ))}
            {columns.length === 0 && <div className="card" style={{ padding:40, textAlign:'center', color:'var(--text3)' }}>Belum ada kategori. Tambah di Config → Kategori.</div>}
          </div>
        )}
      </div>
    </div>
  )
}
const lbl: React.CSSProperties = { display:'block', fontSize:11, fontWeight:500, color:'var(--text2)', marginBottom:5 }
