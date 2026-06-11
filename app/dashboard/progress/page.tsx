'use client'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useSession } from 'next-auth/react'

const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']

// ─── Visual Month Range Picker ──────────────────────────────
function MonthRangePicker({ label, color, start, end, onChange }: { label:string; color:string; start?:number; end?:number; onChange:(s:number,e:number)=>void }) {
  const [dragMode, setDragMode] = useState<'none'|'start'|'end'>('none')
  const [hoverMonth, setHoverMonth] = useState<number|null>(null)

  function handleClick(m:number) {
    if (!start || !end) { onChange(m, m); return }
    if (m < start) onChange(m, end)
    else if (m > end) onChange(start, m)
    else { onChange(m, m) }
  }

  const inRange = (m:number) => start && end && m >= start && m <= end
  const isHovered = (m:number) => hoverMonth === m

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
        <span style={{ fontSize:11, fontWeight:600, color }}>{label}</span>
        <span style={{ fontSize:10, color:'var(--text3)' }}>
          {start && end ? `${MONTHS[start-1]} – ${MONTHS[end-1]}` : 'Belum di-set'}
        </span>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(12,1fr)', gap:2, padding:2, background:'var(--bg4)', borderRadius:6 }}>
        {MONTHS.map((mn,i) => {
          const m = i+1
          const active = inRange(m)
          return (
            <div key={m} onClick={()=>handleClick(m)} onMouseEnter={()=>setHoverMonth(m)} onMouseLeave={()=>setHoverMonth(null)}
              style={{
                padding:'5px 0', textAlign:'center', fontSize:9, fontWeight:600, cursor:'pointer',
                borderRadius:4, transition:'all 0.15s',
                background: active ? color : isHovered(m) ? color+'33' : 'transparent',
                color: active ? '#fff' : isHovered(m) ? color : 'var(--text3)',
              }}>{mn}</div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Phase Editor Card ──────────────────────────────────────
function PhaseEditor({ phase, idx, onChange, onDelete }: { phase:any; idx:number; onChange:(p:any)=>void; onDelete:()=>void }) {
  return (
    <div className="glass" style={{ padding:'14px 16px', borderRadius:12, marginBottom:8 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
        <div style={{ width:28, height:28, borderRadius:'50%', background:'var(--bluebg)', color:'var(--blue)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, flexShrink:0 }}>{idx+1}</div>
        <input className="input" value={phase.name} onChange={e=>onChange({...phase, name:e.target.value})} placeholder="Nama phase..." style={{ flex:1, fontWeight:500 }} />
        <button onClick={onDelete} className="btn btn-icon" style={{ fontSize:14, color:'var(--red)' }} title="Hapus phase">🗑</button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        {/* PLAN */}
        <div style={{ padding:'10px 12px', background:'var(--bg3)', borderRadius:8 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
            <span style={{ fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.07em' }}>📋 PLAN</span>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <input type="number" min={0} max={100} className="input" value={phase.planPct||0} onChange={e=>onChange({...phase, planPct:Number(e.target.value)})} style={{ width:55, padding:'3px 6px', fontSize:11, textAlign:'center' }} />
              <span style={{ fontSize:11, color:'var(--text2)', fontWeight:600 }}>%</span>
            </div>
          </div>
          <MonthRangePicker label="Periode Plan" color="#9da3b8" start={phase.planStartMonth} end={phase.planEndMonth} onChange={(s,e)=>onChange({...phase, planStartMonth:s, planEndMonth:e})} />
        </div>

        {/* ACTUAL */}
        <div style={{ padding:'10px 12px', background:'var(--bluebg)', borderRadius:8, border:'1px solid var(--blue)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
            <span style={{ fontSize:10, fontWeight:700, color:'var(--blue)', textTransform:'uppercase', letterSpacing:'0.07em' }}>⚡ ACTUAL</span>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <input type="number" min={0} max={100} className="input" value={phase.actualPct||0} onChange={e=>onChange({...phase, actualPct:Number(e.target.value)})} style={{ width:55, padding:'3px 6px', fontSize:11, textAlign:'center' }} />
              <span style={{ fontSize:11, color:'var(--blue)', fontWeight:600 }}>%</span>
            </div>
          </div>
          <MonthRangePicker label="Periode Actual" color="#4f8ef7" start={phase.actualStartMonth} end={phase.actualEndMonth} onChange={(s,e)=>onChange({...phase, actualStartMonth:s, actualEndMonth:e})} />
        </div>
      </div>
    </div>
  )
}

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

  function updatePhase(i:number, newPhase:any) { set('phases', form.phases.map((p:any,idx:number) => idx===i?newPhase:p)) }
  function addPhase() { set('phases', [...form.phases, { name:`Phase ${form.phases.length+1}`, planPct:0, actualPct:0, planStartMonth:1, planEndMonth:3 }]) }
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
      <div className="glass-strong scale-in" style={{ borderRadius:18, width:720, maxWidth:'92vw', maxHeight:'90vh', overflow:'hidden', display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'16px 22px', borderBottom:'1px solid var(--glass-border)', display:'flex', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:15, fontWeight:600 }}>{editing?'Edit Initiative':'+ Initiative Baru'}</div>
            <div style={{ fontSize:10, color:'var(--text3)' }}>Strategic Initiative dengan multi-phase tracking</div>
          </div>
          <button onClick={onClose} className="btn btn-icon">×</button>
        </div>
        <div style={{ padding:'18px 22px', overflowY:'auto', flex:1 }}>
          <div className="glass" style={{ padding:'14px 16px', borderRadius:12, marginBottom:16 }}>
            <div style={{ fontSize:11, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:10 }}>Informasi Initiative</div>
            <div style={{ display:'grid', gridTemplateColumns:'120px 1fr', gap:10, marginBottom:10 }}>
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
          </div>

          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
            <div>
              <div style={{ fontSize:13, fontWeight:600 }}>Phases ({form.phases.length})</div>
              <div style={{ fontSize:10, color:'var(--text3)' }}>Klik bulan untuk set range Plan & Actual</div>
            </div>
            <button onClick={addPhase} className="btn btn-sm btn-primary">+ Tambah Phase</button>
          </div>
          {form.phases.map((ph:any,i:number)=>(
            <PhaseEditor key={i} phase={ph} idx={i} onChange={p=>updatePhase(i,p)} onDelete={()=>delPhase(i)} />
          ))}
        </div>
        <div style={{ padding:'14px 22px', borderTop:'1px solid var(--glass-border)', display:'flex', justifyContent:'flex-end', gap:8 }}>
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
  const CURRENT_MONTH = new Date().getMonth() + 1

  function toggle(id:string) { setExpanded(prev => { const s = new Set(prev); s.has(id)?s.delete(id):s.add(id); return s }) }

  if (loading) return <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text3)' }}>Memuat...</div>

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', position:'relative' }}>
      <div className="ambient-bg" style={{ position:'fixed' }}>
        <div className="orb" style={{ width:380, height:380, background:'#4f8ef7', top:'5%', left:'10%' }} />
        <div className="orb" style={{ width:340, height:340, background:'#a78bfa', bottom:'10%', right:'5%', animationDelay:'-8s' }} />
      </div>

      {(showForm||editing) && <InitiativeForm editing={editing} onClose={()=>{setShowForm(false);setEditing(null)}} onSave={load} />}

      <div className="glass" style={{ padding:'14px 22px', borderBottom:'1px solid var(--glass-border)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0, position:'relative', zIndex:1 }}>
        <div>
          <div style={{ fontSize:16, fontWeight:700, letterSpacing:'-0.02em' }} className="gradient-text">Progress of Projects</div>
          <div style={{ fontSize:11, color:'var(--text3)' }}>Plan vs Actual per phase · {initiatives.length} initiative</div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <div style={{ display:'flex', gap:12, fontSize:10, color:'var(--text3)' }}>
            <span style={{ display:'flex', alignItems:'center', gap:4 }}><span style={{ width:12, height:7, background:'var(--bg5)', borderRadius:2 }} />Plan</span>
            <span style={{ display:'flex', alignItems:'center', gap:4 }}><span style={{ width:12, height:7, background:'var(--blue)', borderRadius:2, opacity:0.8 }} />Actual</span>
          </div>
          {canEdit && <button className="btn btn-primary btn-sm" onClick={()=>setShowForm(true)}>+ Initiative</button>}
        </div>
      </div>

      <div style={{ display:'flex', gap:5, padding:'10px 22px', flexShrink:0, flexWrap:'wrap', position:'relative', zIndex:1 }}>
        <button onClick={()=>setActiveTab('all')} className={activeTab==='all'?'glass-strong':'glass'} style={{ padding:'6px 16px', borderRadius:20, fontSize:12, fontWeight:600, cursor:'pointer', color:activeTab==='all'?'var(--blue)':'var(--text2)', border: activeTab==='all'?'1px solid var(--blue)':'1px solid var(--glass-border)' }}>All</button>
        {subTabs.map((t:any) => (
          <button key={t.key} onClick={()=>setActiveTab(t.key)} className={activeTab===t.key?'glass-strong':'glass'} style={{ padding:'6px 16px', borderRadius:20, fontSize:12, fontWeight:600, cursor:'pointer', color:activeTab===t.key?t.color:'var(--text2)', border: activeTab===t.key?`1px solid ${t.color}`:'1px solid var(--glass-border)' }}>{t.label}</button>
        ))}
        <div style={{ flex:1 }} />
        <button className="btn btn-sm" onClick={()=>setExpanded(new Set(initiatives.map(i=>i._id)))}>Expand All</button>
        <button className="btn btn-sm" onClick={()=>setExpanded(new Set())}>Collapse All</button>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'14px 22px 24px', position:'relative', zIndex:1 }} className="safe-bottom">
        {initiatives.length === 0 ? (
          <div className="glass" style={{ textAlign:'center', padding:60, color:'var(--text3)', borderRadius:18 }}>
            <div style={{ fontSize:36, marginBottom:8 }}>📈</div>
            <div style={{ fontSize:12 }}>Belum ada initiative. {canEdit && 'Klik + Initiative untuk mulai.'}</div>
          </div>
        ) : (
        <div className="glass" style={{ borderRadius:14, overflow:'hidden' }}>
          <div style={{ display:'grid', gridTemplateColumns:'36px 1fr 76px 76px 1.2fr 90px', background:'var(--bg3)', borderBottom:'1px solid var(--glass-border)' }}>
            {['','Activity','% Plan','% Actual','','Action'].map((h,i) => (
              <div key={i} style={{ padding:'10px', fontSize:10, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.05em', borderRight: i<5?'1px solid var(--glass-border)':'none' }}>
                {i === 4 ? (
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(12,1fr)' }}>
                    {MONTHS.map((m,mi) => <div key={m} style={{ textAlign:'center', fontSize:9, fontWeight:mi+1===CURRENT_MONTH?700:400, color:mi+1===CURRENT_MONTH?'var(--blue)':'var(--text3)' }}>{m}</div>)}
                  </div>
                ) : h}
              </div>
            ))}
          </div>
          {initiatives.map((ini, idx) => {
            const isExpanded = expanded.has(ini._id)
            return (
              <div key={ini._id}>
                <div style={{ display:'grid', gridTemplateColumns:'36px 1fr 76px 76px 1.2fr 90px', borderBottom:'1px solid var(--glass-border)' }} className="glass">
                  <div onClick={()=>toggle(ini._id)} style={{ padding:'10px', textAlign:'center', fontSize:12, fontWeight:700, color:'var(--blue)', borderRight:'1px solid var(--glass-border)', cursor:'pointer' }}>{idx+1}</div>
                  <div onClick={()=>toggle(ini._id)} style={{ padding:'10px', fontSize:12, fontWeight:700, color:'var(--blue)', display:'flex', alignItems:'center', gap:6, borderRight:'1px solid var(--glass-border)', cursor:'pointer' }}>
                    <span style={{ fontSize:10, color:'var(--text3)', transition:'transform 0.2s', display:'inline-block', transform: isExpanded?'rotate(90deg)':'rotate(0)' }}>▶</span>
                    <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ini.code} — {ini.title}</span>
                  </div>
                  <div style={{ padding:'10px', textAlign:'center', fontSize:12, fontWeight:600, color:'var(--text2)', borderRight:'1px solid var(--glass-border)' }}>{ini.planProgress}%</div>
                  <div style={{ padding:'10px', textAlign:'center', fontSize:13, fontWeight:700, color: ini.actualProgress >= ini.planProgress ? 'var(--green)' : 'var(--amber)', borderRight:'1px solid var(--glass-border)' }}>{ini.actualProgress}%</div>
                  <div style={{ padding:'10px', borderRight:'1px solid var(--glass-border)' }} />
                  <div style={{ padding:'6px', display:'flex', gap:3, justifyContent:'center', alignItems:'center' }}>
                    {canEdit && <>
                      <button onClick={(e)=>{e.stopPropagation();setEditing(ini)}} className="btn btn-icon btn-sm" style={{ fontSize:11 }}>✏️</button>
                      <button onClick={(e)=>{e.stopPropagation();del(ini._id)}} className="btn btn-icon btn-sm" style={{ fontSize:11 }}>🗑</button>
                    </>}
                  </div>
                </div>

                {isExpanded && ini.phases.map((phase:any, pi:number) => {
                  const planLeft = phase.planStartMonth ? ((phase.planStartMonth-1)/12*100).toFixed(1) : 0
                  const planWidth = phase.planStartMonth && phase.planEndMonth ? (((phase.planEndMonth-phase.planStartMonth+1)/12*100)).toFixed(1) : 0
                  const actLeft = phase.actualStartMonth ? ((phase.actualStartMonth-1)/12*100).toFixed(1) : null
                  const actWidth = phase.actualStartMonth && phase.actualEndMonth ? (((phase.actualEndMonth-phase.actualStartMonth+1)/12*100)).toFixed(1) : null
                  const pctColor = phase.actualPct>=100?'var(--green)':phase.actualPct>0?'var(--blue)':'var(--text3)'
                  return (
                    <div key={pi} style={{ display:'grid', gridTemplateColumns:'36px 1fr 76px 76px 1.2fr 90px', borderBottom:'1px solid var(--glass-border)', background:'var(--bg2)' }}>
                      <div style={{ padding:'10px', fontSize:10, color:'var(--text3)', textAlign:'center', borderRight:'1px solid var(--glass-border)', display:'flex', alignItems:'center', justifyContent:'center' }}>{idx+1}.{pi+1}</div>
                      <div style={{ padding:'10px', fontSize:11, color:'var(--text)', borderRight:'1px solid var(--glass-border)', display:'flex', alignItems:'center' }}>{phase.name}</div>
                      <div style={{ padding:'10px', textAlign:'center', fontSize:12, fontWeight:600, color:'var(--text2)', borderRight:'1px solid var(--glass-border)' }}>{phase.planPct||0}%</div>
                      <div style={{ padding:'10px', textAlign:'center', fontSize:12, fontWeight:600, color:pctColor, borderRight:'1px solid var(--glass-border)' }}>{phase.actualPct||0}%</div>
                      <div style={{ padding:'10px', position:'relative', display:'flex', flexDirection:'column', gap:3, justifyContent:'center', borderRight:'1px solid var(--glass-border)' }}>
                        <div style={{ position:'absolute', left:`${((CURRENT_MONTH-0.5)/12*100).toFixed(1)}%`, top:0, bottom:0, width:1, background:'var(--blue)', opacity:0.4 }} />
                        <div style={{ position:'relative', height:9, background:'var(--bg4)', borderRadius:3 }}>
                          {planWidth ? <div style={{ position:'absolute', top:0, left:`${planLeft}%`, width:`${planWidth}%`, height:'100%', background:'var(--bg5)', borderRadius:3 }} /> : null}
                        </div>
                        <div style={{ position:'relative', height:9, background:'var(--bg4)', borderRadius:3 }}>
                          {actLeft !== null && actWidth ? (
                            <div style={{ position:'absolute', top:0, left:`${actLeft}%`, width:`${actWidth}%`, height:'100%', background:`linear-gradient(90deg, ${pctColor}, ${pctColor}aa)`, borderRadius:3 }} />
                          ) : null}
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
