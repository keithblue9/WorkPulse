'use client'
import { useEffect, useState, useMemo } from 'react'
import toast from 'react-hot-toast'

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']

// Auto-calculate proportional % based on months blocked, total = 100% across all phases
function calcProportional(phases:any[], field:'plan'|'actual'):number[] {
  const startKey = field === 'plan' ? 'planStartMonth' : 'actualStartMonth'
  const endKey = field === 'plan' ? 'planEndMonth' : 'actualEndMonth'
  // Total months blocked across all phases
  const monthsPerPhase = phases.map(p => {
    const s = p[startKey], e = p[endKey]
    if (!s || !e || s > e) return 0
    return e - s + 1
  })
  const totalMonths = monthsPerPhase.reduce((a,b)=>a+b, 0)
  if (totalMonths === 0) return phases.map(()=>0)
  // Each phase % is proportional to its month-block
  return monthsPerPhase.map(m => (m / totalMonths) * 100)
}

function PhaseRow({ phase, idx, onChange, autoPlanPct, autoActualPct }: { phase:any; idx:number; onChange:(p:any)=>void; autoPlanPct:number; autoActualPct:number }) {
  const months = Array.from({length:12}, (_,i)=>i+1)
  function setRange(field:'plan'|'actual', m:number) {
    const sKey = field==='plan'?'planStartMonth':'actualStartMonth'
    const eKey = field==='plan'?'planEndMonth':'actualEndMonth'
    const cs = phase[sKey], ce = phase[eKey]
    if (!cs && !ce) onChange({ ...phase, [sKey]:m, [eKey]:m })
    else if (cs && !ce) {
      if (m < cs) onChange({ ...phase, [sKey]:m, [eKey]:cs })
      else onChange({ ...phase, [eKey]:m })
    }
    else { onChange({ ...phase, [sKey]:m, [eKey]:m }) }
  }
  function inRange(field:'plan'|'actual', m:number) {
    const sKey = field==='plan'?'planStartMonth':'actualStartMonth'
    const eKey = field==='plan'?'planEndMonth':'actualEndMonth'
    return phase[sKey] && phase[eKey] && m >= phase[sKey] && m <= phase[eKey]
  }
  return (
    <div className="card" style={{ padding:12, marginBottom:8 }}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:10, marginBottom:8, alignItems:'center' }}>
        <input className="input input-sm" value={phase.name||''} onChange={e=>onChange({...phase, name:e.target.value})} placeholder={`Phase ${idx+1}`} />
        <div style={{ fontSize:10, color:'var(--text3)' }}>auto-calc</div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'60px 1fr 80px', gap:5, alignItems:'center', marginBottom:5 }}>
        <div style={{ fontSize:10, color:'var(--brand)', fontWeight:600 }}>Plan</div>
        <div style={{ display:'flex', gap:1 }}>
          {months.map(m => (
            <div key={m} onClick={()=>setRange('plan', m)} style={{ flex:1, height:24, fontSize:9, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', background: inRange('plan',m)?'var(--brand)':'var(--bg3)', color: inRange('plan',m)?'#fff':'var(--text3)', borderRight:m<12?'1px solid var(--bg2)':'none' }}>{MONTHS_SHORT[m-1].substring(0,1)}</div>
          ))}
        </div>
        <div style={{ fontSize:11, fontWeight:700, color:'var(--brand)', textAlign:'right' }}>{autoPlanPct.toFixed(1)}%</div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'60px 1fr 80px', gap:5, alignItems:'center', marginBottom:8 }}>
        <div style={{ fontSize:10, color:'var(--green)', fontWeight:600 }}>Actual</div>
        <div style={{ display:'flex', gap:1 }}>
          {months.map(m => (
            <div key={m} onClick={()=>setRange('actual', m)} style={{ flex:1, height:24, fontSize:9, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', background: inRange('actual',m)?'var(--green)':'var(--bg3)', color: inRange('actual',m)?'#fff':'var(--text3)', borderRight:m<12?'1px solid var(--bg2)':'none' }}>{MONTHS_SHORT[m-1].substring(0,1)}</div>
          ))}
        </div>
        <div style={{ fontSize:11, fontWeight:700, color:'var(--green)', textAlign:'right' }}>{autoActualPct.toFixed(1)}%</div>
      </div>
      <textarea className="input" rows={2} style={{ fontSize:11 }} value={phase.progressNotes||''} onChange={e=>onChange({...phase, progressNotes:e.target.value})} placeholder="Catatan progress phase ini (apa yang sudah dilakukan)" />
    </div>
  )
}

function InitiativeForm({ editing, onClose, onSave, members }: { editing?:any; onClose:()=>void; onSave:()=>void; members:any[] }) {
  const [form, setForm] = useState({
    code: editing?.code || '',
    title: editing?.title || '',
    year: editing?.year || new Date().getFullYear(),
    pic: editing?.pic && Array.isArray(editing.pic) ? editing.pic : [],
    progressNotes: editing?.progressNotes || '',
    phases: editing?.phases?.length ? editing.phases : [{ name:'Phase 1', planStartMonth:null, planEndMonth:null, actualStartMonth:null, actualEndMonth:null, progressNotes:'' }],
  })
  const [saving, setSaving] = useState(false)
  const [picInput, setPicInput] = useState('')

  const autoPlan = calcProportional(form.phases, 'plan')
  const autoActual = calcProportional(form.phases, 'actual')
  const totalPlan = autoPlan.reduce((a,b)=>a+b, 0)
  const totalActual = autoActual.reduce((a,b)=>a+b, 0)

  function setPhase(i:number, p:any) { setForm(f=>({...f, phases: f.phases.map((x:any,idx:number)=>idx===i?p:x) })) }
  function addPhase() { setForm(f=>({...f, phases: [...f.phases, { name:`Phase ${f.phases.length+1}`, planStartMonth:null, planEndMonth:null, actualStartMonth:null, actualEndMonth:null, progressNotes:'' }] })) }
  function removePhase(i:number) { setForm(f=>({...f, phases: f.phases.filter((_:any,idx:number)=>idx!==i) })) }
  function addPic(name:string) { if (name && !form.pic.includes(name)) setForm(f=>({...f, pic:[...f.pic, name]})); setPicInput('') }
  function removePic(name:string) { setForm(f=>({...f, pic: f.pic.filter((p:string)=>p!==name)})) }

  async function save() {
    if (!form.code || !form.title) { toast.error('Code & title wajib'); return }
    setSaving(true)
    try {
      // Save phases with computed pcts
      const phasesWithPct = form.phases.map((p:any, i:number) => ({ ...p, planPct: autoPlan[i], actualPct: autoActual[i] }))
      const body = { ...form, phases: phasesWithPct, planProgress: totalPlan, actualProgress: totalActual }
      const url = editing ? `/api/initiatives/${editing._id}` : '/api/initiatives'
      await fetch(url, { method: editing?'PATCH':'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) })
      toast.success(editing?'Diperbarui':'Initiative dibuat'); onSave(); onClose()
    } finally { setSaving(false) }
  }
  async function del() {
    if (!confirm('Hapus initiative?')) return
    await fetch(`/api/initiatives/${editing._id}`, { method:'DELETE' })
    toast.success('Dihapus'); onSave(); onClose()
  }

  const suggestions = members.filter(m => m.name.toLowerCase().includes(picInput.toLowerCase()) && !form.pic.includes(m.name)).slice(0,5)

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ width:760, maxHeight:'92vh' }}>
        <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between' }}>
          <span style={{ fontSize:14, fontWeight:600 }}>{editing?'Edit Initiative':'+ Initiative Baru'}</span>
          <button onClick={onClose} className="btn btn-icon">×</button>
        </div>
        <div style={{ padding:'14px 20px', overflowY:'auto', flex:1, display:'flex', flexDirection:'column', gap:11 }}>
          <div className="card" style={{ padding:12 }}>
            <div style={{ fontSize:11, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', marginBottom:8 }}>Informasi Initiative</div>
            <div style={{ display:'grid', gridTemplateColumns:'120px 1fr 100px', gap:10, marginBottom:10 }}>
              <div><label style={lbl}>Code *</label><input className="input" value={form.code} onChange={e=>setForm(f=>({...f, code:e.target.value}))} /></div>
              <div><label style={lbl}>Title *</label><input className="input" value={form.title} onChange={e=>setForm(f=>({...f, title:e.target.value}))} /></div>
              <div><label style={lbl}>Tahun</label><input type="number" className="input" value={form.year} onChange={e=>setForm(f=>({...f, year:Number(e.target.value)}))} /></div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
              <div className="card" style={{ padding:'10px 12px', background:'var(--brand-soft)' }}>
                <div style={{ fontSize:10, color:'var(--brand)' }}>Plan %</div>
                <div style={{ fontSize:20, fontWeight:800, color:'var(--brand)' }}>{totalPlan.toFixed(1)}%</div>
                <div style={{ fontSize:9, color:'var(--text3)' }}>auto from phases</div>
              </div>
              <div className="card" style={{ padding:'10px 12px', background:'var(--greenbg)' }}>
                <div style={{ fontSize:10, color:'var(--green)' }}>Actual %</div>
                <div style={{ fontSize:20, fontWeight:800, color:'var(--green)' }}>{totalActual.toFixed(1)}%</div>
                <div style={{ fontSize:9, color:'var(--text3)' }}>auto from phases</div>
              </div>
            </div>

            <div style={{ marginBottom:10 }}>
              <label style={lbl}>PIC (multi)</label>
              <div className="input" style={{ display:'flex', flexWrap:'wrap', gap:5, minHeight:36 }}>
                {form.pic.map((p:string) => (
                  <span key={p} style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'3px 8px', background:'var(--brand-soft)', color:'var(--brand)', borderRadius:14, fontSize:11, fontWeight:600 }}>
                    {p} <span style={{ cursor:'pointer' }} onClick={()=>removePic(p)}>×</span>
                  </span>
                ))}
                <input style={{ border:'none', background:'transparent', outline:'none', flex:1, minWidth:80, color:'var(--text)', fontSize:12 }} value={picInput} onChange={e=>setPicInput(e.target.value)}
                  onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault(); if(suggestions[0]) addPic(suggestions[0].name); else if(picInput) addPic(picInput)}}}
                  placeholder={form.pic.length?'':'+ Tag PIC'} />
              </div>
              {picInput && suggestions.length > 0 && (
                <div className="glass-strong" style={{ marginTop:4, borderRadius:6, padding:4, maxHeight:120, overflowY:'auto' }}>
                  {suggestions.map((m:any) => (
                    <div key={m._id} onClick={()=>addPic(m.name)} style={{ padding:'5px 9px', borderRadius:4, cursor:'pointer', fontSize:11 }}>{m.name}</div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label style={lbl}>Progress (Catatan deskripsi progress yg sudah dilakukan)</label>
              <textarea className="input" rows={3} value={form.progressNotes} onChange={e=>setForm(f=>({...f, progressNotes:e.target.value}))} placeholder="Apa yang sudah dilakukan, milestone, dll" />
            </div>
          </div>

          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <div style={{ fontSize:11, fontWeight:600, color:'var(--text3)', textTransform:'uppercase' }}>Phases (klik kotak bulan untuk set blok)</div>
              <button onClick={addPhase} className="btn btn-sm">+ Phase</button>
            </div>
            {form.phases.map((p:any, i:number) => (
              <div key={i} style={{ position:'relative' }}>
                {form.phases.length > 1 && <button onClick={()=>removePhase(i)} className="btn btn-icon btn-sm" style={{ position:'absolute', top:6, right:6, color:'var(--red)', zIndex:5 }}>×</button>}
                <PhaseRow phase={p} idx={i} onChange={(np:any)=>setPhase(i, np)} autoPlanPct={autoPlan[i]||0} autoActualPct={autoActual[i]||0} />
              </div>
            ))}
            <div style={{ padding:'8px 12px', background:'var(--bg3)', borderRadius:7, fontSize:11, color:'var(--text3)', lineHeight:1.5 }}>
              <b>Auto-calc rule:</b> Total % across all phases = 100% (jika semua phase di-block). Setiap phase % = proporsional (bulan phase / total bulan all phases) × 100. Klik kotak bulan untuk set start, klik lagi untuk set end.
            </div>
          </div>
        </div>
        <div style={{ padding:'12px 20px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'space-between' }}>
          {editing ? <button onClick={del} className="btn btn-danger btn-sm">🗑 Hapus</button> : <div />}
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={onClose} className="btn">Batal</button>
            <button onClick={save} disabled={saving} className="btn btn-primary">{saving?'...':'Simpan'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ProgressPage() {
  const [initiatives, setInitiatives] = useState<any[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)

  async function load() {
    setLoading(true)
    const [i, m] = await Promise.all([fetch('/api/initiatives').then(r=>r.json()), fetch('/api/users').then(r=>r.json())])
    setInitiatives(i.data||[]); setMembers((m.data||[]).filter((u:any)=>u.active!==false)); setLoading(false)
  }
  useEffect(() => { load() }, [])

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {(showForm||editing) && <InitiativeForm editing={editing} onClose={()=>{setShowForm(false);setEditing(null)}} onSave={load} members={members} />}

      <div style={{ padding:'12px 20px', borderBottom:'1px solid var(--border)', background:'var(--bg2)', display:'flex', justifyContent:'space-between', flexShrink:0 }}>
        <div>
          <div style={{ fontSize:14, fontWeight:600 }}>Progress Initiatives</div>
          <div style={{ fontSize:11, color:'var(--text3)' }}>{initiatives.length} initiative · Auto-calc % proportional dari phases</div>
        </div>
        <button onClick={()=>setShowForm(true)} className="btn btn-primary btn-sm">+ Initiative Baru</button>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'14px 20px' }} className="safe-bottom">
        {loading ? <div style={{ textAlign:'center', padding:40, color:'var(--text3)' }}>Memuat...</div> :
         initiatives.length === 0 ? <div className="card" style={{ padding:40, textAlign:'center', color:'var(--text3)' }}>Belum ada initiative · klik <b>+ Initiative Baru</b></div> : (
          <div className="card" style={{ padding:14, overflow:'auto' }}>
            {/* Gantt header */}
            <div style={{ display:'grid', gridTemplateColumns:'260px repeat(12, 1fr) 80px', gap:0, alignItems:'center', minWidth:1000, marginBottom:6, fontSize:10, color:'var(--text3)', fontWeight:600 }}>
              <div style={{ padding:'6px 8px' }}>Initiative · PIC</div>
              {['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'].map(m => (
                <div key={m} style={{ textAlign:'center', borderLeft:'1px solid var(--border)', padding:'6px 0' }}>{m}</div>
              ))}
              <div style={{ textAlign:'right', padding:'6px 8px' }}>Plan / Actual</div>
            </div>
            {initiatives.map(i => (
              <div key={i._id} className="glass-hover" style={{ display:'grid', gridTemplateColumns:'260px repeat(12, 1fr) 80px', gap:0, alignItems:'center', minWidth:1000, padding:'8px 0', borderTop:'1px solid var(--border)', cursor:'pointer' }} onClick={()=>setEditing(i)}>
                <div style={{ padding:'4px 8px', minWidth:0 }}>
                  <div style={{ fontSize:9, color:'var(--text3)' }}>{i.code} · {i.year}</div>
                  <div style={{ fontSize:12, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{i.title}</div>
                  {i.pic?.length > 0 && <div style={{ fontSize:9, color:'var(--text3)' }}>👤 {i.pic.slice(0,3).join(', ')}{i.pic.length>3?` +${i.pic.length-3}`:''}</div>}
                  <div style={{ fontSize:9, color:'var(--text3)' }}>📊 {i.phases?.length||0} phase{(i.phases?.length||0)>1?'s':''}</div>
                </div>
                <div style={{ gridColumn:'2 / span 12', position:'relative', height: Math.max(36, (i.phases?.length||0) * 26 + 12), borderLeft:'1px solid var(--border)' }}>
                  {Array.from({length:12}).map((_,m) => (
                    <div key={m} style={{ position:'absolute', left:`${(m/12)*100}%`, top:0, bottom:0, width:'1px', background:'var(--border)' }} />
                  ))}
                  {(i.phases||[]).map((ph:any, idx:number) => {
                    const rowTop = 4 + idx * 26
                    const elements:any[] = []
                    if (ph.planStartMonth && ph.planEndMonth) {
                      const start = ((ph.planStartMonth-1)/12)*100
                      const width = ((ph.planEndMonth-ph.planStartMonth+1)/12)*100
                      elements.push(
                        <div key={`p${idx}`} style={{ position:'absolute', left:`${start}%`, width:`${width}%`, top:rowTop, height:10, background:'var(--brand)', borderRadius:3, opacity:0.65, display:'flex', alignItems:'center', justifyContent:'center', fontSize:8, color:'#fff', fontWeight:700 }} title={`Plan ${ph.name}: M${ph.planStartMonth}-M${ph.planEndMonth}`}>
                          {width > 8 && (ph.name || 'P'+(idx+1))}
                        </div>
                      )
                    }
                    if (ph.actualStartMonth && ph.actualEndMonth) {
                      const start = ((ph.actualStartMonth-1)/12)*100
                      const width = ((ph.actualEndMonth-ph.actualStartMonth+1)/12)*100
                      elements.push(
                        <div key={`a${idx}`} style={{ position:'absolute', left:`${start}%`, width:`${width}%`, top:rowTop + 12, height:10, background:'var(--green)', borderRadius:3, opacity:0.85, display:'flex', alignItems:'center', justifyContent:'center', fontSize:8, color:'#fff', fontWeight:700 }} title={`Actual ${ph.name}: M${ph.actualStartMonth}-M${ph.actualEndMonth}`}>
                          {width > 8 && 'A'}
                        </div>
                      )
                    }
                    return elements
                  })}
                </div>
                <div style={{ padding:'4px 8px', textAlign:'right', fontSize:11 }}>
                  <div style={{ color:'var(--brand)', fontWeight:700 }}>P {(i.planProgress||0).toFixed(0)}%</div>
                  <div style={{ color:'var(--green)', fontWeight:700 }}>A {(i.actualProgress||0).toFixed(0)}%</div>
                </div>
              </div>
            ))}
            <div style={{ display:'flex', gap:14, padding:'12px 8px 4px', fontSize:10, color:'var(--text3)' }}>
              <span style={{ display:'flex', alignItems:'center', gap:5 }}><span style={{ width:14, height:8, background:'var(--brand)', borderRadius:2, opacity:0.65 }} /> Plan</span>
              <span style={{ display:'flex', alignItems:'center', gap:5 }}><span style={{ width:14, height:8, background:'var(--green)', borderRadius:2, opacity:0.85 }} /> Actual</span>
              <span style={{ marginLeft:'auto' }}>💡 Klik row untuk edit · Tiap baris di area chart = 1 phase</span>
            </div>
          </div>
         )}
      </div>
    </div>
  )
}
const lbl: React.CSSProperties = { display:'block', fontSize:11, fontWeight:500, color:'var(--text2)', marginBottom:5 }
