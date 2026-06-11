'use client'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useSession } from 'next-auth/react'

function InitiativeForm({ editing, onClose, onSave }: { editing?:any; onClose:()=>void; onSave:()=>void }) {
  const [form, setForm] = useState({
    code: editing?.code||'',
    title: editing?.title||'',
    planProgress: editing?.planProgress||0,
    actualProgress: editing?.actualProgress||0,
    status: editing?.status||'on_track',
    year: editing?.year||2026,
    phases: editing?.phases||[{ name:'Phase 1', planPct:0, actualPct:0, planStartMonth:1, planEndMonth:3 }],
  })
  const [saving, setSaving] = useState(false)
  const set = (k:string,v:any) => setForm(f=>({...f,[k]:v}))

  function updatePhase(i:number, patch:any) { set('phases', form.phases.map((p:any,idx:number) => idx===i?{...p,...patch}:p)) }
  function addPhase() { set('phases', [...form.phases, { name:'New Phase', planPct:0, actualPct:0, planStartMonth:1, planEndMonth:3 }]) }
  function delPhase(i:number) {
    if (!confirm('Hapus phase ini?')) return
    set('phases', form.phases.filter((_:any,idx:number)=>idx!==i))
  }

  async function save() {
    if (!form.code || !form.title) { toast.error('Code dan title wajib'); return }
    setSaving(true)
    try {
      const url = editing ? `/api/initiatives/${editing._id}` : '/api/initiatives'
      await fetch(url, { method: editing?'PATCH':'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(form) })
      toast.success(editing?'Diperbarui!':'Initiative dibuat!'); onSave(); onClose()
    } catch { toast.error('Gagal') } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ width:640 }}>
        <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between' }}>
          <span style={{ fontSize:14, fontWeight:600 }}>{editing?'Edit Initiative':'+ Initiative Baru'}</span>
          <button onClick={onClose} className="btn btn-icon">×</button>
        </div>
        <div style={{ padding:'14px 18px', overflowY:'auto', maxHeight:'72vh', display:'flex', flexDirection:'column', gap:11 }}>
          <div style={{ display:'grid', gridTemplateColumns:'120px 1fr', gap:10 }}>
            <div><label style={lbl}>Code *</label><input className="input" value={form.code} onChange={e=>set('code',e.target.value)} placeholder="SI-001" /></div>
            <div><label style={lbl}>Title *</label><input className="input" value={form.title} onChange={e=>set('title',e.target.value)} placeholder="Nama initiative..." /></div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:8 }}>
            <div><label style={lbl}>Plan %</label><input type="number" className="input" value={form.planProgress} onChange={e=>set('planProgress',Number(e.target.value))} /></div>
            <div><label style={lbl}>Actual %</label><input type="number" className="input" value={form.actualProgress} onChange={e=>set('actualProgress',Number(e.target.value))} /></div>
            <div><label style={lbl}>Status</label>
              <select className="input" value={form.status} onChange={e=>set('status',e.target.value)}>
                <option value="on_track">On Track</option><option value="at_risk">At Risk</option>
                <option value="delayed">Delayed</option><option value="completed">Completed</option>
              </select></div>
            <div><label style={lbl}>Year</label><input type="number" className="input" value={form.year} onChange={e=>set('year',Number(e.target.value))} /></div>
          </div>
          <div style={{ borderTop:'1px solid var(--border)', paddingTop:10 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <span style={{ fontSize:12, fontWeight:600 }}>Phases ({form.phases.length})</span>
              <button onClick={addPhase} className="btn btn-sm">+ Tambah Phase</button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {form.phases.map((ph:any,i:number)=>(
                <div key={i} style={{ padding:'8px 10px', background:'var(--bg3)', borderRadius:7 }}>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 70px 70px 70px 70px 30px', gap:6, alignItems:'center' }}>
                    <input className="input" value={ph.name} onChange={e=>updatePhase(i,{name:e.target.value})} placeholder="Phase name" />
                    <input type="number" className="input" value={ph.planPct} onChange={e=>updatePhase(i,{planPct:Number(e.target.value)})} placeholder="Plan%" />
                    <input type="number" className="input" value={ph.actualPct} onChange={e=>updatePhase(i,{actualPct:Number(e.target.value)})} placeholder="Act%" />
                    <input type="number" min={1} max={12} className="input" value={ph.planStartMonth} onChange={e=>updatePhase(i,{planStartMonth:Number(e.target.value)})} placeholder="Start" title="Plan start month" />
                    <input type="number" min={1} max={12} className="input" value={ph.planEndMonth} onChange={e=>updatePhase(i,{planEndMonth:Number(e.target.value)})} placeholder="End" title="Plan end month" />
                    <button onClick={()=>delPhase(i)} className="btn btn-icon btn-sm" style={{ fontSize:13, color:'var(--red)' }}>×</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ padding:'12px 18px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'flex-end', gap:8 }}>
          <button onClick={onClose} className="btn">Batal</button>
          <button onClick={save} disabled={saving} className="btn btn-primary">{saving?'Menyimpan...':editing?'Simpan':'Buat Initiative'}</button>
        </div>
      </div>
    </div>
  )
}

export default function ProgressOfProjectsPage() {
  const { data:session } = useSession(); const user = session?.user as any
  const [config, setConfig] = useState<any>(null)
  const [initiatives, setInitiatives] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)

  async function load() {
    setLoading(true)
    const [c, i] = await Promise.all([fetch('/api/config').then(r=>r.json()), fetch('/api/initiatives').then(r=>r.json())])
    setConfig(c.data); setInitiatives(i.data||[]); setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function del(id:string) {
    if (!confirm('Hapus initiative ini beserta phases?')) return
    await fetch(`/api/initiatives/${id}`, { method:'DELETE' })
    toast.success('Dihapus'); load()
  }

  const canEdit = user?.role === 'admin' || user?.role === 'manager'
  const subTabs = config?.progressSubTabs?.filter((t:any)=>t.active) || []
  const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']
  const CURRENT_MONTH = new Date().getMonth() + 1

  function toggle(id:string) { setExpanded(prev => { const s = new Set(prev); s.has(id)?s.delete(id):s.add(id); return s }) }

  if (loading) return <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text3)' }}>Memuat...</div>

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {(showForm||editing) && <InitiativeForm editing={editing} onClose={()=>{setShowForm(false);setEditing(null)}} onSave={load} />}

      <div style={{ padding:'12px 20px', borderBottom:'1px solid var(--border)', background:'var(--bg2)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div>
          <div style={{ fontSize:14, fontWeight:600 }}>Progress of Projects</div>
          <div style={{ fontSize:11, color:'var(--text3)' }}>Plan vs Actual per kategori · {initiatives.length} initiative</div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <div style={{ display:'flex', gap:12, fontSize:10, color:'var(--text3)' }}>
            <span style={{ display:'flex', alignItems:'center', gap:4 }}><span style={{ width:12, height:7, background:'var(--bg5)', borderRadius:2 }} />Plan</span>
            <span style={{ display:'flex', alignItems:'center', gap:4 }}><span style={{ width:12, height:7, background:'var(--blue)', borderRadius:2, opacity:0.8 }} />Actual</span>
          </div>
          {canEdit && <button className="btn btn-primary btn-sm" onClick={()=>setShowForm(true)}>+ Initiative</button>}
        </div>
      </div>

      <div style={{ display:'flex', gap:4, padding:'8px 20px', background:'var(--bg2)', borderBottom:'1px solid var(--border)', flexShrink:0, flexWrap:'wrap' }}>
        <button onClick={()=>setActiveTab('all')} style={{ padding:'5px 14px', borderRadius:8, fontSize:12, fontWeight:500, cursor:'pointer', border:`1px solid ${activeTab==='all'?'var(--blue)':'var(--border)'}`, background:activeTab==='all'?'var(--bluebg)':'var(--bg3)', color:activeTab==='all'?'var(--blue)':'var(--text2)' }}>All</button>
        {subTabs.map((t:any) => (
          <button key={t.key} onClick={()=>setActiveTab(t.key)} style={{ padding:'5px 14px', borderRadius:8, fontSize:12, fontWeight:500, cursor:'pointer', border:`1px solid ${activeTab===t.key?t.color:'var(--border)'}`, background:activeTab===t.key?t.color+'22':'var(--bg3)', color:activeTab===t.key?t.color:'var(--text2)' }}>{t.label}</button>
        ))}
        <div style={{ flex:1 }} />
        <button className="btn btn-sm" onClick={()=>setExpanded(new Set(initiatives.map(i=>i._id)))}>Expand All</button>
        <button className="btn btn-sm" onClick={()=>setExpanded(new Set())}>Collapse All</button>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'14px 20px' }} className="safe-bottom">
        {initiatives.length === 0 ? (
          <div style={{ textAlign:'center', padding:60, color:'var(--text3)' }}>
            <div style={{ fontSize:32, marginBottom:8 }}>📈</div>
            <div>Belum ada initiative. {canEdit && 'Klik + Initiative untuk mulai.'}</div>
          </div>
        ) : (
        <div className="card" style={{ overflow:'hidden' }}>
          <div style={{ display:'grid', gridTemplateColumns:'36px 1fr 76px 76px 1.2fr 90px', background:'var(--bg3)', borderBottom:'1px solid var(--border)' }}>
            {['','Activity','% Plan','% Actual','','Action'].map((h,i) => (
              <div key={i} style={{ padding:'8px 10px', fontSize:10, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', borderRight: i<5?'1px solid var(--border)':'none' }}>
                {i === 4 ? (
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(12,1fr)' }}>
                    {months.map((m,mi) => <div key={m} style={{ textAlign:'center', fontSize:9, fontWeight:mi+1===CURRENT_MONTH?700:400, color:mi+1===CURRENT_MONTH?'var(--blue)':'var(--text3)' }}>{m}</div>)}
                  </div>
                ) : h}
              </div>
            ))}
          </div>
          {initiatives.map((ini, idx) => {
            const isExpanded = expanded.has(ini._id)
            return (
              <div key={ini._id}>
                <div style={{ display:'grid', gridTemplateColumns:'36px 1fr 76px 76px 1.2fr 90px', background:'var(--bg3)', borderBottom:'1px solid var(--border)' }}>
                  <div onClick={()=>toggle(ini._id)} style={{ padding:'9px 10px', textAlign:'center', fontSize:12, fontWeight:700, color:'var(--blue)', borderRight:'1px solid var(--border)', cursor:'pointer' }}>{idx+1}</div>
                  <div onClick={()=>toggle(ini._id)} style={{ padding:'9px 10px', fontSize:12, fontWeight:700, color:'var(--blue)', display:'flex', alignItems:'center', gap:6, borderRight:'1px solid var(--border)', cursor:'pointer' }}>
                    <span style={{ fontSize:10, color:'var(--text3)', transition:'transform 0.2s', display:'inline-block', transform: isExpanded?'rotate(90deg)':'rotate(0)' }}>▶</span>
                    <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ini.code} — {ini.title}</span>
                  </div>
                  <div style={{ padding:'9px 10px', textAlign:'center', fontSize:12, fontWeight:600, color:'var(--text2)', borderRight:'1px solid var(--border)' }}>{ini.planProgress}%</div>
                  <div style={{ padding:'9px 10px', textAlign:'center', fontSize:12, fontWeight:600, color: ini.actualProgress >= ini.planProgress ? 'var(--green)' : 'var(--amber)', borderRight:'1px solid var(--border)' }}>{ini.actualProgress}%</div>
                  <div style={{ padding:'9px 10px', borderRight:'1px solid var(--border)' }} />
                  <div style={{ padding:'6px', display:'flex', gap:3, justifyContent:'center', alignItems:'center' }}>
                    {canEdit && <>
                      <button onClick={(e)=>{e.stopPropagation();setEditing(ini)}} className="btn btn-icon btn-sm" style={{ fontSize:11 }}>✏️</button>
                      <button onClick={(e)=>{e.stopPropagation();del(ini._id)}} className="btn btn-icon btn-sm" style={{ fontSize:11 }}>🗑</button>
                    </>}
                  </div>
                </div>

                {isExpanded && ini.phases.map((phase:any, pi:number) => {
                  const planLeft = ((phase.planStartMonth-1)/12*100).toFixed(1)
                  const planWidth = (((phase.planEndMonth||12)-phase.planStartMonth+1)/12*100).toFixed(1)
                  const pctColor = phase.actualPct>=100?'var(--green)':phase.actualPct>0?'var(--blue)':'var(--text3)'
                  return (
                    <div key={pi} style={{ display:'grid', gridTemplateColumns:'36px 1fr 76px 76px 1.2fr 90px', borderBottom:'1px solid var(--border)', background:'var(--bg2)' }}>
                      <div style={{ padding:'8px', fontSize:10, color:'var(--text3)', textAlign:'center', borderRight:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center' }}>{idx+1}.{pi+1}</div>
                      <div style={{ padding:'8px 10px', fontSize:11, color:'var(--text)', borderRight:'1px solid var(--border)', display:'flex', alignItems:'center' }}>{phase.name}</div>
                      <div style={{ padding:'8px 10px', textAlign:'center', fontSize:12, fontWeight:600, color:'var(--text2)', borderRight:'1px solid var(--border)' }}>{phase.planPct}%</div>
                      <div style={{ padding:'8px 10px', textAlign:'center', fontSize:12, fontWeight:600, color:pctColor, borderRight:'1px solid var(--border)' }}>{phase.actualPct}%</div>
                      <div style={{ padding:'8px', position:'relative', display:'flex', flexDirection:'column', gap:3, justifyContent:'center', borderRight:'1px solid var(--border)' }}>
                        <div style={{ position:'absolute', left:`${((CURRENT_MONTH-0.5)/12*100).toFixed(1)}%`, top:0, bottom:0, width:1, background:'var(--blue)', opacity:0.3 }} />
                        <div style={{ position:'relative', height:9, background:'var(--bg4)', borderRadius:3 }}>
                          <div style={{ position:'absolute', top:0, left:`${planLeft}%`, width:`${planWidth}%`, height:'100%', background:'var(--bg5)', borderRadius:3 }} />
                        </div>
                        <div style={{ position:'relative', height:9, background:'var(--bg4)', borderRadius:3 }}>
                          <div style={{ position:'absolute', top:0, left:`${planLeft}%`, width:`${Math.min(parseFloat(planWidth) * (phase.actualPct/Math.max(phase.planPct||1, 1)), parseFloat(planWidth))}%`, height:'100%', background:pctColor, borderRadius:3, opacity:0.85 }} />
                        </div>
                      </div>
                      <div />
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
        )}
      </div>
    </div>
  )
}
const lbl: React.CSSProperties = { display:'block', fontSize:11, fontWeight:500, color:'var(--text2)', marginBottom:5 }
