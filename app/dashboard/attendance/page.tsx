'use client'
import { getConfig } from '@/lib/configCache'
import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { AppConfig, AttendanceType } from '@/types'
import toast from 'react-hot-toast'
import { format, getDaysInMonth, getDay, startOfMonth } from 'date-fns'
import { Empty, Icon, PageHeader, Seg, Sheet } from '@/components/ui'
import { useYear } from '@/lib/year'

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

const TEAM_COLORS = ['#4B3BFF','#7B6BFF','#0FA898','#F2A33A','#16a34a','#FF5D3B','#0891b2','#8C89A6']
// Warna tipe presensi dari Configuration (dibuat untuk tema gelap) → latar lembut yang aman di terang & gelap.
const tint = (c?:string, pct=16) => c ? `color-mix(in srgb, ${c} ${pct}%, var(--surface))` : 'var(--sunken)'
const BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']

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
    <Sheet open title={`${isEdit ? 'Edit' : 'Tambah'} kehadiran`} onClose={onClose} onSave={save} saveLabel={isEdit ? 'Simpan' : 'Tambah'}>
      <p className="au-small au-ink2" style={{ marginTop:-6, textAlign:'center' }}>{new Date(date+'T00:00:00').toLocaleDateString('id-ID',{ weekday:'long', day:'numeric', month:'long', year:'numeric' })}</p>
      <div className="au-col" style={{ gap:8 }}><span className="lbl">Tipe kehadiran</span>
        <div className="au-row au-wrap" style={{ gap:6 }}>
          {attTypes.map(t => (
            <button key={t.key} type="button" onClick={()=>setType(t.key)} className="au-chip" aria-pressed={type===t.key}
              style={type===t.key ? { background:t.textColor, borderColor:t.textColor, color:'#fff' } : { background:tint(t.textColor, 10) }}>{t.label}</button>
          ))}
        </div></div>
      <label className="au-igr" style={{ border:'1px solid var(--line)', borderRadius:16 }}><span className="k">Seharian (full day)</span><input type="checkbox" className="au-sw" style={{ marginLeft:'auto' }} checked={isFullDay} onChange={()=>setIsFullDay(!isFullDay)} /></label>
      {!isFullDay && (
        <div className="au-grid" style={{ gridTemplateColumns:'repeat(2,minmax(0,1fr))', gap:10 }}>
          <label className="au-col" style={{ gap:6 }}><span className="lbl">Mulai</span><input type="time" className="input" value={startTime} onChange={e=>setStartTime(e.target.value)} /></label>
          <label className="au-col" style={{ gap:6 }}><span className="lbl">Selesai</span><input type="time" className="input" value={endTime} onChange={e=>setEndTime(e.target.value)} /></label>
        </div>
      )}
      <label className="au-col" style={{ gap:6 }}><span className="lbl">Catatan (opsional)</span><input className="input" value={note} onChange={e=>setNote(e.target.value)} placeholder="Mis. WFO pagi, dinas sore" /></label>
      {!isEdit && !isHoliday && others.length > 0 && (
        <div className="au-col" style={{ gap:8 }}><span className="lbl">Tag member lain (opsional)</span>
          <div className="au-row au-wrap" style={{ gap:6 }}>
            {others.map(m => { const on = tagged.includes(m.id); return (
              <button key={m.id} type="button" className="au-chip" aria-pressed={on} onClick={()=>setTagged(prev => on ? prev.filter(x=>x!==m.id) : [...prev, m.id])}>{m.name}</button>
            ) })}
          </div>
          {tagged.length>0 && <span className="au-xs au-muted">Kehadiran ini ditambahkan juga ke {tagged.length} member lain.</span>}
        </div>
      )}
      {isHoliday && !isEdit && <div className="p-warn" style={{ borderRadius:12, padding:'10px 12px', fontSize:13 }}>Hari libur otomatis diterapkan ke <b>semua member</b> dan tampil di Calendar.</div>}
      {typeDef && <div style={{ padding:'10px 14px', background:tint(typeDef.textColor, 18), borderRadius:14, fontWeight:600, color:'var(--ink)', display:'flex', alignItems:'center', gap:8 }}><i style={{ width:10, height:10, borderRadius:3, background:typeDef.textColor, display:'inline-block' }} />{typeDef.label} · {isFullDay ? 'Seharian' : `${startTime}–${endTime}`}</div>}
    </Sheet>
  )
}

export default function AttendancePage() {
  const { data:session } = useSession(); const user = session?.user as any
  const [month, setMonth] = useState(() => format(new Date(), 'yyyy-MM'))
  const { year: gYear, setYear: setGYear } = useYear()
  // Tahun global ↔ bulan yang ditampilkan.
  useEffect(() => { setMonth(m => (Number(m.slice(0,4)) === gYear ? m : `${gYear}-${m.slice(5,7)}`)) }, [gYear])
  const goMonth = (m:string) => { setMonth(m); const y = Number(m.slice(0,4)); if (y !== gYear) setGYear(y) }
  const [records, setRecords] = useState<any[]>([])
  const [config, setConfig] = useState<AppConfig|null>(null)
  const [summary, setSummary] = useState<any>(null)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [team, setTeam] = useState<any[]>([])
  const [showSlotForm, setShowSlotForm] = useState<string|null>(null)
  const [editingSlot, setEditingSlot] = useState<{date:string; slot:any}|null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'calendar'|'cuti'|'team'>('calendar')
  const [leave, setLeave] = useState<any[]|null>(null)
  // View "Tim per Hari": lihat siapa saja WFO/WFH/Dinas/dll pada tanggal tertentu
  const [teamDate, setTeamDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [teamDocs, setTeamDocs] = useState<any[]|null>(null)
  const year = month.slice(0,4)

  useEffect(() => {
    if (view !== 'team') return
    let cancelled = false
    setTeamDocs(null)
    fetch(`/api/attendance/overview?from=${teamDate}&to=${teamDate}`)
      .then(r=>r.json())
      .then(d=>{ if(!cancelled) setTeamDocs(d.data||[]) })
      .catch(()=>{ if(!cancelled) setTeamDocs([]) })
    return ()=>{ cancelled = true }
  }, [view, teamDate])


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

  // Kelompokkan anggota tim per kategori kehadiran pada tanggal terpilih.
  // 1 orang bisa punya beberapa slot (mis. pagi WFO, siang Dinas) -> muncul di tiap kategori,
  // tapi tidak dobel dalam kategori yang sama.
  const teamByType = useMemo(() => {
    if (!teamDocs) return null
    const byUser = new Map<string, any[]>()
    for (const doc of teamDocs) {
      const list = byUser.get(String(doc.userId)) || []
      list.push(...(doc.slots||[]))
      byUser.set(String(doc.userId), list)
    }
    const groups = (attTypes||[]).map((t:any) => {
      const seen = new Set<string>()
      const people:any[] = []
      for (const m of team) {
        const slots = byUser.get(String(m.id)) || []
        const mine = slots.filter((s:any)=>s?.type===t.key)
        if (mine.length && !seen.has(m.id)) {
          seen.add(m.id)
          people.push({ ...m, slots: mine, fullDay: mine.some((s:any)=>slotIsFullDay(s)) })
        }
      }
      return { ...t, people }
    })
    const filledIds = new Set(Array.from(byUser.entries()).filter(([,s])=>s.length>0).map(([id])=>id))
    const belum = team.filter(m => !filledIds.has(String(m.id)))
    return { groups, belum }
  }, [teamDocs, team, attTypes])

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
    const d = await r.json().catch(()=>({}))
    if (!r.ok || !d.data) { toast.error(d.error || 'Gagal menyimpan presensi'); return }
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
    const r = await fetch(`/api/attendance?userId=${selectedUserId}&date=${dateStr}&slotId=${slotId}`, { method:'DELETE' })
    if (!r.ok) { toast.error('Gagal menghapus slot'); return }
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

  const selMember = team.find(t=>t.id===selectedUserId)
  const monthLabel = `${BULAN[Number(month.slice(5,7))-1]} ${month.slice(0,4)}`
  return (
    <div className="au-page">
      {showSlotForm && <SlotForm date={showSlotForm} attTypes={attTypes} team={team} selfId={selectedUserId} onClose={()=>setShowSlotForm(null)} onSave={(slot, tagged) => { const day=parseInt(showSlotForm.split('-')[2]); addSlot(day,slot,tagged); setShowSlotForm(null) }} />}
      {editingSlot && <SlotForm date={editingSlot.date} editing={editingSlot.slot} attTypes={attTypes} onClose={()=>setEditingSlot(null)} onSave={async (slot)=>{ const day=parseInt(editingSlot.date.split('-')[2]); await updateSlot(day, editingSlot.slot._id, slot); setEditingSlot(null) }} />}
      <div className="au-view au-anim">
        <PageHeader eyebrow={`Team · ${view==='calendar' ? 'ketuk tanggal untuk menambah kehadiran' : view==='team' ? 'siapa di mana per hari' : 'rekap cuti setahun'}`} title="Presensi" actions={<>
          <Seg label="Tampilan presensi" value={view} onChange={setView} options={[['calendar', <><Icon name="cal" size={15} />Kalender</>], ['team', <><Icon name="team" size={15} />Tim per hari</>], ['cuti', <><Icon name="sun" size={15} />Rekap cuti</>]] as const} />
          {view !== 'team' && <div className="au-row" style={{ gap:6 }}>
            <button type="button" onClick={()=>goMonth(view==='cuti' ? `${Number(year)-1}-${month.slice(5,7)}` : prevM)} className="btn btn-icon" aria-label={view==='cuti' ? 'Tahun sebelumnya' : 'Bulan sebelumnya'}><Icon name="left" size={18} /></button>
            <b style={{ minWidth:130, textAlign:'center', font:'700 16px var(--disp)' }} aria-live="polite">{view==='cuti' ? year : monthLabel}</b>
            <button type="button" onClick={()=>goMonth(view==='cuti' ? `${Number(year)+1}-${month.slice(5,7)}` : nextM)} className="btn btn-icon" aria-label={view==='cuti' ? 'Tahun berikutnya' : 'Bulan berikutnya'}><Icon name="right" size={18} /></button>
          </div>}
        </>} />

        {view === 'cuti' ? <CutiSummary team={team} leave={leave} year={year} attTypes={attTypes} />
        : view === 'team' ? <TeamDayView date={teamDate} setDate={setTeamDate} data={teamByType} total={team.length} />
        : (
        <div className="au-cal-wrap">
          <div className="au-col" style={{ gap:12, minWidth:0 }}>
            <div className="au-chips" role="group" aria-label="Pilih member">
              {team.map(m => <button key={m.id} type="button" className="au-chip" aria-pressed={selectedUserId===m.id} onClick={()=>setSelectedUserId(m.id)}>{m.name}</button>)}
            </div>
            <section className="au-card" style={{ padding:14, gap:8 }}>
              <div className="au-cal-head">{DAY_LABELS.map(d => <span key={d}>{d}</span>)}</div>
              {loading ? <div className="au-skel" style={{ height:300, borderRadius:16 }} /> : (
              <div className="au-cal-grid">
                {Array.from({length:firstDayDow}).map((_,i)=><div key={`e${i}`} />)}
                {Array.from({length:daysInMonth}).map((_,i) => {
                  const day = i+1
                  const dow = (firstDayDow+i)%7
                  const isWeekend = dow >= 5
                  const dateStr = `${month}-${String(day).padStart(2,'0')}`
                  const slots = getRecord(day)?.slots || []
                  const isToday = dateStr === today
                  const pt = slots[0] ? attTypes.find(t=>t.key===slots[0].type) : null
                  return (
                    <div key={day} role={isWeekend ? undefined : 'button'} tabIndex={isWeekend ? -1 : 0}
                      onClick={()=>!isWeekend&&setShowSlotForm(dateStr)} onKeyDown={e=>{ if (!isWeekend && (e.key==='Enter'||e.key===' ')) { e.preventDefault(); setShowSlotForm(dateStr) } }}
                      aria-label={`${day} ${monthLabel}${slots.length ? ': ' + slots.map((sl:any)=>`${sl.label||sl.type} ${slotTimeLabel(sl)}`).join(', ') : isWeekend ? ', akhir pekan' : ', tambah kehadiran'}`}
                      className={`au-cal-day au-att-day${isToday ? ' today' : ''}${isWeekend && !pt ? ' out' : ''}`}
                      style={pt ? { background:tint(pt.textColor, 18), borderColor:tint(pt.textColor, 45) } : isWeekend ? { cursor:'default' } : undefined}>
                      <span className="n">{day}</span>
                      {slots.slice(0,3).map((slot:any, si:number) => {
                        const t = attTypes.find(x=>x.key===slot.type)
                        return (
                          <span key={si} className="au-att-slot" style={{ ['--tc' as any]: t?.textColor || 'var(--muted)' }}>
                            <button type="button" onClick={e=>{e.stopPropagation();setEditingSlot({date:dateStr, slot})}} aria-label={`Edit ${t?.label||slot.type} ${day}`}>{t?.label||slot.type}{!slotIsFullDay(slot)?` ${slot.startTime}`:''}</button>
                            <button type="button" className="x" onClick={e=>{e.stopPropagation();removeSlot(day,slot._id)}} aria-label={`Hapus ${t?.label||slot.type} ${day}`}><Icon name="x" size={11} stroke={2.6} /></button>
                          </span>
                        )
                      })}
                      {slots.length>3 && <span className="more">+{slots.length-3} lagi</span>}
                    </div>
                  )
                })}
              </div>)}
              <div className="au-key" style={{ paddingTop:10, borderTop:'1px solid var(--line)' }}>{attTypes.map(t => <span key={t.key}><i style={{ background:t.textColor }} />{t.label}</span>)}</div>
            </section>
          </div>
          <div className="au-col" style={{ gap:12 }}>
            <section className="au-card">
              <div className="au-col" style={{ gap:2 }}><span className="lbl">{monthLabel}</span><h2>{selMember?.name || 'Member'}</h2></div>
              {(() => {
                const rows = attTypes.map(t => ({ t, count: records.reduce((acc,r) => acc + (r.slots||[]).filter((sl:any)=>sl.type===t.key).length, 0), full: records.reduce((acc,r) => acc + (r.slots||[]).filter((sl:any)=>sl.type===t.key&&slotIsFullDay(sl)).length, 0) })).filter(x => x.count)
                const tot = rows.reduce((a,x)=>a+x.count,0)
                return rows.length ? <>
                  <div className="au-stack" style={{ height:12 }}>{rows.map(x => <i key={x.t.key} style={{ flex:x.count, background:x.t.textColor }} />)}</div>
                  <div className="au-ig" style={{ border:0 }}>{rows.map(x => (
                    <div key={x.t.key} className="au-igr" style={{ padding:'10px 0' }}><i style={{ width:10, height:10, borderRadius:3, background:x.t.textColor, flexShrink:0 }} /><span className="k">{x.t.label}</span><span className="v">{x.count}× <span className="au-xs au-muted">{x.full} seharian</span></span></div>
                  ))}</div>
                  <span className="au-xs au-muted">{tot} slot bulan ini</span>
                </> : <span className="au-small au-muted">Belum ada kehadiran bulan ini.</span>
              })()}
            </section>
            {(() => {
              const todaySlots = month === today.slice(0,7) ? (getRecord(parseInt(today.split('-')[2]))?.slots || []) : []
              return todaySlots.length > 0 ? (
                <section className="au-card"><h2>Hari ini</h2>
                  {todaySlots.map((slot:any, i:number) => { const t = attTypes.find(x=>x.key===slot.type); return (
                    <div key={i} className="au-row au-between" style={{ padding:'10px 12px', background:tint(t?.textColor, 18), borderRadius:12 }}><b style={{ fontSize:14 }}>{t?.label||slot.type}</b><span className="au-small au-ink2">{slotTimeLabel(slot)}</span></div>
                  ) })}
                </section>
              ) : null
            })()}
          </div>
        </div>
        )}
      </div>
    </div>
  )
}

function CutiSummary({ team, leave, year, attTypes }: { team:any[]; leave:any[]|null; year:string; attTypes:AttendanceType[] }) {
  const cutiDef = attTypes.find(t => t.key === 'cuti')
  if (leave === null) return <div className="au-card"><div className="au-skel" /><div className="au-skel" style={{ width:'60%' }} /></div>

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

  const maxT = Math.max(1, ...rows.map(r=>r.entry.total))
  return (
    <div className="au-col" style={{ gap:12, maxWidth:960 }}>
      <div className="au-row au-between au-wrap"><h2 style={{ font:'700 20px var(--disp)' }}>Rekap cuti {year}</h2><span className="au-small au-ink2">Total cuti tim: <b style={{ color:'var(--ink)' }}>{grandTotal} hari</b></span></div>
      {rows.length === 0 ? <div className="au-card"><Empty title="Belum ada data member" /></div> : <div className="au-ig">
        {rows.map(({ member, entry }) => (
          <details key={member.id} className="au-cuti" open={entry.total > 0 && rows.length <= 4}>
            <summary className="au-igr">
              <span className="au-av s" style={{ background:member.color, color:'#fff' }}>{String(member.name||'?')[0]}</span>
              <span className="au-col" style={{ minWidth:0, flex:'0 1 220px' }}><b style={{ fontSize:14 }}>{member.name}</b><span className="au-xs au-muted">{member.division}</span></span>
              <span className="au-track" style={{ flex:1, height:8, minWidth:60 }}><i className="a" style={{ width:`${entry.total/maxT*100}%`, background: cutiDef?.textColor || 'var(--aqua)' }} /></span>
              <b style={{ minWidth:70, textAlign:'right' }}>{entry.total ? `${entry.total} hari` : <span className="au-muted" style={{ fontWeight:500 }}>–</span>}</b>
            </summary>
            {entry.total>0 && <div className="au-col" style={{ gap:8, padding:'4px 16px 14px 60px' }}>
              {groupByMonth(entry.dates).map(([mo, list]:any) => (
                <div key={mo} className="au-row" style={{ alignItems:'flex-start', gap:10 }}>
                  <span className="au-xs au-muted" style={{ minWidth:84, fontWeight:600, paddingTop:3 }}>{MON[parseInt(mo.slice(5,7))-1]} ({list.length})</span>
                  <span className="au-row au-wrap" style={{ gap:5 }}>{list.map((d:any,i:number)=><span key={i} className="au-tag" title={d.note||''}>{fmtDate(d.date)}{!d.fullDay && ' ½'}{d.note?` · ${d.note}`:''}</span>)}</span>
                </div>
              ))}
            </div>}
          </details>
        ))}
      </div>}
    </div>
  )
}

// ── View "Tim per Hari": siapa saja WFO / WFH / Dinas / Cuti / dll pada tanggal terpilih ──
function TeamDayView({ date, setDate, data, total }:{ date:string; setDate:(d:string)=>void; data:any; total:number }) {
  // Geser tanggal (bisa maju utk lihat rencana besok/lusa)
  const shift = (n:number) => {
    const [y,m,d] = date.split('-').map(Number)
    const dt = new Date(y, (m||1)-1, (d||1)+n)
    setDate(`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`)
  }
  const today = format(new Date(),'yyyy-MM-dd')
  const labelHari = (() => {
    const [y,m,d] = date.split('-').map(Number)
    const dt = new Date(y,(m||1)-1,d||1)
    return isNaN(dt.getTime()) ? date : dt.toLocaleDateString('id-ID',{ weekday:'long', day:'numeric', month:'long', year:'numeric' })
  })()

  return (
    <div className="au-col" style={{ gap:14, maxWidth:1100 }}>
      <section className="au-card" style={{ flexDirection:'row', alignItems:'center', flexWrap:'wrap', gap:10, padding:14 }}>
        <button type="button" onClick={()=>shift(-1)} className="btn btn-icon" aria-label="Hari sebelumnya"><Icon name="left" size={18} /></button>
        <input type="date" className="input" value={date} onChange={e=>e.target.value && setDate(e.target.value)} aria-label="Tanggal" style={{ width:170 }} />
        <button type="button" onClick={()=>shift(1)} className="btn btn-icon" aria-label="Hari berikutnya"><Icon name="right" size={18} /></button>
        <button type="button" onClick={()=>setDate(today)} className="btn" disabled={date===today}>Hari ini</button>
        <span className="au-col" style={{ marginLeft:'auto', alignItems:'flex-end' }}><b style={{ font:'700 16px var(--disp)' }}>{labelHari}</b>{date>today && <span className="au-xs" style={{ color:'var(--warn)' }}>Rencana ke depan</span>}</span>
      </section>
      {data === null ? <div className="au-grid" style={{ gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:12 }}>{[0,1,2].map(k=><div key={k} className="au-card"><div className="au-skel" style={{ width:'40%' }} /><div className="au-skel" /></div>)}</div> : <>
        <div className="au-grid" style={{ gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:12 }}>
          {data.groups.map((g:any) => (
            <section key={g.key} className="au-card" style={{ gap:10, opacity:g.people.length?1:.6 }}>
              <div className="au-row au-between"><span className="au-row" style={{ gap:8 }}><i style={{ width:10, height:10, borderRadius:3, background:g.textColor||'var(--accent)', display:'inline-block' }} /><b style={{ fontSize:15 }}>{g.label}</b></span><b style={{ font:'700 24px var(--disp)' }}>{g.people.length}</b></div>
              {g.people.length === 0 ? <span className="au-xs au-muted">Tidak ada</span> : <div className="au-col" style={{ gap:6 }}>
                {g.people.map((p:any) => (
                  <div key={p.id} className="au-row" style={{ gap:8 }}>
                    <span className="au-av s" style={{ background:p.color, color:'#fff' }}>{String(p.name||'?')[0]}</span>
                    <span style={{ flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:14 }}>{p.name}</span>
                    <span className="au-xs au-muted">{p.fullDay ? 'Seharian' : p.slots.map((sl:any)=>slotTimeLabel(sl)).join(', ')}</span>
                  </div>
                ))}
              </div>}
            </section>
          ))}
        </div>
        <section className="au-card" style={{ borderStyle:'dashed' }}>
          <div className="au-row au-between"><b>Belum isi presensi</b><span className="au-pill p-warn">{data.belum.length} dari {total}</span></div>
          {data.belum.length === 0 ? <span className="au-small" style={{ color:'var(--ok)', fontWeight:600 }}>Semua anggota sudah mengisi.</span>
            : <div className="au-row au-wrap" style={{ gap:6 }}>{data.belum.map((m:any) => <span key={m.id} className="au-tag">{m.name}</span>)}</div>}
        </section>
      </>}
    </div>
  )
}
