'use client'
import { Fragment, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'

const GROUPS = ['Holding','SH Upstream','SH Gas','SH C&T','SH PNRE','SH R&P','SH Shipping','Others']
const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']

function fmtDate(v:string){ if(!v) return ''; const [y,m]=v.split('-'); return m&&y ? `${MONTHS[parseInt(m)-1]}-${y.slice(2)}` : v }

export default function GoLivePage() {
  const [apps, setApps] = useState<any[]>([])
  const [entities, setEntities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [groupFilter, setGroupFilter] = useState('all')
  const [q, setQ] = useState('')

  async function load() {
    setLoading(true)
    const d = await fetch('/api/golive').then(r=>r.json()).catch(()=>({apps:[],entities:[]}))
    setApps(d.apps||[]); setEntities(d.entities||[]); setLoading(false)
  }
  useEffect(()=>{ load() }, [])

  async function addEntity() {
    const r = await fetch('/api/golive', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ kind:'entity', name:'', cocd:'', group:'' }) })
    const d = await r.json()
    if (r.ok) setEntities(prev=>[...prev, d.data])
    else toast.error(d.error||'Gagal')
  }
  async function addApp() {
    const label = prompt('Nama aplikasi baru (mis. SAP, e-Proc):')
    if (!label?.trim()) return
    const r = await fetch('/api/golive', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ kind:'app', label: label.trim() }) })
    const d = await r.json()
    if (r.ok) { setApps(prev=>[...prev, d.data]); toast.success(`App "${label.trim()}" ditambahkan`) }
    else toast.error(d.error||'Gagal')
  }
  async function delApp(app:any) {
    if (!confirm(`Hapus aplikasi "${app.label}" beserta semua centangnya?`)) return
    await fetch(`/api/golive?kind=app&id=${app._id}`, { method:'DELETE' })
    setApps(prev=>prev.filter(a=>a._id!==app._id)); toast.success('App dihapus')
  }
  async function delEntity(e:any) {
    if (!confirm(`Hapus entitas "${e.name||'(tanpa nama)'}"?`)) return
    await fetch(`/api/golive?kind=entity&id=${e._id}`, { method:'DELETE' })
    setEntities(prev=>prev.filter(x=>x._id!==e._id)); toast.success('Entitas dihapus')
  }

  async function patchEntity(id:string, patch:any) {
    setEntities(prev=>prev.map(e=>e._id===id?{...e, ...patch, apps:{...(e.apps||{}), ...(patch.apps||{})}}:e))
    try { await fetch('/api/golive', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ kind:'entity', id, patch }) }) }
    catch { toast.error('Gagal menyimpan') }
  }
  function setApp(e:any, appKey:string, val:{done?:boolean; date?:string}) {
    const cur = (e.apps||{})[appKey] || {}
    patchEntity(e._id, { apps: { ...(e.apps||{}), [appKey]: { ...cur, ...val } } })
  }

  const view = useMemo(()=>entities
    .filter(e=>groupFilter==='all' || e.group===groupFilter)
    .filter(e=>!q.trim() || (e.name||'').toLowerCase().includes(q.toLowerCase()) || String(e.cocd||'').includes(q)),
  [entities, groupFilter, q])

  const summary = useMemo(()=>apps.map(a=>({ ...a, done: entities.filter(e=>(e.apps||{})[a.key]?.done).length })), [apps, entities])

  const COLORS = ['#4f8ef7','#8b5cf6','#22c55e','#f59e0b','#ec4899','#14b8a6','#f97316','#06b6d4']
  const th:React.CSSProperties = { padding:'8px 10px', fontSize:10.5, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:0.3, background:'var(--bg2)', borderBottom:'2px solid var(--border)', whiteSpace:'nowrap', textAlign:'left', position:'sticky', top:0, zIndex:2 }
  const td:React.CSSProperties = { padding:'6px 10px', fontSize:12.5, borderBottom:'1px solid var(--border)', verticalAlign:'middle' }

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ padding:'12px 20px', borderBottom:'1px solid var(--border)', background:'var(--bg2)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap', flexShrink:0 }}>
        <div>
          <div style={{ fontSize:14, fontWeight:600 }}>🚀 Go-Live</div>
          <div style={{ fontSize:11, color:'var(--text3)' }}>Status go-live entitas per aplikasi · centang + tanggal</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={addApp} className="btn btn-sm">+ App</button>
          <button onClick={addEntity} className="btn btn-primary btn-sm">+ Entitas</button>
        </div>
      </div>

      <div style={{ flex:1, overflow:'auto', padding:'16px 20px' }}>
        {/* Summary cards */}
        <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap' }}>
          {summary.map((a,i)=>{ const color=COLORS[i%COLORS.length]; const pct=entities.length>0?Math.round(a.done/entities.length*100):0; return (
            <div key={a._id} className="card" style={{ padding:'12px 16px', flex:'1 1 140px', minWidth:140, borderLeft:`3px solid ${color}` }}>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:0.3, marginBottom:4 }}>{a.label}</div>
              <div style={{ display:'flex', alignItems:'baseline', gap:6 }}>
                <span style={{ fontSize:24, fontWeight:800, color }}>{a.done}</span>
                <span style={{ fontSize:11, color:'var(--text3)' }}>/ {entities.length}</span>
              </div>
              <div style={{ height:4, background:'var(--bg3)', borderRadius:2, overflow:'hidden', marginTop:6 }}>
                <div style={{ width:`${pct}%`, height:'100%', background:color, transition:'width .3s' }} />
              </div>
            </div>
          )})}
        </div>

        {/* Filters */}
        <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap', alignItems:'center' }}>
          <input className="input" placeholder="🔍 Cari entitas / CoCd…" value={q} onChange={e=>setQ(e.target.value)} style={{ maxWidth:240, fontSize:12 }} />
          <select className="input" value={groupFilter} onChange={e=>setGroupFilter(e.target.value)} style={{ maxWidth:180, fontSize:12 }}>
            <option value="all">Semua Grup</option>
            {GROUPS.map(g=><option key={g} value={g}>{g}</option>)}
          </select>
          <span style={{ fontSize:11, color:'var(--text3)' }}>{view.length} entitas</span>
        </div>

        {loading ? <div style={{ fontSize:12.5, color:'var(--text3)' }}>Memuat…</div> : (
        <div className="card" style={{ padding:0, overflow:'auto', maxHeight:'calc(100vh - 300px)' }}>
          <table style={{ borderCollapse:'collapse', width:'100%', minWidth: 420 + apps.length*110 }}>
            <thead>
              <tr>
                <th style={{ ...th, width:36, textAlign:'center' }}>No</th>
                <th style={{ ...th, minWidth:200 }}>Company</th>
                <th style={{ ...th, width:60, textAlign:'center' }}>CoCd</th>
                <th style={{ ...th, width:120 }}>HSH</th>
                {apps.map((a,i)=>(
                  <th key={a._id} style={{ ...th, textAlign:'center', borderLeft:'2px solid var(--border)', minWidth:100 }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}>
                      <span style={{ color:COLORS[i%COLORS.length], fontWeight:800 }}>{a.label}</span>
                      <button onClick={()=>delApp(a)} title="Hapus app" className="btn btn-icon btn-sm" style={{ fontSize:8, height:14, width:14, color:'var(--red)', opacity:0.5 }}>✕</button>
                    </div>
                  </th>
                ))}
                <th style={{ ...th, width:36 }}></th>
              </tr>
            </thead>
            <tbody>
              {view.map((e,i)=>(
                <tr key={e._id} style={{ background: i%2===0?'transparent':'var(--bg2)' }}>
                  <td style={{ ...td, textAlign:'center', color:'var(--text3)', fontSize:11 }}>{i+1}</td>
                  <td style={td}>
                    <input defaultValue={e.name||''} placeholder="Nama entitas…" onBlur={ev=>{ if(ev.target.value!==e.name) patchEntity(e._id,{name:ev.target.value}) }}
                      style={{ width:'100%', border:'none', background:'transparent', fontSize:12.5, fontWeight:600, color:'var(--text)', padding:'2px 0', outline:'none' }} />
                  </td>
                  <td style={{ ...td, textAlign:'center' }}>
                    <input defaultValue={e.cocd||''} placeholder="—" onBlur={ev=>{ if(ev.target.value!==e.cocd) patchEntity(e._id,{cocd:ev.target.value}) }}
                      style={{ width:56, border:'none', background:'transparent', fontSize:12, color:'var(--text2)', padding:'2px 0', outline:'none', textAlign:'center' }} />
                  </td>
                  <td style={td}>
                    <select value={e.group||''} onChange={ev=>patchEntity(e._id,{group:ev.target.value})}
                      style={{ width:'100%', border:'1px solid var(--border)', borderRadius:5, padding:'4px 6px', fontSize:11, background:'var(--bg)', color:'var(--text)' }}>
                      <option value="">—</option>
                      {GROUPS.map(g=><option key={g} value={g}>{g}</option>)}
                    </select>
                  </td>
                  {apps.map((a,ai)=>{ const st=(e.apps||{})[a.key]||{}; const color=COLORS[ai%COLORS.length]; return (
                    <td key={a._id} style={{ ...td, textAlign:'center', borderLeft:'2px solid var(--border)', padding:'4px 6px' }}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                        <input type="checkbox" checked={!!st.done} onChange={ev=>setApp(e,a.key,{done:ev.target.checked})}
                          style={{ width:16, height:16, cursor:'pointer', accentColor:color, flexShrink:0 }} />
                        <input type="text" value={st.date ? fmtDate(st.date) : ''} placeholder="—"
                          onFocus={ev=>{ ev.target.type='month'; ev.target.value=st.date||'' }}
                          onBlur={ev=>{ ev.target.type='text'; ev.target.value=ev.target.value ? fmtDate(ev.target.value) : ''; if(ev.target.value!==fmtDate(st.date||'')) setApp(e,a.key,{date:(ev.target as any)._rawVal||''}) }}
                          onChange={ev=>{ (ev.target as any)._rawVal=ev.target.value; setApp(e,a.key,{date:ev.target.value}) }}
                          style={{ width:72, border:'1px solid var(--border)', borderRadius:5, padding:'3px 6px', fontSize:11, background: st.done?`${color}11`:'var(--bg)', color: st.done?color:'var(--text3)', textAlign:'center', fontWeight:st.done?700:400, outline:'none' }} />
                      </div>
                    </td>
                  )})}
                  <td style={{ ...td, textAlign:'center' }}>
                    <button onClick={()=>delEntity(e)} className="btn btn-icon btn-sm" title="Hapus" style={{ color:'var(--red)', fontSize:11, opacity:0.6 }}>🗑</button>
                  </td>
                </tr>
              ))}
              {view.length===0 && <tr><td colSpan={4+apps.length+1} style={{ padding:30, textAlign:'center', fontSize:12, color:'var(--text3)' }}>Belum ada entitas. Klik <b>+ Entitas</b> untuk mulai.</td></tr>}
            </tbody>
          </table>
        </div>
        )}
      </div>
    </div>
  )
}
