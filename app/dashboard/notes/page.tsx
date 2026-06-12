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
          <div><label style={lbl}>Kategori</label>
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
  const [filterCat, setFilterCat] = useState('All')

  async function load() {
    setLoading(true)
    const [n,c,m] = await Promise.all([fetch('/api/notes').then(r=>r.json()), fetch('/api/config').then(r=>r.json()), fetch('/api/users').then(r=>r.json())])
    setNotes(n.data||[]); setConfig(c.data); setMembers((m.data||[]).filter((u:any)=>u.active!==false)); setLoading(false)
  }
  useEffect(() => { load() }, [])
  const cats = config?.activityCategories?.filter((c:any)=>c.active) || []
  const filtered = filterCat==='All' ? notes : notes.filter(n => n.category === filterCat)
  function catColor(key:string) { return cats.find((c:any)=>c.key===key)?.color || 'var(--brand)' }

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {(showForm||editing) && <NoteForm editing={editing} onClose={()=>{setShowForm(false);setEditing(null)}} onSave={load} config={config} members={members} />}

      <div style={{ padding:'12px 20px', borderBottom:'1px solid var(--border)', background:'var(--bg2)', display:'flex', justifyContent:'space-between', flexShrink:0 }}>
        <div>
          <div style={{ fontSize:14, fontWeight:600 }}>Notes</div>
          <div style={{ fontSize:11, color:'var(--text3)' }}>Catatan project · {notes.length} note</div>
        </div>
        <button onClick={()=>setShowForm(true)} className="btn btn-primary btn-sm">+ Note Baru</button>
      </div>

      <div style={{ display:'flex', gap:5, padding:'10px 20px', background:'var(--bg2)', borderBottom:'1px solid var(--border)', flexShrink:0, flexWrap:'wrap' }}>
        <button onClick={()=>setFilterCat('All')} style={chip(filterCat==='All')}>All</button>
        {cats.map((c:any) => (
          <button key={c.key} onClick={()=>setFilterCat(c.key)} style={chip(filterCat===c.key, c.color)}>{c.label}</button>
        ))}
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'14px 20px' }} className="safe-bottom">
        {loading ? <div style={{ textAlign:'center', padding:40, color:'var(--text3)' }}>Memuat...</div> :
         filtered.length === 0 ? (
           <div className="card" style={{ textAlign:'center', padding:40, color:'var(--text3)' }}><div style={{ fontSize:30, marginBottom:8 }}>📝</div><div>Belum ada note</div></div>
         ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:10 }}>
            {filtered.map(n => (
              <div key={n._id} className="card" onClick={()=>setEditing(n)} style={{ padding:14, cursor:'pointer', borderLeft:`3px solid ${catColor(n.category)}` }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6, gap:6 }}>
                  <div style={{ fontSize:13, fontWeight:600, flex:1 }}>{n.title}</div>
                  <span className="badge" style={{ background:catColor(n.category)+'22', color:catColor(n.category), fontSize:9 }}>{n.category}</span>
                </div>
                <div style={{ fontSize:11, color:'var(--text2)', whiteSpace:'pre-wrap', lineHeight:1.5, marginBottom:8 }}>{(n.content||'').substring(0,150)}{n.content?.length>150?'...':''}</div>
                <div style={{ display:'flex', gap:8, fontSize:10, color:'var(--text3)' }}>
                  <span>📅 {n.date}</span>
                  {n.picTags?.length > 0 && <span>👤 {n.picTags.length}</span>}
                </div>
              </div>
            ))}
          </div>
         )}
      </div>
    </div>
  )
}
function chip(active:boolean, color:string='var(--brand)'):React.CSSProperties { return { padding:'4px 11px', borderRadius:20, fontSize:11, fontWeight:600, cursor:'pointer', border:`1px solid ${active?color:'var(--border)'}`, background:active?color+'1a':'var(--bg3)', color:active?color:'var(--text2)' } }
const lbl: React.CSSProperties = { display:'block', fontSize:11, fontWeight:500, color:'var(--text2)', marginBottom:5 }
