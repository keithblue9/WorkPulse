'use client'
import { getConfig } from '@/lib/configCache'
import { picArray } from '@/lib/defaults'
import { useEffect, useState } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, isSameMonth } from 'date-fns'

const PRIORITY_CFG: Record<string,{label:string;color:string}> = {
  high:{label:'High', color:'var(--red)'},
  medium:{label:'Medium', color:'var(--amber)'},
  low:{label:'Low', color:'var(--green)'},
}

function ActivityDetail({ activity, onClose, onSave, members, config }: { activity:any; onClose:()=>void; onSave:()=>void; members:any[]; config:any }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(activity)
  const [saving, setSaving] = useState(false)
  const set = (k:string, v:any) => setForm((f:any)=>({...f,[k]:v}))

  async function save() {
    setSaving(true)
    try {
      await fetch(`/api/projects/${activity._id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(form) })
      onSave(); onClose()
    } finally { setSaving(false) }
  }
  async function del() {
    if (!confirm('Hapus aktivitas?')) return
    await fetch(`/api/projects/${activity._id}`, { method:'DELETE' })
    onSave(); onClose()
  }

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ width:540 }}>
        <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between' }}>
          <span style={{ fontSize:14, fontWeight:600 }}>{editing?'Edit Activity':'Detail Activity'}</span>
          <div style={{ display:'flex', gap:6 }}>
            {!editing && <button onClick={()=>setEditing(true)} className="btn btn-sm">✏️ Edit</button>}
            <button onClick={del} className="btn btn-sm btn-danger">🗑</button>
            <button onClick={onClose} className="btn btn-icon">×</button>
          </div>
        </div>
        <div style={{ padding:'14px 20px', overflowY:'auto', maxHeight:'72vh', display:'flex', flexDirection:'column', gap:10 }}>
          {editing ? (
            <>
              <div><label style={lbl}>Title</label><input className="input" value={form.title} onChange={e=>set('title',e.target.value)} /></div>
              <div><label style={lbl}>Aktivitas</label><textarea className="input" rows={4} value={form.description||''} onChange={e=>set('description',e.target.value)} /></div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div><label style={lbl}>Action Date</label><input type="date" className="input" value={form.actionDate||''} onChange={e=>set('actionDate',e.target.value)} /></div>
                <div><label style={lbl}>Target Week</label><input className="input" value={form.targetWeek||''} onChange={e=>set('targetWeek',e.target.value)} /></div>
              </div>
              <div><label style={lbl}>Next Plan</label><textarea className="input" rows={3} value={form.nextPlan||''} onChange={e=>set('nextPlan',e.target.value)} /></div>
            </>
          ) : (
            <>
              <div><div style={{ fontSize:11, color:'var(--text3)' }}>Title</div><div style={{ fontSize:14, fontWeight:600 }}>{activity.title}</div></div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                <span className="badge" style={{ background:'var(--brand-soft)', color:'var(--brand)', fontSize:10 }}>{activity.category}</span>
                <span className="badge" style={{ background:'var(--bg3)', color:'var(--text2)', fontSize:10 }}>{activity.subType}</span>
                {activity.priority && <span style={{ fontSize:10, color:PRIORITY_CFG[activity.priority]?.color, fontWeight:600 }}>● {PRIORITY_CFG[activity.priority]?.label}</span>}
              </div>
              {activity.description && <div><div style={{ fontSize:11, color:'var(--text3)' }}>Aktivitas / Progress</div><div style={{ fontSize:12, whiteSpace:'pre-wrap', marginTop:4, lineHeight:1.6 }}>{activity.description}</div></div>}
              {activity.nextPlan && <div><div style={{ fontSize:11, color:'var(--text3)' }}>Next Plan</div><div style={{ fontSize:12, whiteSpace:'pre-wrap', marginTop:4, lineHeight:1.6 }}>{activity.nextPlan}</div></div>}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div><div style={{ fontSize:10, color:'var(--text3)' }}>Action Date</div><div style={{ fontSize:12, fontWeight:500 }}>{activity.actionDate || '—'}{activity.actionDateEnd && activity.actionDateEnd!==activity.actionDate ? ` → ${activity.actionDateEnd}` : ''}</div></div>
                <div><div style={{ fontSize:10, color:'var(--text3)' }}>Target Week</div><div style={{ fontSize:12, fontWeight:500 }}>{activity.targetWeek || '—'}</div></div>
              </div>
              <div><div style={{ fontSize:10, color:'var(--text3)' }}>PIC</div><div style={{ fontSize:12 }}>{(activity.pic||[]).join(', ') || activity.picName || '—'}</div></div>
              {activity.mode === 'offline' && activity.location && (
                <div><div style={{ fontSize:10, color:'var(--text3)' }}>Lokasi</div><div style={{ fontSize:12 }}>📍 {activity.location}</div></div>
              )}
            </>
          )}
        </div>
        {editing && (
          <div style={{ padding:'12px 20px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'flex-end', gap:8 }}>
            <button onClick={()=>{setEditing(false);setForm(activity)}} className="btn">Batal</button>
            <button onClick={save} disabled={saving} className="btn btn-primary">{saving?'Menyimpan...':'Simpan'}</button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function CalendarPage() {
  const [activities, setActivities] = useState<any[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [config, setConfig] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selected, setSelected] = useState<any>(null)
  const [selectedDay, setSelectedDay] = useState<Date>(new Date())

  const [holidays, setHolidays] = useState<Set<string>>(new Set())

  async function load() {
    setLoading(true)
    const [a,m,c] = await Promise.all([
      fetch('/api/projects').then(r=>r.json()),
      fetch('/api/users').then(r=>r.json()),
      getConfig().then((data:any)=>({ data })),
    ])
    setActivities(a.data||[]); setMembers(m.data||[]); setConfig(c.data); setLoading(false)
    // Overlay Hari Libur dari Presensi (khusus tipe libur)
    const hType = (c.data?.attendanceTypes||[]).find((t:any)=> /libur|holiday/i.test(String(t.key)) || /libur/i.test(String(t.label)))
    if (hType) {
      const yr = format(currentMonth, 'yyyy')
      fetch(`/api/attendance/holiday?year=${yr}&type=${hType.key}`).then(r=>r.json())
        .then(d=>setHolidays(new Set(d.data||[]))).catch(()=>{})
    }
  }
  useEffect(() => { load() }, [])
  // refetch libur saat ganti tahun
  useEffect(() => {
    const hType = (config?.attendanceTypes||[]).find((t:any)=> /libur|holiday/i.test(String(t.key)) || /libur/i.test(String(t.label)))
    if (!hType) return
    fetch(`/api/attendance/holiday?year=${format(currentMonth,'yyyy')}&type=${hType.key}`).then(r=>r.json())
      .then(d=>setHolidays(new Set(d.data||[]))).catch(()=>{})
  }, [currentMonth, config])

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const gridStart = startOfWeek(monthStart, { weekStartsOn:1 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn:1 })
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })

  function activitiesOn(d:Date) {
    const ds = format(d,'yyyy-MM-dd')
    return activities.filter(a => {
      if (!a.actionDate) return false
      const start = a.actionDate
      const end = a.actionDateEnd || a.actionDate   // single-day if no end
      return ds >= start && ds <= end               // string compare works for yyyy-MM-dd
    })
  }
  const selectedDayActivities = activitiesOn(selectedDay)

  const cats = config?.activityCategories || []
  function catColor(key:string) { return cats.find((c:any)=>c.key===key)?.color || '#4f8ef7' }

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {selected && <ActivityDetail activity={selected} onClose={()=>setSelected(null)} onSave={load} members={members} config={config} />}

      <div style={{ padding:'12px 20px', borderBottom:'1px solid var(--border)', background:'var(--bg2)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div>
          <div style={{ fontSize:14, fontWeight:600 }}>Calendar</div>
          <div style={{ fontSize:11, color:'var(--text3)' }}>Source: Activities · Klik tanggal untuk lihat detail · Add via menu Activities</div>
        </div>
        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
          <button onClick={()=>setCurrentMonth(subMonths(currentMonth,1))} className="btn btn-icon">‹</button>
          <div style={{ minWidth:140, textAlign:'center', fontSize:13, fontWeight:600 }}>{format(currentMonth,'MMMM yyyy')}</div>
          <button onClick={()=>setCurrentMonth(addMonths(currentMonth,1))} className="btn btn-icon">›</button>
          <button onClick={()=>{setCurrentMonth(new Date()); setSelectedDay(new Date())}} className="btn btn-sm">Today</button>
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'14px 20px', display:'grid', gridTemplateColumns:'1fr 320px', gap:14 }} className="safe-bottom page-pad dash-2col">
        {/* Calendar grid */}
        <div className="card" style={{ padding:14 }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:1, fontSize:11, color:'var(--text3)', fontWeight:600, textAlign:'center', marginBottom:6 }}>
            {['Sen','Sel','Rab','Kam','Jum','Sab','Min'].map(d => <div key={d} style={{ padding:'4px 0' }}>{d}</div>)}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:2 }}>
            {days.map(day => {
              const dayActivities = activitiesOn(day)
              const isCurrentMonth = isSameMonth(day, currentMonth)
              const isToday = isSameDay(day, new Date())
              const isSelected = isSameDay(day, selectedDay)
              const isHoliday = holidays.has(format(day,'yyyy-MM-dd'))
              return (
                <div key={day.toISOString()} onClick={()=>setSelectedDay(day)} style={{
                  minHeight:80, minWidth:0, padding:6, borderRadius:7, cursor:'pointer', overflow:'hidden',
                  background: isSelected ? 'var(--brand-soft)' : isHoliday ? 'rgba(220,38,38,0.08)' : isToday ? 'var(--bg3)' : 'transparent',
                  border: `1px solid ${isSelected?'var(--brand)':isHoliday?'rgba(220,38,38,0.5)':'var(--border)'}`,
                  opacity: isCurrentMonth ? 1 : 0.4,
                }}>
                  <div style={{ fontSize:11, fontWeight: isToday?700:500, color: isHoliday?'#dc2626':isToday?'var(--brand)':'var(--text2)', marginBottom:3 }}>{format(day,'d')}</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:2, minWidth:0 }}>
                    {isHoliday && <div style={{ fontSize:9, fontWeight:700, color:'#dc2626', display:'flex', alignItems:'center', gap:3, minWidth:0 }}><span style={{ width:5, height:5, borderRadius:'50%', background:'#dc2626', flexShrink:0 }} />Hari Libur</div>}
                    {dayActivities.slice(0, isHoliday?1:2).map(a => (
                      <div key={a._id} title={a.title} style={{ display:'flex', alignItems:'center', gap:3, fontSize:9, minWidth:0 }}>
                        <span style={{ width:5, height:5, borderRadius:'50%', background:catColor(a.category), flexShrink:0 }} />
                        <span style={{ color:'var(--text2)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', minWidth:0 }}>{a.title}</span>
                      </div>
                    ))}
                    {dayActivities.length > (isHoliday?1:2) && <div style={{ fontSize:9, color:'var(--text3)', fontWeight:600 }}>+{dayActivities.length-(isHoliday?1:2)} lagi</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Selected day detail */}
        <div className="card" style={{ padding:14 }}>
          <div style={{ fontSize:13, fontWeight:600, marginBottom:4 }}>{format(selectedDay,'EEEE, d MMM yyyy')}</div>
          {holidays.has(format(selectedDay,'yyyy-MM-dd')) && (
            <div style={{ fontSize:11.5, fontWeight:700, color:'#dc2626', background:'rgba(220,38,38,0.08)', border:'1px solid rgba(220,38,38,0.4)', borderRadius:7, padding:'7px 10px', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>🔴 Hari Libur</div>
          )}
          <div style={{ fontSize:11, color:'var(--text3)', marginBottom:10 }}>{selectedDayActivities.length} aktivitas</div>
          {selectedDayActivities.length === 0 ? (
            <div style={{ textAlign:'center', padding:20, color:'var(--text3)', fontSize:11 }}>Tidak ada aktivitas</div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {selectedDayActivities.map(a => (
                <div key={a._id} onClick={()=>setSelected(a)} style={{ padding:'8px 10px', borderRadius:7, cursor:'pointer', border:`1px solid var(--border)`, borderLeft:`3px solid ${catColor(a.category)}`, background:'var(--bg2)' }}>
                  <div style={{ fontSize:12, fontWeight:600 }}>{a.title}</div>
                  <div style={{ fontSize:10, color:'var(--text3)', marginTop:2 }}>{a.category} · {a.subType}</div>
                  {a.startTime && <div style={{ fontSize:10, color:'var(--text2)' }}>🕐 {a.startTime}{a.endTime?' - '+a.endTime:''}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
const lbl: React.CSSProperties = { display:'block', fontSize:11, fontWeight:500, color:'var(--text2)', marginBottom:5 }
