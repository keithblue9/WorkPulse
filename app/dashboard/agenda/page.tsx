'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import { format, addDays, startOfWeek } from 'date-fns'

const ITEM_TYPES: Record<string,{label:string;color:string;icon:string}> = {
  meeting:  { label:'Meeting',   color:'var(--blue)',   icon:'👥' },
  task:     { label:'Task',      color:'var(--purple)', icon:'✅' },
  dinas:    { label:'Dinas',     color:'var(--amber)',  icon:'✈️' },
  wfo:      { label:'WFO',       color:'var(--teal)',   icon:'🏢' },
  wfh:      { label:'WFH',       color:'var(--green)',  icon:'🏠' },
  event:    { label:'Event',     color:'var(--pink)',   icon:'🎉' },
  other:    { label:'Lainnya',   color:'var(--text3)',  icon:'📌' },
}
const PRIORITIES: Record<string,{label:string;color:string}> = {
  high:   { label:'High',   color:'var(--red)' },
  medium: { label:'Medium', color:'var(--amber)' },
  low:    { label:'Low',    color:'var(--green)' },
}
const TEAM_IDS = ['mas-e','rina-s','budi-h','dewi-p','adi-k']
const TEAM = [
  { id:'mas-e', name:'Mas E', color:'#2563d4' },
  { id:'rina-s', name:'Rina S', color:'#7c3aed' },
  { id:'budi-h', name:'Budi H', color:'#0d9488' },
  { id:'dewi-p', name:'Dewi P', color:'#d97706' },
  { id:'adi-k', name:'Adi K', color:'#16a34a' },
]

function AgendaItemForm({ date, onClose, onSave, editing }: { date:string; onClose:()=>void; onSave:(item:any)=>void; editing?:any }) {
  const [form, setForm] = useState({
    title: editing?.title||'', type: editing?.type||'task', priority: editing?.priority||'medium',
    time: editing?.time||'', endTime: editing?.endTime||'', location: editing?.location||'',
    description: editing?.description||'', attendees: editing?.attendees?.join(', ')||'',
    status: editing?.status||'planned',
  })
  const set = (k:string,v:any) => setForm(f=>({...f,[k]:v}))
  const cfg = ITEM_TYPES[form.type]

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ width:480 }}>
        <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between' }}>
          <span style={{ fontSize:13, fontWeight:600 }}>{editing?'Edit Item':'+ Tambah Agenda'} — {date}</span>
          <button onClick={onClose} className="btn btn-icon">×</button>
        </div>
        <div style={{ padding:'14px 18px', display:'flex', flexDirection:'column', gap:10 }}>
          {/* Type */}
          <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
            {Object.entries(ITEM_TYPES).map(([k,v]) => (
              <button key={k} onClick={()=>set('type',k)} style={{ padding:'3px 9px', borderRadius:6, fontSize:11, cursor:'pointer', border:`1px solid ${form.type===k?v.color:'var(--border)'}`, background:form.type===k?v.color+'22':'var(--bg3)', color:form.type===k?v.color:'var(--text2)' }}>{v.icon} {v.label}</button>
            ))}
          </div>
          <div><label style={lbl}>Judul *</label><input className="input" value={form.title} onChange={e=>set('title',e.target.value)} placeholder="Judul aktivitas..." /></div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
            <div><label style={lbl}>Mulai</label><input type="time" className="input" value={form.time} onChange={e=>set('time',e.target.value)} /></div>
            <div><label style={lbl}>Selesai</label><input type="time" className="input" value={form.endTime} onChange={e=>set('endTime',e.target.value)} /></div>
            <div><label style={lbl}>Prioritas</label>
              <select className="input" value={form.priority} onChange={e=>set('priority',e.target.value)}>
                {Object.entries(PRIORITIES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
              </select></div>
          </div>
          <div><label style={lbl}>Lokasi</label><input className="input" value={form.location} onChange={e=>set('location',e.target.value)} placeholder="Online / nama tempat..." /></div>
          <div><label style={lbl}>Peserta (pisahkan koma)</label><input className="input" value={form.attendees} onChange={e=>set('attendees',e.target.value)} placeholder="Erwin, Nabila, Bagus..." /></div>
          <div><label style={lbl}>Deskripsi</label><textarea className="input" value={form.description} onChange={e=>set('description',e.target.value)} rows={2} placeholder="Detail tambahan..." /></div>
        </div>
        <div style={{ padding:'12px 18px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'flex-end', gap:8 }}>
          <button onClick={onClose} className="btn">Batal</button>
          <button onClick={()=>{ if(!form.title){toast.error('Judul wajib');return}; onSave({...form, attendees: form.attendees.split(',').map(s=>s.trim()).filter(Boolean)}); onClose() }} className="btn btn-primary">Simpan</button>
        </div>
      </div>
    </div>
  )
}

export default function AgendaPage() {
  const { data:session } = useSession(); const user = session?.user as any
  const [selectedDate, setSelectedDate] = useState(format(new Date(),'yyyy-MM-dd'))
  const [selectedUser, setSelectedUser] = useState('mas-e')
  const [agendas, setAgendas] = useState<Record<string,any>>({})
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState<string|null>(null)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [viewMode, setViewMode] = useState<'day'|'week'>('week')

  const today = format(new Date(),'yyyy-MM-dd')
  const weekStart = format(startOfWeek(new Date(selectedDate), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const weekDays = Array.from({length:7},(_,i)=>format(addDays(new Date(weekStart),i),'yyyy-MM-dd'))

  useEffect(() => {
    async function load() {
      setLoading(true)
      const from = viewMode==='day' ? selectedDate : weekDays[0]
      const to = viewMode==='day' ? selectedDate : weekDays[6]
      const d = await fetch(`/api/agenda?userId=${selectedUser}&from=${from}&to=${to}`).then(r=>r.json())
      const map: Record<string,any> = {}
      ;(d.data||[]).forEach((a:any) => { map[a.date] = a })
      setAgendas(map); setLoading(false)
    }
    load()
  }, [selectedDate, selectedUser, viewMode])

  async function addItem(date:string, item:any) {
    const existing = agendas[date]
    const r = await fetch('/api/agenda', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ userId:selectedUser, date, addItem: item }) })
    const d = await r.json()
    setAgendas(prev => ({...prev, [date]: d.data}))
    toast.success('Agenda ditambahkan!')
  }

  async function removeItem(date:string, agendaId:string, itemId:string) {
    await fetch(`/api/agenda/${agendaId}`, { method:'PATCH', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ removeItemId: itemId }) })
    setAgendas(prev => ({...prev, [date]: {...prev[date], items: prev[date].items.filter((i:any)=>i._id!==itemId)}}))
    toast.success('Dihapus')
  }

  const DAY_NAMES = ['Sen','Sel','Rab','Kam','Jum','Sab','Min']

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {showForm && <AgendaItemForm date={showForm} onClose={()=>setShowForm(null)} onSave={item=>addItem(showForm,item)} />}

      <div style={{ padding:'12px 20px', borderBottom:'1px solid var(--border)', background:'var(--bg2)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div><div style={{ fontSize:14, fontWeight:600 }}>Daily Agenda</div><div style={{ fontSize:11, color:'var(--text3)' }}>Aktivitas harian & rencana per PIC</div></div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <div style={{ display:'flex', gap:0, background:'var(--bg3)', borderRadius:8, padding:3 }}>
            {[['day','Hari'],['week','Minggu']].map(([v,l]) => (
              <button key={v} onClick={()=>setViewMode(v as any)} style={{ padding:'4px 12px', borderRadius:6, fontSize:12, fontWeight:500, cursor:'pointer', border:'none', background:viewMode===v?'var(--bg2)':'transparent', color:viewMode===v?'var(--text)':'var(--text3)' }}>{l}</button>
            ))}
          </div>
          <input type="date" className="input" style={{ width:150 }} value={selectedDate} onChange={e=>setSelectedDate(e.target.value)} />
        </div>
      </div>

      {/* User selector */}
      <div style={{ display:'flex', gap:6, padding:'8px 20px', background:'var(--bg2)', borderBottom:'1px solid var(--border)', flexShrink:0, overflowX:'auto' }}>
        {TEAM.map(m => (
          <button key={m.id} onClick={()=>setSelectedUser(m.id)} style={{ padding:'5px 12px', borderRadius:20, fontSize:12, fontWeight:500, cursor:'pointer', border:`1px solid ${selectedUser===m.id?m.color:'var(--border)'}`, background:selectedUser===m.id?m.color+'33':'var(--bg3)', color:selectedUser===m.id?m.color:'var(--text2)', whiteSpace:'nowrap' }}>
            {m.name}
          </button>
        ))}
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'12px 20px' }}>
        {viewMode === 'day' ? (
          /* Day view */
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <div style={{ fontSize:14, fontWeight:600, color:'var(--text)' }}>{selectedDate} {selectedDate===today?'(Hari ini)':''}</div>
              <button className="btn btn-primary btn-sm" onClick={()=>setShowForm(selectedDate)}>+ Tambah</button>
            </div>
            {agendas[selectedDate]?.items?.length > 0 ? (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {[...agendas[selectedDate].items].sort((a:any,b:any)=>(a.time||'').localeCompare(b.time||'')).map((item:any) => {
                  const cfg = ITEM_TYPES[item.type]||ITEM_TYPES.other
                  const pcfg = PRIORITIES[item.priority]||PRIORITIES.medium
                  return (
                    <div key={item._id} className="card" style={{ padding:'12px 14px', borderLeft:`3px solid ${cfg.color}` }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                        <div style={{ flex:1 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                            <span style={{ fontSize:14 }}>{cfg.icon}</span>
                            <span style={{ fontSize:13, fontWeight:500, color:'var(--text)' }}>{item.title}</span>
                            <span style={{ fontSize:10, fontWeight:600, color:pcfg.color, background:pcfg.color+'22', padding:'1px 6px', borderRadius:20 }}>{pcfg.label}</span>
                          </div>
                          {(item.time||item.endTime) && <div style={{ fontSize:11, color:'var(--text3)', marginBottom:2 }}>⏰ {item.time}{item.endTime?` – ${item.endTime}`:''}</div>}
                          {item.location && <div style={{ fontSize:11, color:'var(--text3)', marginBottom:2 }}>📍 {item.location}</div>}
                          {item.attendees?.length>0 && <div style={{ fontSize:11, color:'var(--text3)', marginBottom:2 }}>👥 {item.attendees.join(', ')}</div>}
                          {item.description && <div style={{ fontSize:11, color:'var(--text2)', marginTop:4 }}>{item.description}</div>}
                        </div>
                        <button onClick={()=>removeItem(selectedDate, agendas[selectedDate]._id, item._id)} className="btn btn-icon btn-sm" style={{ fontSize:12, marginLeft:8 }}>×</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={{ textAlign:'center', padding:'40px 0', color:'var(--text3)' }}>
                <div style={{ fontSize:28, marginBottom:8 }}>📅</div>
                <div style={{ fontSize:12 }}>Belum ada agenda untuk hari ini</div>
                <button className="btn btn-primary btn-sm" style={{ marginTop:10 }} onClick={()=>setShowForm(selectedDate)}>+ Tambah Agenda</button>
              </div>
            )}
          </div>
        ) : (
          /* Week view */
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:8 }}>
            {weekDays.map((date, i) => {
              const isToday = date===today
              const isSelected = date===selectedDate
              const dayAgenda = agendas[date]
              const items = dayAgenda?.items || []
              return (
                <div key={date} onClick={()=>setSelectedDate(date)} style={{ cursor:'pointer' }}>
                  <div style={{ textAlign:'center', marginBottom:6 }}>
                    <div style={{ fontSize:10, color:'var(--text3)', fontWeight:600 }}>{DAY_NAMES[i]}</div>
                    <div style={{ width:28, height:28, borderRadius:'50%', margin:'3px auto 0', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:isToday?700:400, background:isToday?'var(--blue)':isSelected?'var(--bg4)':'transparent', color:isToday?'#fff':'var(--text2)' }}>{parseInt(date.split('-')[2])}</div>
                  </div>
                  <div style={{ background:'var(--bg2)', border:`1px solid ${isSelected?'var(--blue)':'var(--border)'}`, borderRadius:8, minHeight:120, padding:6, transition:'border-color 0.15s' }}>
                    <button onClick={e=>{e.stopPropagation();setShowForm(date)}} className="btn btn-sm" style={{ width:'100%', marginBottom:4, fontSize:10, padding:'2px 0', justifyContent:'center' }}>+ Tambah</button>
                    {items.slice(0,4).map((item:any) => {
                      const cfg = ITEM_TYPES[item.type]||ITEM_TYPES.other
                      return (
                        <div key={item._id} style={{ padding:'2px 5px', borderRadius:4, fontSize:10, color:cfg.color, background:cfg.color+'22', marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {cfg.icon} {item.time && `${item.time} `}{item.title}
                        </div>
                      )
                    })}
                    {items.length>4 && <div style={{ fontSize:10, color:'var(--text3)', textAlign:'center' }}>+{items.length-4} lagi</div>}
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
