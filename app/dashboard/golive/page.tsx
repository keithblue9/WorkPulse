'use client'
import { Fragment, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'

const GROUPS = ['Holding','SH Upstream','SH Gas','SH C&T','SH PNRE','SH R&P','SH Shipping','Others']
const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']
function fmtDate(v:string){ if(!v||v==='Not Yet') return v||''; const [y,m]=v.split('-'); return m&&y? `${MONTHS[parseInt(m)-1]}-${y.slice(2)}` : v }

export default function GoLivePage() {
  const [apps, setApps] = useState<any[]>([])
  const [entities, setEntities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [groupFilter, setGroupFilter] = useState('all')
  const [yearFilter, setYearFilter] = useState('all')
  const [q, setQ] = useState('')

  const [seeding, setSeeding] = useState(false)
  const [editApp, setEditApp] = useState<any|null>(null)
  const [exporting, setExporting] = useState<'excel'|'pdf'|null>(null)

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
    try { await fetch('/api/golive',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'app',id,patch})}) }
    catch { toast.error('Gagal') }
  }
  async function delApp(app:any) {
    if(!confirm(`Hapus aplikasi "${app.label}" beserta semua data centangnya?`)) return
    await fetch(`/api/golive?kind=app&id=${app._id}`,{method:'DELETE'})
    setApps(p=>p.filter(a=>a._id!==app._id)); setEditApp(null); toast.success('App dihapus')
  }

  async function doSeed() {
    setSeeding(true)
    try {
      const sr = await fetch('/api/golive/seed', { method:'POST' })
      const sd = await sr.json()
      if (!sr.ok) { toast.error(sd.error || 'Seed gagal'); setSeeding(false); return }
      toast.success(`Berhasil import ${sd.entities} entitas`)
      await load()
    } catch { toast.error('Seed gagal') }
    setSeeding(false)
  }

  async function load() {
    setLoading(true)
    const d=await fetch('/api/golive').then(r=>r.json()).catch(()=>({apps:[],entities:[]}))
    setApps(d.apps||[]); setEntities(d.entities||[]); setLoading(false)
  }
  useEffect(()=>{ load() }, [])

  async function addEntity(){ const r=await fetch('/api/golive',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'entity',name:'',cocd:'',group:''})}); const d=await r.json(); if(r.ok) setEntities(p=>[...p,d.data]); else toast.error(d.error||'Gagal') }
  async function addApp(){ const label=prompt('Nama aplikasi baru:'); if(!label?.trim()) return; const r=await fetch('/api/golive',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'app',label:label.trim()})}); const d=await r.json(); if(r.ok){setApps(p=>[...p,d.data]);toast.success('App ditambahkan')} else toast.error(d.error||'Gagal') }
  async function delEntity(e:any){ if(!confirm(`Hapus "${e.name||'(kosong)'}"?`)) return; await fetch(`/api/golive?kind=entity&id=${e._id}`,{method:'DELETE'}); setEntities(p=>p.filter(x=>x._id!==e._id)) }

  async function patchEntity(id:string,patch:any){ setEntities(p=>p.map(e=>e._id===id?{...e,...patch,apps:{...(e.apps||{}),...(patch.apps||{})}}:e)); try{await fetch('/api/golive',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'entity',id,patch})})}catch{toast.error('Gagal')} }
  function setSub(e:any,appKey:string,subKey:string,val:boolean){ const cur=(e.apps||{})[appKey]||{}; const subs={...(cur.subs||{}), [subKey]:val}; const anyDone=Object.values(subs).some(Boolean); patchEntity(e._id,{apps:{...(e.apps||{}), [appKey]:{...cur,subs,done:anyDone}}}) }
  function setAppDate(e:any,appKey:string,date:string){ const cur=(e.apps||{})[appKey]||{}; patchEntity(e._id,{apps:{...(e.apps||{}), [appKey]:{...cur,date}}}) }

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
    return {...a, done, color:['#4f8ef7','#8b5cf6','#22c55e','#f59e0b','#ec4899','#14b8a6'][i%6]}
  }),[apps,entities,yearFilter])

  // Total entitas yang go-live (aplikasi apa pun) di tahun terpilih
  const yearTotal = useMemo(()=> yearFilter==='all' ? entities.length : entities.filter(e=>liveYears(e).has(yearFilter)).length
  ,[entities,yearFilter])

  const th:React.CSSProperties={padding:'6px 8px',fontSize:9.5,fontWeight:700,color:'var(--text3)',textTransform:'uppercase',letterSpacing:0.3,background:'var(--bg2)',borderBottom:'2px solid var(--border)',whiteSpace:'nowrap',textAlign:'center',position:'sticky',top:0,zIndex:2}
  const td:React.CSSProperties={padding:'4px 6px',fontSize:11.5,borderBottom:'1px solid var(--border)',verticalAlign:'middle'}

  // ── Freeze pane: kolom identitas (No…Client) menempel saat scroll ke kanan ──
  // Offset kiri dihitung kumulatif dari lebar kolom sebelumnya.
  const ID_W = [30, 280, 52, 100, 60]                                  // No, Company, CoCd, HSH, Client
  const ID_LEFT = ID_W.reduce<number[]>((acc,w,i)=>[...acc, i===0?0:acc[i-1]+ID_W[i-1]], [])
  const FROZEN_W = ID_W.reduce((a,b)=>a+b,0)
  // Garis pemisah di kolom terakhir yang dibekukan
  const edge = (i:number):React.CSSProperties => i===ID_W.length-1 ? { boxShadow:'2px 0 4px -1px rgba(0,0,0,0.12)', borderRight:'2px solid var(--border)' } : {}
  // Sel header beku (perlu z-index lebih tinggi: menempel atas DAN kiri)
  const thFreeze = (i:number):React.CSSProperties => ({ ...th, position:'sticky', top:0, left:ID_LEFT[i], zIndex:5, ...edge(i) })
  // Sel body beku — latar harus solid supaya isi kolom lain tidak menembus saat digeser
  const tdFreeze = (i:number, even:boolean):React.CSSProperties => ({ ...td, position:'sticky', left:ID_LEFT[i], zIndex:1, background: even?'var(--bg)':'var(--bg2)', ...edge(i) })
  const totalSubs = apps.reduce((s:number,a:any)=>(a.subFeatures||[]).length + 1 + s, 0) // +1 for date col

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <div style={{padding:'12px 20px',borderBottom:'1px solid var(--border)',background:'var(--bg2)',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap',flexShrink:0}}>
        <div><div style={{fontSize:14,fontWeight:600}}>🚀 Go-Live</div><div style={{fontSize:11,color:'var(--text3)'}}>Status go-live entitas per aplikasi · sub-fitur + tanggal</div></div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          {entities.length===0 && !loading && <button onClick={doSeed} disabled={seeding} className="btn btn-sm" style={{background:'#f59e0b',color:'#fff',border:'none'}}>{seeding?'Importing…':'📥 Import dari Excel'}</button>}
          <button onClick={()=>doExport('excel')} disabled={!!exporting||view.length===0} className="btn btn-sm" title="Export tabel ke Excel (data asli, bisa difilter)">
            {exporting==='excel'?'⏳ Excel…':'📊 Excel'}
          </button>
          <button onClick={()=>doExport('pdf')} disabled={!!exporting||view.length===0} className="btn btn-sm" title="Export ke PDF (rapi, otomatis banyak halaman)">
            {exporting==='pdf'?'⏳ PDF…':'📄 PDF'}
          </button>
          <button onClick={addApp} className="btn btn-sm">+ App</button>
          <button onClick={addEntity} className="btn btn-primary btn-sm">+ Entitas</button>
        </div>
      </div>

      <div style={{flex:1,overflow:'auto',padding:'16px 20px'}}>
        {/* Summary */}
        {yearFilter!=='all' && (
          <div className="card" style={{padding:'10px 14px',marginBottom:10,borderLeft:'3px solid var(--brand)',display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
            <span style={{fontSize:12}}>📅 Ada go-live di tahun <b>{yearFilter}</b>:</span>
            <span style={{fontSize:20,fontWeight:800,color:'var(--brand)'}}>{yearTotal}</span>
            <span style={{fontSize:11.5,color:'var(--text3)'}}>entitas dari total {entities.length}</span>
            <span style={{fontSize:10.5,color:'var(--text3)',flexBasis:'100%'}}>Kolom aplikasi yang go-live di tahun lain ditampilkan samar — yang pekat = go-live {yearFilter}.</span>
            <button onClick={()=>setYearFilter('all')} className="btn btn-sm" style={{marginLeft:'auto',fontSize:10.5}}>Tampilkan semua tahun</button>
          </div>
        )}
        <div style={{display:'flex',gap:10,marginBottom:14,flexWrap:'wrap'}}>
          {summary.map((a:any)=>{const denom=yearFilter==='all'?entities.length:yearTotal; const pct=denom>0?Math.round(a.done/denom*100):0; return(
            <div key={a._id||a.key} className="card" style={{padding:'10px 14px',flex:'1 1 140px',minWidth:140,borderLeft:`3px solid ${a.color}`}}>
              <div style={{fontSize:10,fontWeight:700,color:'var(--text3)',textTransform:'uppercase',letterSpacing:0.3,marginBottom:3}}>{a.label}</div>
              <div style={{display:'flex',alignItems:'baseline',gap:5}}><span style={{fontSize:22,fontWeight:800,color:a.color}}>{a.done}</span><span style={{fontSize:10.5,color:'var(--text3)'}}>/ {denom}</span></div>
              <div style={{height:4,background:'var(--bg3)',borderRadius:2,overflow:'hidden',marginTop:5}}><div style={{width:`${pct}%`,height:'100%',background:a.color,transition:'width .3s'}}/></div>
              {yearFilter!=='all' && <div style={{fontSize:9.5,color:'var(--text3)',marginTop:3}}>go-live di {yearFilter}</div>}
            </div>
          )})}
        </div>

        {/* Filter */}
        <div style={{display:'flex',gap:8,marginBottom:10,flexWrap:'wrap',alignItems:'center'}}>
          <input className="input" placeholder="🔍 Cari entitas / CoCd…" value={q} onChange={e=>setQ(e.target.value)} style={{maxWidth:220,fontSize:12}}/>
          <select className="input" value={groupFilter} onChange={e=>setGroupFilter(e.target.value)} style={{maxWidth:170,fontSize:12}}>
            <option value="all">Semua Grup</option>{GROUPS.map(g=><option key={g} value={g}>{g}</option>)}
          </select>
          <select className="input" value={yearFilter} onChange={e=>setYearFilter(e.target.value)} style={{maxWidth:150,fontSize:12}} title="Lihat entitas yang go-live di tahun tertentu">
            <option value="all">Semua Tahun</option>{yearOptions.map(y=><option key={y} value={y}>Go-Live {y}</option>)}
          </select>
          <span style={{fontSize:11,color:'var(--text3)'}}>{view.length} entitas</span>
        </div>

        {loading?<div style={{fontSize:12,color:'var(--text3)'}}>Memuat…</div>:(
        <div className="card" style={{padding:0,overflow:'auto',maxHeight:'calc(100vh - 300px)'}}>
          <table style={{borderCollapse:'collapse',width:'100%',minWidth:FROZEN_W+80+totalSubs*70}}>
            <thead>
              {/* Row 1: app group headers */}
              <tr>
                <th style={{...thFreeze(0),width:ID_W[0]}} rowSpan={2}>No</th>
                <th style={{...thFreeze(1),width:ID_W[1],minWidth:ID_W[1],maxWidth:ID_W[1],textAlign:'left'}} rowSpan={2}>Company</th>
                <th style={{...thFreeze(2),width:ID_W[2]}} rowSpan={2}>CoCd</th>
                <th style={{...thFreeze(3),width:ID_W[3],textAlign:'left'}} rowSpan={2}>HSH</th>
                <th style={{...thFreeze(4),width:ID_W[4],textAlign:'left'}} rowSpan={2}>Client</th>
                {apps.map((a:any,ai:number)=>{
                  const subs=(a.subFeatures||[]); const cols=subs.length+1; // subs + date
                  const color=['#4f8ef7','#8b5cf6','#22c55e','#f59e0b','#ec4899','#14b8a6'][ai%6]
                  return <th key={a._id||a.key} style={{...th,borderLeft:'2px solid var(--border)',color,cursor:'pointer'}} colSpan={cols} onClick={()=>setEditApp({...a})} title="Klik untuk edit app & sub-fitur">{a.label} <span style={{fontSize:8,opacity:0.6}}>✎</span></th>
                })}
                <th style={{...th,width:30}} rowSpan={2}></th>
              </tr>
              {/* Row 2: sub-feature headers */}
              <tr>
                {apps.map((a:any)=>{const subs=(a.subFeatures||[]); return(
                  <Fragment key={a._id||a.key}>
                    <th style={{...th,borderLeft:'2px solid var(--border)',width:110,fontSize:9}}>Tgl</th>
                    {subs.map((sf:any)=><th key={sf.key} style={{...th,width:48,fontSize:9}}>{sf.label}</th>)}
                  </Fragment>
                )})}
              </tr>
            </thead>
            <tbody>
              {view.map((e:any,i:number)=>{const even=i%2===0; return(
                <tr key={e._id} style={{background:even?'transparent':'var(--bg2)'}}>
                  <td style={{...tdFreeze(0,even),textAlign:'center',color:'var(--text3)',fontSize:10}}>{i+1}</td>
                  <td style={tdFreeze(1,even)}><input defaultValue={e.name||''} placeholder="—" onBlur={ev=>{if(ev.target.value!==e.name) patchEntity(e._id,{name:ev.target.value})}} style={{width:'100%',border:'none',background:'transparent',fontSize:11.5,fontWeight:600,color:'var(--text)',padding:0,outline:'none'}}/></td>
                  <td style={{...tdFreeze(2,even),textAlign:'center'}}><input defaultValue={e.cocd||''} onBlur={ev=>{if(ev.target.value!==e.cocd) patchEntity(e._id,{cocd:ev.target.value})}} style={{width:48,border:'none',background:'transparent',fontSize:11,color:'var(--text2)',padding:0,outline:'none',textAlign:'center'}}/></td>
                  <td style={tdFreeze(3,even)}><select value={e.group||''} onChange={ev=>patchEntity(e._id,{group:ev.target.value})} style={{width:'100%',border:'1px solid var(--border)',borderRadius:4,padding:'2px 4px',fontSize:10.5,background:'var(--bg)',color:'var(--text)'}}><option value="">—</option>{GROUPS.map(g=><option key={g} value={g}>{g}</option>)}</select></td>
                  <td style={{...tdFreeze(4,even),fontSize:10.5}}>
                    <input defaultValue={e.client||''} placeholder="—" onBlur={ev=>{if(ev.target.value!==(e.client||'')) patchEntity(e._id,{client:ev.target.value})}} style={{width:56,border:'none',background:'transparent',fontSize:10.5,color:'var(--text2)',padding:0,outline:'none'}}/>
                  </td>
                  {apps.map((a:any,ai:number)=>{const ap=(e.apps||{})[a.key]||{}; const subs=(a.subFeatures||[]); const color=['#4f8ef7','#8b5cf6','#22c55e','#f59e0b','#ec4899','#14b8a6'][ai%6]; const dateStr=ap.date||'';
                    // Saat filter tahun aktif, redupkan aplikasi yang go-live di tahun LAIN
                    // supaya jelas kolom mana yang relevan dgn tahun terpilih.
                    const offYear = yearFilter!=='all' && yearOf(dateStr)!==yearFilter
                    return(
                    <Fragment key={a._id||a.key}>
                      <td style={{...td,borderLeft:'2px solid var(--border)',textAlign:'center',padding:'3px 4px',opacity:offYear?0.28:1}} title={offYear?`Go-live di tahun lain (${yearOf(dateStr)||'belum diisi'})`:undefined}>
                        <input type="month" value={dateStr!=='Not Yet'?dateStr:''} onChange={ev=>setAppDate(e,a.key,ev.target.value)}
                          style={{width:110,border:'1px solid var(--border)',borderRadius:4,padding:'2px 4px',fontSize:10,background:dateStr&&dateStr!=='Not Yet'?`${color}11`:'var(--bg)',color:dateStr&&dateStr!=='Not Yet'?color:'var(--text3)',fontWeight:dateStr&&dateStr!=='Not Yet'?700:400,outline:'none',cursor:'pointer'}} />
                      </td>
                      {subs.map((sf:any)=>{const checked=!!(ap.subs||{})[sf.key]; return(
                        <td key={sf.key} style={{...td,textAlign:'center',padding:'3px 2px',opacity:offYear?0.28:1}}>
                          <input type="checkbox" checked={checked} onChange={ev=>setSub(e,a.key,sf.key,ev.target.checked)} style={{width:14,height:14,cursor:'pointer',accentColor:color}}/>
                        </td>
                      )})}
                    </Fragment>
                  )})}
                  <td style={{...td,textAlign:'center'}}><button onClick={()=>delEntity(e)} className="btn btn-icon btn-sm" style={{color:'var(--red)',fontSize:10,opacity:0.5}}>🗑</button></td>
                </tr>
              )})}
              {view.length===0&&<tr><td colSpan={5+totalSubs+apps.length+1} style={{padding:24,textAlign:'center',fontSize:12,color:'var(--text3)'}}>Belum ada entitas.</td></tr>}
            </tbody>
          </table>
        </div>
        )}
      </div>

      {/* Edit App Modal */}
      {editApp && (
        <div className="modal-overlay" onClick={ev=>{if(ev.target===ev.currentTarget) setEditApp(null)}}>
          <div className="modal" style={{width:420,maxWidth:'100%'}}>
            <div style={{padding:'14px 18px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontSize:14,fontWeight:700}}>Edit Aplikasi</span>
              <button onClick={()=>setEditApp(null)} className="btn btn-icon">×</button>
            </div>
            <div style={{padding:'14px 18px',display:'flex',flexDirection:'column',gap:14}}>
              {/* App label */}
              <div>
                <label style={{display:'block',fontSize:11,fontWeight:600,color:'var(--text3)',marginBottom:4}}>Nama Aplikasi</label>
                <input className="input" value={editApp.label||''} onChange={ev=>setEditApp((p:any)=>({...p,label:ev.target.value}))} />
              </div>

              {/* Sub-features list */}
              <div>
                <label style={{display:'block',fontSize:11,fontWeight:600,color:'var(--text3)',marginBottom:6}}>Sub-fitur (kolom checkbox)</label>
                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  {(editApp.subFeatures||[]).map((sf:any, i:number)=>(
                    <div key={sf.key||i} style={{display:'flex',gap:8,alignItems:'center'}}>
                      <input className="input" value={sf.label||''} onChange={ev=>{
                        const next=[...(editApp.subFeatures||[])]; next[i]={...next[i],label:ev.target.value}; setEditApp((p:any)=>({...p,subFeatures:next}))
                      }} style={{flex:1}} placeholder="Nama sub-fitur" />
                      <button onClick={()=>{
                        const next=(editApp.subFeatures||[]).filter((_:any,j:number)=>j!==i); setEditApp((p:any)=>({...p,subFeatures:next}))
                      }} className="btn btn-icon btn-sm" style={{color:'var(--red)'}}>✕</button>
                    </div>
                  ))}
                </div>
                <button onClick={()=>{
                  const key='sf'+Date.now().toString(36)
                  const next=[...(editApp.subFeatures||[]),{key,label:'',order:(editApp.subFeatures||[]).length+1}]
                  setEditApp((p:any)=>({...p,subFeatures:next}))
                }} className="btn btn-sm" style={{marginTop:8,fontSize:11}}>+ Sub-fitur</button>
              </div>
            </div>
            <div style={{padding:'12px 18px',borderTop:'1px solid var(--border)',display:'flex',justifyContent:'space-between',gap:8}}>
              <button onClick={()=>delApp(editApp)} className="btn btn-sm" style={{color:'var(--red)'}}>🗑 Hapus App</button>
              <div style={{display:'flex',gap:8}}>
                <button onClick={()=>setEditApp(null)} className="btn btn-sm">Batal</button>
                <button onClick={async ()=>{
                  const patch = { label: editApp.label, subFeatures: (editApp.subFeatures||[]).filter((sf:any)=>sf.label?.trim()).map((sf:any,i:number)=>({...sf, key:sf.key||sf.label.toLowerCase().replace(/[^a-z0-9]+/g,'-'), order:i+1})) }
                  await patchApp(editApp._id, patch)
                  setEditApp(null); toast.success('App diperbarui')
                }} className="btn btn-primary btn-sm">Simpan</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
