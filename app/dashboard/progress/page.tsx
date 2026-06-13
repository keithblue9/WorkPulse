'use client'
import { picArray } from '@/lib/defaults'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import RichTextarea from '@/components/RichTextarea'
import { calcInitiativeProgress } from '@/lib/defaults'

const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']

// Circular progress ring widget
function ProgressRing({ plan, actual, size=120 }: { plan:number; actual:number; size?:number }) {
  const r = size/2 - 10
  const circ = 2 * Math.PI * r
  const actualOffset = circ - (Math.min(100,actual)/100) * circ
  const planOffset = circ - (Math.min(100,plan)/100) * circ
  const center = size/2
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={center} cy={center} r={r} fill="none" stroke="var(--bg3)" strokeWidth="9" />
      {/* Plan ring (faint) */}
      <circle cx={center} cy={center} r={r} fill="none" stroke="var(--brand)" strokeWidth="9" strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={planOffset} opacity={0.25}
        transform={`rotate(-90 ${center} ${center})`} />
      {/* Actual ring */}
      <circle cx={center} cy={center} r={r} fill="none" stroke="var(--green)" strokeWidth="9" strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={actualOffset}
        transform={`rotate(-90 ${center} ${center})`} style={{ transition:'stroke-dashoffset 0.6s ease' }} />
      <text x={center} y={center-2} textAnchor="middle" fontSize="22" fontWeight="800" fill="var(--green)">{actual.toFixed(0)}%</text>
      <text x={center} y={center+14} textAnchor="middle" fontSize="9" fill="var(--text3)">dari {plan.toFixed(0)}% plan</text>
    </svg>
  )
}

// Week-level month/week picker for a phase
function WeekPicker({ cells, color, onChange }: { cells:string[]; color:string; onChange:(c:string[])=>void }) {
  const [openMonth, setOpenMonth] = useState<number|null>(null)
  function monthHasCells(m:number) { return cells.some(c => c.startsWith(`${m}-`)) }
  function weekActive(m:number, w:number) { return cells.includes(`${m}-${w}`) }
  function toggleWeek(m:number, w:number) {
    const key = `${m}-${w}`
    onChange(cells.includes(key) ? cells.filter(c=>c!==key) : [...cells, key])
  }
  function toggleAllWeeks(m:number) {
    const monthCells = [1,2,3,4].map(w=>`${m}-${w}`)
    const allOn = monthCells.every(c=>cells.includes(c))
    if (allOn) onChange(cells.filter(c=>!c.startsWith(`${m}-`)))
    else onChange([...cells.filter(c=>!c.startsWith(`${m}-`)), ...monthCells])
  }
  return (
    <div>
      <div style={{ display:'flex', gap:1 }}>
        {MONTHS.map((mn, i) => {
          const m = i+1
          const active = monthHasCells(m)
          const cnt = cells.filter(c=>c.startsWith(`${m}-`)).length
          return (
            <div key={m} onClick={()=>setOpenMonth(openMonth===m?null:m)} style={{ flex:1, minHeight:28, fontSize:9, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', cursor:'pointer', background: active?color:'var(--bg3)', color: active?'#fff':'var(--text3)', borderRight:m<12?'1px solid var(--bg2)':'none', position:'relative' }}>
              <span>{mn.substring(0,1)}</span>
              {cnt>0 && <span style={{ fontSize:7, fontWeight:700 }}>{cnt}w</span>}
            </div>
          )
        })}
      </div>
      {openMonth && (
        <div className="glass-strong scale-in" style={{ marginTop:4, padding:8, borderRadius:8 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
            <span style={{ fontSize:11, fontWeight:600 }}>{MONTHS[openMonth-1]} — pilih minggu</span>
            <button type="button" onClick={()=>toggleAllWeeks(openMonth)} className="btn btn-sm" style={{ fontSize:9 }}>Semua W</button>
          </div>
          <div style={{ display:'flex', gap:5 }}>
            {[1,2,3,4].map(w => (
              <button key={w} type="button" onClick={()=>toggleWeek(openMonth, w)} style={{ flex:1, padding:'6px 0', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer', border:`1px solid ${weekActive(openMonth,w)?color:'var(--border2)'}`, background: weekActive(openMonth,w)?color:'var(--bg3)', color: weekActive(openMonth,w)?'#fff':'var(--text2)' }}>W{w}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function PhaseEditor({ phase, idx, onChange, onRemove, computed }: { phase:any; idx:number; onChange:(p:any)=>void; onRemove:()=>void; computed:any }) {
  return (
    <div className="card" style={{ padding:12, marginBottom:8, position:'relative' }}>
      <button onClick={onRemove} className="btn btn-icon btn-sm" style={{ position:'absolute', top:8, right:8, color:'var(--red)', zIndex:5 }}>×</button>
      <input className="input input-sm" style={{ marginBottom:10, fontWeight:600, width:'calc(100% - 30px)' }} value={phase.name||''} onChange={e=>onChange({...phase, name:e.target.value})} placeholder={`Phase ${idx+1}`} />
      <div style={{ display:'grid', gridTemplateColumns:'50px 1fr 70px', gap:6, alignItems:'start', marginBottom:6 }}>
        <div style={{ fontSize:10, color:'var(--brand)', fontWeight:600, paddingTop:6 }}>Plan</div>
        <WeekPicker cells={phase.planCells||[]} color="var(--brand)" onChange={c=>onChange({...phase, planCells:c})} />
        <div style={{ fontSize:11, fontWeight:700, color:'var(--brand)', textAlign:'right', paddingTop:6 }}>{computed.planPct.toFixed(1)}%</div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'50px 1fr 70px', gap:6, alignItems:'start', marginBottom:8 }}>
        <div style={{ fontSize:10, color:'var(--green)', fontWeight:600, paddingTop:6 }}>Actual</div>
        <WeekPicker cells={phase.actualCells||[]} color="var(--green)" onChange={c=>onChange({...phase, actualCells:c})} />
        <div style={{ fontSize:11, fontWeight:700, color:'var(--green)', textAlign:'right', paddingTop:6 }}>{computed.actualPct.toFixed(1)}%</div>
      </div>
      <div style={{ fontSize:9, color:'var(--text3)', marginBottom:6 }}>
        {computed._planWeeks} minggu plan · {computed._actualWeeks} minggu actual · actual% = ({computed._actualWeeks}/{computed._planWeeks||1}) × {computed.planPct.toFixed(0)}% = {computed.actualPct.toFixed(1)}%
      </div>
      <RichTextarea rows={2} value={phase.progressNotes||''} onChange={v=>onChange({...phase, progressNotes:v})} placeholder="Catatan progress phase ini. Klik • atau 1. untuk bullet" style={{ fontSize:11 }} />
    </div>
  )
}

function InitiativeForm({ editing, onClose, onSave, members }: { editing?:any; onClose:()=>void; onSave:()=>void; members:any[] }) {
  const [form, setForm] = useState({
    code: editing?.code || '',
    title: editing?.title || '',
    year: editing?.year || new Date().getFullYear(),
    pic: picArray(editing?.pic),
    progressNotes: editing?.progressNotes || '',
    phases: editing?.phases?.length ? editing.phases.map((p:any)=>({ ...p, planCells:p.planCells||[], actualCells:p.actualCells||[] })) : [{ name:'Phase 1', planCells:[], actualCells:[], progressNotes:'' }],
  })
  const [saving, setSaving] = useState(false)
  const [picInput, setPicInput] = useState('')

  const calc = calcInitiativeProgress(form.phases)

  function setPhase(i:number, p:any) { setForm(f=>({...f, phases: f.phases.map((x:any,idx:number)=>idx===i?p:x) })) }
  function addPhase() { setForm(f=>({...f, phases: [...f.phases, { name:`Phase ${f.phases.length+1}`, planCells:[], actualCells:[], progressNotes:'' }] })) }
  function removePhase(i:number) { setForm(f=>({...f, phases: f.phases.filter((_:any,idx:number)=>idx!==i) })) }
  function addPic(name:string) { if (name && !form.pic.includes(name)) setForm(f=>({...f, pic:[...f.pic, name]})); setPicInput('') }
  function removePic(name:string) { setForm(f=>({...f, pic: f.pic.filter((p:string)=>p!==name)})) }

  async function save() {
    if (!form.code || !form.title) { toast.error('Code & title wajib'); return }
    setSaving(true)
    try {
      const phasesWithPct = calc.phases.map((p:any) => {
        const { _planWeeks, _actualWeeks, ...rest } = p
        return rest
      })
      const body = { ...form, phases: phasesWithPct, planProgress: calc.planProgress, actualProgress: calc.actualProgress }
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
      <div className="modal" style={{ width:780, maxHeight:'92vh' }}>
        <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between' }}>
          <span style={{ fontSize:14, fontWeight:600 }}>{editing?'Edit Initiative':'+ Initiative Baru'}</span>
          <button onClick={onClose} className="btn btn-icon">×</button>
        </div>
        <div style={{ padding:'14px 20px', overflowY:'auto', flex:1, display:'flex', flexDirection:'column', gap:11 }}>
          <div className="card" style={{ padding:12 }}>
            <div style={{ display:'grid', gridTemplateColumns:'120px 1fr 100px', gap:10, marginBottom:10 }}>
              <div><label style={lbl}>Code *</label><input className="input" value={form.code} onChange={e=>setForm(f=>({...f, code:e.target.value}))} /></div>
              <div><label style={lbl}>Title *</label><input className="input" value={form.title} onChange={e=>setForm(f=>({...f, title:e.target.value}))} /></div>
              <div><label style={lbl}>Tahun</label><input type="number" className="input" value={form.year} onChange={e=>setForm(f=>({...f, year:Number(e.target.value)}))} /></div>
            </div>
            <div style={{ display:'flex', gap:14, marginBottom:10, alignItems:'center', justifyContent:'center' }}>
              <ProgressRing plan={calc.planProgress} actual={calc.actualProgress} />
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
              <label style={lbl}>Progress (Catatan umum initiative)</label>
              <RichTextarea rows={2} value={form.progressNotes} onChange={v=>setForm(f=>({...f, progressNotes:v}))} placeholder="Catatan umum. Klik • atau 1. untuk bullet" />
            </div>
          </div>

          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <div style={{ fontSize:11, fontWeight:600, color:'var(--text3)', textTransform:'uppercase' }}>Phases — klik bulan lalu pilih minggu (W1-W4)</div>
              <button onClick={addPhase} className="btn btn-sm">+ Phase</button>
            </div>
            {form.phases.map((p:any, i:number) => (
              <PhaseEditor key={i} phase={p} idx={i} onChange={(np:any)=>setPhase(i, np)} onRemove={()=>removePhase(i)} computed={calc.phases[i]} />
            ))}
            <div style={{ padding:'8px 12px', background:'var(--bg3)', borderRadius:7, fontSize:11, color:'var(--text3)', lineHeight:1.5 }}>
              <b>Rumus:</b> Plan% phase = (minggu plan phase / total minggu plan semua phase) × 100. Actual% phase = (minggu actual / minggu plan phase) × Plan% phase. Total = penjumlahan semua phase.
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
          <div style={{ fontSize:11, color:'var(--text3)' }}>{initiatives.length} initiative · Detail per phase (week-level) · klik card untuk edit</div>
        </div>
        <button onClick={()=>setShowForm(true)} className="btn btn-primary btn-sm">+ Initiative Baru</button>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'14px 20px' }} className="safe-bottom">
        {loading ? <div style={{ textAlign:'center', padding:40, color:'var(--text3)' }}>Memuat...</div> :
         initiatives.length === 0 ? <div className="card" style={{ padding:40, textAlign:'center', color:'var(--text3)' }}>Belum ada initiative · klik <b>+ Initiative Baru</b></div> : (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {initiatives.map(i => {
              const calc = calcInitiativeProgress(i.phases || [])
              return (
                <div key={i._id} className="card" style={{ padding:16 }}>
                  <div style={{ display:'flex', gap:16 }}>
                    {/* Left: info + phases detail */}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                        <div>
                          <div style={{ fontSize:9, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.05em' }}>{i.code} · {i.year}</div>
                          <div style={{ fontSize:15, fontWeight:700 }}>{i.title}</div>
                          {picArray(i.pic).length > 0 && <div style={{ fontSize:10, color:'var(--text3)', marginTop:2 }}>👤 {picArray(i.pic).join(', ')}</div>}
                        </div>
                        <button onClick={()=>setEditing(i)} className="btn btn-sm">✏️ Edit / Update</button>
                      </div>
                      {i.progressNotes && <div style={{ fontSize:11, color:'var(--text2)', whiteSpace:'pre-wrap', marginBottom:10, padding:'8px 10px', background:'var(--bg3)', borderRadius:6, lineHeight:1.5 }}>{i.progressNotes}</div>}
                      {/* Phases breakdown */}
                      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                        {calc.phases.map((ph:any, idx:number) => (
                          <div key={idx} style={{ borderLeft:'3px solid var(--brand)', paddingLeft:12 }}>
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                              <div style={{ fontSize:12, fontWeight:600 }}>{ph.name || `Phase ${idx+1}`}</div>
                              <div style={{ fontSize:11 }}>
                                <span style={{ color:'var(--brand)', fontWeight:700 }}>Plan {ph.planPct.toFixed(0)}%</span>
                                <span style={{ color:'var(--text3)' }}> · </span>
                                <span style={{ color:'var(--green)', fontWeight:700 }}>Actual {ph.actualPct.toFixed(1)}%</span>
                              </div>
                            </div>
                            {/* Mini progress bar */}
                            <div style={{ height:5, background:'var(--bg3)', borderRadius:3, overflow:'hidden', margin:'4px 0' }}>
                              <div style={{ width:`${Math.min(100, ph.planPct>0?(ph.actualPct/ph.planPct)*100:0)}%`, height:'100%', background:'var(--green)' }} />
                            </div>
                            {ph.progressNotes && <div style={{ fontSize:10.5, color:'var(--text2)', whiteSpace:'pre-wrap', lineHeight:1.5, marginTop:3 }}>{ph.progressNotes}</div>}
                            <div style={{ fontSize:9, color:'var(--text3)', marginTop:2 }}>{ph._planWeeks} mgg plan · {ph._actualWeeks} mgg actual</div>
                          </div>
                        ))}
                        {calc.phases.length === 0 && <div style={{ fontSize:11, color:'var(--text3)' }}>Belum ada phase</div>}
                      </div>
                    </div>
                    {/* Right: progress ring widget */}
                    <div style={{ flexShrink:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8, minWidth:140, borderLeft:'1px solid var(--border)', paddingLeft:16 }}>
                      <ProgressRing plan={calc.planProgress} actual={calc.actualProgress} size={130} />
                      <div style={{ fontSize:10, color:'var(--text3)', textAlign:'center' }}>{calc.phases.length} phase{calc.phases.length>1?'s':''}</div>
                    </div>
                  </div>
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
