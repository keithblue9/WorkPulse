'use client'
import { getConfig } from '@/lib/configCache'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { AppConfig, AttendanceType } from '@/types'
import toast from 'react-hot-toast'
import { format, getDaysInMonth, getDay, startOfMonth } from 'date-fns'

// External/guest collaborators are not internal staff → excluded from presensi & biodata
const NON_STAFF_ROLES = ['external', 'guest']
function isInternalMember(u:any): boolean {
  const roles = (u?.roles && u.roles.length) ? u.roles : (u?.role ? [u.role] : [])
  return !roles.some((r:string) => NON_STAFF_ROLES.includes(String(r).toLowerCase()))
}

// Robust slot helpers — handle legacy slots (missing isFullDay / 'fullday' sentinel / missing times)
function slotIsFullDay(slot:any): boolean {
  const st = slot?.startTime, et = slot?.endTime
  // Times are the source of truth: missing or 'fullday' sentinel = full day,
  // regardless of the isFullDay flag (which may be a stale/incorrect false on
  // legacy slots that have no real times).
  if (!st || !et || st === 'fullday' || et === 'fullday') return true
  if (slot?.isFullDay === true) return true
  return false
}
function slotTimeLabel(slot:any): string {
  if (slotIsFullDay(slot)) return 'Full Day'
  return `${slot.startTime}–${slot.endTime}`
}

const TEAM_COLORS = ['#2563d4','#7c3aed','#0d9488','#d97706','#16a34a','#dc2626','#0891b2','#7c2d12']

function SlotForm({ date, editing, attTypes, team, selfId, onClose, onSave }: { date:string; editing?:any; attTypes:AttendanceType[]; team?:any[]; selfId?:string; onClose:()=>void; onSave:(slot:any, taggedIds:string[])=>void }) {
  const isEdit = !!editing
  // Initialize from editing slot if provided; helpers handle legacy time shape
  const editIsFullDay = editing ? (
    !editing.startTime || !editing.endTime || editing.startTime === 'fullday' || editing.endTime === 'fullday' || editing.isFullDay === true
  ) : true
  const [type, setType] = useState(editing?.type || attTypes[0]?.key || 'wfo')
  const [isFullDay, setIsFullDay] = useState(editIsFullDay)
  const [startTime, setStartTime] = useState(editing?.startTime && editing.startTime !== 'fullday' ? editing.startTime : '08:00')
  const [endTime, setEndTime] = useState(editing?.endTime && editing.endTime !== 'fullday' ? editing.endTime : '17:00')
  const [note, setNote] = useState(editing?.note || '')
  const [tagged, setTagged] = useState<string[]>([])
  const typeDef = attTypes.find(t => t.key === type)
  const isHoliday = /libur|holiday/i.test(String(type)) || /libur/i.test(String(typeDef?.label))
  const others = (team || []).filter(m => m.id !== selfId)

  function save() {
    onSave({ type, label: typeDef?.label, isFullDay, startTime: isFullDay ? 'fullday' : startTime, endTime: isFullDay ? 'fullday' : endTime, note }, tagged)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ width:400 }}>
        <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between' }}>
          <span style={{ fontSize:13, fontWeight:600 }}>{isEdit?'Edit':'+ Tambah'} Kehadiran — {date}</span>
          <button onClick={onClose} className="btn btn-icon">×</button>
        </div>
        <div style={{ padding:'14px 18px', display:'flex', flexDirection:'column', gap:12 }}>
          <div><label style={lbl}>Tipe Kehadiran</label>
            <div className="chip-row" style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
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

          {/* Tag member lain — hanya saat tambah baru, & bukan hari libur (libur otomatis ke semua) */}
          {!isEdit && !isHoliday && others.length > 0 && (
            <div>
              <label style={lbl}>Tag member lain (opsional) — agenda bareng, isi sekali untuk semua</label>
              <div className="chip-row" style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {others.map(m => {
                  const on = tagged.includes(m.id)
                  return (
                    <button key={m.id} onClick={()=>setTagged(prev => on ? prev.filter(x=>x!==m.id) : [...prev, m.id])}
                      style={{ padding:'5px 11px', borderRadius:20, fontSize:11, fontWeight:600, cursor:'pointer', border:`1px solid ${on?m.color:'var(--border)'}`, background:on?m.color+'22':'var(--bg3)', color:on?m.color:'var(--text2)' }}>
                      {on?'✓ ':''}{m.name}
                    </button>
                  )
                })}
              </div>
              {tagged.length>0 && <div style={{ fontSize:10.5, color:'var(--text3)', marginTop:5 }}>Kehadiran ini akan ditambahkan juga ke {tagged.length} member lain.</div>}
            </div>
          )}
          {isHoliday && !isEdit && (
            <div style={{ fontSize:10.5, color:'#b45309', background:'#fff3e0', border:'1px solid #f0c07a', borderRadius:7, padding:'7px 10px' }}>Hari Libur otomatis diterapkan ke <b>semua member</b> & muncul di Calendar.</div>
          )}

          {typeDef && (
            <div style={{ padding:'8px 12px', background:typeDef.color, borderRadius:7, fontSize:12, fontWeight:600, color:typeDef.textColor }}>
              Preview: {typeDef.label} {isFullDay ? '(Full Day)' : `${startTime}–${endTime}`}
            </div>
          )}
        </div>
        <div style={{ padding:'12px 18px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'flex-end', gap:8 }}>
          <button onClick={onClose} className="btn">Batal</button>
          <button onClick={save} className="btn btn-primary">{isEdit?'Simpan':'Tambah'}</button>
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
  const [selectedUserId, setSelectedUserId] = useState('')
  const [team, setTeam] = useState<any[]>([])
  const [showSlotForm, setShowSlotForm] = useState<string|null>(null)
  const [editingSlot, setEditingSlot] = useState<{date:string; slot:any}|null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'calendar'|'cuti'>('calendar')
  const [leave, setLeave] = useState<any[]|null>(null)
  const year = month.slice(0,4)

  useEffect(() => {
    if (view !== 'cuti') return
    setLeave(null)
    fetch(`/api/attendance/leave-summary?year=${year}`).then(r=>r.json()).then(d=>setLeave(d.data||[])).catch(()=>setLeave([]))
  }, [view, year])

  useEffect(() => {
    async function load() {
      const [cfg, usr, sum] = await Promise.all([
        getConfig().then((data:any)=>({ data })),
        fetch('/api/users').then(r=>r.json()),
        fetch(`/api/attendance/summary?month=${month}`).then(r=>r.json()),
      ])
      const activeMembers = (usr.data||[]).filter((u:any)=>u.active!==false && isInternalMember(u)).map((u:any, idx:number)=>({ id:u._id, name:u.name, division:u.division||u.role, color: TEAM_COLORS[idx % TEAM_COLORS.length] }))
      setTeam(activeMembers)
      let uid = selectedUserId
      if (!uid && activeMembers.length) { uid = activeMembers[0].id; setSelectedUserId(uid) }
      const att = await fetch(`/api/attendance?userId=${uid}&month=${month}`).then(r=>r.json()).catch(()=>({data:[]}))
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

  // Tipe "Hari Libur" (custom, ditandai admin) — dikenali dari key/label mengandung 'libur'/'holiday'
  const holidayType = attTypes.find(t => /libur|holiday/i.test(String(t.key)) || /libur/i.test(String(t.label)))
  const holidayKey = holidayType?.key

  async function reloadRecords() {
    const att = await fetch(`/api/attendance?userId=${selectedUserId}&month=${month}`).then(r=>r.json()).catch(()=>({data:[]}))
    setRecords(att.data||[])
    const sum = await fetch(`/api/attendance/summary?month=${month}`).then(r=>r.json()).catch(()=>({data:null}))
    setSummary(sum.data)
  }

  async function addSlot(day: number, slot: any, taggedIds: string[] = []) {
    const dateStr = `${month}-${String(day).padStart(2,'0')}`
    if (holidayKey && slot.type === holidayKey) {
      const userIds = team.map(m => m.id)
      const r = await fetch('/api/attendance/holiday', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ date:dateStr, slot, userIds }) })
      const d = await r.json()
      if (!r.ok) { toast.error(d.error||'Gagal'); return }
      await reloadRecords()
      toast.success(`Hari Libur ${dateStr} diterapkan ke semua member (${d.applied})`)
      return
    }
    const r = await fetch('/api/attendance', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ userId:selectedUserId, date:dateStr, slot }) })
    const d = await r.json()
    setRecords(prev => { const filtered=prev.filter(r=>r.date!==dateStr); return [...filtered, d.data] })
    if (taggedIds.length) {
      await Promise.all(taggedIds.map(uid => fetch('/api/attendance', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ userId:uid, date:dateStr, slot }) })))
      toast.success(`Ditambahkan ke kamu + ${taggedIds.length} member lain: ${slot.label||slot.type}`)
    } else {
      toast.success(`Ditambahkan: ${slot.label||slot.type} ${slotIsFullDay(slot) ? '(Full Day)' : `${slot.startTime}–${slot.endTime}`}`)
    }
  }

  async function removeSlot(day: number, slotId: string) {
    const dateStr = `${month}-${String(day).padStart(2,'0')}`
    const rec = records.find(r => r.date===dateStr)
    const slot = rec?.slots?.find((s:any)=>s._id===slotId)
    if (holidayKey && slot?.type === holidayKey) {
      await fetch(`/api/attendance/holiday?date=${dateStr}&type=${holidayKey}`, { method:'DELETE' })
      await reloadRecords()
      toast.success('Hari Libur dihapus dari semua member')
      return
    }
    await fetch(`/api/attendance?userId=${selectedUserId}&date=${dateStr}&slotId=${slotId}`, { method:'DELETE' })
    setRecords(prev => prev.map(r => r.date===dateStr ? {...r, slots:r.slots.filter((s:any)=>s._id!==slotId)} : r))
    toast.success('Slot dihapus')
  }

  async function updateSlot(day:number, slotId:string, newSlot:any) {
    const dateStr = `${month}-${String(day).padStart(2,'0')}`
    // Delete old slot then add the new one (atomic enough for our purposes)
    await fetch(`/api/attendance?userId=${selectedUserId}&date=${dateStr}&slotId=${slotId}`, { method:'DELETE' })
    const r = await fetch('/api/attendance', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ userId:selectedUserId, date:dateStr, slot:newSlot }) })
    const d = await r.json()
    setRecords(prev => { const filtered=prev.filter(r=>r.date!==dateStr); return [...filtered, d.data] })
    toast.success('Slot diperbarui')
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
      {showSlotForm && <SlotForm date={showSlotForm} attTypes={attTypes} team={team} selfId={selectedUserId} onClose={()=>setShowSlotForm(null)} onSave={(slot, tagged) => { const day=parseInt(showSlotForm.split('-')[2]); addSlot(day,slot,tagged); setShowSlotForm(null) }} />}
      {editingSlot && <SlotForm date={editingSlot.date} editing={editingSlot.slot} attTypes={attTypes} onClose={()=>setEditingSlot(null)} onSave={async (slot)=>{ const day=parseInt(editingSlot.date.split('-')[2]); await updateSlot(day, editingSlot.slot._id, slot); setEditingSlot(null) }} />}

      <div style={{ padding:'12px 20px', borderBottom:'1px solid var(--border)', background:'var(--bg2)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0, gap:12, flexWrap:'wrap' }}>
        <div style={{ display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
          <div><div style={{ fontSize:14, fontWeight:600 }}>Absensi Harian</div><div style={{ fontSize:11, color:'var(--text3)' }}>{view==='calendar'?'Klik tanggal untuk tambah slot kehadiran':'Rekap cuti seluruh member dalam setahun'}</div></div>
          <div style={{ display:'flex', gap:4, background:'var(--bg3)', borderRadius:8, padding:3 }}>
            <button onClick={()=>setView('calendar')} className="btn btn-sm" style={{ background:view==='calendar'?'var(--brand)':'transparent', color:view==='calendar'?'#fff':'var(--text2)', border:'none' }}>📅 Kalender</button>
            <button onClick={()=>setView('cuti')} className="btn btn-sm" style={{ background:view==='cuti'?'var(--brand)':'transparent', color:view==='cuti'?'#fff':'var(--text2)', border:'none' }}>🌴 Summary Cuti</button>
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={()=>setMonth(prevM)} className="btn btn-sm">◀</button>
          <span style={{ padding:'5px 14px', background:'var(--bg3)', borderRadius:6, fontSize:13, fontWeight:600, color:'var(--text)' }}>{view==='cuti'?year:month}</span>
          <button onClick={()=>setMonth(nextM)} className="btn btn-sm">▶</button>
        </div>
      </div>

      <div style={{ flex:1, overflow:'auto', padding:'16px 20px' }}>
        {view === 'cuti' ? (
          <CutiSummary team={team} leave={leave} year={year} attTypes={attTypes} />
        ) : (
        <div className="dash-2col" style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:16 }}>
          {/* Calendar */}
          <div>
            {/* User selector — horizontal scroll on mobile */}
            <div className="chip-row" style={{ display:'flex', gap:6, marginBottom:12, flexWrap:'wrap' }}>
              {team.map(m => (
                <button key={m.id} onClick={()=>setSelectedUserId(m.id)} style={{ padding:'6px 14px', borderRadius:20, fontSize:12, fontWeight:500, cursor:'pointer', whiteSpace:'nowrap', border:`1px solid ${selectedUserId===m.id?m.color:'var(--border)'}`, background:selectedUserId===m.id?m.color+'33':'var(--bg3)', color:selectedUserId===m.id?m.color:'var(--text2)' }}>
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
                      title={slots.length>0 ? slots.map((s:any)=>`${s.label||s.type} ${slotTimeLabel(s)}`).join('\n') : 'Klik untuk tambah kehadiran'}
                      style={{ minHeight:52, borderRadius:7, cursor:isWeekend?'default':'pointer', border:`${isToday?'2px':'1px'} solid ${isToday?'var(--blue)':primaryType?primaryType.textColor+'44':'var(--border)'}`, background:primaryType?primaryType.color:isWeekend?'var(--bg3)':'var(--bg4)', opacity:isWeekend&&!primaryType?0.4:1, transition:'all 0.1s', position:'relative', overflow:'hidden' }}
                      onMouseEnter={e=>!isWeekend&&((e.currentTarget as HTMLElement).style.transform='scale(1.04)')}
                      onMouseLeave={e=>((e.currentTarget as HTMLElement).style.transform='scale(1)')}>
                      <div style={{ padding:'4px 5px 2px', fontSize:11, fontWeight:isToday?700:400, color:primaryType?primaryType.textColor:'var(--text2)' }}>{day}</div>
                      {slots.slice(0,3).map((slot:any, si:number) => {
                        const t = attTypes.find(x=>x.key===slot.type)
                        return (
                          <div key={si} style={{ margin:'1px 3px', padding:'1px 4px', borderRadius:3, fontSize:9, fontWeight:600, background:t?t.textColor+'33':'var(--bg5)', color:t?t.textColor:'var(--text3)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', display:'flex', justifyContent:'space-between', alignItems:'center', gap:2 }}>
                            <span title="Klik untuk edit" onClick={e=>{e.stopPropagation();setEditingSlot({date:dateStr, slot})}} style={{ cursor:'pointer', flex:1, overflow:'hidden', textOverflow:'ellipsis' }}>{t?.label||slot.type}{!slotIsFullDay(slot)?` ${slot.startTime}`:''}</span>
                            <span title="Hapus" onClick={e=>{e.stopPropagation();removeSlot(day,slot._id)}} style={{ cursor:'pointer', opacity:0.6 }}>×</span>
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
                Detail — {team.find(t=>t.id===selectedUserId)?.name} · {month}
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
                          {slotTimeLabel(slot)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : null
            })()}
          </div>
        </div>
        )}
      </div>
    </div>
  )
}
const lbl: React.CSSProperties = { display:'block', fontSize:11, fontWeight:500, color:'var(--text2)', marginBottom:5 }

function CutiSummary({ team, leave, year, attTypes }: { team:any[]; leave:any[]|null; year:string; attTypes:AttendanceType[] }) {
  const cutiDef = attTypes.find(t => t.key === 'cuti')
  if (leave === null) return <div style={{ fontSize:12.5, color:'var(--text3)', padding:20 }}>Memuat rekap cuti…</div>

  const byUser: Record<string, any> = {}
  for (const l of leave) byUser[l.userId] = l
  const rows = team.map(m => ({ member:m, entry: byUser[m.id] || { dates:[], total:0 } }))
    .sort((a,b) => b.entry.total - a.entry.total)
  const grandTotal = rows.reduce((s,r)=>s+r.entry.total, 0)

  const fmtDate = (d:string) => { const [ , mo, da] = d.split('-'); const MON=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']; return `${parseInt(da)} ${MON[parseInt(mo)-1]}` }
  // kelompokkan tanggal per bulan
  const groupByMonth = (dates:any[]) => {
    const g: Record<string, any[]> = {}
    for (const d of dates) { const mo = d.date.slice(0,7); (g[mo]=g[mo]||[]).push(d) }
    return Object.entries(g).sort((a,b)=>a[0].localeCompare(b[0]))
  }
  const MON=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']

  return (
    <div style={{ maxWidth:900 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12, flexWrap:'wrap', gap:8 }}>
        <div style={{ fontSize:15, fontWeight:700 }}>🌴 Rekap Cuti {year}</div>
        <div style={{ fontSize:12, color:'var(--text3)' }}>Total cuti tim tahun ini: <b style={{ color:'var(--text)' }}>{grandTotal} hari</b></div>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {rows.map(({ member, entry }) => (
          <div key={member.id} className="card" style={{ padding:0, overflow:'hidden' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'11px 14px', borderBottom: entry.total>0?'1px solid var(--border)':'none' }}>
              <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                <span style={{ width:9, height:9, borderRadius:'50%', background:member.color, display:'inline-block' }} />
                <span style={{ fontSize:13, fontWeight:600 }}>{member.name}</span>
                <span style={{ fontSize:10.5, color:'var(--text3)' }}>{member.division}</span>
              </div>
              <span style={{ fontSize:12, fontWeight:700, padding:'3px 10px', borderRadius:20, background: entry.total>0?(cutiDef?.color||'var(--greenbg)'):'var(--bg3)', color: entry.total>0?(cutiDef?.textColor||'var(--green)'):'var(--text3)' }}>
                {entry.total>0 ? `${entry.total} hari cuti` : 'Belum ada cuti'}
              </span>
            </div>
            {entry.total>0 && (
              <div style={{ padding:'10px 14px', display:'flex', flexDirection:'column', gap:7 }}>
                {groupByMonth(entry.dates).map(([mo, list]:any) => (
                  <div key={mo} style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
                    <div style={{ fontSize:11, fontWeight:600, color:'var(--text3)', minWidth:74 }}>{MON[parseInt(mo.slice(5,7))-1]} <span style={{ color:'var(--text3)' }}>({list.length})</span></div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                      {list.map((d:any,i:number)=>(
                        <span key={i} title={d.note||''} style={{ fontSize:11, padding:'2px 8px', borderRadius:6, background:'var(--bg3)', color:'var(--text2)', border:'1px solid var(--border)' }}>
                          {fmtDate(d.date)}{!d.fullDay && ' ½'}{d.note?` · ${d.note}`:''}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {rows.length===0 && <div style={{ fontSize:12, color:'var(--text3)', padding:20, textAlign:'center' }} className="card">Belum ada data member.</div>}
      </div>
    </div>
  )
}
