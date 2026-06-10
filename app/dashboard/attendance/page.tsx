'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { AppConfig, AttendanceType } from '@/types'
import toast from 'react-hot-toast'
import { format, getDaysInMonth, getDay, startOfMonth } from 'date-fns'

const TEAM = [
  { id:'mas-e',  name:'Mas E',  division:'BPD Proc', color:'#2563d4' },
  { id:'rina-s', name:'Rina S', division:'SS Proc',  color:'#7c3aed' },
  { id:'budi-h', name:'Budi H', division:'TnD',      color:'#0d9488' },
  { id:'dewi-p', name:'Dewi P', division:'EIT',       color:'#d97706' },
  { id:'adi-k',  name:'Adi K',  division:'PMO',       color:'#16a34a' },
]

function SlotForm({ date, attTypes, onClose, onSave }: { date:string; attTypes:AttendanceType[]; onClose:()=>void; onSave:(slot:any)=>void }) {
  const [type, setType] = useState(attTypes[0]?.key || 'wfo')
  const [isFullDay, setIsFullDay] = useState(true)
  const [startTime, setStartTime] = useState('08:00')
  const [endTime, setEndTime] = useState('17:00')
  const [note, setNote] = useState('')
  const typeDef = attTypes.find(t => t.key === type)

  function save() {
    onSave({ type, label: typeDef?.label, isFullDay, startTime: isFullDay ? 'fullday' : startTime, endTime: isFullDay ? 'fullday' : endTime, note })
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ width:400 }}>
        <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between' }}>
          <span style={{ fontSize:13, fontWeight:600 }}>+ Tambah Kehadiran — {date}</span>
          <button onClick={onClose} className="btn btn-icon">×</button>
        </div>
        <div style={{ padding:'14px 18px', display:'flex', flexDirection:'column', gap:12 }}>
          <div><label style={lbl}>Tipe Kehadiran</label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {attTypes.map(t => (
                <button key={t.key} onClick={()=>setType(t.key)} style={{ padding:'5px 12px', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer', border:`1px solid ${type===t.key?t.textColor:'var(--border)'}`, background:type===t.key?t.color:' var(--bg3)', color:type===t.key?t.textColor:'var(--text2)' }}>{t.label}</button>
              ))}
            </div></div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div className={`toggle-wrap${isFullDay?' on':''}`} onClick={()=>setIsFullDay(!isFullDay)} />
            <span style={{ fontSize:12, color:'var(--text2)' }}>Full Day</span>
          </div>
          {!isFullDay && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <div><label style={lbl}>Mulai</label><input type="time" className="input" value={startTime} onChange={e=>setStartTime(e.target.value)} /></div>
              <div><label style={lbl}>Selesai</label><input type="time" className="input" value={endTime} onChange={e=>setEndTime(e.target.value)} /></div>
            </div>
          )}
          <div><label style={lbl}>Catatan (opsional)</label><input className="input" value={note} onChange={e=>setNote(e.target.value)} placeholder="cth: WFO pagi, Dinas sore" /></div>
          {typeDef && (
            <div style={{ padding:'8px 12px', background:typeDef.color, borderRadius:7, fontSize:12, fontWeight:600, color:typeDef.textColor }}>
              Preview: {typeDef.label} {isFullDay ? '(Full Day)' : `${startTime}–${endTime}`}
            </div>
          )}
        </div>
        <div style={{ padding:'12px 18px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'flex-end', gap:8 }}>
          <button onClick={onClose} className="btn">Batal</button>
          <button onClick={save} className="btn btn-primary">Tambah</button>
        </div>
      </div>
    </div>
  )
}

export default function AttendancePage() {
  const { data:session } = useSession(); const user = session?.user as any
  const [month, setMonth] = useState(() => format(new Date(), 'yyyy-MM'))
  const [records, setRecords] = useState<any[]>([])
  const [config, setConfig] = useState<AppConfig|null>(null)
  const [summary, setSummary] = useState<any>(null)
  const [selectedUserId, setSelectedUserId] = useState('mas-e')
  const [showSlotForm, setShowSlotForm] = useState<string|null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [cfg, att, sum] = await Promise.all([
        fetch('/api/config').then(r=>r.json()),
        fetch(`/api/attendance?userId=${selectedUserId}&month=${month}`).then(r=>r.json()),
        fetch(`/api/attendance/summary?month=${month}`).then(r=>r.json()),
      ])
      setConfig(cfg.data); setRecords(att.data||[]); setSummary(sum.data); setLoading(false)
    }
    load()
  }, [month, selectedUserId])

  const attTypes: AttendanceType[] = config?.attendanceTypes?.filter(t=>t.active) || [
    { key:'wfo', label:'WFO', color:'#1a2d4a', textColor:'#4f8ef7', active:true },
    { key:'wfh', label:'WFH', color:'#1e1630', textColor:'#a78bfa', active:true },
    { key:'dinas', label:'Dinas', color:'#2a1f0a', textColor:'#f59e0b', active:true },
    { key:'cuti', label:'Cuti', color:'#142a1e', textColor:'#22c55e', active:true },
    { key:'sakit', label:'Sakit', color:'#2a1010', textColor:'#ef4444', active:true },
  ]

  function getRecord(day: number) {
    const dateStr = `${month}-${String(day).padStart(2,'0')}`
    return records.find(r => r.date === dateStr)
  }

  async function addSlot(day: number, slot: any) {
    const dateStr = `${month}-${String(day).padStart(2,'0')}`
    const r = await fetch('/api/attendance', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ userId:selectedUserId, date:dateStr, slot }) })
    const d = await r.json()
    setRecords(prev => { const filtered=prev.filter(r=>r.date!==dateStr); return [...filtered, d.data] })
    toast.success(`Ditambahkan: ${slot.label} ${slot.isFullDay ? '(Full Day)' : `${slot.startTime}–${slot.endTime}`}`)
  }

  async function removeSlot(day: number, slotId: string) {
    const dateStr = `${month}-${String(day).padStart(2,'0')}`
    await fetch(`/api/attendance?userId=${selectedUserId}&date=${dateStr}&slotId=${slotId}`, { method:'DELETE' })
    setRecords(prev => prev.map(r => r.date===dateStr ? {...r, slots:r.slots.filter((s:any)=>s._id!==slotId)} : r))
    toast.success('Slot dihapus')
  }

  const daysInMonth = getDaysInMonth(new Date(month+'-01'))
  const firstDayDow = (getDay(startOfMonth(new Date(month+'-01')))+6)%7
  const today = format(new Date(), 'yyyy-MM-dd')
  const DAY_LABELS = ['Sen','Sel','Rab','Kam','Jum','Sab','Min']
  const [prevM, nextM] = (() => {
    const d=new Date(month+'-01')
    const p=new Date(d); p.setMonth(p.getMonth()-1)
    const n=new Date(d); n.setMonth(n.getMonth()+1)
    return [format(p,'yyyy-MM'),format(n,'yyyy-MM')]
  })()

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {showSlotForm && <SlotForm date={showSlotForm} attTypes={attTypes} onClose={()=>setShowSlotForm(null)} onSave={slot => { const day=parseInt(showSlotForm.split('-')[2]); addSlot(day,slot); setShowSlotForm(null) }} />}

      <div style={{ padding:'12px 20px', borderBottom:'1px solid var(--border)', background:'var(--bg2)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div><div style={{ fontSize:14, fontWeight:600 }}>Absensi Harian</div><div style={{ fontSize:11, color:'var(--text3)' }}>Klik tanggal untuk tambah slot kehadiran</div></div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={()=>setMonth(prevM)} className="btn btn-sm">◀</button>
          <span style={{ padding:'5px 14px', background:'var(--bg3)', borderRadius:6, fontSize:13, fontWeight:600, color:'var(--text)' }}>{month}</span>
          <button onClick={()=>setMonth(nextM)} className="btn btn-sm">▶</button>
        </div>
      </div>

      <div style={{ flex:1, overflow:'auto', padding:'16px 20px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:16 }}>
          {/* Calendar */}
          <div>
            {/* User selector */}
            <div style={{ display:'flex', gap:6, marginBottom:12, flexWrap:'wrap' }}>
              {TEAM.map(m => (
                <button key={m.id} onClick={()=>setSelectedUserId(m.id)} style={{ padding:'5px 12px', borderRadius:20, fontSize:12, fontWeight:500, cursor:'pointer', border:`1px solid ${selectedUserId===m.id?m.color:'var(--border)'}`, background:selectedUserId===m.id?m.color+'33':'var(--bg3)', color:selectedUserId===m.id?m.color:'var(--text2)' }}>
                  {m.name}
                </button>
              ))}
            </div>

            <div className="card" style={{ padding:14 }}>
              {/* Day labels */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4, marginBottom:8 }}>
                {DAY_LABELS.map(d => <div key={d} style={{ textAlign:'center', fontSize:10, fontWeight:600, color:'var(--text3)', padding:'3px 0' }}>{d}</div>)}
              </div>

              {/* Days */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4 }}>
                {Array.from({length:firstDayDow}).map((_,i)=><div key={`e${i}`} />)}
                {Array.from({length:daysInMonth}).map((_,i) => {
                  const day = i+1
                  const dow = (firstDayDow+i)%7
                  const isWeekend = dow >= 5
                  const dateStr = `${month}-${String(day).padStart(2,'0')}`
                  const rec = getRecord(day)
                  const slots = rec?.slots || []
                  const isToday = dateStr === today
                  const primarySlot = slots[0]
                  const primaryType = primarySlot ? attTypes.find(t=>t.key===primarySlot.type) : null

                  return (
                    <div key={day} onClick={()=>!isWeekend&&setShowSlotForm(dateStr)}
                      title={slots.length>0 ? slots.map((s:any)=>`${s.label}${s.isFullDay?'':`  ${s.startTime}-${s.endTime}`}`).join('\n') : 'Klik untuk tambah kehadiran'}
                      style={{ minHeight:52, borderRadius:7, cursor:isWeekend?'default':'pointer', border:`${isToday?'2px':'1px'} solid ${isToday?'var(--blue)':primaryType?primaryType.textColor+'44':'var(--border)'}`, background:primaryType?primaryType.color:isWeekend?'var(--bg3)':'var(--bg4)', opacity:isWeekend&&!primaryType?0.4:1, transition:'all 0.1s', position:'relative', overflow:'hidden' }}
                      onMouseEnter={e=>!isWeekend&&((e.currentTarget as HTMLElement).style.transform='scale(1.04)')}
                      onMouseLeave={e=>((e.currentTarget as HTMLElement).style.transform='scale(1)')}>
                      <div style={{ padding:'4px 5px 2px', fontSize:11, fontWeight:isToday?700:400, color:primaryType?primaryType.textColor:'var(--text2)' }}>{day}</div>
                      {slots.slice(0,3).map((slot:any, si:number) => {
                        const t = attTypes.find(x=>x.key===slot.type)
                        return (
                          <div key={si} style={{ margin:'1px 3px', padding:'1px 4px', borderRadius:3, fontSize:9, fontWeight:600, background:t?t.textColor+'33':'var(--bg5)', color:t?t.textColor:'var(--text3)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', display:'flex', justifyContent:'space-between', alignItems:'center', gap:2 }}>
                            <span>{t?.label||slot.type} {!slot.isFullDay&&`${slot.startTime}`}</span>
                            <span onClick={e=>{e.stopPropagation();removeSlot(day,slot._id)}} style={{ cursor:'pointer', opacity:0.6 }}>×</span>
                          </div>
                        )
                      })}
                      {slots.length>3 && <div style={{ margin:'1px 3px', fontSize:8, color:'var(--text3)' }}>+{slots.length-3} lagi</div>}
                    </div>
                  )
                })}
              </div>

              {/* Legend */}
              <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop:12, paddingTop:10, borderTop:'1px solid var(--border)' }}>
                {attTypes.map(t => (
                  <div key={t.key} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'var(--text2)' }}>
                    <div style={{ width:10, height:10, borderRadius:2, background:t.textColor }} />{t.label}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {/* Selected user detail */}
            <div className="card" style={{ padding:14 }}>
              <div style={{ fontSize:12, fontWeight:600, color:'var(--text)', marginBottom:10 }}>
                Detail — {TEAM.find(t=>t.id===selectedUserId)?.name} · {month}
              </div>
              {/* Type summary */}
              {attTypes.map(t => {
                const count = records.reduce((s,r) => s + (r.slots||[]).filter((sl:any)=>sl.type===t.key).length, 0)
                const fullDayCount = records.reduce((s,r) => s + (r.slots||[]).filter((sl:any)=>sl.type===t.key&&sl.isFullDay).length, 0)
                if (count===0) return null
                return (
                  <div key={t.key} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:7 }}>
                    <div style={{ width:8, height:8, borderRadius:2, background:t.textColor, flexShrink:0 }} />
                    <span style={{ flex:1, fontSize:12, color:'var(--text2)' }}>{t.label}</span>
                    <span style={{ fontSize:12, fontWeight:600, color:t.textColor }}>{count}x</span>
                    <span style={{ fontSize:10, color:'var(--text3)' }}>{fullDayCount} full day</span>
                  </div>
                )
              })}
            </div>

            {/* Team summary */}
            <div className="card" style={{ padding:14 }}>
              <div style={{ fontSize:12, fontWeight:600, color:'var(--text)', marginBottom:10 }}>Rekap Tim</div>
              {TEAM.map(m => {
                const ms = summary?.summary?.find((s:any) => s.name===m.name)
                const wfo = ms?.counts?.wfo || 0
                const pct = Math.round((wfo/22)*100)
                return (
                  <div key={m.id} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                    <div style={{ width:26, height:26, borderRadius:'50%', background:m.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'#fff', flexShrink:0 }}>
                      {m.name.split(' ').map((x:string)=>x[0]).join('')}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:500, color:'var(--text)' }}>{m.name}</div>
                      <div style={{ height:4, background:'var(--bg4)', borderRadius:2, marginTop:3, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${pct}%`, background:m.color, borderRadius:2 }} />
                      </div>
                    </div>
                    <span style={{ fontSize:11, fontWeight:600, color:'var(--text3)' }}>{pct}%</span>
                  </div>
                )
              })}
            </div>

            {/* Today's slots for selected user */}
            {(() => {
              const todayRec = getRecord(parseInt(today.split('-')[2]))
              const todaySlots = todayRec?.slots || []
              return todaySlots.length > 0 ? (
                <div className="card" style={{ padding:14 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:'var(--text)', marginBottom:8 }}>Hari Ini</div>
                  {todaySlots.map((slot:any, i:number) => {
                    const t = attTypes.find(x=>x.key===slot.type)
                    return (
                      <div key={i} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6, padding:'6px 10px', background:t?t.color:'var(--bg3)', borderRadius:6 }}>
                        <div style={{ fontSize:11, fontWeight:600, color:t?t.textColor:'var(--text2)', flex:1 }}>{t?.label||slot.type}</div>
                        <div style={{ fontSize:10, color:t?t.textColor+'aa':'var(--text3)' }}>
                          {slot.isFullDay ? 'Full Day' : `${slot.startTime}–${slot.endTime}`}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : null
            })()}
          </div>
        </div>
      </div>
    </div>
  )
}
const lbl: React.CSSProperties = { display:'block', fontSize:11, fontWeight:500, color:'var(--text2)', marginBottom:5 }
