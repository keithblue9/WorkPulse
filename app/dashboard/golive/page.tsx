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
  const [q, setQ] = useState('')

  async function load() { setLoading(true); const d=await fetch('/api/golive').then(r=>r.json()).catch(()=>({apps:[],entities:[]})); setApps(d.apps||[]); setEntities(d.entities||[]); setLoading(false) }
  useEffect(()=>{ load() }, [])

  async function addEntity(){ const r=await fetch('/api/golive',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'entity',name:'',cocd:'',group:''})}); const d=await r.json(); if(r.ok) setEntities(p=>[...p,d.data]); else toast.error(d.error||'Gagal') }
  async function addApp(){ const label=prompt('Nama aplikasi baru:'); if(!label?.trim()) return; const r=await fetch('/api/golive',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'app',label:label.trim()})}); const d=await r.json(); if(r.ok){setApps(p=>[...p,d.data]);toast.success('App ditambahkan')} else toast.error(d.error||'Gagal') }
  async function delEntity(e:any){ if(!confirm(`Hapus "${e.name||'(kosong)'}"?`)) return; await fetch(`/api/golive?kind=entity&id=${e._id}`,{method:'DELETE'}); setEntities(p=>p.filter(x=>x._id!==e._id)) }

  async function patchEntity(id:string,patch:any){ setEntities(p=>p.map(e=>e._id===id?{...e,...patch,apps:{...(e.apps||{}),...(patch.apps||{})}}:e)); try{await fetch('/api/golive',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'entity',id,patch})})}catch{toast.error('Gagal')} }
  function setSub(e:any,appKey:string,subKey:string,val:boolean){ const cur=(e.apps||{})[appKey]||{}; const subs={...(cur.subs||{}), [subKey]:val}; const anyDone=Object.values(subs).some(Boolean); patchEntity(e._id,{apps:{...(e.apps||{}), [appKey]:{...cur,subs,done:anyDone}}}) }
  function setAppDate(e:any,appKey:string,date:string){ const cur=(e.apps||{})[appKey]||{}; patchEntity(e._id,{apps:{...(e.apps||{}), [appKey]:{...cur,date}}}) }

  const view = useMemo(()=>entities.filter(e=>groupFilter==='all'||e.group===groupFilter).filter(e=>!q.trim()||(e.name||'').toLowerCase().includes(q.toLowerCase())||String(e.cocd||'').includes(q)),[entities,groupFilter,q])

  // Summary: per app count entities where done
  const summary = useMemo(()=>apps.map((a:any,i:number)=>{
    const done=entities.filter(e=>{const ap=(e.apps||{})[a.key]; return ap?.done || (ap?.subs && Object.values(ap.subs).some(Boolean))}).length
    return {...a, done, color:['#4f8ef7','#8b5cf6','#22c55e','#f59e0b','#ec4899','#14b8a6'][i%6]}
  }),[apps,entities])

  const th:React.CSSProperties={padding:'6px 8px',fontSize:9.5,fontWeight:700,color:'var(--text3)',textTransform:'uppercase',letterSpacing:0.3,background:'var(--bg2)',borderBottom:'2px solid var(--border)',whiteSpace:'nowrap',textAlign:'center',position:'sticky',top:0,zIndex:2}
  const td:React.CSSProperties={padding:'4px 6px',fontSize:11.5,borderBottom:'1px solid var(--border)',verticalAlign:'middle'}
  const totalSubs = apps.reduce((s:number,a:any)=>(a.subFeatures||[]).length + 1 + s, 0) // +1 for date col

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <div style={{padding:'12px 20px',borderBottom:'1px solid var(--border)',background:'var(--bg2)',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap',flexShrink:0}}>
        <div><div style={{fontSize:14,fontWeight:600}}>🚀 Go-Live</div><div style={{fontSize:11,color:'var(--text3)'}}>Status go-live entitas per aplikasi · sub-fitur + tanggal</div></div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={addApp} className="btn btn-sm">+ App</button>
          <button onClick={addEntity} className="btn btn-primary btn-sm">+ Entitas</button>
        </div>
      </div>

      <div style={{flex:1,overflow:'auto',padding:'16px 20px'}}>
        {/* Summary */}
        <div style={{display:'flex',gap:10,marginBottom:14,flexWrap:'wrap'}}>
          {summary.map((a:any)=>{const pct=entities.length>0?Math.round(a.done/entities.length*100):0; return(
            <div key={a._id||a.key} className="card" style={{padding:'10px 14px',flex:'1 1 140px',minWidth:140,borderLeft:`3px solid ${a.color}`}}>
              <div style={{fontSize:10,fontWeight:700,color:'var(--text3)',textTransform:'uppercase',letterSpacing:0.3,marginBottom:3}}>{a.label}</div>
              <div style={{display:'flex',alignItems:'baseline',gap:5}}><span style={{fontSize:22,fontWeight:800,color:a.color}}>{a.done}</span><span style={{fontSize:10.5,color:'var(--text3)'}}>/ {entities.length}</span></div>
              <div style={{height:4,background:'var(--bg3)',borderRadius:2,overflow:'hidden',marginTop:5}}><div style={{width:`${pct}%`,height:'100%',background:a.color,transition:'width .3s'}}/></div>
            </div>
          )})}
        </div>

        {/* Filter */}
        <div style={{display:'flex',gap:8,marginBottom:10,flexWrap:'wrap',alignItems:'center'}}>
          <input className="input" placeholder="🔍 Cari entitas / CoCd…" value={q} onChange={e=>setQ(e.target.value)} style={{maxWidth:220,fontSize:12}}/>
          <select className="input" value={groupFilter} onChange={e=>setGroupFilter(e.target.value)} style={{maxWidth:170,fontSize:12}}>
            <option value="all">Semua Grup</option>{GROUPS.map(g=><option key={g} value={g}>{g}</option>)}
          </select>
          <span style={{fontSize:11,color:'var(--text3)'}}>{view.length} entitas</span>
        </div>

        {loading?<div style={{fontSize:12,color:'var(--text3)'}}>Memuat…</div>:(
        <div className="card" style={{padding:0,overflow:'auto',maxHeight:'calc(100vh - 300px)'}}>
          <table style={{borderCollapse:'collapse',width:'100%',minWidth:420+totalSubs*52}}>
            <thead>
              {/* Row 1: app group headers */}
              <tr>
                <th style={{...th,width:30}} rowSpan={2}>No</th>
                <th style={{...th,minWidth:180,textAlign:'left'}} rowSpan={2}>Company</th>
                <th style={{...th,width:52}} rowSpan={2}>CoCd</th>
                <th style={{...th,width:100,textAlign:'left'}} rowSpan={2}>HSH</th>
                <th style={{...th,width:60,textAlign:'left'}} rowSpan={2}>Client</th>
                {apps.map((a:any,ai:number)=>{
                  const subs=(a.subFeatures||[]); const cols=subs.length+1; // subs + date
                  const color=['#4f8ef7','#8b5cf6','#22c55e','#f59e0b','#ec4899','#14b8a6'][ai%6]
                  return <th key={a._id||a.key} style={{...th,borderLeft:'2px solid var(--border)',color}} colSpan={cols}>{a.label}</th>
                })}
                <th style={{...th,width:30}} rowSpan={2}></th>
              </tr>
              {/* Row 2: sub-feature headers */}
              <tr>
                {apps.map((a:any)=>{const subs=(a.subFeatures||[]); return(
                  <Fragment key={a._id||a.key}>
                    <th style={{...th,borderLeft:'2px solid var(--border)',width:70,fontSize:9}}>Tgl</th>
                    {subs.map((sf:any)=><th key={sf.key} style={{...th,width:42,fontSize:9}}>{sf.label}</th>)}
                  </Fragment>
                )})}
              </tr>
            </thead>
            <tbody>
              {view.map((e:any,i:number)=>(
                <tr key={e._id} style={{background:i%2===0?'transparent':'var(--bg2)'}}>
                  <td style={{...td,textAlign:'center',color:'var(--text3)',fontSize:10}}>{i+1}</td>
                  <td style={td}><input defaultValue={e.name||''} placeholder="—" onBlur={ev=>{if(ev.target.value!==e.name) patchEntity(e._id,{name:ev.target.value})}} style={{width:'100%',border:'none',background:'transparent',fontSize:11.5,fontWeight:600,color:'var(--text)',padding:0,outline:'none'}}/></td>
                  <td style={{...td,textAlign:'center'}}><input defaultValue={e.cocd||''} onBlur={ev=>{if(ev.target.value!==e.cocd) patchEntity(e._id,{cocd:ev.target.value})}} style={{width:48,border:'none',background:'transparent',fontSize:11,color:'var(--text2)',padding:0,outline:'none',textAlign:'center'}}/></td>
                  <td style={td}><select value={e.group||''} onChange={ev=>patchEntity(e._id,{group:ev.target.value})} style={{width:'100%',border:'1px solid var(--border)',borderRadius:4,padding:'2px 4px',fontSize:10.5,background:'var(--bg)',color:'var(--text)'}}><option value="">—</option>{GROUPS.map(g=><option key={g} value={g}>{g}</option>)}</select></td>
                  <td style={{...td,fontSize:10.5,color:'var(--text3)'}}>{e.client||''}</td>
                  {apps.map((a:any,ai:number)=>{const ap=(e.apps||{})[a.key]||{}; const subs=(a.subFeatures||[]); const color=['#4f8ef7','#8b5cf6','#22c55e','#f59e0b','#ec4899','#14b8a6'][ai%6]; const dateStr=ap.date||''; return(
                    <Fragment key={a._id||a.key}>
                      <td style={{...td,borderLeft:'2px solid var(--border)',textAlign:'center',padding:'3px 4px'}}>
                        <span style={{fontSize:10,color:dateStr&&dateStr!=='Not Yet'?color:'var(--text3)',fontWeight:dateStr&&dateStr!=='Not Yet'?700:400}}>{fmtDate(dateStr)||'—'}</span>
                      </td>
                      {subs.map((sf:any)=>{const checked=!!(ap.subs||{})[sf.key]; return(
                        <td key={sf.key} style={{...td,textAlign:'center',padding:'3px 2px'}}>
                          <input type="checkbox" checked={checked} onChange={ev=>setSub(e,a.key,sf.key,ev.target.checked)} style={{width:14,height:14,cursor:'pointer',accentColor:color}}/>
                        </td>
                      )})}
                    </Fragment>
                  )})}
                  <td style={{...td,textAlign:'center'}}><button onClick={()=>delEntity(e)} className="btn btn-icon btn-sm" style={{color:'var(--red)',fontSize:10,opacity:0.5}}>🗑</button></td>
                </tr>
              ))}
              {view.length===0&&<tr><td colSpan={5+totalSubs+apps.length+1} style={{padding:24,textAlign:'center',fontSize:12,color:'var(--text3)'}}>Belum ada entitas.</td></tr>}
            </tbody>
          </table>
        </div>
        )}
      </div>
    </div>
  )
}
