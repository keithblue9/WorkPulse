'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'

const STATUS_CFG: Record<string,{label:string;color:string;bg:string}> = {
  active:    { label:'Aktif',     color:'var(--blue)',   bg:'var(--bluebg)' },
  completed: { label:'Selesai',   color:'var(--green)',  bg:'var(--greenbg)' },
  on_hold:   { label:'Hold',      color:'var(--amber)',  bg:'var(--amberbg)' },
  cancelled: { label:'Batal',     color:'var(--red)',    bg:'var(--redbg)' },
}
const PRIORITY_CFG: Record<string,{label:string;color:string}> = {
  high:   { label:'🔴 High',   color:'var(--red)' },
  medium: { label:'🟡 Medium', color:'var(--amber)' },
  low:    { label:'🟢 Low',    color:'var(--green)' },
}

function ProjectForm({ editing, onClose, onSave }: { editing?:any; onClose:()=>void; onSave:()=>void }) {
  const { data:session } = useSession(); const user = session?.user as any
  const [form, setForm] = useState({ title:editing?.title||'', description:editing?.description||'', pic:editing?.pic||user?.name||'', members:editing?.members?.join(', ')||'', status:editing?.status||'active', priority:editing?.priority||'medium', startDate:editing?.startDate||'', endDate:editing?.endDate||'', progress:editing?.progress||0, category:editing?.category||'Others', tags:editing?.tags?.join(', ')||'', color:editing?.color||'#4f8ef7' })
  const [saving, setSaving] = useState(false)
  const set = (k:string,v:any) => setForm(f=>({...f,[k]:v}))

  async function save() {
    if (!form.title) { toast.error('Judul wajib'); return }
    setSaving(true)
    try {
      const url = editing ? `/api/projects/${editing._id}` : '/api/projects'
      await fetch(url, { method:editing?'PATCH':'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ...form, members: form.members.split(',').map((s:string)=>s.trim()).filter(Boolean), tags: form.tags.split(',').map((s:string)=>s.trim()).filter(Boolean) }) })
      toast.success(editing?'Project diperbarui!':'Project dibuat!'); onSave(); onClose()
    } catch { toast.error('Gagal') } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ width:520 }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between' }}>
          <span style={{ fontSize:14, fontWeight:600 }}>{editing?'Edit Project':'+ Project Baru'}</span>
          <button onClick={onClose} className="btn btn-icon">×</button>
        </div>
        <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:11, overflowY:'auto', maxHeight:'72vh' }}>
          <div><label style={lbl}>Judul *</label><input className="input" value={form.title} onChange={e=>set('title',e.target.value)} /></div>
          <div><label style={lbl}>Deskripsi</label><textarea className="input" value={form.description} onChange={e=>set('description',e.target.value)} rows={2} /></div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div><label style={lbl}>PIC</label><input className="input" value={form.pic} onChange={e=>set('pic',e.target.value)} /></div>
            <div><label style={lbl}>Members (koma)</label><input className="input" value={form.members} onChange={e=>set('members',e.target.value)} /></div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
            <div><label style={lbl}>Status</label><select className="input" value={form.status} onChange={e=>set('status',e.target.value)}>{Object.entries(STATUS_CFG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select></div>
            <div><label style={lbl}>Priority</label><select className="input" value={form.priority} onChange={e=>set('priority',e.target.value)}>{Object.entries(PRIORITY_CFG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select></div>
            <div><label style={lbl}>Kategori</label><select className="input" value={form.category} onChange={e=>set('category',e.target.value)}><option value="SI">SI</option><option value="Non-SI">Non-SI</option><option value="Others">Others</option></select></div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div><label style={lbl}>Start Date</label><input type="date" className="input" value={form.startDate} onChange={e=>set('startDate',e.target.value)} /></div>
            <div><label style={lbl}>End Date</label><input type="date" className="input" value={form.endDate} onChange={e=>set('endDate',e.target.value)} /></div>
          </div>
          <div><label style={lbl}>Progress ({form.progress}%)</label><input type="range" min={0} max={100} value={form.progress} onChange={e=>set('progress',Number(e.target.value))} style={{ width:'100%' }} /></div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:10, alignItems:'flex-end' }}>
            <div><label style={lbl}>Tags (koma)</label><input className="input" value={form.tags} onChange={e=>set('tags',e.target.value)} placeholder="KIMs, BRD, OnePro..." /></div>
            <div><label style={lbl}>Warna</label><input type="color" value={form.color} onChange={e=>set('color',e.target.value)} style={{ width:36, height:36, borderRadius:6, border:'1px solid var(--border)', cursor:'pointer' }} /></div>
          </div>
        </div>
        <div style={{ padding:'12px 20px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'flex-end', gap:8 }}>
          <button onClick={onClose} className="btn">Batal</button>
          <button onClick={save} disabled={saving} className="btn btn-primary">{saving?'Menyimpan...':editing?'Simpan':'Buat Project'}</button>
        </div>
      </div>
    </div>
  )
}

export default function ProjectsPage() {
  const { data:session } = useSession(); const user = session?.user as any
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPIC, setFilterPIC] = useState('')

  async function load() {
    const params = new URLSearchParams()
    if (filterStatus) params.set('status', filterStatus)
    const d = await fetch(`/api/projects?${params}`).then(r=>r.json())
    setProjects(d.data||[]); setLoading(false)
  }
  useEffect(()=>{ load() }, [filterStatus])

  async function del(id:string) {
    if (!confirm('Hapus project ini?')) return
    await fetch(`/api/projects/${id}`, { method:'DELETE' })
    toast.success('Dihapus'); load()
  }

  const myProjects = projects.filter(p => p.pic === user?.name || p.members?.includes(user?.name))

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {(showForm||editing) && <ProjectForm editing={editing} onClose={()=>{setShowForm(false);setEditing(null)}} onSave={load} />}
      <div style={{ padding:'12px 20px', borderBottom:'1px solid var(--border)', background:'var(--bg2)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div><div style={{ fontSize:14, fontWeight:600 }}>Projects</div><div style={{ fontSize:11, color:'var(--text3)' }}>Semua project per PIC</div></div>
        <button className="btn btn-primary btn-sm" onClick={()=>setShowForm(true)}>+ Project Baru</button>
      </div>
      <div style={{ display:'flex', gap:8, padding:'8px 20px', background:'var(--bg2)', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
        <select className="input" style={{ width:150 }} value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
          <option value="">Semua Status</option>
          {Object.entries(STATUS_CFG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
        </select>
        <div style={{ marginLeft:'auto', fontSize:12, color:'var(--text3)' }}>{projects.length} project · {myProjects.length} milik saya</div>
      </div>
      <div style={{ flex:1, overflowY:'auto', padding:'16px 20px' }}>
        {loading ? <div style={{ textAlign:'center', padding:40, color:'var(--text3)' }}>Memuat...</div> : (
          projects.length===0 ? (
            <div style={{ textAlign:'center', padding:60, color:'var(--text3)' }}>
              <div style={{ fontSize:32, marginBottom:12 }}>🗂</div>
              <div>Belum ada project</div>
              <button className="btn btn-primary btn-sm" style={{ marginTop:12 }} onClick={()=>setShowForm(true)}>+ Buat Project Pertama</button>
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:10 }}>
              {projects.map((p,i)=>{
                const scfg = STATUS_CFG[p.status]
                const pcfg = PRIORITY_CFG[p.priority]
                const isMyProject = p.pic===user?.name||p.members?.includes(user?.name)
                return (
                  <div key={p._id} className="card fade-in" style={{ padding:'14px 16px', borderTop:`3px solid ${p.color||'var(--blue)'}`, animationDelay:`${i*0.04}s` }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:600, color:'var(--text)', marginBottom:3 }}>{p.title}</div>
                        <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                          <span style={{ padding:'1px 7px', borderRadius:20, fontSize:10, fontWeight:600, background:scfg.bg, color:scfg.color }}>{scfg.label}</span>
                          <span style={{ fontSize:10, color:pcfg.color }}>{pcfg.label}</span>
                          <span style={{ fontSize:10, color:'var(--text3)', background:'var(--bg4)', padding:'1px 6px', borderRadius:20 }}>{p.category}</span>
                          {isMyProject && <span style={{ fontSize:10, color:'var(--blue)', background:'var(--bluebg)', padding:'1px 6px', borderRadius:20 }}>Milik saya</span>}
                        </div>
                      </div>
                      <div style={{ display:'flex', gap:4 }}>
                        <button className="btn btn-icon btn-sm" onClick={()=>setEditing(p)} style={{ fontSize:12 }}>✏️</button>
                        <button className="btn btn-icon btn-sm" onClick={()=>del(p._id)} style={{ fontSize:12 }}>🗑</button>
                      </div>
                    </div>
                    {p.description && <div style={{ fontSize:11, color:'var(--text3)', marginBottom:8, lineHeight:1.4 }}>{p.description}</div>}
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                      <div className="prog-bar" style={{ flex:1 }}><div className="prog-fill" style={{ width:`${p.progress}%`, background:p.progress>=80?'var(--green)':p.progress>=40?p.color||'var(--blue)':'var(--amber)' }} /></div>
                      <span style={{ fontSize:11, fontWeight:600, color:'var(--text2)' }}>{p.progress}%</span>
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--text3)' }}>
                      <span>👤 {p.pic}</span>
                      {p.endDate && <span>📅 {p.endDate}</span>}
                    </div>
                    {p.tags?.length>0 && (
                      <div style={{ display:'flex', gap:4, marginTop:6, flexWrap:'wrap' }}>
                        {p.tags.map((t:string)=><span key={t} style={{ fontSize:9, background:'var(--bg4)', color:'var(--text3)', padding:'1px 6px', borderRadius:20 }}>{t}</span>)}
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
