'use client'
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Empty, Icon, PageHeader, Seg, Sheet } from '@/components/ui'
import { useYear } from '@/lib/year'

const GROUPS = ['Holding','SH Upstream','SH Gas','SH C&T','SH PNRE','SH R&P','SH Shipping','Others']
const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']
const APP_COLORS = ['#4B3BFF','#7B6BFF','#0FA898','#F2A33A','#FF5D3B','#14b8a6']
function fmtDate(v:string){ if(!v||v==='Not Yet') return v||''; const [y,m]=v.split('-'); return m&&y? `${MONTHS[parseInt(m)-1]}-${y.slice(2)}` : v }

export default function GoLivePage() {
  const [apps, setApps] = useState<any[]>([])
  const [entities, setEntities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [groupFilter, setGroupFilter] = useState('all')
  const { year } = useYear()
  const [yearMode, setYearMode] = useState<'all'|'year'>('all')
  const yearFilter = yearMode === 'all' ? 'all' : String(year)
  const setYearFilter = (v:string) => setYearMode(v === 'all' ? 'all' : 'year')
  const [newApp, setNewApp] = useState<string|null>(null)
  const [confirmDelApp, setConfirmDelApp] = useState(false)
  const [pendingDel, setPendingDel] = useState<string|null>(null)
  const [q, setQ] = useState('')

  const [editApp, setEditApp] = useState<any|null>(null)
  const [exporting, setExporting] = useState<'excel'|'pdf'|null>(null)
  const [newEntityId, setNewEntityId] = useState<string|null>(null)   // sorot baris yg baru ditambah

  // Export mengikuti apa yang sedang tampil (filter grup + pencarian)
  async function doExport(kind:'excel'|'pdf') {
    if (!view.length) { toast.error('Tidak ada entitas untuk diexport'); return }
    setExporting(kind)
    const t = toast.loading(`Menyiapkan ${kind==='excel'?'Excel':'PDF'}…`)
    try {
      const parts:string[] = []
      if (groupFilter!=='all') parts.push(`Grup: ${groupFilter}`)
      if (yearFilter!=='all') parts.push(`Go-Live ${yearFilter}`)
      if (q.trim()) parts.push(`Cari: "${q.trim()}"`)
      const meta = { filterLabel: parts.join(' · ') || undefined }
      const mod = await import('@/lib/exportGoLive')
      if (kind==='excel') await mod.exportGoLiveExcel(apps, view, meta)
      else await mod.exportGoLivePdf(apps, view, meta)
      toast.success(`${kind==='excel'?'Excel':'PDF'} berhasil diunduh`, { id:t })
    } catch (e:any) {
      toast.error(`Gagal export: ${e?.message||'error'}`, { id:t })
    } finally { setExporting(null) }
  }

  async function patchApp(id:string, patch:any) {
    setApps(p=>p.map(a=>a._id===id?{...a,...patch}:a))
    try { const r = await fetch('/api/golive',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'app',id,patch})}); if (!r.ok) throw new Error() }
    catch { toast.error('Gagal menyimpan aplikasi'); load() }
  }
  async function delApp(app:any) {
    const r = await fetch(`/api/golive?kind=app&id=${app._id}`,{method:'DELETE'})
    if (!r.ok) { toast.error('Gagal menghapus aplikasi'); return }
    setApps(p=>p.filter(a=>a._id!==app._id)); setEditApp(null); setConfirmDelApp(false); toast.success('Aplikasi dihapus')
  }

  async function load() {
    setLoading(true)
    const d=await fetch('/api/golive').then(r=>r.json()).catch(()=>({apps:[],entities:[]}))
    setApps(d.apps||[]); setEntities(d.entities||[]); setLoading(false)
  }
  useEffect(()=>{ load() }, [])

  async function addEntity(){
    const r=await fetch('/api/golive',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'entity',name:'',cocd:'',group:''})})
    const d=await r.json()
    if(!r.ok){ toast.error(d.error||'Gagal menambah entitas'); return }
    // Entitas baru belum punya nama/grup/tanggal go-live, jadi akan tersaring keluar
    // kalau filter sedang aktif -> terlihat seperti "gagal tambah". Reset filter dulu.
    const adaFilter = groupFilter!=='all' || yearFilter!=='all' || !!q.trim()
    if (adaFilter){ setGroupFilter('all'); setYearMode('all'); setQ('') }
    setEntities(p=>[...p,d.data])
    setNewEntityId(d.data?._id||null)
    toast.success(adaFilter ? 'Entitas ditambahkan (filter direset agar terlihat)' : 'Entitas ditambahkan — isi namanya')
    // Gulirkan ke baris baru supaya langsung terlihat di daftar yang panjang
    setTimeout(()=>{ document.getElementById(`ent-${d.data?._id}`)?.scrollIntoView({ behavior:'smooth', block:'center' }) }, 120)
  }
  async function addApp(label:string){ if(!label.trim()) { toast.error('Nama aplikasi wajib diisi'); return } const r=await fetch('/api/golive',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'app',label:label.trim()})}); const d=await r.json().catch(()=>({})); if(r.ok){setApps(p=>[...p,d.data]);setNewApp(null);toast.success('Aplikasi ditambahkan')} else toast.error(d.error||'Gagal') }
  // Hapus entitas: ketuk sekali untuk konfirmasi, ketuk lagi untuk menghapus (tanpa dialog browser).
  async function delEntity(e:any){
    if (pendingDel !== e._id) { setPendingDel(e._id); setTimeout(()=>setPendingDel(p=>p===e._id?null:p), 3500); return }
    setPendingDel(null)
    const r = await fetch(`/api/golive?kind=entity&id=${e._id}`,{method:'DELETE'})
    if (!r.ok) { toast.error('Gagal menghapus entitas'); return }
    setEntities(p=>p.filter(x=>x._id!==e._id)); toast.success('Entitas dihapus')
  }

  async function patchEntity(id:string,patch:any){
    const sebelum = entities.find(e=>e._id===id)
    setEntities(p=>p.map(e=>e._id===id?{...e,...patch,apps:{...(e.apps||{}),...(patch.apps||{})}}:e))
    try{
      const r = await fetch('/api/golive',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'entity',id,patch})})
      if(!r.ok){
        const d = await r.json().catch(()=>null)
        throw new Error(d?.error || `Server error ${r.status}`)
      }
    }catch(err:any){
      // Kembalikan tampilan ke kondisi sebelumnya supaya tidak terlihat "tersimpan" padahal gagal
      if (sebelum) setEntities(p=>p.map(e=>e._id===id?sebelum:e))
      toast.error('Gagal menyimpan: '+(err?.message||'coba lagi'))
    }
  }
  function setSub(e:any,appKey:string,subKey:string,val:boolean){ const cur=(e.apps||{})[appKey]||{}; const subs={...(cur.subs||{}), [subKey]:val}; const anyDone=Object.values(subs).some(Boolean); patchEntity(e._id,{apps:{...(e.apps||{}), [appKey]:{...cur,subs,done:anyDone}}}) }
  function setAppDate(e:any,appKey:string,date:string){
    const cur=(e.apps||{})[appKey]||{}
    patchEntity(e._id,{apps:{...(e.apps||{}), [appKey]:{...cur,date}}})
    // Kalau filter tahun aktif dan tanggal barunya tahun lain, baris akan hilang
    // dari tampilan. Beri tahu supaya tidak dikira gagal tersimpan.
    if (yearFilter!=='all' && date && yearOf(date)!==yearFilter) {
      toast(`Tersimpan. Baris disembunyikan karena filter "Go-Live ${yearFilter}" aktif.`)
    }
  }

  // ── Filter tahun go-live ──
  // Tanggal go-live disimpan per aplikasi di e.apps[key].date (format 'YYYY-MM').
  // yearFilter='all' -> semua entitas. Kalau tahun dipilih, entitas tampil bila
  // ADA aplikasi yang go-live di tahun itu.
  const yearOf = (d?:string) => { const m = /^(\d{4})-\d{2}$/.exec(String(d||'')); return m ? m[1] : '' }
  const liveYears = (e:any) => { const s = new Set<string>(); Object.values(e.apps||{}).forEach((ap:any)=>{ const y = yearOf(ap?.date); if (y) s.add(y) }); return s }
  // Daftar tahun yang benar-benar ada datanya (urut terbaru dulu)
  const yearOptions = useMemo(()=>{
    const s = new Set<string>()
    entities.forEach(e=>liveYears(e).forEach(y=>s.add(y)))
    return Array.from(s).sort((a,b)=>b.localeCompare(a))
  },[entities])

  const view = useMemo(()=>entities
    .filter(e=>groupFilter==='all'||e.group===groupFilter)
    .filter(e=>yearFilter==='all'||liveYears(e).has(yearFilter))
    .filter(e=>!q.trim()||(e.name||'').toLowerCase().includes(q.toLowerCase())||String(e.cocd||'').includes(q))
  ,[entities,groupFilter,yearFilter,q])

  // Summary per aplikasi. Kalau tahun dipilih: hitung entitas yang go-live DI TAHUN ITU.
  const summary = useMemo(()=>apps.map((a:any,i:number)=>{
    const done = entities.filter(e=>{
      const ap=(e.apps||{})[a.key]
      if (yearFilter!=='all') return yearOf(ap?.date)===yearFilter
      return ap?.done || (ap?.subs && Object.values(ap.subs).some(Boolean))
    }).length
    return {...a, done, color:APP_COLORS[i%6]}
  }),[apps,entities,yearFilter])

  // Total entitas yang go-live (aplikasi apa pun) di tahun terpilih
  const yearTotal = useMemo(()=> yearFilter==='all' ? entities.length : entities.filter(e=>liveYears(e).has(yearFilter)).length
  ,[entities,yearFilter])

  // Lapisan: header beku (6) > header biasa (5) > body beku (3) > body biasa (auto)
  const th:React.CSSProperties={padding:'8px 8px',font:'500 10.5px var(--mono)',color:'var(--muted)',textTransform:'uppercase',letterSpacing:'.05em',background:'var(--surface)',borderBottom:'1px solid var(--line)',whiteSpace:'nowrap',textAlign:'center',position:'sticky',top:0,zIndex:5}
  const td:React.CSSProperties={padding:'6px 8px',fontSize:13,borderBottom:'1px solid var(--line)',verticalAlign:'middle'}

  // ── Freeze pane: kolom identitas (No…Client) menempel saat scroll ke kanan ──
  // Lebar kolom ditentukan browser (table layout auto), jadi offset TIDAK boleh
  // di-hardcode — harus diukur dari elemen aslinya, kalau tidak kolom bisa
  // tumpang tindih saat digeser.
  const ID_COUNT = 5
  const idRefs = useRef<(HTMLTableCellElement|null)[]>([])
  const headRow1 = useRef<HTMLTableRowElement|null>(null)
  const [idLeft, setIdLeft] = useState<number[]>(()=>Array(ID_COUNT).fill(0))
  const [row1H, setRow1H] = useState(0)   // tinggi baris header pertama

  useLayoutEffect(()=>{
    const measure = () => {
      const w = idRefs.current.slice(0,ID_COUNT).map(el=>el?.offsetWidth ?? 0)
      const next:number[] = []
      let acc = 0
      for (let i=0;i<ID_COUNT;i++){ next.push(acc); acc += w[i] }
      setIdLeft(prev => prev.length===next.length && prev.every((v,i)=>v===next[i]) ? prev : next)
      const h = headRow1.current?.offsetHeight ?? 0
      setRow1H(prev => prev===h ? prev : h)
    }
    measure()
    const ro = typeof ResizeObserver!=='undefined' ? new ResizeObserver(measure) : null
    idRefs.current.slice(0,ID_COUNT).forEach(el=>{ if(el&&ro) ro.observe(el) })
    if (headRow1.current && ro) ro.observe(headRow1.current)
    window.addEventListener('resize', measure)
    return ()=>{ ro?.disconnect(); window.removeEventListener('resize', measure) }
  },[apps, view.length, loading])

  const isLastFrozen = (i:number) => i===ID_COUNT-1
  const edge = (i:number):React.CSSProperties => isLastFrozen(i)
    ? { borderRight:'1px solid var(--line2)', boxShadow:'6px 0 10px -8px rgba(11,13,23,.25)' } : {}
  // Header beku: menempel atas DAN kiri -> z-index paling tinggi
  const thFreeze = (i:number):React.CSSProperties => ({ ...th, position:'sticky', top:0, left:idLeft[i], zIndex:6, ...edge(i) })
  // Body beku: latar solid supaya kolom lain tidak menembus saat digeser
  const tdFreeze = (i:number, even:boolean, hl=false):React.CSSProperties => ({ ...td, position:'sticky', left:idLeft[i], zIndex:3, background: hl ? 'var(--accent-soft)' : (even?'var(--surface)':'var(--sunken)'), ...edge(i) })
  const totalSubs = apps.reduce((s:number,a:any)=>(a.subFeatures||[]).length + 1 + s, 0) // +1 for date col

  return (
    <div className="au-page">
      <div className="au-view au-anim">
        <PageHeader eyebrow={`Activities · ${entities.length} entitas · ${apps.length} aplikasi`} title="Go-Live" actions={<>
          <button type="button" onClick={()=>doExport('excel')} disabled={!!exporting||view.length===0} className="btn btn-ghost" title="Export tabel ke Excel"><Icon name="file" size={15} />{exporting==='excel'?'Menyiapkan…':'Excel'}</button>
          <button type="button" onClick={()=>doExport('pdf')} disabled={!!exporting||view.length===0} className="btn btn-ghost" title="Export ke PDF"><Icon name="file" size={15} />{exporting==='pdf'?'Menyiapkan…':'PDF'}</button>
          <button type="button" onClick={()=>setNewApp('')} className="btn"><Icon name="plus" size={15} />Aplikasi</button>
          <button type="button" onClick={addEntity} className="btn btn-primary"><Icon name="plus" size={16} stroke={2.2} />Entitas</button>
        </>} />
        <div className="au-grid au-tiles" style={{ gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))' }}>
          {summary.map((a:any)=>{ const denom=yearFilter==='all'?entities.length:yearTotal; const pct=denom>0?Math.round(a.done/denom*100):0; return (
            <button type="button" key={a._id||a.key} className="au-tile" onClick={()=>setEditApp({...a})} title="Edit aplikasi & sub-fitur">
              <span className="au-row au-between"><span className="lbl">{a.label}</span><span className="au-xs au-muted">{pct}%</span></span>
              <b className="v" style={{ color:a.color }}>{a.done}<small style={{ fontSize:14, color:'var(--muted)', fontWeight:600 }}> / {denom}</small></b>
              <span className="au-track" style={{ height:8 }}><i className="a" style={{ width:`${pct}%`, background:a.color }} /></span>
              <span className="l au-xs">{yearFilter!=='all' ? `go-live di ${yearFilter}` : 'sudah go-live'}</span>
            </button>
          )})}
        </div>
        <div className="au-row au-wrap" style={{ gap:8 }}>
          <label className="input au-row" style={{ gap:8, padding:'0 12px', flex:'1 1 220px', maxWidth:320 }}><Icon name="search" size={16} />
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Cari entitas / CoCd" aria-label="Cari entitas" style={{ border:0, background:'transparent', flex:1, minHeight:40, outline:0, color:'var(--ink)' }} /></label>
          <select className="input" value={groupFilter} onChange={e=>setGroupFilter(e.target.value)} style={{ width:'auto', minWidth:160 }} aria-label="Filter grup">
            <option value="all">Semua grup</option>{GROUPS.map(g=><option key={g} value={g}>{g}</option>)}
          </select>
          <Seg label="Tahun go-live" value={yearMode} onChange={setYearMode} options={[['all','Semua tahun'],['year',`Go-live ${year}`]] as const} />
          <span className="au-xs au-muted">{view.length} entitas{yearFilter!=='all' ? ` · ${yearTotal} go-live di ${yearFilter}` : ''}{yearOptions.length ? ` · ada data: ${yearOptions.join(', ')}` : ''}</span>
        </div>
        {yearFilter!=='all' && <span className="au-xs au-muted" style={{ marginTop:-8 }}>Kolom aplikasi yang go-live di tahun lain ditampilkan samar.</span>}

        {loading?<div className="au-card"><div className="au-skel" /><div className="au-skel" style={{ width:'70%' }} /></div>:(
        <div className="au-tblw" style={{overflow:'auto',maxHeight:'calc(100dvh - 330px)', minHeight:260}}>
          <table style={{borderCollapse:'collapse',width:'100%',minWidth:600+totalSubs*70}}>
            <thead>
              {/* Row 1: app group headers */}
              <tr ref={headRow1}>
                <th ref={el=>{idRefs.current[0]=el}} style={{...thFreeze(0),width:30}} rowSpan={2}>No</th>
                <th ref={el=>{idRefs.current[1]=el}} style={{...thFreeze(1),minWidth:260,textAlign:'left'}} rowSpan={2}>Company</th>
                <th ref={el=>{idRefs.current[2]=el}} style={{...thFreeze(2),width:52}} rowSpan={2}>CoCd</th>
                <th ref={el=>{idRefs.current[3]=el}} style={{...thFreeze(3),width:100,textAlign:'left'}} rowSpan={2}>HSH</th>
                <th ref={el=>{idRefs.current[4]=el}} style={{...thFreeze(4),width:70,textAlign:'left'}} rowSpan={2}>Client</th>
                {apps.map((a:any,ai:number)=>{
                  const subs=(a.subFeatures||[]); const cols=subs.length+1; // subs + date
                  const color=APP_COLORS[ai%6]
                  return <th key={a._id||a.key} style={{...th,borderLeft:'1px solid var(--line2)',color:`color-mix(in srgb, ${color} 62%, var(--ink))`,cursor:'pointer'}} colSpan={cols} onClick={()=>setEditApp({...a})} title="Klik untuk edit aplikasi & sub-fitur">{a.label} <Icon name="pnote" size={11} /></th>
                })}
                <th style={{...th,width:30}} rowSpan={2}></th>
              </tr>
              {/* Row 2: sub-feature headers — menempel DI BAWAH baris 1, bukan menimpanya */}
              <tr>
                {apps.map((a:any)=>{const subs=(a.subFeatures||[]); return(
                  <Fragment key={a._id||a.key}>
                    <th style={{...th,top:row1H,borderLeft:'1px solid var(--line2)',width:150}}>Tgl</th>
                    {subs.map((sf:any)=><th key={sf.key} style={{...th,top:row1H,width:56}}>{sf.label}</th>)}
                  </Fragment>
                )})}
              </tr>
            </thead>
            <tbody>
              {view.map((e:any,i:number)=>{const even=i%2===0; const hl=e._id===newEntityId; return(
                <tr key={e._id} id={`ent-${e._id}`} style={{background: e._id===newEntityId ? 'var(--accent-soft)' : (even?'transparent':'var(--sunken)')}}>
                  <td style={{...tdFreeze(0,even,hl),textAlign:'center',color:'var(--muted)',fontSize:11}}>{i+1}</td>
                  <td style={tdFreeze(1,even,hl)}><input defaultValue={e.name||''} placeholder="—" onBlur={ev=>{if(ev.target.value!==e.name) patchEntity(e._id,{name:ev.target.value})}} aria-label="Nama entitas" style={{width:'100%',border:'none',background:'transparent',fontSize:13,fontWeight:600,color:'var(--ink)',padding:'4px 0',outline:'none'}}/></td>
                  <td style={{...tdFreeze(2,even,hl),textAlign:'center'}}><input defaultValue={e.cocd||''} onBlur={ev=>{if(ev.target.value!==e.cocd) patchEntity(e._id,{cocd:ev.target.value})}} aria-label="CoCd" style={{width:52,border:'none',background:'transparent',fontSize:12.5,color:'var(--ink2)',padding:'4px 0',outline:'none',textAlign:'center'}}/></td>
                  <td style={tdFreeze(3,even,hl)}><select value={e.group||''} onChange={ev=>patchEntity(e._id,{group:ev.target.value})} aria-label="Grup" style={{width:'100%',border:'1px solid var(--line)',borderRadius:8,padding:'4px 6px',fontSize:12,background:'var(--surface)',color:'var(--ink)'}}><option value="">—</option>{GROUPS.map(g=><option key={g} value={g}>{g}</option>)}</select></td>
                  <td style={{...tdFreeze(4,even,hl),fontSize:10.5}}>
                    <input defaultValue={e.client||''} placeholder="—" onBlur={ev=>{if(ev.target.value!==(e.client||'')) patchEntity(e._id,{client:ev.target.value})}} aria-label="Client" style={{width:60,border:'none',background:'transparent',fontSize:12,color:'var(--ink2)',padding:'4px 0',outline:'none'}}/>
                  </td>
                  {apps.map((a:any,ai:number)=>{const ap=(e.apps||{})[a.key]||{}; const subs=(a.subFeatures||[]); const color=APP_COLORS[ai%6]; const dateStr=ap.date||'';
                    // Saat filter tahun aktif, redupkan aplikasi yang go-live di tahun LAIN
                    // supaya jelas kolom mana yang relevan dgn tahun terpilih.
                    const offYear = yearFilter!=='all' && yearOf(dateStr)!==yearFilter
                    return(
                    <Fragment key={a._id||a.key}>
                      <td style={{...td,borderLeft:'1px solid var(--line2)',textAlign:'center',padding:'4px',opacity:offYear?0.28:1}} title={offYear?`Go-live di tahun lain (${yearOf(dateStr)||'belum diisi'})`:undefined}>
                        <input type="month" value={dateStr!=='Not Yet'?dateStr:''} onChange={ev=>setAppDate(e,a.key,ev.target.value)}
                          aria-label={`Tanggal go-live ${a.label} ${e.name||''}`} style={{width:146,border:'1px solid var(--line)',borderRadius:8,padding:'4px 6px',fontSize:11.5,background:dateStr&&dateStr!=='Not Yet'?`color-mix(in srgb, ${color} 10%, var(--surface))`:'var(--surface)',color:dateStr&&dateStr!=='Not Yet'?'var(--ink)':'var(--muted)',fontWeight:dateStr&&dateStr!=='Not Yet'?700:400,outline:'none',cursor:'pointer'}} />
                      </td>
                      {subs.map((sf:any)=>{const checked=!!(ap.subs||{})[sf.key]; return(
                        <td key={sf.key} style={{...td,textAlign:'center',padding:'3px 2px',opacity:offYear?0.28:1}}>
                          <input type="checkbox" className="au-chk" aria-label={`${sf.label} ${a.label} ${e.name||''}`} checked={checked} onChange={ev=>setSub(e,a.key,sf.key,ev.target.checked)} style={{width:20,height:20,borderRadius:6}}/>
                        </td>
                      )})}
                    </Fragment>
                  )})}
                  <td style={{...td,textAlign:'center'}}><button type="button" onClick={()=>delEntity(e)} className={`btn btn-sm${pendingDel===e._id?' btn-danger':' btn-icon'}`} aria-label={pendingDel===e._id ? `Konfirmasi hapus ${e.name||'entitas'}` : `Hapus ${e.name||'entitas'}`} style={pendingDel===e._id?undefined:{color:'var(--bad)'}}>{pendingDel===e._id ? 'Hapus?' : <Icon name="trash" size={14} />}</button></td>
                </tr>
              )})}
              {view.length===0&&<tr><td colSpan={5+totalSubs+apps.length+1}><Empty title={entities.length ? 'Tidak ada yang cocok' : 'Belum ada entitas'} text={entities.length ? 'Ubah pencarian, grup atau tahun.' : 'Tambah entitas untuk mulai mencatat go-live.'} /></td></tr>}
            </tbody>
          </table>
        </div>
        )}
      </div>

      {editApp && (
        <Sheet open title="Edit aplikasi" onClose={()=>{ setEditApp(null); setConfirmDelApp(false) }} onSave={async ()=>{
          if (!String(editApp.label||'').trim()) { toast.error('Nama aplikasi wajib diisi'); return }
          const patch = { label: editApp.label, subFeatures: (editApp.subFeatures||[]).filter((sf:any)=>sf.label?.trim()).map((sf:any,i:number)=>({...sf, key:sf.key||sf.label.toLowerCase().replace(/[^a-z0-9]+/g,'-'), order:i+1})) }
          await patchApp(editApp._id, patch); setEditApp(null); toast.success('Aplikasi diperbarui')
        }}>
          <label className="au-col" style={{ gap:6 }}><span className="lbl">Nama aplikasi</span><input className="input" value={editApp.label||''} onChange={ev=>setEditApp((p:any)=>({...p,label:ev.target.value}))} /></label>
          <div className="au-col" style={{ gap:8 }}><span className="lbl">Sub-fitur (kolom centang)</span>
            {(editApp.subFeatures||[]).map((sf:any, i:number)=>(
              <div key={sf.key||i} className="au-row" style={{ gap:8 }}>
                <input className="input" value={sf.label||''} aria-label={`Sub-fitur ${i+1}`} onChange={ev=>{ const next=[...(editApp.subFeatures||[])]; next[i]={...next[i],label:ev.target.value}; setEditApp((p:any)=>({...p,subFeatures:next})) }} placeholder="Nama sub-fitur" />
                <button type="button" aria-label="Hapus sub-fitur" onClick={()=>{ const next=(editApp.subFeatures||[]).filter((_:any,j:number)=>j!==i); setEditApp((p:any)=>({...p,subFeatures:next})) }} className="btn btn-icon btn-sm" style={{ color:'var(--bad)' }}><Icon name="x" size={14} /></button>
              </div>
            ))}
            <button type="button" onClick={()=>{ const key='sf'+Date.now().toString(36); const next=[...(editApp.subFeatures||[]),{key,label:'',order:(editApp.subFeatures||[]).length+1}]; setEditApp((p:any)=>({...p,subFeatures:next})) }} className="btn btn-sm" style={{ alignSelf:'flex-start' }}><Icon name="plus" size={13} />Sub-fitur</button>
          </div>
          {confirmDelApp
            ? <div className="au-row au-wrap p-bad" style={{ borderRadius:14, padding:12, gap:8 }}><span className="au-small" style={{ flex:1 }}>Hapus “{editApp.label}” beserta semua data centangnya?</span><button type="button" className="btn btn-sm" onClick={()=>setConfirmDelApp(false)}>Batal</button><button type="button" className="btn btn-danger btn-sm" onClick={()=>delApp(editApp)}>Ya, hapus</button></div>
            : <button type="button" onClick={()=>setConfirmDelApp(true)} className="btn btn-danger" style={{ alignSelf:'flex-start' }}><Icon name="trash" size={15} />Hapus aplikasi</button>}
        </Sheet>
      )}
      {newApp !== null && (
        <Sheet open title="Aplikasi baru" onClose={()=>setNewApp(null)} onSave={()=>addApp(newApp)} saveLabel="Tambah">
          <label className="au-col" style={{ gap:6 }}><span className="lbl">Nama aplikasi</span><input className="input" value={newApp} onChange={e=>setNewApp(e.target.value)} onKeyDown={e=>{ if (e.key==='Enter') addApp(newApp) }} placeholder="Mis. iPROVE" /></label>
        </Sheet>
      )}
    </div>
  )
}
