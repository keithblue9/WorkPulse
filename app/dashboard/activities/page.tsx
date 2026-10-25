'use client'
import { getConfig } from '@/lib/configCache'
// Normalize keys for filtering — handles 'KPI-SI' vs 'KPI - SI' vs 'kpi_si' etc.
function normKey(s:any):string { return String(s||'').toLowerCase().replace(/[\s\-_]/g,'') }

import { picArray } from '@/lib/defaults'
import RichTextarea from '@/components/RichTextarea'
import { startTransition, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import { Empty, Icon, PageHeader, Pill, Sheet, Tile } from '@/components/ui'
import { useYear } from '@/lib/year'
import { activityInYear } from '@/lib/dashboard'
import HistoryList from '@/components/HistoryList'

function PicTagInput({ value, onChange, members }: { value:string[]; onChange:(v:string[])=>void; members:any[] }) {
  const [input, setInput] = useState('')
  const [showSuggest, setShowSuggest] = useState(false)
  const suggestions = members.filter(m => (m.name||'').toLowerCase().includes(input.toLowerCase()) && !value.includes(m.name)).slice(0,8)
  function addTag(name:string) { if (name && !value.includes(name)) onChange([...value, name]); setInput(''); setShowSuggest(false) }
  function removeTag(name:string) { onChange(value.filter(v=>v!==name)) }
  return (
    <div style={{ position:'relative' }}>
      <div className="input au-row au-wrap" style={{ gap:6, minHeight:44, cursor:'text' }} onClick={()=>setShowSuggest(true)}>
        {value.map(name => (
          <span key={name} className="au-tag" style={{ background:'var(--accent-soft)', color:'var(--accent-ink)' }}>{name}
            <button type="button" aria-label={`Hapus ${name}`} onClick={(e)=>{e.stopPropagation();removeTag(name)}} style={{ border:0, background:'none', color:'inherit', cursor:'pointer', padding:0, display:'grid' }}><Icon name="x" size={12} /></button></span>
        ))}
        <input aria-label="Tambah PIC" style={{ border:'none', background:'transparent', outline:'none', flex:1, minWidth:100, color:'var(--ink)', minHeight:28 }}
          value={input} onChange={e=>{setInput(e.target.value);setShowSuggest(true)}} onFocus={()=>setShowSuggest(true)} onBlur={()=>setTimeout(()=>setShowSuggest(false), 150)}
          onKeyDown={e=>{ if(e.key==='Enter'){e.preventDefault();if(suggestions[0])addTag(suggestions[0].name);else if(input)addTag(input)} }}
          placeholder={value.length?'':'Ketik nama PIC'} />
      </div>
      {showSuggest && suggestions.length > 0 && (
        <div className="au-ig" style={{ position:'absolute', top:'calc(100% + 6px)', left:0, right:0, zIndex:10, maxHeight:240, overflowY:'auto', boxShadow:'var(--shadow-s2)' }}>
          {suggestions.map((m, i) => (
            <button type="button" key={m._id} className="au-igr" onMouseDown={e=>e.preventDefault()} onClick={()=>addTag(m.name)} style={{ minHeight:44 }}>
              <span className={`au-av s c${(i % 7) + 1}`}>{String(m.name||'?')[0]}</span><span>{m.name}</span><span className="v au-xs au-muted">{m.division||m.role}</span>
            </button>
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
  const [confirmDel, setConfirmDel] = useState<null|'one'|'all'>(null)
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
      if (info?.unmatched?.length) toast(`PIC belum terdaftar di Member: ${info.unmatched.join(', ')}`)
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
    const r = await fetch(`/api/projects/${editing._id}`, { method:'DELETE' })
    if (!r.ok) { toast.error('Gagal menghapus'); return }
    // Cabut slot presensi yang dibuat otomatis dari aktivitas ini
    await syncAttendance(editing._id, { ...form, mode:'online' }, [])
    toast.success('Dihapus'); onSave(); onClose()
  }

  async function delAll() {
    if (!editing?.recurrenceGroupId) return del()
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
  const opt = (v:string, cur:string, label:React.ReactNode, onPick:()=>void) => <button key={v} type="button" className="au-chip" aria-pressed={cur===v} onClick={onPick} style={{ flex:1, justifyContent:'center', display:'inline-flex', alignItems:'center', gap:6 }}>{label}</button>

  return (
    <Sheet open wide title={editing ? 'Edit aktivitas' : 'Aktivitas baru'} onClose={onClose} onSave={save} saveDisabled={saving} saveLabel={saving ? 'Menyimpan…' : editing ? 'Simpan' : 'Buat'}>
      <p className="au-xs au-muted" style={{ marginTop:-4 }}>Tampil juga di Issues &amp; Calendar.</p>
      <div className="au-grid" style={{ gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))', gap:10 }}>
        <label className="au-col" style={{ gap:6 }}><span className="lbl">Kategori</span>
          <select className="input" value={form.category} onChange={e=>set('category', e.target.value)}>{cats.map((c:any)=><option key={c.key} value={c.key}>{c.label}</option>)}</select></label>
        <label className="au-col" style={{ gap:6 }}><span className="lbl">Sub tipe</span>
          <select className="input" value={form.subType} onChange={e=>set('subType', e.target.value)}>{subs.map((s:any)=><option key={s.key} value={s.key}>{s.label}</option>)}</select></label>
      </div>
      <label className="au-col" style={{ gap:6 }}><span className="lbl">Judul aktivitas *</span>
        <input className="input" value={form.title} onChange={e=>set('title', e.target.value)} placeholder="Judul singkat" /></label>
      <div className="au-col" style={{ gap:6 }}><span className="lbl">Narasi / poin progress</span>
        <RichTextarea rows={4} value={form.description} onChange={v=>set('description', v)} placeholder="Narasi atau poin progress. Ketuk • atau 1. untuk bullet/penomoran" /></div>
      <div className="au-grid" style={{ gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:10 }}>
        <label className="au-col" style={{ gap:6 }}><span className="lbl">Status</span>
          <select className="input" value={form.status} onChange={e=>set('status', e.target.value)}>{statuses.map((s:any)=><option key={s.key} value={s.key}>{s.label}</option>)}</select></label>
        <label className="au-col" style={{ gap:6 }}><span className="lbl">Prioritas</span>
          <select className="input" value={form.priority} onChange={e=>set('priority', e.target.value)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
        <label className="au-col" style={{ gap:6 }}><span className="lbl">Tanggal (dari) *</span>
          <input type="date" className="input" value={form.actionDate} onChange={e=>set('actionDate', e.target.value)} /></label>
        <label className="au-col" style={{ gap:6 }}><span className="lbl">Sampai (opsional)</span>
          <input type="date" className="input" value={form.actionDateEnd} min={form.actionDate||undefined} onChange={e=>set('actionDateEnd', e.target.value)} disabled={!!form.recurrence} /></label>
      </div>
      <span className="au-xs au-muted" style={{ marginTop:-6 }}>Isi “Sampai” bila kegiatan lebih dari 1 hari; tampil di kalender sepanjang rentang.</span>
      {!editing && (
        <div className="au-box" style={{ padding:14, gap:10 }}>
          <div className="au-grid" style={{ gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))', gap:10 }}>
            <label className="au-col" style={{ gap:6 }}><span className="lbl">Berulang</span>
              <select className="input" value={form.recurrence} onChange={e=>set('recurrence', e.target.value)}>
                <option value="">Tidak berulang</option><option value="weekly">Tiap minggu</option><option value="biweekly">Tiap 2 minggu</option><option value="monthly">Tiap bulan</option>
              </select></label>
            <label className="au-col" style={{ gap:6 }}><span className="lbl">Berulang sampai {form.recurrence && <span style={{ color:'var(--bad)' }}>*</span>}</span>
              <input type="date" className="input" value={form.recurrenceEnd} min={form.actionDate||undefined} onChange={e=>set('recurrenceEnd', e.target.value)} disabled={!form.recurrence} /></label>
          </div>
          {form.recurrence && <label className="au-row au-small" style={{ gap:10, cursor:'pointer', alignItems:'flex-start' }}>
            <input type="checkbox" className="au-chk" checked={form.recurrenceShowAll} onChange={e=>set('recurrenceShowAll', e.target.checked)} />
            <span>Tampilkan <b>semua pengulangan</b> di daftar Activities.<span className="au-xs au-muted" style={{ display:'block' }}>Default hanya agenda pertama yang tampil; sisanya tetap ada di Calendar.</span></span>
          </label>}
        </div>
      )}
      <div className="au-col" style={{ gap:6 }}><span className="lbl">PIC</span><PicTagInput value={form.pic} onChange={v=>set('pic', v)} members={members} /></div>
      <div className="au-col" style={{ gap:6 }}><span className="lbl">Next plan</span>
        <RichTextarea rows={3} value={form.nextPlan} onChange={v=>set('nextPlan', v)} placeholder="Rencana berikutnya. Ketuk • atau 1. untuk bullet/penomoran" /></div>
      <div className="au-grid" style={{ gridTemplateColumns:'minmax(110px,140px) minmax(0,1fr)', gap:10 }}>
        <label className="au-col" style={{ gap:6 }}><span className="lbl">Target week</span><input className="input" value={form.targetWeek} onChange={e=>set('targetWeek', e.target.value)} placeholder="W23" /></label>
        <div className="au-col" style={{ gap:6 }}><span className="lbl">Mode</span>
          <div className="au-row" style={{ gap:8 }}>{opt('online', form.mode, <><Icon name="link" size={15} />Online</>, ()=>set('mode','online'))}{opt('offline', form.mode, <><Icon name="pin" size={15} />Offline</>, ()=>set('mode','offline'))}</div></div>
      </div>
      {form.mode === 'offline' && (
        <div className="au-box" style={{ padding:14, gap:10 }}>
          <label className="au-col" style={{ gap:6 }}><span className="lbl">Lokasi</span><input className="input" value={form.location} onChange={e=>set('location', e.target.value)} placeholder="Gedung, ruangan, kota" /></label>
          <div className="au-col" style={{ gap:6 }}><span className="lbl">Area offline</span>
            <div className="au-row" style={{ gap:8 }}>{opt('jakarta', form.offlineScope, 'Jakarta', ()=>set('offlineScope','jakarta'))}{opt('luar', form.offlineScope, 'Luar Jakarta', ()=>set('offlineScope','luar'))}</div>
            {form.offlineScope && <span className="au-xs au-muted">Presensi PIC otomatis diisi <b style={{ color:'var(--accent-ink)' }}>{form.offlineScope==='luar' ? 'Dinas Luar Kota' : 'Izin / Meeting Luar Kantor'}</b> untuk tanggal kegiatan.</span>}
          </div>
        </div>
      )}
      <div className="au-grid" style={{ gridTemplateColumns:'repeat(2,minmax(0,1fr))', gap:10 }}>
        <label className="au-col" style={{ gap:6 }}><span className="lbl">Mulai (opsional)</span><input type="time" className="input" value={form.startTime} onChange={e=>set('startTime', e.target.value)} /></label>
        <label className="au-col" style={{ gap:6 }}><span className="lbl">Selesai (opsional)</span><input type="time" className="input" value={form.endTime} onChange={e=>set('endTime', e.target.value)} /></label>
      </div>
      {editing?.recurrenceGroupId && <button type="button" onClick={saveEditAll} disabled={saving} className="btn" style={{ alignSelf:'flex-start' }}><Icon name="check" size={15} />Simpan ke semua pengulangan</button>}
      {editing && (confirmDel
        ? <div className="au-row au-wrap p-bad" style={{ borderRadius:14, padding:12, gap:8 }}>
            <span className="au-small" style={{ flex:1, minWidth:180 }}>{confirmDel === 'all' ? 'Hapus SEMUA pengulangan agenda ini (termasuk di Calendar)?' : 'Hapus aktivitas ini?'}</span>
            <button type="button" className="btn btn-sm" onClick={()=>setConfirmDel(null)}>Batal</button>
            <button type="button" className="btn btn-danger btn-sm" disabled={saving} onClick={()=> confirmDel === 'all' ? delAll() : del()}>Ya, hapus</button>
          </div>
        : <div className="au-row au-wrap" style={{ gap:8 }}>
            <button type="button" onClick={()=>setConfirmDel('one')} className="btn btn-danger"><Icon name="trash" size={15} />Hapus{editing.recurrenceGroupId ? ' yang ini' : ''}</button>
            {editing.recurrenceGroupId && <button type="button" onClick={()=>setConfirmDel('all')} className="btn"><Icon name="trash" size={15} />Hapus semua pengulangan</button>}
          </div>)}
      {editing?._id && <HistoryList entity="activity" id={String(editing._id)} />}
    </Sheet>
  )
}

const PRIORITY_CFG: Record<string,{label:string;tone:'bad'|'warn'|'ok'}> = {
  high:{label:'High', tone:'bad'}, medium:{label:'Medium', tone:'warn'}, low:{label:'Low', tone:'ok'},
}

export default function ActivitiesPage() {
  const { data:session } = useSession()
  const { year } = useYear()
  const nowYear = new Date().getFullYear()
  const [activities, setActivities] = useState<any[]>([])
  const [config, setConfig] = useState<any>(null)
  const [members, setMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
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
    setLoading(true); setFailed(false)
    try {
      const [a,c,m] = await Promise.all([
        fetch('/api/projects').then(r=>{ if (!r.ok) throw new Error(); return r.json() }),
        getConfig().then((data:any)=>({ data })),
        fetch('/api/users').then(r=>r.ok ? r.json() : { data: [] }),
      ])
      startTransition(() => { setActivities(a.data||[]); setConfig(c.data); setMembers((m.data||[]).filter((u:any)=>u.active!==false)) })
    } catch { setFailed(true) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const cats = config?.activityCategories?.filter((c:any)=>c.active) || []
  const subs = config?.activitySubTypes?.filter((s:any)=>s.active) || []
  const statuses = config?.issueStatuses?.filter((s:any)=>s.active) || []
  const statusOrder: Record<string,number> = {}
  statuses.forEach((s:any,i:number)=>{ statusOrder[s.key]=i })

  // Tahun global: aktivitas tahun terpilih; yang belum selesai dari tahun lalu ikut tampil di tahun berjalan.
  const inYear = activities.filter(a => a.showInList !== false && activityInYear(a, year, nowYear))
  const filtered = inYear.filter(a => {
    if (search && !String(a.title||'').toLowerCase().includes(search.toLowerCase())) return false
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
  const hiddenRec = activities.filter(a => a.showInList === false && activityInYear(a, year, nowYear)).length
  const filtersOn = filterCat !== 'All' || !!filterSub || filterStatus !== 'All' || filterPic !== 'All' || !!search

  return (
    <div className="au-page">
      {(showForm||editing) && <ActivityForm editing={editing} onClose={()=>{setShowForm(false);setEditing(null)}} onSave={load} config={config} members={members} />}
      <div className="au-view au-anim">
        <PageHeader eyebrow={`Activities · ${filtered.length} tampil${hiddenRec ? ` · ${hiddenRec} agenda rutin di Calendar` : ''}`} title="Activities" actions={
          <button type="button" onClick={()=>setShowForm(true)} className="btn btn-primary"><Icon name="plus" size={16} stroke={2.2} />Aktivitas baru</button>
        } />
        {statuses.length > 0 && (
          <div className="au-grid au-tiles" style={{ gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))' }}>
            <Tile icon="act" color="var(--accent)" value={inYear.length} label="Semua" hint={String(year)} active={filterStatus==='All'} onClick={()=>setFilterStatus('All')} />
            {statuses.map((st:any) => <Tile key={st.key} icon={/complete|done/i.test(st.key) ? 'check' : /delay|late/i.test(st.key) ? 'bolt' : /risk/i.test(st.key) ? 'clock' : 'prog'} color={st.color} value={inYear.filter(a=>normKey(a.status)===normKey(st.key)).length} label={st.label} active={filterStatus===st.key} onClick={()=>setFilterStatus(filterStatus===st.key ? 'All' : st.key)} />)}
          </div>
        )}
        <div className="au-row au-wrap" style={{ gap:8 }}>
          <label className="input au-row" style={{ gap:8, padding:'0 12px', flex:'1 1 220px', maxWidth:360 }}><Icon name="search" size={16} />
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari judul" aria-label="Cari aktivitas" style={{ border:0, background:'transparent', flex:1, minHeight:40, outline:0, color:'var(--ink)' }} /></label>
          <select className="input" style={{ width:'auto', minWidth:150 }} value={filterPic} onChange={e=>setFilterPic(e.target.value)} aria-label="Filter PIC">
            <option value="All">Semua PIC</option>{members.map(m => <option key={m._id} value={m.name}>{m.name}</option>)}
          </select>
          <select className="input" style={{ width:'auto', minWidth:170 }} value={sortBy} onChange={e=>setSortBy(e.target.value as any)} aria-label="Urutkan">
            <option value="date_desc">Tanggal terbaru</option><option value="date_asc">Tanggal terlama</option><option value="status">Per status</option>
          </select>
          {filtersOn && <button type="button" className="au-link" onClick={()=>{ setFilterCat('All'); setFilterSub(''); setFilterStatus('All'); setFilterPic('All'); setSearch('') }}>Reset filter</button>}
        </div>
        {cats.length > 0 && <div className="au-chips" role="group" aria-label="Filter kategori">
          <button type="button" className="au-chip" aria-pressed={filterCat==='All'} onClick={()=>setFilterCat('All')}>Semua kategori</button>
          {cats.map((c:any) => <button key={c.key} type="button" className="au-chip" aria-pressed={filterCat===c.key} onClick={()=>setFilterCat(filterCat===c.key ? 'All' : c.key)}>{c.label}</button>)}
        </div>}
        {failed && <div className="au-row au-wrap p-bad" role="alert" style={{ borderRadius:14, padding:12 }}><span className="au-small" style={{ flex:1 }}>Aktivitas gagal dimuat.</span><button type="button" className="btn btn-sm" onClick={load}>Coba lagi</button></div>}

        {loading ? <div className="au-col" style={{ gap:10 }}>{[0,1,2].map(k=><div key={k} className="au-card"><div className="au-skel" style={{ width:'45%' }} /><div className="au-skel" style={{ width:'80%' }} /></div>)}</div>
          : filtered.length === 0 ? <div className="au-card"><Empty title={inYear.length ? 'Tidak ada yang cocok' : `Belum ada aktivitas di ${year}`} text={inYear.length ? 'Ubah atau reset filter.' : 'Buat aktivitas baru; otomatis tampil di Issues & Calendar.'} action={<button type="button" className="btn btn-primary" onClick={()=>setShowForm(true)}>Aktivitas baru</button>} /></div>
          : <div className="au-ig">
              {filtered.map(a => {
                const catColor = cats.find((c:any)=>c.key===a.category)?.color || 'var(--accent)'
                const statusDef = statuses.find((st:any)=>normKey(st.key)===normKey(a.status))
                const pr = PRIORITY_CFG[a.priority]
                return (
                  <button type="button" key={a._id} className="au-igr au-actrow" onClick={()=>setEditing(a)} style={{ ['--sc' as any]: statusDef?.color || catColor }}>
                    <span className="au-col" style={{ gap:6, minWidth:0, flex:1 }}>
                      <span className="au-row au-wrap" style={{ gap:6 }}>
                        <b style={{ fontSize:15 }}>{a.title}</b>
                        {a.recurrenceGroupId && <span className="au-tag" title="Agenda berulang; pengulangan lain di Calendar"><Icon name="clock" size={12} />Rutin</span>}
                      </span>
                      {a.description && <span className="au-small au-ink2" style={{ whiteSpace:'pre-wrap', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{a.description}</span>}
                      <span className="au-row au-wrap au-xs au-muted" style={{ gap:6 }}>
                        <span className="au-tag"><i style={{ background:catColor }} />{a.category}</span>
                        {a.subType && <span className="au-tag">{a.subType}</span>}
                        {a.actionDate && <span>{a.actionDate}{a.actionDateEnd && a.actionDateEnd !== a.actionDate ? ` – ${a.actionDateEnd}` : ''}</span>}
                        {a.targetWeek && <span>· {a.targetWeek}</span>}
                        {picArray(a.pic).length > 0 && <span>· {picArray(a.pic).join(', ')}</span>}
                        {a.mode === 'offline' && a.location && <span>· {a.location}</span>}
                      </span>
                    </span>
                    <span className="au-col" style={{ alignItems:'flex-end', gap:6, flexShrink:0 }}>
                      {statusDef && <span className="au-pill" style={{ background:`color-mix(in srgb, ${statusDef.color} 16%, transparent)`, color:'var(--ink)' }}><i style={{ width:8, height:8, borderRadius:3, background:statusDef.color, display:'inline-block' }} />{statusDef.label}</span>}
                      {pr && <Pill tone={pr.tone}>{pr.label}</Pill>}
                    </span>
                  </button>
                )
              })}
            </div>}
      </div>
    </div>
  )
}
