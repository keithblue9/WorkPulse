'use client'
import { getConfig } from '@/lib/configCache'
// Normalize keys for filtering — handles 'KPI-SI' vs 'KPI - SI' vs 'kpi_si' etc.
function normKey(s:any):string { return String(s||'').toLowerCase().replace(/[\s\-_]/g,'') }

import { picArray } from '@/lib/defaults'
import RichTextarea from '@/components/RichTextarea'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'

function PicTagInput({ value, onChange, members }: { value:string[]; onChange:(v:string[])=>void; members:any[] }) {
  const [input, setInput] = useState('')
  const [showSuggest, setShowSuggest] = useState(false)
  const suggestions = members.filter(m => m.name.toLowerCase().includes(input.toLowerCase()) && !value.includes(m.name)).slice(0,8)
  function addTag(name:string) { if (name && !value.includes(name)) onChange([...value, name]); setInput(''); setShowSuggest(false) }
  function removeTag(name:string) { onChange(value.filter(v=>v!==name)) }
  return (
    <div style={{ position:'relative' }}>
      <div className="input" style={{ display:'flex', flexWrap:'wrap', gap:5, alignItems:'center', minHeight:38, cursor:'text' }} onClick={()=>setShowSuggest(true)}>
        {value.map(name => (
          <span key={name} style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 8px', background:'var(--brand-soft)', color:'var(--brand)', borderRadius:14, fontSize:11, fontWeight:600 }}>
            {name} <span style={{ cursor:'pointer' }} onClick={(e)=>{e.stopPropagation();removeTag(name)}}>×</span>
          </span>
        ))}
        <input style={{ border:'none', background:'transparent', outline:'none', flex:1, minWidth:80, color:'var(--text)', fontSize:12 }}
          value={input} onChange={e=>{setInput(e.target.value);setShowSuggest(true)}} onFocus={()=>setShowSuggest(true)}
          onKeyDown={e=>{ if(e.key==='Enter'){e.preventDefault();if(suggestions[0])addTag(suggestions[0].name);else if(input)addTag(input)} }}
          placeholder={value.length?'':'+ Tag PIC'} />
      </div>
      {showSuggest && suggestions.length > 0 && (
        <div className="glass-strong" style={{ position:'absolute', top:'calc(100% + 4px)', left:0, right:0, borderRadius:8, padding:5, zIndex:10, maxHeight:200, overflowY:'auto' }}>
          {suggestions.map(m => (
            <div key={m._id} onClick={()=>addTag(m.name)} style={{ padding:'6px 9px', borderRadius:6, cursor:'pointer', fontSize:12, display:'flex', alignItems:'center', gap:8 }}
              onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='var(--bg3)'}
              onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='transparent'}>
              <div style={{ width:22, height:22, borderRadius:'50%', background:'var(--brand)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'#fff' }}>{m.name[0]}</div>
              <span>{m.name}</span>
              <span style={{ marginLeft:'auto', fontSize:9, color:'var(--text3)' }}>{m.division||m.role}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ActivityForm({ editing, onClose, onSave, config, members }: { editing?:any; onClose:()=>void; onSave:()=>void; config:any; members:any[] }) {
  const { data:session } = useSession(); const user = session?.user as any
  const [form, setForm] = useState({
    title: editing?.title || '',
    description: editing?.description || '',
    category: editing?.category || (config?.activityCategories?.[0]?.key || 'Others'),
    subType: editing?.subType || (config?.activitySubTypes?.[0]?.key || 'Others'),
    status: editing?.status || 'on_track',
    priority: editing?.priority || 'medium',
    pic: editing?.pic && Array.isArray(editing.pic) ? editing.pic : (editing?.picName ? [editing.picName] : (user?.name ? [user.name] : [])),
    actionDate: editing?.actionDate || '',
    targetWeek: editing?.targetWeek || '',
    progressNotes: editing?.progressNotes || '',
    nextPlan: editing?.nextPlan || '',
    mode: editing?.mode || 'online',
    location: editing?.location || '',
    startTime: editing?.startTime || '',
    endTime: editing?.endTime || '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k:string, v:any) => setForm(f=>({...f, [k]:v}))

  async function save() {
    if (!form.title) { toast.error('Aktivitas wajib diisi'); return }
    if (!form.actionDate) { toast.error('Action Date wajib diisi'); return }
    setSaving(true)
    try {
      const url = editing ? `/api/projects/${editing._id}` : '/api/projects'
      const r = await fetch(url, { method: editing?'PATCH':'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ ...form, picName: form.pic[0] || '', members: form.pic }) })
      if (!r.ok) { const e = await r.json(); toast.error('Gagal: '+(e.error||r.statusText)); return }
      toast.success(editing?'Diperbarui!':'Aktivitas dibuat!'); onSave(); onClose()
    } catch { toast.error('Gagal') } finally { setSaving(false) }
  }

  async function del() {
    if (!confirm('Hapus aktivitas ini?')) return
    await fetch(`/api/projects/${editing._id}`, { method:'DELETE' })
    toast.success('Dihapus'); onSave(); onClose()
  }

  const cats = config?.activityCategories?.filter((c:any)=>c.active) || []
  const subs = config?.activitySubTypes?.filter((s:any)=>s.active) || []
  const statuses = config?.issueStatuses?.filter((s:any)=>s.active) || []

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ width:620 }}>
        <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:14, fontWeight:600 }}>{editing?'Edit':'+ Aktivitas Baru'}</div>
            <div style={{ fontSize:10, color:'var(--text3)' }}>Akan muncul juga di Issues & Calendar</div>
          </div>
          <button onClick={onClose} className="btn btn-icon">×</button>
        </div>
        <div style={{ padding:'14px 20px', overflowY:'auto', maxHeight:'76vh', display:'flex', flexDirection:'column', gap:11 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div><label style={lbl}>Kategori</label>
              <select className="input" value={form.category} onChange={e=>set('category', e.target.value)}>
                {cats.map((c:any)=><option key={c.key} value={c.key}>{c.label}</option>)}
              </select></div>
            <div><label style={lbl}>Sub Tipe</label>
              <select className="input" value={form.subType} onChange={e=>set('subType', e.target.value)}>
                {subs.map((s:any)=><option key={s.key} value={s.key}>{s.label}</option>)}
              </select></div>
          </div>
          <div><label style={lbl}>Judul Aktivitas *</label>
            <input className="input" value={form.title} onChange={e=>set('title', e.target.value)} placeholder="Title singkat..." /></div>
          <div><label style={lbl}>Aktivitas (Narasi / Point-Point Progress)</label>
            <RichTextarea rows={4} value={form.description} onChange={v=>set('description', v)}
              placeholder="Isi narasi atau point-point progress aktivitas. Klik tombol • atau 1. untuk bullet/numbering" /></div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
            <div><label style={lbl}>Status</label>
              <select className="input" value={form.status} onChange={e=>set('status', e.target.value)}>
                {statuses.map((s:any)=><option key={s.key} value={s.key}>{s.label}</option>)}
              </select></div>
            <div><label style={lbl}>Priority</label>
              <select className="input" value={form.priority} onChange={e=>set('priority', e.target.value)}>
                <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
              </select></div>
            <div><label style={lbl}>Action Date *</label>
              <input type="date" className="input" value={form.actionDate} onChange={e=>set('actionDate', e.target.value)} /></div>
          </div>
          <div><label style={lbl}>PIC (multi tag)</label>
            <PicTagInput value={form.pic} onChange={v=>set('pic', v)} members={members} /></div>
          <div><label style={lbl}>Next Plan (Narasi / Point-Point)</label>
            <RichTextarea rows={3} value={form.nextPlan} onChange={v=>set('nextPlan', v)}
              placeholder="Plan kedepannya. Klik • atau 1. untuk bullet/numbering" /></div>
          <div style={{ display:'grid', gridTemplateColumns:'120px 1fr', gap:10 }}>
            <div><label style={lbl}>Target Week</label>
              <input className="input" value={form.targetWeek} onChange={e=>set('targetWeek', e.target.value)} placeholder="W23" /></div>
            <div><label style={lbl}>Mode</label>
              <div style={{ display:'flex', gap:8 }}>
                <label style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'8px 12px', borderRadius:7, cursor:'pointer', fontSize:12, background:form.mode==='online'?'var(--brand-soft)':'var(--bg3)', border:`1px solid ${form.mode==='online'?'var(--brand)':'var(--border2)'}`, color:form.mode==='online'?'var(--brand)':'var(--text2)' }}>
                  <input type="radio" checked={form.mode==='online'} onChange={()=>set('mode','online')} style={{ display:'none' }} />
                  💻 Online
                </label>
                <label style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'8px 12px', borderRadius:7, cursor:'pointer', fontSize:12, background:form.mode==='offline'?'var(--brand-soft)':'var(--bg3)', border:`1px solid ${form.mode==='offline'?'var(--brand)':'var(--border2)'}`, color:form.mode==='offline'?'var(--brand)':'var(--text2)' }}>
                  <input type="radio" checked={form.mode==='offline'} onChange={()=>set('mode','offline')} style={{ display:'none' }} />
                  📍 Offline
                </label>
              </div></div>
          </div>
          {form.mode === 'offline' && (
            <div><label style={lbl}>Lokasi (Offline)</label>
              <input className="input" value={form.location} onChange={e=>set('location', e.target.value)} placeholder="Gedung, ruangan, kota..." /></div>
          )}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div><label style={lbl}>Mulai (opsional)</label>
              <input type="time" className="input" value={form.startTime} onChange={e=>set('startTime', e.target.value)} /></div>
            <div><label style={lbl}>Selesai (opsional)</label>
              <input type="time" className="input" value={form.endTime} onChange={e=>set('endTime', e.target.value)} /></div>
          </div>
        </div>
        <div style={{ padding:'12px 20px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'space-between' }}>
          {editing ? <button onClick={del} className="btn btn-danger btn-sm">🗑 Hapus</button> : <div />}
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={onClose} className="btn">Batal</button>
            <button onClick={save} disabled={saving} className="btn btn-primary">{saving?'Menyimpan...':editing?'Simpan':'Buat Aktivitas'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

const PRIORITY_CFG: Record<string,{label:string;color:string;bg:string}> = {
  high:{label:'High', color:'var(--red)', bg:'var(--redbg)'},
  medium:{label:'Medium', color:'var(--amber)', bg:'var(--amberbg)'},
  low:{label:'Low', color:'var(--green)', bg:'var(--greenbg)'},
}

export default function ActivitiesPage() {
  const { data:session } = useSession()
  const [activities, setActivities] = useState<any[]>([])
  const [config, setConfig] = useState<any>(null)
  const [members, setMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [filterCat, setFilterCat] = useState('All')
  const [filterSub, setFilterSub] = useState('')
  const [filterPic, setFilterPic] = useState('All')
  const [search, setSearch] = useState('')

  // Read URL params on mount
  useEffect(() => { if (typeof window !== 'undefined') { const sp = new URLSearchParams(window.location.search); const cat = sp.get('cat'); const sub = sp.get('sub'); if (cat) setFilterCat(cat); if (sub) setFilterSub(sub) } }, [])

  async function load() {
    setLoading(true)
    const [a,c,m] = await Promise.all([
      fetch('/api/projects').then(r=>r.json()),
      getConfig().then((data:any)=>({ data })),
      fetch('/api/users').then(r=>r.json()),
    ])
    setActivities(a.data||[]); setConfig(c.data); setMembers((m.data||[]).filter((u:any)=>u.active!==false)); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const cats = config?.activityCategories?.filter((c:any)=>c.active) || []
  const subs = config?.activitySubTypes?.filter((s:any)=>s.active) || []

  const filtered = activities.filter(a => {
    if (search && !a.title.toLowerCase().includes(search.toLowerCase())) return false
    if (filterCat !== 'All' && normKey(a.category) !== normKey(filterCat) && normKey(a.subType) !== normKey(filterCat)) return false
    if (filterSub && normKey(a.subType) !== normKey(filterSub)) return false
    if (filterPic !== 'All' && !picArray(a.pic).includes(filterPic)) return false
    return true
  })

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {(showForm||editing) && <ActivityForm editing={editing} onClose={()=>{setShowForm(false);setEditing(null)}} onSave={load} config={config} members={members} />}

      <div style={{ padding:'12px 20px', borderBottom:'1px solid var(--border)', background:'var(--bg2)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div>
          <div style={{ fontSize:14, fontWeight:600 }}>Activities</div>
          <div style={{ fontSize:11, color:'var(--text3)' }}>Trigger Issues & Calendar · {activities.length} total</div>
        </div>
        <button onClick={()=>setShowForm(true)} className="btn btn-primary btn-sm">+ Aktivitas Baru</button>
      </div>

      <div style={{ display:'flex', gap:8, padding:'10px 20px', background:'var(--bg2)', borderBottom:'1px solid var(--border)', flexShrink:0, flexWrap:'wrap', alignItems:'center' }}>
        <input className="input" style={{ width:180 }} value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Cari..." />
        <select className="input" style={{ width:160 }} value={filterPic} onChange={e=>setFilterPic(e.target.value)}>
          <option value="All">👤 Semua PIC</option>
          {members.map(m => <option key={m._id} value={m.name}>{m.name}</option>)}
        </select>
        <div className="chip-row" style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
          <button onClick={()=>setFilterCat('All')} style={chip(filterCat==='All')}>All</button>
          {subs.map((s:any) => (
            <button key={s.key} onClick={()=>setFilterCat(s.key)} style={chip(filterCat===s.key, s.color)}>{s.label}</button>
          ))}
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'14px 20px' }} className="safe-bottom page-pad">
        {loading ? <div style={{ textAlign:'center', padding:40, color:'var(--text3)' }}>Memuat...</div> :
         filtered.length === 0 ? (
           <div className="card" style={{ textAlign:'center', padding:40, color:'var(--text3)' }}>
             <div style={{ fontSize:34, marginBottom:8 }}>📋</div>
             <div>Belum ada aktivitas</div>
           </div>
         ) : (
           <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
             {filtered.map(a => {
               const catColor = cats.find((c:any)=>c.key===a.category)?.color || 'var(--brand)'
               const subColor = subs.find((s:any)=>s.key===a.subType)?.color || 'var(--text3)'
               return (
                 <div key={a._id} className="card" style={{ padding:'12px 14px', borderLeft:`3px solid ${catColor}`, cursor:'pointer' }} onClick={()=>setEditing(a)}>
                   <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10 }}>
                     <div style={{ flex:1, minWidth:0 }}>
                       <div style={{ display:'flex', flexWrap:'wrap', gap:5, alignItems:'center', marginBottom:5 }}>
                         <span style={{ fontSize:13, fontWeight:600 }}>{a.title}</span>
                         <span className="badge" style={{ background:catColor+'22', color:catColor, fontSize:10 }}>{a.category}</span>
                         <span className="badge" style={{ background:subColor+'22', color:subColor, fontSize:10 }}>{a.subType}</span>
                         {a.priority && <span className="badge" style={{ background:PRIORITY_CFG[a.priority]?.bg, color:PRIORITY_CFG[a.priority]?.color, fontSize:10 }}>{PRIORITY_CFG[a.priority]?.label}</span>}
                         {a.mode === 'offline' && a.location && <span style={{ fontSize:10, color:'var(--text3)' }}>📍 {a.location}</span>}
                       </div>
                       {a.description && <div style={{ fontSize:11, color:'var(--text2)', lineHeight:1.5, marginBottom:5, whiteSpace:'pre-wrap' }}>{a.description.substring(0, 180)}{a.description.length>180?'...':''}</div>}
                       <div style={{ display:'flex', flexWrap:'wrap', gap:10, fontSize:10, color:'var(--text3)' }}>
                         {a.actionDate && <span>📅 {a.actionDate}</span>}
                         {a.targetWeek && <span>🗓 {a.targetWeek}</span>}
                         {picArray(a.pic).length > 0 && <span>👤 {picArray(a.pic).join(', ')}</span>}
                       </div>
                     </div>
                   </div>
                 </div>
               )
             })}
           </div>
         )
        }
      </div>
    </div>
  )
}
function chip(active:boolean, color:string='var(--brand)'):React.CSSProperties { return { padding:'4px 11px', borderRadius:20, fontSize:11, fontWeight:600, cursor:'pointer', border:`1px solid ${active?color:'var(--border)'}`, background:active?color+'1a':'var(--bg3)', color:active?color:'var(--text2)' } }
const lbl: React.CSSProperties = { display:'block', fontSize:11, fontWeight:500, color:'var(--text2)', marginBottom:5 }
