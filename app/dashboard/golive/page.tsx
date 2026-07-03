'use client'
import { Fragment, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'

const GROUPS = ['Holding','SH Upstream','SH Gas','SH C&T','SH PNRE','SH R&P','SH Shipping','Others']

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

  // simpan patch entity (optimistic + debounce ringan via blur/change)
  async function patchEntity(id:string, patch:any) {
    setEntities(prev=>prev.map(e=>e._id===id?{...e, ...patch, apps:{...(e.apps||{}), ...(patch.apps||{})}}:e))
    try { await fetch('/api/golive', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ kind:'entity', id, patch }) }) }
    catch { toast.error('Gagal menyimpan') }
  }
  function setApp(e:any, appKey:string, val:{done?:boolean; date?:string}) {
    const cur = (e.apps||{})[appKey] || {}
    const next = { ...cur, ...val }
    patchEntity(e._id, { apps: { ...(e.apps||{}), [appKey]: next } })
  }

  const view = useMemo(()=>entities
    .filter(e=>groupFilter==='all' || e.group===groupFilter)
    .filter(e=>!q.trim() || (e.name||'').toLowerCase().includes(q.toLowerCase()) || String(e.cocd||'').includes(q)),
  [entities, groupFilter, q])

  // ringkasan per app
  const summary = useMemo(()=>apps.map(a=>({ ...a, done: entities.filter(e=>(e.apps||{})[a.key]?.done).length })), [apps, entities])

  const th: React.CSSProperties = { padding:'7px 8px', fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:0.4, background:'var(--bg2)', borderBottom:'1px solid var(--border)', whiteSpace:'nowrap', textAlign:'left' }
  const td: React.CSSProperties = { padding:'4px 8px', fontSize:12, borderBottom:'1px solid var(--border)', verticalAlign:'middle' }
  const inp: React.CSSProperties = { width:'100%', border:'1px solid transparent', borderRadius:5, padding:'4px 6px', fontSize:12, background:'transparent', color:'var(--text)', outline:'none' }

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
        {/* Ringkasan per app */}
        <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap' }}>
          {summary.map(a=>(
            <div key={a._id} className="card" style={{ padding:'10px 16px', display:'flex', alignItems:'center', gap:10, flex:'1 1 140px', minWidth:140 }}>
              <div style={{ fontSize:22, fontWeight:800, color:'var(--brand)' }}>{a.done}</div>
              <div>
                <div style={{ fontSize:12, fontWeight:700 }}>{a.label}</div>
                <div style={{ fontSize:10, color:'var(--text3)' }}>dari {entities.length} entitas</div>
              </div>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap', alignItems:'center' }}>
          <input className="input" placeholder="🔍 Cari entitas / CoCd…" value={q} onChange={e=>setQ(e.target.value)} style={{ maxWidth:240 }} />
          <select className="input" value={groupFilter} onChange={e=>setGroupFilter(e.target.value)} style={{ maxWidth:180 }}>
            <option value="all">Semua Grup</option>
            {GROUPS.map(g=><option key={g} value={g}>{g}</option>)}
          </select>
          <span style={{ fontSize:11, color:'var(--text3)' }}>{view.length} entitas</span>
        </div>

        {loading ? <div style={{ fontSize:12.5, color:'var(--text3)' }}>Memuat…</div> : (
        <div className="card" style={{ padding:0, overflow:'auto' }}>
          <table style={{ borderCollapse:'collapse', minWidth: 560 + apps.length*150 }}>
            <thead>
              <tr>
                <th style={{ ...th, width:34 }} rowSpan={2}>No</th>
                <th style={{ ...th, minWidth:220 }} rowSpan={2}>Company</th>
                <th style={{ ...th, width:70 }} rowSpan={2}>CoCd</th>
                <th style={{ ...th, width:130 }} rowSpan={2}>HSH</th>
                {apps.map(a=>(
                  <th key={a._id} style={{ ...th, textAlign:'center', borderLeft:'1px solid var(--border)' }} colSpan={2}>
                    <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>{a.label}
                      <button onClick={()=>delApp(a)} title="Hapus app" className="btn btn-icon btn-sm" style={{ fontSize:9, height:16, width:16, color:'var(--red)' }}>✕</button>
                    </span>
                  </th>
                ))}
                <th style={{ ...th, width:40 }} rowSpan={2}></th>
              </tr>
              <tr>
                {apps.map(a=>(<Fragment key={a._id}><th style={{ ...th, width:46, textAlign:'center', borderLeft:'1px solid var(--border)' }}>✓</th><th style={{ ...th, width:118 }}>Tgl</th></Fragment>))}
              </tr>
            </thead>
            <tbody>
              {view.map((e,i)=>(
                <tr key={e._id}>
                  <td style={{ ...td, textAlign:'center', color:'var(--text3)', fontSize:11 }}>{i+1}</td>
                  <td style={td}><input style={{ ...inp, fontWeight:600 }} defaultValue={e.name||''} placeholder="Nama entitas…" onBlur={ev=>{ if(ev.target.value!==e.name) patchEntity(e._id,{ name:ev.target.value }) }} /></td>
                  <td style={td}><input style={inp} defaultValue={e.cocd||''} placeholder="0000" onBlur={ev=>{ if(ev.target.value!==e.cocd) patchEntity(e._id,{ cocd:ev.target.value }) }} /></td>
                  <td style={td}>
                    <select value={e.group||''} onChange={ev=>patchEntity(e._id,{ group:ev.target.value })} style={{ ...inp, border:'1px solid var(--border)', background:'var(--bg)' }}>
                      <option value="">—</option>
                      {GROUPS.map(g=><option key={g} value={g}>{g}</option>)}
                    </select>
                  </td>
                  {apps.map(a=>{ const st=(e.apps||{})[a.key]||{}; return (
                    <Fragment key={a._id}>
                      <td style={{ ...td, textAlign:'center', borderLeft:'1px solid var(--border)' }}>
                        <input type="checkbox" checked={!!st.done} onChange={ev=>setApp(e, a.key, { done: ev.target.checked })} style={{ width:15, height:15, cursor:'pointer', accentColor:'var(--green)' }} />
                      </td>
                      <td style={td}>
                        <input type="month" value={st.date||''} onChange={ev=>setApp(e, a.key, { date: ev.target.value })} style={{ ...inp, border:'1px solid var(--border)', background:'var(--bg)', fontSize:11, color: st.done?'var(--text)':'var(--text3)' }} />
                      </td>
                    </Fragment>
                  )})}
                  <td style={{ ...td, textAlign:'center' }}>
                    <button onClick={()=>delEntity(e)} className="btn btn-icon btn-sm" title="Hapus entitas" style={{ color:'var(--red)', fontSize:11 }}>🗑</button>
                  </td>
                </tr>
              ))}
              {view.length===0 && <tr><td colSpan={5+apps.length*2} style={{ padding:24, textAlign:'center', fontSize:12, color:'var(--text3)' }}>Belum ada entitas. Klik <b>+ Entitas</b> untuk mulai.</td></tr>}
            </tbody>
          </table>
        </div>
        )}
      </div>
    </div>
  )
}
