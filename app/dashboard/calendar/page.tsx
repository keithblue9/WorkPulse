'use client'
import { getConfig } from '@/lib/configCache'
import { picArray } from '@/lib/defaults'
import { useEffect, useState } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, isSameMonth } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { Empty, Icon, PageHeader, Pill, Sheet } from '@/components/ui'
import { useYear } from '@/lib/year'

const PRIORITY_CFG: Record<string,{label:string;tone:'bad'|'warn'|'ok'}> = {
  high:{label:'High', tone:'bad'}, medium:{label:'Medium', tone:'warn'}, low:{label:'Low', tone:'ok'},
}

function ActivityDetail({ activity, onClose, onSave }: { activity:any; onClose:()=>void; onSave:()=>void; members:any[]; config:any }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(activity)
  const [saving, setSaving] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const set = (k:string, v:any) => setForm((f:any)=>({...f,[k]:v}))

  async function save() {
    if (!String(form.title||'').trim()) { toast.error('Judul wajib diisi'); return }
    setSaving(true)
    try {
      const r = await fetch(`/api/projects/${activity._id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(form) })
      if (!r.ok) throw new Error()
      toast.success('Aktivitas diperbarui'); onSave(); onClose()
    } catch { toast.error('Gagal menyimpan') } finally { setSaving(false) }
  }
  async function del() {
    setSaving(true)
    try { const r = await fetch(`/api/projects/${activity._id}`, { method:'DELETE' }); if (!r.ok) throw new Error(); toast.success('Aktivitas dihapus'); onSave(); onClose() }
    catch { toast.error('Gagal menghapus') } finally { setSaving(false) }
  }
  const pics = picArray(activity.pic).length ? picArray(activity.pic) : picArray(activity.picName)
  return (
    <Sheet open title={editing ? 'Edit aktivitas' : 'Detail aktivitas'} onClose={onClose} onSave={editing ? save : undefined} saveDisabled={saving} saveLabel={saving ? 'Menyimpan…' : 'Simpan'}>
      {editing ? <>
        <label className="au-col" style={{ gap:6 }}><span className="lbl">Judul</span><input className="input" value={form.title} onChange={e=>set('title',e.target.value)} /></label>
        <label className="au-col" style={{ gap:6 }}><span className="lbl">Narasi / progress</span><textarea className="input" rows={4} value={form.description||''} onChange={e=>set('description',e.target.value)} /></label>
        <div className="au-grid" style={{ gridTemplateColumns:'repeat(2,minmax(0,1fr))', gap:10 }}>
          <label className="au-col" style={{ gap:6 }}><span className="lbl">Tanggal</span><input type="date" className="input" value={form.actionDate||''} onChange={e=>set('actionDate',e.target.value)} /></label>
          <label className="au-col" style={{ gap:6 }}><span className="lbl">Target week</span><input className="input" value={form.targetWeek||''} onChange={e=>set('targetWeek',e.target.value)} /></label>
        </div>
        <label className="au-col" style={{ gap:6 }}><span className="lbl">Next plan</span><textarea className="input" rows={3} value={form.nextPlan||''} onChange={e=>set('nextPlan',e.target.value)} /></label>
        <button type="button" className="btn" style={{ alignSelf:'flex-start' }} onClick={()=>{ setEditing(false); setForm(activity) }}>Batalkan perubahan</button>
      </> : <>
        <h3 style={{ font:'700 21px/1.25 var(--disp)' }}>{activity.title}</h3>
        <div className="au-row au-wrap" style={{ gap:6 }}>
          <span className="au-tag">{activity.category}</span>{activity.subType && <span className="au-tag">{activity.subType}</span>}
          {activity.priority && PRIORITY_CFG[activity.priority] && <Pill tone={PRIORITY_CFG[activity.priority].tone}>{PRIORITY_CFG[activity.priority].label}</Pill>}
        </div>
        <div className="au-ig">
          <div className="au-igr"><span className="k">Tanggal</span><span className="v">{activity.actionDate || '–'}{activity.actionDateEnd && activity.actionDateEnd!==activity.actionDate ? ` – ${activity.actionDateEnd}` : ''}</span></div>
          {activity.startTime && <div className="au-igr"><span className="k">Waktu</span><span className="v">{activity.startTime}{activity.endTime ? ` – ${activity.endTime}` : ''}</span></div>}
          <div className="au-igr"><span className="k">Target week</span><span className="v">{activity.targetWeek || '–'}</span></div>
          <div className="au-igr"><span className="k">PIC</span><span className="v">{pics.join(', ') || '–'}</span></div>
          {activity.mode === 'offline' && activity.location && <div className="au-igr"><span className="k">Lokasi</span><span className="v">{activity.location}</span></div>}
        </div>
        {activity.description && <div className="au-col" style={{ gap:6 }}><span className="lbl">Narasi / progress</span><p className="au-small au-ink2" style={{ whiteSpace:'pre-wrap', lineHeight:1.6 }}>{activity.description}</p></div>}
        {activity.nextPlan && <div className="au-col" style={{ gap:6 }}><span className="lbl">Next plan</span><p className="au-small au-ink2" style={{ whiteSpace:'pre-wrap', lineHeight:1.6 }}>{activity.nextPlan}</p></div>}
        <div className="au-row au-wrap" style={{ gap:8 }}>
          <button type="button" className="btn btn-primary" onClick={()=>setEditing(true)}><Icon name="pnote" size={15} />Edit</button>
          {confirmDel ? <span className="au-row p-bad" style={{ borderRadius:12, padding:'6px 8px', gap:6 }}><span className="au-small">Hapus aktivitas?</span><button type="button" className="btn btn-sm" onClick={()=>setConfirmDel(false)}>Batal</button><button type="button" className="btn btn-danger btn-sm" disabled={saving} onClick={del}>Ya, hapus</button></span>
            : <button type="button" className="btn btn-danger" onClick={()=>setConfirmDel(true)}><Icon name="trash" size={15} />Hapus</button>}
        </div>
      </>}
    </Sheet>
  )
}

export default function CalendarPage() {
  const { year } = useYear()
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
      fetch('/api/projects').then(r=>r.ok ? r.json() : { data: [] }).catch(()=>({ data: [] })),
      fetch('/api/users').then(r=>r.ok ? r.json() : { data: [] }).catch(()=>({ data: [] })),
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
  // Tahun global: pindah ke bulan yang sama di tahun terpilih.
  useEffect(() => { setCurrentMonth(m => (m.getFullYear() === year ? m : new Date(year, m.getMonth(), 1))) }, [year])
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

  // Aktivitas yang sudah Delayed / Completed tidak perlu tampil di kalender
  // (kalender fokus ke agenda yang masih berjalan).
  const HIDDEN_STATUS = ['delayed','completed','done','finished','closed','selesai']
  const isHiddenStatus = (a:any) => HIDDEN_STATUS.includes(String(a?.status||'').toLowerCase())

  function activitiesOn(d:Date) {
    const ds = format(d,'yyyy-MM-dd')
    return activities.filter(a => {
      if (!a.actionDate) return false
      if (isHiddenStatus(a)) return false
      const start = a.actionDate
      const end = a.actionDateEnd || a.actionDate   // single-day if no end
      return ds >= start && ds <= end               // string compare works for yyyy-MM-dd
    })
  }
  const selectedDayActivities = activitiesOn(selectedDay)

  const cats = config?.activityCategories || []
  function catColor(key:string) { return cats.find((c:any)=>c.key===key)?.color || '#4f8ef7' }

  const holidayOf = (d:Date) => holidays.has(format(d,'yyyy-MM-dd'))
  return (
    <div className="au-page">
      {selected && <ActivityDetail activity={selected} onClose={()=>setSelected(null)} onSave={load} members={members} config={config} />}
      <div className="au-view au-anim">
        <PageHeader eyebrow="Team · sumber: Activities" title="Calendar" actions={<>
          <div className="au-row" style={{ gap:6 }}>
            <button type="button" onClick={()=>setCurrentMonth(subMonths(currentMonth,1))} className="btn btn-icon" aria-label="Bulan sebelumnya"><Icon name="left" size={18} /></button>
            <b style={{ minWidth:150, textAlign:'center', font:'700 17px var(--disp)' }} aria-live="polite">{format(currentMonth,'MMMM yyyy', { locale:idLocale })}</b>
            <button type="button" onClick={()=>setCurrentMonth(addMonths(currentMonth,1))} className="btn btn-icon" aria-label="Bulan berikutnya"><Icon name="right" size={18} /></button>
          </div>
          <button type="button" onClick={()=>{setCurrentMonth(new Date()); setSelectedDay(new Date())}} className="btn">Hari ini</button>
          <a href="/dashboard/activities" className="btn btn-primary"><Icon name="plus" size={16} stroke={2.2} />Aktivitas</a>
        </>} />
        <div className="au-cal-wrap">
          <section className="au-card rise" style={{ padding:14, gap:8 }}>
            <div className="au-cal-head">{['Sen','Sel','Rab','Kam','Jum','Sab','Min'].map(d => <span key={d}>{d}</span>)}</div>
            <div className="au-cal-grid" role="group" aria-label="Kalender bulan">
              {days.map(day => {
                const dayActivities = activitiesOn(day)
                const isCurrentMonth = isSameMonth(day, currentMonth)
                const isToday = isSameDay(day, new Date())
                const isSel = isSameDay(day, selectedDay)
                const hol = holidayOf(day)
                const cap = hol ? 1 : 2
                return (
                  <button type="button" key={day.toISOString()} onClick={()=>setSelectedDay(day)} className={`au-cal-day${isSel ? ' sel' : ''}${isToday ? ' today' : ''}${hol ? ' hol' : ''}${isCurrentMonth ? '' : ' out'}`} aria-pressed={isSel} aria-label={`${format(day,'d MMMM yyyy', { locale:idLocale })}${hol ? ', hari libur' : ''}, ${dayActivities.length} aktivitas`}>
                    <span className="n">{format(day,'d')}</span>
                    {hol && <span className="ev hol">Hari libur</span>}
                    {dayActivities.slice(0, cap).map(a => <span key={a._id} className="ev"><i style={{ background:catColor(a.category) }} />{a.title}</span>)}
                    {dayActivities.length > cap && <span className="more">+{dayActivities.length-cap} lagi</span>}
                    {dayActivities.length > 0 && <span className="dots" aria-hidden="true">{dayActivities.slice(0,4).map(a => <i key={a._id} style={{ background:catColor(a.category) }} />)}</span>}
                  </button>
                )
              })}
            </div>
          </section>
          <section className="au-card rise" style={{ ['--d' as any]:1, alignSelf:'start' }}>
            <div className="au-col" style={{ gap:2 }}><span className="lbl">{selectedDayActivities.length} aktivitas</span><h2>{format(selectedDay,'EEEE, d MMMM yyyy', { locale:idLocale })}</h2></div>
            {holidayOf(selectedDay) && <span className="au-pill p-bad" style={{ alignSelf:'flex-start' }}>Hari libur</span>}
            {loading ? <><div className="au-skel" /><div className="au-skel" style={{ width:'70%' }} /></>
              : selectedDayActivities.length === 0 ? <Empty title="Tidak ada aktivitas" text="Pilih tanggal lain atau tambahkan dari Activities." />
              : <div className="au-ig">{selectedDayActivities.map(a => {
                  const pics = picArray(a.pic).length ? picArray(a.pic) : picArray(a.picName)
                  return (
                    <button type="button" key={a._id} onClick={()=>setSelected(a)} className="au-igr au-actrow" style={{ ['--sc' as any]: catColor(a.category) }}>
                      <span className="au-col" style={{ gap:4, minWidth:0 }}>
                        <b style={{ fontSize:14.5 }}>{a.title}</b>
                        <span className="au-xs au-muted">{[a.category, a.subType, a.startTime ? `${a.startTime}${a.endTime ? `–${a.endTime}` : ''}` : ''].filter(Boolean).join(' · ')}</span>
                        {pics.length > 0 && <span className="au-row au-wrap" style={{ gap:4 }}>{pics.map((p:string,i:number) => <span key={i} className="au-tag">{p}</span>)}</span>}
                      </span>
                    </button>
                  )
                })}</div>}
          </section>
        </div>
      </div>
    </div>
  )
}
