'use client'
import { useEffect, useState, useRef } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import { format, addDays, startOfWeek, startOfMonth, endOfMonth, getDay, getDaysInMonth, addMonths, subMonths } from 'date-fns'

const ITEM_TYPES: Record<string,{label:string;color:string;icon:string}> = {
  meeting:  { label:'Meeting',   color:'#4f8ef7', icon:'👥' },
  task:     { label:'Task',      color:'#a78bfa', icon:'✅' },
  dinas:    { label:'Dinas',     color:'#f59e0b', icon:'✈️' },
  wfo:      { label:'WFO',       color:'#2dd4bf', icon:'🏢' },
  wfh:      { label:'WFH',       color:'#22c55e', icon:'🏠' },
  event:    { label:'Event',     color:'#f472b6', icon:'🎉' },
  other:    { label:'Lainnya',   color:'#9da3b8', icon:'📌' },
}
const PRIORITIES: Record<string,{label:string;color:string}> = {
  high:{label:'High',color:'var(--red)'}, medium:{label:'Medium',color:'var(--amber)'}, low:{label:'Low',color:'var(--green)'},
}
const MEMBER_COLORS = ['#4f8ef7','#a78bfa','#f59e0b','#22c55e','#2dd4bf','#f472b6','#ef4444','#818cf8','#fbbf24']

function AgendaItemForm({ date, onClose, onSave, editing }: { date:string; onClose:()=>void; onSave:(item:any)=>void; editing?:any }) {
  const [form, setForm] = useState({
    title:editing?.title||'', type:editing?.type||'task', priority:editing?.priority||'medium',
    time:editing?.time||'', endTime:editing?.endTime||'', location:editing?.location||'',
    description:editing?.description||'', attendees:editing?.attendees?.join(', ')||'',
  })
  const set = (k:string,v:any) => setForm(f=>({...f,[k]:v}))

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ width:480 }}>
        <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between' }}>
          <span style={{ fontSize:13, fontWeight:600 }}>{editing?'Edit':'+ Tambah Agenda'} — {date}</span>
          <button onClick={onClose} className="btn btn-icon">×</button>
        </div>
        <div style={{ padding:'14px 18px', display:'flex', flexDirection:'column', gap:10 }}>
          <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
            {Object.entries(ITEM_TYPES).map(([k,v]) => (
              <button key={k} onClick={()=>set('type',k)} style={{ padding:'3px 9px', borderRadius:6, fontSize:11, cursor:'pointer', border:`1px solid ${form.type===k?v.color:'var(--border)'}`, background:form.type===k?v.color+'22':'var(--bg3)', color:form.type===k?v.color:'var(--text2)' }}>{v.icon} {v.label}</button>
            ))}
          </div>
          <div><label style={lbl}>Judul *</label><input className="input" value={form.title} onChange={e=>set('title',e.target.value)} /></div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
            <div><label style={lbl}>Mulai</label><input type="time" className="input" value={form.time} onChange={e=>set('time',e.target.value)} /></div>
            <div><label style={lbl}>Selesai</label><input type="time" className="input" value={form.endTime} onChange={e=>set('endTime',e.target.value)} /></div>
            <div><label style={lbl}>Priority</label>
              <select className="input" value={form.priority} onChange={e=>set('priority',e.target.value)}>
                {Object.entries(PRIORITIES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
              </select></div>
          </div>
          <div><label style={lbl}>Lokasi</label><input className="input" value={form.location} onChange={e=>set('location',e.target.value)} /></div>
          <div><label style={lbl}>Peserta</label><input className="input" value={form.attendees} onChange={e=>set('attendees',e.target.value)} /></div>
          <div><label style={lbl}>Deskripsi</label><textarea className="input" value={form.description} onChange={e=>set('description',e.target.value)} rows={2} /></div>
        </div>
        <div style={{ padding:'12px 18px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'flex-end', gap:8 }}>
          <button onClick={onClose} className="btn">Batal</button>
          <button onClick={()=>{ if(!form.title){toast.error('Judul wajib');return}; onSave({...form, attendees: form.attendees.split(',').map((s:string)=>s.trim()).filter(Boolean)}); onClose() }} className="btn btn-primary">Simpan</button>
        </div>
      </div>
    </div>
  )
}

export default function AgendaPage() {
  const { data:session } = useSession(); const user = session?.user as any
  const [members, setMembers] = useState<any[]>([])
  const [selectedDate, setSelectedDate] = useState(format(new Date(),'yyyy-MM-dd'))
  const [selectedUser, setSelectedUser] = useState<string>('')
  const [agendas, setAgendas] = useState<Record<string,any>>({})
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState<string|null>(null)
  const [viewMode, setViewMode] = useState<'day'|'week'|'month'|'all'>('week')

  useEffect(() => {
    fetch('/api/users').then(r=>r.json()).then(d => {
      const list = (d.data||[]).filter((u:any)=>u.active!==false)
      setMembers(list)
      if (list.length && !selectedUser) setSelectedUser(list[0]._id || list[0].email)
    })
  }, [])

  const memberColors: Record<string,string> = {}
  members.forEach((m, i) => { memberColors[m._id || m.email] = MEMBER_COLORS[i % MEMBER_COLORS.length] })

  useEffect(() => {
    async function load() {
      setLoading(true)
      let from = selectedDate, to = selectedDate
      if (viewMode === 'week') {
        const ws = format(startOfWeek(new Date(selectedDate), { weekStartsOn:1 }), 'yyyy-MM-dd')
        from = ws; to = format(addDays(new Date(ws), 6), 'yyyy-MM-dd')
      } else if (viewMode === 'month' || viewMode === 'all') {
        from = format(startOfMonth(new Date(selectedDate)), 'yyyy-MM-dd')
        to = format(endOfMonth(new Date(selectedDate)), 'yyyy-MM-dd')
      }
      const userParam = viewMode === 'all' ? '' : `userId=${selectedUser}&`
      const d = await fetch(`/api/agenda?${userParam}from=${from}&to=${to}`).then(r=>r.json())
      const map: Record<string,any> = {}
      ;(d.data||[]).forEach((a:any) => {
        const key = viewMode === 'all' ? `${a.userId}|${a.date}` : a.date
        map[key] = a
      })
      setAgendas(map); setLoading(false)
    }
    if (selectedUser || viewMode === 'all') load()
  }, [selectedDate, selectedUser, viewMode])

  async function addItem(date:string, item:any) {
    const r = await fetch('/api/agenda', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ userId:selectedUser, date, addItem:item }) })
    const d = await r.json()
    setAgendas(prev => ({ ...prev, [date]: d.data }))
    toast.success('Agenda ditambahkan!')
  }

  async function removeItem(date:string, agendaId:string, itemId:string) {
    await fetch(`/api/agenda/${agendaId}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ removeItemId: itemId }) })
    setAgendas(prev => ({ ...prev, [date]: { ...prev[date], items: prev[date].items.filter((i:any)=>i._id!==itemId) } }))
    toast.success('Dihapus')
  }

  const today = format(new Date(),'yyyy-MM-dd')
  const DAY_NAMES = ['Sen','Sel','Rab','Kam','Jum','Sab','Min']

  const weekDays = (() => {
    const ws = startOfWeek(new Date(selectedDate), { weekStartsOn:1 })
    return Array.from({length:7},(_,i)=>format(addDays(ws,i),'yyyy-MM-dd'))
  })()

  const monthDays = (() => {
    const mStart = startOfMonth(new Date(selectedDate))
    const dim = getDaysInMonth(mStart)
    const firstDow = (getDay(mStart)+6)%7
    const arr: (string|null)[] = []
    for (let i=0;i<firstDow;i++) arr.push(null)
    for (let i=1;i<=dim;i++) arr.push(format(new Date(mStart.getFullYear(), mStart.getMonth(), i), 'yyyy-MM-dd'))
    return arr
  })()

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {showForm && <AgendaItemForm date={showForm} onClose={()=>setShowForm(null)} onSave={item=>addItem(showForm,item)} />}

      <div style={{ padding:'12px 20px', borderBottom:'1px solid var(--border)', background:'var(--bg2)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div><div style={{ fontSize:14, fontWeight:600 }}>Daily Agenda</div><div style={{ fontSize:11, color:'var(--text3)' }}>Aktivitas harian per PIC atau view semua member</div></div>
        <div style={{ display:'flex', gap:8 }}>
          <div style={{ display:'flex', gap:0, background:'var(--bg3)', borderRadius:8, padding:3 }}>
            {[['day','Hari'],['week','Minggu'],['month','Bulan'],['all','All Members']].map(([v,l]) => (
              <button key={v} onClick={()=>setViewMode(v as any)} style={{ padding:'4px 11px', borderRadius:6, fontSize:11, fontWeight:500, cursor:'pointer', border:'none', background:viewMode===v?'var(--bg2)':'transparent', color:viewMode===v?'var(--text)':'var(--text3)' }}>{l}</button>
            ))}
          </div>
          {viewMode === 'month' || viewMode === 'all' ? (
            <div style={{ display:'flex', gap:4, alignItems:'center' }}>
              <button onClick={()=>setSelectedDate(format(subMonths(new Date(selectedDate),1),'yyyy-MM-dd'))} className="btn btn-sm">◀</button>
              <span style={{ padding:'4px 10px', background:'var(--bg3)', borderRadius:6, fontSize:12, fontWeight:500, minWidth:120, textAlign:'center' }}>{format(new Date(selectedDate),'MMM yyyy')}</span>
              <button onClick={()=>setSelectedDate(format(addMonths(new Date(selectedDate),1),'yyyy-MM-dd'))} className="btn btn-sm">▶</button>
            </div>
          ) : (
            <input type="date" className="input" style={{ width:150 }} value={selectedDate} onChange={e=>setSelectedDate(e.target.value)} />
          )}
        </div>
      </div>

      {viewMode !== 'all' && (
        <div style={{ display:'flex', gap:5, padding:'8px 20px', background:'var(--bg2)', borderBottom:'1px solid var(--border)', flexShrink:0, overflowX:'auto' }}>
          {members.map(m => {
            const id = m._id || m.email
            const c = memberColors[id]
            return (
              <button key={id} onClick={()=>setSelectedUser(id)} style={{ padding:'4px 11px', borderRadius:20, fontSize:11, fontWeight:500, cursor:'pointer', border:`1px solid ${selectedUser===id?c:'var(--border)'}`, background:selectedUser===id?c+'33':'var(--bg3)', color:selectedUser===id?c:'var(--text2)', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:5 }}>
                <span style={{ width:8, height:8, borderRadius:'50%', background:c }} />
                {m.name}
              </button>
            )
          })}
        </div>
      )}

      {viewMode === 'all' && (
        <div style={{ display:'flex', gap:6, padding:'8px 20px', background:'var(--bg2)', borderBottom:'1px solid var(--border)', flexShrink:0, flexWrap:'wrap' }}>
          <span style={{ fontSize:10, color:'var(--text3)', alignSelf:'center', marginRight:6 }}>Legenda warna:</span>
          {members.map(m => (
            <div key={m._id||m.email} style={{ display:'flex', alignItems:'center', gap:4, fontSize:10, color:'var(--text2)' }}>
              <span style={{ width:10, height:10, borderRadius:3, background:memberColors[m._id||m.email] }} />
              {m.name}
            </div>
          ))}
        </div>
      )}

      <div style={{ flex:1, overflow:'auto', padding:'12px 20px' }}>
        {loading && <div style={{ textAlign:'center', padding:20, color:'var(--text3)', fontSize:12 }}>Memuat...</div>}

        {/* Day view */}
        {viewMode === 'day' && (
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <div style={{ fontSize:14, fontWeight:600 }}>{format(new Date(selectedDate),'EEE, d MMM yyyy')} {selectedDate===today?'(Hari ini)':''}</div>
              <button className="btn btn-primary btn-sm" onClick={()=>setShowForm(selectedDate)}>+ Tambah</button>
            </div>
            {(agendas[selectedDate]?.items || []).length > 0 ? (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {[...(agendas[selectedDate]?.items||[])].sort((a:any,b:any)=>(a.time||'').localeCompare(b.time||'')).map((item:any) => {
                  const cfg = ITEM_TYPES[item.type]||ITEM_TYPES.other
                  return (
                    <div key={item._id} className="card" style={{ padding:'12px 14px', borderLeft:`3px solid ${cfg.color}` }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                        <div style={{ flex:1 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                            <span>{cfg.icon}</span>
                            <span style={{ fontSize:13, fontWeight:500, color:'var(--text)' }}>{item.title}</span>
                          </div>
                          {(item.time||item.endTime) && <div style={{ fontSize:11, color:'var(--text3)' }}>⏰ {item.time}{item.endTime?` – ${item.endTime}`:''}</div>}
                          {item.location && <div style={{ fontSize:11, color:'var(--text3)' }}>📍 {item.location}</div>}
                          {item.description && <div style={{ fontSize:11, color:'var(--text2)', marginTop:4 }}>{item.description}</div>}
                        </div>
                        <button onClick={()=>removeItem(selectedDate, agendas[selectedDate]._id, item._id)} className="btn btn-icon btn-sm">×</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={{ textAlign:'center', padding:'40px 0', color:'var(--text3)' }}>
                <div style={{ fontSize:28, marginBottom:8 }}>📅</div>
                <div style={{ fontSize:12 }}>Belum ada agenda</div>
              </div>
            )}
          </div>
        )}

        {/* Week view */}
        {viewMode === 'week' && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:8 }}>
            {weekDays.map((date,i) => {
              const isToday = date===today
              const items = agendas[date]?.items || []
              return (
                <div key={date} onClick={()=>{setSelectedDate(date);setViewMode('day')}} style={{ cursor:'pointer' }}>
                  <div style={{ textAlign:'center', marginBottom:6 }}>
                    <div style={{ fontSize:10, color:'var(--text3)', fontWeight:600 }}>{DAY_NAMES[i]}</div>
                    <div style={{ width:28, height:28, borderRadius:'50%', margin:'3px auto 0', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:isToday?700:400, background:isToday?'var(--blue)':'transparent', color:isToday?'#fff':'var(--text2)' }}>{parseInt(date.split('-')[2])}</div>
                  </div>
                  <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, minHeight:120, padding:6 }}>
                    <button onClick={e=>{e.stopPropagation();setShowForm(date)}} className="btn btn-sm" style={{ width:'100%', marginBottom:4, fontSize:10, padding:'2px 0', justifyContent:'center' }}>+</button>
                    {items.slice(0,4).map((item:any) => {
                      const cfg = ITEM_TYPES[item.type]||ITEM_TYPES.other
                      return (
                        <div key={item._id} style={{ padding:'2px 5px', borderRadius:4, fontSize:10, color:cfg.color, background:cfg.color+'22', marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {cfg.icon} {item.time && `${item.time} `}{item.title}
                        </div>
                      )
                    })}
                    {items.length>4 && <div style={{ fontSize:10, color:'var(--text3)', textAlign:'center' }}>+{items.length-4}</div>}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Month view (single user) */}
        {viewMode === 'month' && (
          <div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4, marginBottom:6 }}>
              {DAY_NAMES.map(d=><div key={d} style={{ textAlign:'center', fontSize:10, fontWeight:600, color:'var(--text3)', padding:'4px 0' }}>{d}</div>)}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4 }}>
              {monthDays.map((date, i) => {
                if (!date) return <div key={`e${i}`} />
                const isToday = date===today
                const items = agendas[date]?.items || []
                return (
                  <div key={date} onClick={()=>setShowForm(date)} style={{ minHeight:80, background:'var(--bg2)', border:`${isToday?'2px':'1px'} solid ${isToday?'var(--blue)':'var(--border)'}`, borderRadius:7, padding:5, cursor:'pointer', display:'flex', flexDirection:'column' }}>
                    <div style={{ fontSize:10, fontWeight:isToday?700:500, color:isToday?'var(--blue)':'var(--text2)', marginBottom:3 }}>{parseInt(date.split('-')[2])}</div>
                    {items.slice(0,3).map((item:any)=>{
                      const cfg = ITEM_TYPES[item.type]||ITEM_TYPES.other
                      return (
                        <div key={item._id} style={{ padding:'1px 4px', borderRadius:3, fontSize:9, color:cfg.color, background:cfg.color+'22', marginBottom:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', lineHeight:1.3 }}>{cfg.icon} {item.title}</div>
                      )
                    })}
                    {items.length>3 && <div style={{ fontSize:9, color:'var(--text3)' }}>+{items.length-3}</div>}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* All members view (month calendar with color per member) */}
        {viewMode === 'all' && (
          <div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4, marginBottom:6 }}>
              {DAY_NAMES.map(d=><div key={d} style={{ textAlign:'center', fontSize:10, fontWeight:600, color:'var(--text3)', padding:'4px 0' }}>{d}</div>)}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4 }}>
              {monthDays.map((date, i) => {
                if (!date) return <div key={`e${i}`} />
                const isToday = date===today
                // gather items from all members for this date
                const allItems: { item:any; member:any; color:string }[] = []
                members.forEach(m => {
                  const id = m._id || m.email
                  const a = agendas[`${id}|${date}`]
                  ;(a?.items || []).forEach((item:any) => allItems.push({ item, member:m, color: memberColors[id] }))
                })
                return (
                  <div key={date} style={{ minHeight:110, background:'var(--bg2)', border:`${isToday?'2px':'1px'} solid ${isToday?'var(--blue)':'var(--border)'}`, borderRadius:7, padding:5, display:'flex', flexDirection:'column', overflow:'hidden' }}>
                    <div style={{ fontSize:10, fontWeight:isToday?700:500, color:isToday?'var(--blue)':'var(--text2)', marginBottom:3 }}>{parseInt(date.split('-')[2])}</div>
                    <div style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:1 }}>
                      {allItems.slice(0,5).map(({item, member, color},idx) => (
                        <div key={idx} title={`${member.name}: ${item.title}`} style={{ padding:'1px 4px', borderRadius:3, fontSize:9, color, background:color+'22', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', lineHeight:1.3, display:'flex', gap:3, alignItems:'center' }}>
                          <span style={{ width:4, height:4, borderRadius:'50%', background:color, flexShrink:0 }} />
                          <span style={{ overflow:'hidden', textOverflow:'ellipsis' }}>{item.title}</span>
                        </div>
                      ))}
                      {allItems.length>5 && <div style={{ fontSize:9, color:'var(--text3)' }}>+{allItems.length-5}</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
const lbl: React.CSSProperties = { display:'block', fontSize:11, fontWeight:500, color:'var(--text2)', marginBottom:5 }
