'use client'
import { useEffect, useState, useRef } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'

const STATUS_CFG: Record<string,{label:string;color:string;bg:string}> = {
  active:    { label:'Aktif',   color:'var(--blue)',  bg:'var(--bluebg)' },
  completed: { label:'Selesai', color:'var(--green)', bg:'var(--greenbg)' },
  on_hold:   { label:'Hold',    color:'var(--amber)', bg:'var(--amberbg)' },
  cancelled: { label:'Batal',   color:'var(--red)',   bg:'var(--redbg)' },
}
const PRIORITY_CFG: Record<string,{label:string;color:string}> = {
  high:   { label:'🔴 High',   color:'var(--red)' },
  medium: { label:'🟡 Medium', color:'var(--amber)' },
  low:    { label:'🟢 Low',    color:'var(--green)' },
}

function PicTagInput({ value, onChange, members }: { value:string[]; onChange:(v:string[])=>void; members:any[] }) {
  const [input, setInput] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function h(e:MouseEvent) { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setShowSuggestions(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  function addTag(name:string) {
    if (!name.trim() || value.includes(name)) return
    onChange([...value, name.trim()])
    setInput('')
  }
  function removeTag(name:string) { onChange(value.filter(v => v !== name)) }

  const suggestions = input ? members.filter(m => m.name.toLowerCase().includes(input.toLowerCase()) && !value.includes(m.name)).slice(0,5) : []

  return (
    <div ref={wrapRef} style={{ position:'relative' }}>
      <div style={{ display:'flex', flexWrap:'wrap', gap:5, padding:6, background:'var(--bg3)', border:'1px solid var(--border2)', borderRadius:6, minHeight:36 }}>
        {value.map(tag => {
          const isMember = members.some(m => m.name === tag)
          return (
            <span key={tag} style={{ padding:'2px 8px', borderRadius:20, fontSize:11, background:isMember?'var(--bluebg)':'var(--bg4)', color:isMember?'var(--blue)':'var(--text2)', display:'flex', alignItems:'center', gap:5 }}>
              {isMember?'@':'+'} {tag}
              <span onClick={()=>removeTag(tag)} style={{ cursor:'pointer', opacity:0.6 }}>×</span>
            </span>
          )
        })}
        <input value={input} onChange={e=>{setInput(e.target.value);setShowSuggestions(true)}}
          onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addTag(input)}else if(e.key==='Backspace'&&!input&&value.length){removeTag(value[value.length-1])}}}
          onFocus={()=>setShowSuggestions(true)}
          placeholder={value.length===0?"Ketik nama atau pilih member...":""}
          style={{ flex:1, minWidth:120, border:'none', outline:'none', background:'transparent', color:'var(--text)', fontSize:12 }} />
      </div>
      {showSuggestions && (suggestions.length > 0 || input) && (
        <div style={{ position:'absolute', top:'100%', left:0, right:0, marginTop:4, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:6, zIndex:10, maxHeight:160, overflowY:'auto', boxShadow:'var(--shadow-sm)' }}>
          {suggestions.map(s => (
            <div key={s._id} onClick={()=>addTag(s.name)} style={{ padding:'7px 10px', cursor:'pointer', fontSize:12, display:'flex', alignItems:'center', gap:8 }}
              onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='var(--bg3)'}
              onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='transparent'}>
              <div style={{ width:22, height:22, borderRadius:'50%', background:'var(--blue2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700, color:'#fff' }}>{s.name[0]}</div>
              <span style={{ color:'var(--text)' }}>{s.name}</span>
              <span style={{ marginLeft:'auto', fontSize:10, color:'var(--text3)' }}>{s.division}</span>
            </div>
          ))}
          {input && !suggestions.some(s => s.name === input) && (
            <div onClick={()=>addTag(input)} style={{ padding:'7px 10px', cursor:'pointer', fontSize:12, color:'var(--blue)', borderTop: suggestions.length?'1px solid var(--border)':'none' }}
              onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='var(--bg3)'}
              onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='transparent'}>
              + Tambah "{input}" (PIC luar member)
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ActivityForm({ editing, onClose, onSave, categories, subTypes, members }: { editing?:any; onClose:()=>void; onSave:()=>void; categories:any[]; subTypes:any[]; members:any[] }) {
  const { data:session } = useSession(); const user = session?.user as any
  const [form, setForm] = useState({
    title:editing?.title||'', description:editing?.description||'',
    pic:editing?.pic||user?.name||'',
    members:editing?.members||[],
    status:editing?.status||'active',
    priority:editing?.priority||'medium',
    startDate:editing?.startDate||'',
    endDate:editing?.endDate||'',
    progress:editing?.progress||0,
    category:editing?.category||categories[0]?.key||'iVendor',
    subType:editing?.subType||subTypes[0]?.key||'KPI-SI',
    tags:editing?.tags?.join(', ')||'',
    color:editing?.color||'#4f8ef7',
  })
  const [saving, setSaving] = useState(false)
  const set = (k:string,v:any) => setForm(f=>({...f,[k]:v}))

  async function save() {
    if (!form.title) { toast.error('Judul wajib'); return }
    setSaving(true)
    try {
      const url = editing ? `/api/projects/${editing._id}` : '/api/projects'
      await fetch(url, { method:editing?'PATCH':'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ ...form, tags: form.tags.split(',').map((s:string)=>s.trim()).filter(Boolean) }) })
      toast.success(editing?'Activity diperbarui!':'Activity dibuat!'); onSave(); onClose()
    } catch { toast.error('Gagal') } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ width:560 }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between' }}>
          <span style={{ fontSize:14, fontWeight:600 }}>{editing?'Edit Activity':'+ Activity Baru'}</span>
          <button onClick={onClose} className="btn btn-icon">×</button>
        </div>
        <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:11, overflowY:'auto', maxHeight:'72vh' }}>
          <div><label style={lbl}>Judul *</label><input className="input" value={form.title} onChange={e=>set('title',e.target.value)} /></div>
          <div><label style={lbl}>Deskripsi</label><textarea className="input" value={form.description} onChange={e=>set('description',e.target.value)} rows={2} /></div>
          <div><label style={lbl}>PIC (member atau ketik luar member)</label>
            <PicTagInput value={form.members} onChange={v=>set('members',v)} members={members} />
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div><label style={lbl}>Kategori</label>
              <select className="input" value={form.category} onChange={e=>set('category',e.target.value)}>
                {categories.map((c:any)=><option key={c.key} value={c.key}>{c.label}</option>)}
              </select></div>
            <div><label style={lbl}>Sub-tipe</label>
              <select className="input" value={form.subType} onChange={e=>set('subType',e.target.value)}>
                {subTypes.map((s:any)=><option key={s.key} value={s.key}>{s.label}</option>)}
              </select></div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div><label style={lbl}>Status</label>
              <select className="input" value={form.status} onChange={e=>set('status',e.target.value)}>
                {Object.entries(STATUS_CFG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
              </select></div>
            <div><label style={lbl}>Priority</label>
              <select className="input" value={form.priority} onChange={e=>set('priority',e.target.value)}>
                {Object.entries(PRIORITY_CFG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
              </select></div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div><label style={lbl}>Start</label><input type="date" className="input" value={form.startDate} onChange={e=>set('startDate',e.target.value)} /></div>
            <div><label style={lbl}>End</label><input type="date" className="input" value={form.endDate} onChange={e=>set('endDate',e.target.value)} /></div>
          </div>
          <div><label style={lbl}>Progress ({form.progress}%)</label><input type="range" min={0} max={100} value={form.progress} onChange={e=>set('progress',Number(e.target.value))} style={{ width:'100%' }} /></div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:10, alignItems:'flex-end' }}>
            <div><label style={lbl}>Tags (koma)</label><input className="input" value={form.tags} onChange={e=>set('tags',e.target.value)} placeholder="KIMs, BRD, OnePro..." /></div>
            <div><label style={lbl}>Warna</label><input type="color" value={form.color} onChange={e=>set('color',e.target.value)} style={{ width:36, height:36, borderRadius:6, border:'1px solid var(--border)', cursor:'pointer' }} /></div>
          </div>
        </div>
        <div style={{ padding:'12px 20px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'flex-end', gap:8 }}>
          <button onClick={onClose} className="btn">Batal</button>
          <button onClick={save} disabled={saving} className="btn btn-primary">{saving?'Menyimpan...':editing?'Simpan':'Buat Activity'}</button>
        </div>
      </div>
    </div>
  )
}

export default function ActivitiesPage() {
  const { data:session } = useSession(); const user = session?.user as any
  const [activities, setActivities] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [subTypes, setSubTypes] = useState<any[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [filterCat, setFilterCat] = useState('All')

  async function loadAll() {
    setLoading(true)
    const [proj, cfg, usr] = await Promise.all([
      fetch('/api/projects').then(r=>r.json()),
      fetch('/api/config').then(r=>r.json()),
      fetch('/api/users').then(r=>r.json()),
    ])
    setActivities(proj.data||[])
    setCategories(cfg.data?.activityCategories?.filter((c:any)=>c.active) || [])
    setSubTypes(cfg.data?.activitySubTypes?.filter((c:any)=>c.active) || [])
    setMembers((usr.data||[]).filter((u:any)=>u.active!==false))
    setLoading(false)
  }
  useEffect(() => { loadAll() }, [])

  async function del(id:string) {
    if (!confirm('Hapus activity ini?')) return
    await fetch(`/api/projects/${id}`, { method:'DELETE' })
    toast.success('Dihapus'); loadAll()
  }

  const filtered = filterCat === 'All' ? activities : activities.filter(a => a.category === filterCat)
  const catCounts: Record<string,number> = { All: activities.length }
  categories.forEach((c:any) => { catCounts[c.key] = activities.filter(a => a.category === c.key).length })

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {(showForm||editing) && <ActivityForm editing={editing} onClose={()=>{setShowForm(false);setEditing(null)}} onSave={loadAll} categories={categories} subTypes={subTypes} members={members} />}

      <div style={{ padding:'12px 20px', borderBottom:'1px solid var(--border)', background:'var(--bg2)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div><div style={{ fontSize:14, fontWeight:600 }}>Activities</div><div style={{ fontSize:11, color:'var(--text3)' }}>Semua activity per PIC · {categories.length} kategori</div></div>
        <button className="btn btn-primary btn-sm" onClick={()=>setShowForm(true)}>+ Activity Baru</button>
      </div>

      <div style={{ display:'flex', gap:6, padding:'8px 20px', background:'var(--bg2)', borderBottom:'1px solid var(--border)', flexShrink:0, flexWrap:'wrap' }}>
        <button onClick={()=>setFilterCat('All')} style={{ padding:'4px 12px', borderRadius:20, fontSize:11, fontWeight:500, cursor:'pointer', border:`1px solid ${filterCat==='All'?'var(--blue)':'var(--border)'}`, background:filterCat==='All'?'var(--bluebg)':'var(--bg3)', color:filterCat==='All'?'var(--blue)':'var(--text2)' }}>
          All <span style={{ opacity:0.6 }}>({catCounts.All})</span>
        </button>
        {categories.map((c:any) => (
          <button key={c.key} onClick={()=>setFilterCat(c.key)} style={{ padding:'4px 12px', borderRadius:20, fontSize:11, fontWeight:500, cursor:'pointer', border:`1px solid ${filterCat===c.key?c.color:'var(--border)'}`, background:filterCat===c.key?c.color+'22':'var(--bg3)', color:filterCat===c.key?c.color:'var(--text2)' }}>
            {c.label} <span style={{ opacity:0.6 }}>({catCounts[c.key]||0})</span>
          </button>
        ))}
        <div style={{ marginLeft:'auto', fontSize:12, color:'var(--text3)' }}>{filtered.length} activity</div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'14px 20px' }}>
        {loading ? <div style={{ textAlign:'center', padding:40, color:'var(--text3)' }}>Memuat...</div> : (
          filtered.length === 0 ? (
            <div style={{ textAlign:'center', padding:60, color:'var(--text3)' }}>
              <div style={{ fontSize:32, marginBottom:12 }}>⚡</div>
              <div>Belum ada activity</div>
              <button className="btn btn-primary btn-sm" style={{ marginTop:12 }} onClick={()=>setShowForm(true)}>+ Buat Activity Pertama</button>
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))', gap:10 }}>
              {filtered.map((p, i) => {
                const scfg = STATUS_CFG[p.status]
                const pcfg = PRIORITY_CFG[p.priority]
                const catDef = categories.find((c:any)=>c.key===p.category)
                return (
                  <div key={p._id} className="card fade-in" style={{ padding:'14px 16px', borderTop:`3px solid ${catDef?.color||p.color||'var(--blue)'}`, animationDelay:`${i*0.04}s` }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:600, color:'var(--text)', marginBottom:4 }}>{p.title}</div>
                        <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                          {scfg && <span style={{ padding:'1px 7px', borderRadius:20, fontSize:10, fontWeight:600, background:scfg.bg, color:scfg.color }}>{scfg.label}</span>}
                          {pcfg && <span style={{ fontSize:10, color:pcfg.color }}>{pcfg.label}</span>}
                          {catDef && <span style={{ fontSize:10, color:catDef.color, background:catDef.color+'22', padding:'1px 6px', borderRadius:20 }}>{catDef.label}</span>}
                        </div>
                      </div>
                      <div style={{ display:'flex', gap:4 }}>
                        <button className="btn btn-icon btn-sm" onClick={()=>setEditing(p)} style={{ fontSize:12 }}>✏️</button>
                        <button className="btn btn-icon btn-sm" onClick={()=>del(p._id)} style={{ fontSize:12 }}>🗑</button>
                      </div>
                    </div>
                    {p.description && <div style={{ fontSize:11, color:'var(--text3)', marginBottom:8, lineHeight:1.4 }}>{p.description}</div>}
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                      <div className="prog-bar" style={{ flex:1 }}><div className="prog-fill" style={{ width:`${p.progress}%`, background:p.progress>=80?'var(--green)':p.progress>=40?(catDef?.color||'var(--blue)'):'var(--amber)' }} /></div>
                      <span style={{ fontSize:11, fontWeight:600, color:'var(--text2)' }}>{p.progress}%</span>
                    </div>
                    {p.members?.length > 0 && (
                      <div style={{ display:'flex', gap:3, flexWrap:'wrap', marginBottom:6 }}>
                        {p.members.map((m:string, mi:number) => {
                          const isMember = members.some(mb => mb.name === m)
                          return (
                            <span key={mi} style={{ fontSize:10, padding:'1px 7px', borderRadius:20, background:isMember?'var(--bluebg)':'var(--bg4)', color:isMember?'var(--blue)':'var(--text3)' }}>
                              {isMember?'@':'+'}{m}
                            </span>
                          )
                        })}
                      </div>
                    )}
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'var(--text3)' }}>
                      {p.startDate && p.endDate && <span>📅 {p.startDate} → {p.endDate}</span>}
                    </div>
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
