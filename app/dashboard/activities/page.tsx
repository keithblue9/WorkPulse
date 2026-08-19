'use client'
import { getConfig } from '@/lib/configCache'
// Normalize keys for filtering — handles 'KPI-SI' vs 'KPI - SI' vs 'kpi_si' etc.
function normKey(s:any):string { return String(s||'').toLowerCase().replace(/[\s\-_]/g,'') }

import { picArray } from '@/lib/defaults'
import RichTextarea from '@/components/RichTextarea'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'

function PicTagInput({ value, onChange, members }: { value:string[]; onChange:(v:string[])=>void; members:any[] }) {
  const [input, setInput] = useState('')
  const [showSuggest, setShowSuggest] = useState(false)
  const suggestions = members.filter(m => (m.name||'').toLowerCase().includes(input.toLowerCase()) && !value.includes(m.name)).slice(0,8)
  function addTag(name:string) { if (name && !value.includes(name)) onChange([...value, name]); setInput(''); setShowSuggest(false) }
  function removeTag(name:string) { onChange(value.filter(v=>v!==name)) }
  return (
    <div style={{ position:'relative' }}>
      <div className="input" style={{ display:'flex', flexWrap:'wrap', gap:5, alignItems:'center', minHeight:38, cursor:'text' }} onClick={()=>setShowSuggest(true)}>
        {value.map(name => (
          <span key={name} style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 8px', background:'var(--brand-soft)', color:'var(--brand)', borderRadius:14, fontSize:11, fontWeight:600 }}>
            {name} <span style={{ cursor:'pointer' }} onClick={(e)=>{e.stopPropagation();removeTag(name)}}>×</span>
          </span>
        ))}
        <input style={{ border:'none', background:'transparent', outline:'none', flex:1, minWidth:80, color:'var(--text)', fontSize:12 }}
          value={input} onChange={e=>{setInput(e.target.value);setShowSuggest(true)}} onFocus={()=>setShowSuggest(true)}
          onKeyDown={e=>{ if(e.key==='Enter'){e.preventDefault();if(suggestions[0])addTag(suggestions[0].name);else if(input)addTag(input)} }}
          placeholder={value.length?'':'+ Tag PIC'} />
      </div>
      {showSuggest && suggestions.length > 0 && (
        <div className="glass-strong" style={{ position:'absolute', top:'calc(100% + 4px)', left:0, right:0, borderRadius:8, padding:5, zIndex:10, maxHeight:200, overflowY:'auto' }}>
          {suggestions.map(m => (
            <div key={m._id} onClick={()=>addTag(m.name)} style={{ padding:'6px 9px', borderRadius:6, cursor:'pointer', fontSize:12, display:'flex', alignItems:'center', gap:8 }}
              onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='var(--bg3)'}
              onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='transparent'}>
              <div style={{ width:22, height:22, borderRadius:'50%', background:'var(--brand)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'#fff' }}>{m.name[0]}</div>
              <span>{m.name}</span>
              <span style={{ marginLeft:'auto', fontSize:9, color:'var(--text3)' }}>{m.division||m.role}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ActivityForm({ editing, onClose, onSave, config, members }: { editing?:any; onClose:()=>void; onSave:()=>void; config:any; members:any[] }) {
  const { data:session } = useSession(); const user = session?.user as any
  const [form, setForm] = useState({
    title: editing?.title || '',
    description: editing?.description || '',
    category: editing?.category || (config?.activityCategories?.[0]?.key || 'Others'),
    subType: editing?.subType || (config?.activitySubTypes?.[0]?.key || 'Others'),
    status: editing?.status || 'on_track',
    priority: editing?.priority || 'medium',
    pic: editing?.pic && Array.isArray(editing.pic) ? editing.pic : (editing?.picName ? [editing.picName] : (user?.name ? [user.name] : [])),
    actionDate: editing?.actionDate || '',
    actionDateEnd: editing?.actionDateEnd || '',
    recurrence: editing?.recurrence || '',
    recurrenceEnd: '',
    recurrenceShowAll: false, // default: hanya occurrence pertama yg muncul di list
    targetWeek: editing?.targetWeek || '',
    progressNotes: editing?.progressNotes || '',
    nextPlan: editing?.nextPlan || '',
    mode: editing?.mode || 'online',
    offlineScope: editing?.offlineScope || '',
    location: editing?.location || '',
    startTime: editing?.startTime || '',
    endTime: editing?.endTime || '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k:string, v:any) => setForm(f=>({...f, [k]:v}))

  // Rentang tanggal aktivitas (inklusif) — presensi diisi untuk tiap harinya.
  function datesOf(start:string, end?:string): string[] {
    if (!start) return []
    if (!end || end === start) return [start]
    const [ys,ms,ds] = start.split('-').map(Number)
    const [ye,me,de] = end.split('-').map(Number)
    const a = new Date(ys,(ms||1)-1,ds||1), b = new Date(ye,(me||1)-1,de||1)
    if (isNaN(a.getTime()) || isNaN(b.getTime()) || b <= a) return [start]
    const out:string[] = []; const cur = new Date(a); let guard = 0
    while (cur <= b && guard < 366) {
      guard++
      out.push(`${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}-${String(cur.getDate()).padStart(2,'0')}`)
      cur.setDate(cur.getDate()+1)
    }
    return out
  }

  // Isi/cabut presensi PIC untuk aktivitas offline (best-effort:
  // kalau gagal, aktivitas tetap tersimpan).
  async function syncAttendance(activityId:string, f:any, dates:string[]) {
    try {
      const r = await fetch('/api/attendance/sync-activity', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ activityId, mode:f.mode, offlineScope:f.offlineScope, pics:f.pic||[], dates,
          title:f.title, startTime:f.startTime, endTime:f.endTime }) })
      const info = (await r.json().catch(()=>null))?.data
      if (info?.created > 0) {
        const label = f.offlineScope === 'luar' ? 'Dinas Luar Kota' : 'Izin / Meeting Luar Kantor'
        toast.success(`Presensi ${label} terisi untuk ${info.userIds} PIC`, { duration: 3000 })
      }
      if (info?.unmatched?.length) toast(`PIC belum terdaftar di Member: ${info.unmatched.join(', ')}`, { icon:'⚠️' })
    } catch { /* diamkan */ }
  }

  // Generate the list of start dates for a recurring activity (capped for safety)
  function buildRecurrenceDates(startStr:string, freq:string, endStr:string): string[] {
    const dates:string[] = [startStr]
    if (!freq || !endStr) return dates
    const start = new Date(startStr + 'T00:00:00')
    const end = new Date(endStr + 'T00:00:00')
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return dates
    // Format tanggal LOKAL (bukan toISOString yg konversi ke UTC -> geser hari di WIB)
    const fmtLocal = (d:Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    const cur = new Date(start)
    let guard = 0
    while (guard < 200) {
      guard++
      if (freq === 'weekly') cur.setDate(cur.getDate() + 7)
      else if (freq === 'biweekly') cur.setDate(cur.getDate() + 14)
      else if (freq === 'monthly') cur.setMonth(cur.getMonth() + 1)
      else break
      if (cur > end) break
      dates.push(fmtLocal(cur))
    }
    return dates
  }

  async function save() {
    if (!form.title) { toast.error('Aktivitas wajib diisi'); return }
    if (!form.actionDate) { toast.error('Action Date wajib diisi'); return }
    if (form.recurrence && !editing && !form.recurrenceEnd) { toast.error('Isi tanggal "Berulang sampai" untuk aktivitas berulang'); return }
    setSaving(true)
    try {
      if (editing) {
        const r = await fetch(`/api/projects/${editing._id}`, { method:'PATCH', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ ...form, picName: form.pic[0] || '', members: form.pic }) })
        if (!r.ok) { const e = await r.json(); toast.error('Gagal: '+(e.error||r.statusText)); return }
        await syncAttendance(editing._id, form, datesOf(form.actionDate, form.actionDateEnd))
        toast.success('Diperbarui!'); onSave(); onClose(); return
      }
      // NEW: handle recurrence by creating one activity per occurrence
      const dates = form.recurrence ? buildRecurrenceDates(form.actionDate, form.recurrence, form.recurrenceEnd) : [form.actionDate]
      const groupId = form.recurrence ? `rec_${Date.now()}_${Math.random().toString(36).slice(2,8)}` : ''
      let ok = 0
      for (let i = 0; i < dates.length; i++) {
        const d = dates[i]
        // Untuk aktivitas berulang: default hanya occurrence PERTAMA yg tampil di list (biar list ga penuh).
        // Semua occurrence tetap tersimpan -> muncul di Calendar. Bisa di-override "tampilkan semua".
        const showInList = form.recurrence ? (form.recurrenceShowAll || i === 0) : true
        const r = await fetch('/api/projects', { method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ ...form, actionDate: d, actionDateEnd:'', recurrenceGroupId: groupId, showInList, picName: form.pic[0] || '', members: form.pic }) })
        if (r.ok) {
          ok++
          // Aktivitas offline -> presensi PIC otomatis terisi (dinas / izin meeting luar kantor)
          try { const created = await r.json(); if (created?.data?._id) await syncAttendance(created.data._id, form, [d]) } catch {}
        }
      }
      if (ok === 0) { toast.error('Gagal membuat aktivitas'); return }
      toast.success(dates.length>1 ? `${ok} aktivitas berulang dibuat!` : 'Aktivitas dibuat!'); onSave(); onClose()
    } catch { toast.error('Gagal') } finally { setSaving(false) }
  }

  async function del() {
    if (!confirm('Hapus aktivitas ini?')) return
    await fetch(`/api/projects/${editing._id}`, { method:'DELETE' })
    // Cabut slot presensi yang dibuat otomatis dari aktivitas ini
    await syncAttendance(editing._id, { ...form, mode:'online' }, [])
    toast.success('Dihapus'); onSave(); onClose()
  }

  async function delAll() {
    if (!editing?.recurrenceGroupId) return del()
    if (!confirm('Hapus SEMUA pengulangan agenda ini (termasuk yg di Calendar)?')) return
    const r = await fetch(`/api/projects/recurring?groupId=${editing.recurrenceGroupId}`, { method:'DELETE' })
    const d = await r.json()
    toast.success(`${d.deleted||0} agenda berulang dihapus`); onSave(); onClose()
  }

  async function saveEditAll() {
    if (!editing?.recurrenceGroupId) return save()
    setSaving(true)
    try {
      // Field yg diubah utk semua occurrence (kecuali tanggal per-occurrence)
      const patch = { title:form.title, description:form.description, category:form.category, subType:form.subType,
        status:form.status, priority:form.priority, pic:form.pic, members:form.pic, picName:form.pic[0]||'',
        location:form.location, mode:form.mode, showInList: editing.showInList !== false }
      const r = await fetch('/api/projects/recurring', { method:'PATCH', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ groupId: editing.recurrenceGroupId, patch }) })
      const d = await r.json()
      if (!r.ok) { toast.error(d.error||'Gagal'); return }
      toast.success(`${d.modified||0} agenda berulang diperbarui`); onSave(); onClose()
    } finally { setSaving(false) }
  }

  const cats = config?.activityCategories?.filter((c:any)=>c.active) || []
  const subs = config?.activitySubTypes?.filter((s:any)=>s.active) || []
  const statuses = config?.issueStatuses?.filter((s:any)=>s.active) || []

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ width:620 }}>
        <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:14, fontWeight:600 }}>{editing?'Edit':'+ Aktivitas Baru'}</div>
            <div style={{ fontSize:10, color:'var(--text3)' }}>Akan muncul juga di Issues & Calendar</div>
          </div>
          <button onClick={onClose} className="btn btn-icon">×</button>
        </div>
        <div style={{ padding:'14px 20px', overflowY:'auto', maxHeight:'76vh', display:'flex', flexDirection:'column', gap:11 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div><label style={lbl}>Kategori</label>
              <select className="input" value={form.category} onChange={e=>set('category', e.target.value)}>
                {cats.map((c:any)=><option key={c.key} value={c.key}>{c.label}</option>)}
              </select></div>
            <div><label style={lbl}>Sub Tipe</label>
              <select className="input" value={form.subType} onChange={e=>set('subType', e.target.value)}>
                {subs.map((s:any)=><option key={s.key} value={s.key}>{s.label}</option>)}
              </select></div>
          </div>
          <div><label style={lbl}>Judul Aktivitas *</label>
            <input className="input" value={form.title} onChange={e=>set('title', e.target.value)} placeholder="Title singkat..." /></div>
          <div><label style={lbl}>Aktivitas (Narasi / Point-Point Progress)</label>
            <RichTextarea rows={4} value={form.description} onChange={v=>set('description', v)}
              placeholder="Isi narasi atau point-point progress aktivitas. Klik tombol • atau 1. untuk bullet/numbering" /></div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
            <div><label style={lbl}>Status</label>
              <select className="input" value={form.status} onChange={e=>set('status', e.target.value)}>
                {statuses.map((s:any)=><option key={s.key} value={s.key}>{s.label}</option>)}
              </select></div>
            <div><label style={lbl}>Priority</label>
              <select className="input" value={form.priority} onChange={e=>set('priority', e.target.value)}>
                <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
              </select></div>
            <div><label style={lbl}>Action Date (Dari) *</label>
              <input type="date" className="input" value={form.actionDate} onChange={e=>set('actionDate', e.target.value)} /></div>
            <div><label style={lbl}>Sampai (opsional)</label>
              <input type="date" className="input" value={form.actionDateEnd} min={form.actionDate||undefined} onChange={e=>set('actionDateEnd', e.target.value)} disabled={!!form.recurrence} />
              <div style={{ fontSize:9, color:'var(--text3)', marginTop:3 }}>Isi kalau kegiatan lebih dari 1 hari — muncul di kalender sepanjang rentang</div></div>
          </div>
          {!editing && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, padding:'10px 12px', background:'var(--bg3)', borderRadius:8 }}>
              <div><label style={lbl}>🔁 Berulang</label>
                <select className="input" value={form.recurrence} onChange={e=>set('recurrence', e.target.value)}>
                  <option value="">Tidak berulang</option>
                  <option value="weekly">Tiap minggu</option>
                  <option value="biweekly">Tiap 2 minggu</option>
                  <option value="monthly">Tiap bulan</option>
                </select></div>
              <div><label style={lbl}>Berulang sampai {form.recurrence && <span style={{ color:'var(--red)' }}>*</span>}</label>
                <input type="date" className="input" value={form.recurrenceEnd} min={form.actionDate||undefined} onChange={e=>set('recurrenceEnd', e.target.value)} disabled={!form.recurrence} />
                <div style={{ fontSize:9, color:'var(--text3)', marginTop:3 }}>Agenda otomatis muncul di kalender tiap pengulangan</div></div>
            </div>
          )}
          {form.recurrence && (
            <label style={{ display:'flex', alignItems:'flex-start', gap:8, padding:'9px 11px', background:'var(--bg3)', borderRadius:8, cursor:'pointer', fontSize:11.5 }}>
              <input type="checkbox" checked={form.recurrenceShowAll} onChange={e=>set('recurrenceShowAll', e.target.checked)} style={{ marginTop:1, cursor:'pointer' }} />
              <span style={{ color:'var(--text2)' }}>Tampilkan <b>semua pengulangan</b> di list Activities.
                <span style={{ display:'block', fontSize:10, color:'var(--text3)', marginTop:1 }}>Default: hanya agenda pertama yg muncul di list biar rapi — sisanya tetap tampil di <b>Calendar</b>.</span>
              </span>
            </label>
          )}
          <div><label style={lbl}>PIC (multi tag)</label>
            <PicTagInput value={form.pic} onChange={v=>set('pic', v)} members={members} /></div>
          <div><label style={lbl}>Next Plan (Narasi / Point-Point)</label>
            <RichTextarea rows={3} value={form.nextPlan} onChange={v=>set('nextPlan', v)}
              placeholder="Plan kedepannya. Klik • atau 1. untuk bullet/numbering" /></div>
          <div style={{ display:'grid', gridTemplateColumns:'120px 1fr', gap:10 }}>
            <div><label style={lbl}>Target Week</label>
              <input className="input" value={form.targetWeek} onChange={e=>set('targetWeek', e.target.value)} placeholder="W23" /></div>
            <div><label style={lbl}>Mode</label>
              <div style={{ display:'flex', gap:8 }}>
                <label style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'8px 12px', borderRadius:7, cursor:'pointer', fontSize:12, background:form.mode==='online'?'var(--brand-soft)':'var(--bg3)', border:`1px solid ${form.mode==='online'?'var(--brand)':'var(--border2)'}`, color:form.mode==='online'?'var(--brand)':'var(--text2)' }}>
                  <input type="radio" checked={form.mode==='online'} onChange={()=>set('mode','online')} style={{ display:'none' }} />
                  💻 Online
                </label>
                <label style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'8px 12px', borderRadius:7, cursor:'pointer', fontSize:12, background:form.mode==='offline'?'var(--brand-soft)':'var(--bg3)', border:`1px solid ${form.mode==='offline'?'var(--brand)':'var(--border2)'}`, color:form.mode==='offline'?'var(--brand)':'var(--text2)' }}>
                  <input type="radio" checked={form.mode==='offline'} onChange={()=>set('mode','offline')} style={{ display:'none' }} />
                  📍 Offline
                </label>
              </div></div>
          </div>
          {form.mode === 'offline' && (
            <>
              <div><label style={lbl}>Lokasi (Offline)</label>
                <input className="input" value={form.location} onChange={e=>set('location', e.target.value)} placeholder="Gedung, ruangan, kota..." /></div>
              <div>
                <label style={lbl}>Area Offline</label>
                <div style={{ display:'flex', gap:8 }}>
                  {([['jakarta','🏙️ Jakarta'],['luar','✈️ Luar Jakarta']] as const).map(([val,label])=>(
                    <label key={val} style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'8px 12px', borderRadius:7, cursor:'pointer', fontSize:12, background:form.offlineScope===val?'var(--brand-soft)':'var(--bg3)', border:`1px solid ${form.offlineScope===val?'var(--brand)':'var(--border2)'}`, color:form.offlineScope===val?'var(--brand)':'var(--text2)' }}>
                      <input type="radio" checked={form.offlineScope===val} onChange={()=>set('offlineScope',val)} style={{ display:'none' }} />
                      {label}
                    </label>
                  ))}
                </div>
                {form.offlineScope && (
                  <div style={{ fontSize:10.5, color:'var(--text3)', marginTop:5 }}>
                    Presensi PIC otomatis diisi <b style={{ color:'var(--brand)' }}>{form.offlineScope==='luar' ? 'Dinas Luar Kota' : 'Izin / Meeting Luar Kantor'}</b> untuk tanggal kegiatan.
                  </div>
                )}
              </div>
            </>
          )}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div><label style={lbl}>Mulai (opsional)</label>
              <input type="time" className="input" value={form.startTime} onChange={e=>set('startTime', e.target.value)} /></div>
            <div><label style={lbl}>Selesai (opsional)</label>
              <input type="time" className="input" value={form.endTime} onChange={e=>set('endTime', e.target.value)} /></div>
          </div>
        </div>
        <div style={{ padding:'12px 20px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
          {editing ? (
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              <button onClick={del} className="btn btn-danger btn-sm">🗑 Hapus{editing.recurrenceGroupId?' ini':''}</button>
              {editing.recurrenceGroupId && <button onClick={delAll} className="btn btn-sm" style={{ color:'var(--red)', borderColor:'var(--red)' }}>🗑 Hapus semua rutin</button>}
            </div>
          ) : <div />}
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={onClose} className="btn">Batal</button>
            {editing?.recurrenceGroupId && <button onClick={saveEditAll} disabled={saving} className="btn btn-sm" style={{ background:'#8b5cf6', color:'#fff' }}>{saving?'...':'Simpan ke semua rutin'}</button>}
            <button onClick={save} disabled={saving} className="btn btn-primary">{saving?'Menyimpan...':editing?'Simpan':'Buat Aktivitas'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

const PRIORITY_CFG: Record<string,{label:string;color:string;bg:string}> = {
  high:{label:'High', color:'var(--red)', bg:'var(--redbg)'},
  medium:{label:'Medium', color:'var(--amber)', bg:'var(--amberbg)'},
  low:{label:'Low', color:'var(--green)', bg:'var(--greenbg)'},
}

export default function ActivitiesPage() {
  const { data:session } = useSession()
  const [activities, setActivities] = useState<any[]>([])
  const [config, setConfig] = useState<any>(null)
  const [members, setMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [filterCat, setFilterCat] = useState('All')
  const [filterSub, setFilterSub] = useState('')
  const [filterStatus, setFilterStatus] = useState('All')
  const [filterPic, setFilterPic] = useState('All')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'date_desc'|'date_asc'|'status'>('date_desc')

  // Read URL params on mount
  useEffect(() => { if (typeof window !== 'undefined') { const sp = new URLSearchParams(window.location.search); const cat = sp.get('cat'); const sub = sp.get('sub'); if (cat) setFilterCat(cat); if (sub) setFilterSub(sub) } }, [])

  async function load() {
    setLoading(true)
    const [a,c,m] = await Promise.all([
      fetch('/api/projects').then(r=>r.json()),
      getConfig().then((data:any)=>({ data })),
      fetch('/api/users').then(r=>r.json()),
    ])
    setActivities(a.data||[]); setConfig(c.data); setMembers((m.data||[]).filter((u:any)=>u.active!==false)); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const cats = config?.activityCategories?.filter((c:any)=>c.active) || []
  const subs = config?.activitySubTypes?.filter((s:any)=>s.active) || []
  const statuses = config?.issueStatuses?.filter((s:any)=>s.active) || []
  const statusOrder: Record<string,number> = {}
  statuses.forEach((s:any,i:number)=>{ statusOrder[s.key]=i })

  const filtered = activities.filter(a => {
    if (a.showInList === false) return false // occurrence berulang yg disembunyikan (tetap di Calendar)
    if (search && !a.title.toLowerCase().includes(search.toLowerCase())) return false
    if (filterCat !== 'All' && normKey(a.category) !== normKey(filterCat) && normKey(a.subType) !== normKey(filterCat)) return false
    if (filterSub && normKey(a.subType) !== normKey(filterSub)) return false
    if (filterStatus !== 'All' && normKey(a.status) !== normKey(filterStatus)) return false
    if (filterPic !== 'All' && !picArray(a.pic).includes(filterPic)) return false
    return true
  }).sort((a, b) => {
    if (sortBy === 'status') return (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99)
    const da = a.actionDate || '', db = b.actionDate || ''
    return sortBy === 'date_asc' ? da.localeCompare(db) : db.localeCompare(da)
  })

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {(showForm||editing) && <ActivityForm editing={editing} onClose={()=>{setShowForm(false);setEditing(null)}} onSave={load} config={config} members={members} />}

      <div style={{ padding:'12px 20px', borderBottom:'1px solid var(--border)', background:'var(--bg2)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div>
          <div style={{ fontSize:14, fontWeight:600 }}>Activities</div>
          <div style={{ fontSize:11, color:'var(--text3)' }}>Trigger Issues &amp; Calendar · {filtered.length} tampil{activities.length>filtered.length ? ` · ${activities.length-filtered.length} agenda rutin disembunyikan (cek Calendar)` : ''}</div>
        </div>
        <button onClick={()=>setShowForm(true)} className="btn btn-primary btn-sm">+ Aktivitas Baru</button>
      </div>

      <div style={{ display:'flex', gap:8, padding:'10px 20px', background:'var(--bg2)', borderBottom:'1px solid var(--border)', flexShrink:0, flexWrap:'wrap', alignItems:'center' }}>
        <input className="input" style={{ width:180 }} value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Cari..." />
        <select className="input" style={{ width:160 }} value={filterPic} onChange={e=>setFilterPic(e.target.value)}>
          <option value="All">👤 Semua PIC</option>
          {members.map(m => <option key={m._id} value={m.name}>{m.name}</option>)}
        </select>
        <select className="input" style={{ width:160 }} value={sortBy} onChange={e=>setSortBy(e.target.value as any)}>
          <option value="date_desc">📅 Tanggal Terbaru</option>
          <option value="date_asc">📅 Tanggal Terlama</option>
          <option value="status">🚦 Urutkan per Status</option>
        </select>
        <div className="chip-row" style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
          <button onClick={()=>setFilterStatus('All')} style={chip(filterStatus==='All')}>Semua Status</button>
          {statuses.map((s:any) => (
            <button key={s.key} onClick={()=>setFilterStatus(s.key)} style={chip(filterStatus===s.key, s.color)}>{s.label}</button>
          ))}
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'14px 20px' }} className="safe-bottom page-pad">
        {loading ? <div style={{ textAlign:'center', padding:40, color:'var(--text3)' }}>Memuat...</div> :
         filtered.length === 0 ? (
           <div className="card" style={{ textAlign:'center', padding:40, color:'var(--text3)' }}>
             <div style={{ fontSize:34, marginBottom:8 }}>📋</div>
             <div>Belum ada aktivitas</div>
           </div>
         ) : (
           <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
             {filtered.map(a => {
               const catColor = cats.find((c:any)=>c.key===a.category)?.color || 'var(--brand)'
               const subColor = subs.find((s:any)=>s.key===a.subType)?.color || 'var(--text3)'
               const statusDef = statuses.find((s:any)=>normKey(s.key)===normKey(a.status))
               return (
                 <div key={a._id} className="card" style={{ padding:'12px 14px', borderLeft:`3px solid ${statusDef?.color || catColor}`, cursor:'pointer' }} onClick={()=>setEditing(a)}>
                   <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10 }}>
                     <div style={{ flex:1, minWidth:0 }}>
                       <div style={{ display:'flex', flexWrap:'wrap', gap:5, alignItems:'center', marginBottom:5 }}>
                         <span style={{ fontSize:13, fontWeight:600 }}>{a.title}</span>
                         {statusDef && <span className="badge" style={{ background:statusDef.color+'22', color:statusDef.color, fontSize:10, fontWeight:700 }}>{statusDef.label}</span>}
                         {a.recurrenceGroupId && <span className="badge" style={{ background:'#8b5cf622', color:'#8b5cf6', fontSize:10, fontWeight:700 }} title="Agenda berulang — pengulangan lain ada di Calendar">🔁 Rutin</span>}
                         <span className="badge" style={{ background:catColor+'22', color:catColor, fontSize:10 }}>{a.category}</span>
                         <span className="badge" style={{ background:subColor+'22', color:subColor, fontSize:10 }}>{a.subType}</span>
                         {a.priority && <span className="badge" style={{ background:PRIORITY_CFG[a.priority]?.bg, color:PRIORITY_CFG[a.priority]?.color, fontSize:10 }}>{PRIORITY_CFG[a.priority]?.label}</span>}
                         {a.mode === 'offline' && a.location && <span style={{ fontSize:10, color:'var(--text3)' }}>📍 {a.location}</span>}
                       </div>
                       {a.description && <div style={{ fontSize:11, color:'var(--text2)', lineHeight:1.5, marginBottom:5, whiteSpace:'pre-wrap' }}>{a.description.substring(0, 180)}{a.description.length>180?'...':''}</div>}
                       <div style={{ display:'flex', flexWrap:'wrap', gap:10, fontSize:10, color:'var(--text3)' }}>
                         {a.actionDate && <span>📅 {a.actionDate}</span>}
                         {a.targetWeek && <span>🗓 {a.targetWeek}</span>}
                         {picArray(a.pic).length > 0 && <span>👤 {picArray(a.pic).join(', ')}</span>}
                       </div>
                     </div>
                   </div>
                 </div>
               )
             })}
           </div>
         )
        }
      </div>
    </div>
  )
}
function chip(active:boolean, color:string='var(--brand)'):React.CSSProperties { return { padding:'4px 11px', borderRadius:20, fontSize:11, fontWeight:600, cursor:'pointer', border:`1px solid ${active?color:'var(--border)'}`, background:active?color+'1a':'var(--bg3)', color:active?color:'var(--text2)' } }
const lbl: React.CSSProperties = { display:'block', fontSize:11, fontWeight:500, color:'var(--text2)', marginBottom:5 }
