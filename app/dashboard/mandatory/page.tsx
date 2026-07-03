'use client'
import { useEffect, useState, useMemo } from 'react'
import toast from 'react-hot-toast'

type Rec = { userId:string; year:number; mcu?:any; trainings?:any[]; supportKpi?:any[] }
function uid(){ return Math.random().toString(36).slice(2,9) }

const MCU_RESULTS = ['P1','P2','P3','P4','P5','P6']
function resultColor(r:string){ if(['P1','P2','P3'].includes(r)) return '#22c55e'; if(r==='P4') return '#f59e0b'; if(['P5','P6'].includes(r)) return '#dc2626'; return 'var(--border)' }
const TRAINING_OPTS = ['ISEC','SMART','lainnya']
const KPI_OPTS = ['P-HORSE','Survey','lainnya']

export default function MandatoryPage() {
  const [users, setUsers] = useState<any[]>([])
  const [recs, setRecs] = useState<Record<string, Rec>>({})
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState(new Date().getFullYear())
  const [subtab, setSubtab] = useState<'mcu'|'training'|'kpi'>('mcu')
  const [statusFilter, setStatusFilter] = useState<'all'|'pekerja'|'TAD'>('all')

  async function load() {
    setLoading(true)
    const [u, m] = await Promise.all([
      fetch('/api/users').then(r=>r.json()),
      fetch(`/api/mandatory?year=${year}`).then(r=>r.json()),
    ])
    const list = (u.data||[]).filter((x:any)=>x.active!==false && !(x.roles||[]).includes('guest'))
      .sort((a:any,b:any)=>(a.sortOrder??999)-(b.sortOrder??999))
    setUsers(list)
    const map: Record<string, Rec> = {}
    for (const r of (m.data||[])) map[r.userId] = r
    setRecs(map); setLoading(false)
  }
  useEffect(()=>{ load() }, [year])

  const filteredUsers = useMemo(()=>users.filter(u => statusFilter==='all' || (u.status||'pekerja')===statusFilter), [users, statusFilter])

  function getRec(userId:string): Rec { return recs[userId] || { userId, year, mcu:{ done:'belum', date:'', result:'' }, trainings:[], supportKpi:[] } }

  async function saveRec(userId:string, patch:any) {
    setRecs(prev => ({ ...prev, [userId]: { ...getRec(userId), ...patch } }))
    try {
      await fetch('/api/mandatory', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ userId, year, patch }) })
    } catch { toast.error('Gagal menyimpan') }
  }

  async function saveStatus(user:any, status:string) {
    setUsers(prev => prev.map(u => u._id===user._id ? { ...u, status } : u))
    try { await fetch(`/api/users/${user._id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ status }) }) }
    catch { toast.error('Gagal update status') }
  }

  const idOf = (u:any) => u.email || u.id || u._id
  const th: React.CSSProperties = { padding:'8px 10px', fontSize:10.5, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:0.4, background:'var(--bg2)', borderBottom:'1px solid var(--border)', textAlign:'left', whiteSpace:'nowrap' }
  const td: React.CSSProperties = { padding:'6px 10px', fontSize:12, borderBottom:'1px solid var(--border)', verticalAlign:'top' }
  const cellInput: React.CSSProperties = { width:'100%', border:'1px solid var(--border)', borderRadius:6, padding:'5px 8px', fontSize:12, background:'var(--bg)', color:'var(--text)', outline:'none' }

  function StatusCell({ u }:{ u:any }) {
    return (
      <select value={u.status||'pekerja'} onChange={e=>saveStatus(u, e.target.value)} style={{ ...cellInput, width:100 }}>
        <option value="pekerja">Pekerja</option>
        <option value="TAD">TAD</option>
      </select>
    )
  }

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ padding:'12px 20px', borderBottom:'1px solid var(--border)', background:'var(--bg2)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap', flexShrink:0 }}>
        <div>
          <div style={{ fontSize:14, fontWeight:600 }}>📋 Mandatory</div>
          <div style={{ fontSize:11, color:'var(--text3)' }}>MCU · Training · Support KPI — bisa diisi oleh siapa saja · view tahunan</div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <button onClick={()=>setYear(y=>y-1)} className="btn btn-sm">◀</button>
          <span style={{ padding:'5px 14px', background:'var(--bg3)', borderRadius:6, fontSize:13, fontWeight:700 }}>{year}</span>
          <button onClick={()=>setYear(y=>y+1)} className="btn btn-sm">▶</button>
        </div>
      </div>

      <div style={{ flex:1, overflow:'auto', padding:'16px 20px' }}>
        {/* sub-tabs + status filter */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, marginBottom:14, flexWrap:'wrap' }}>
          <div style={{ display:'flex', gap:4, background:'var(--bg3)', borderRadius:8, padding:3 }}>
            {([['mcu','🩺 MCU'],['training','🎓 Training'],['kpi','📊 Support KPI']] as const).map(([k,l])=>(
              <button key={k} onClick={()=>setSubtab(k)} className="btn btn-sm" style={{ background:subtab===k?'var(--brand)':'transparent', color:subtab===k?'#fff':'var(--text2)', border:'none' }}>{l}</button>
            ))}
          </div>
          <div style={{ display:'flex', gap:6, alignItems:'center' }}>
            <span style={{ fontSize:11, color:'var(--text3)' }}>Status:</span>
            {(['all','pekerja','TAD'] as const).map(s=>(
              <button key={s} onClick={()=>setStatusFilter(s)} className="btn btn-sm" style={{ fontSize:11, background:statusFilter===s?'var(--brand-soft)':'var(--bg3)', color:statusFilter===s?'var(--brand)':'var(--text2)', borderColor:statusFilter===s?'var(--brand)':'var(--border)', textTransform:'capitalize' }}>{s==='all'?'Semua':s}</button>
            ))}
          </div>
        </div>

        {loading ? <div style={{ fontSize:12.5, color:'var(--text3)' }}>Memuat…</div> : (
        <div className="card" style={{ padding:0, overflow:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth: subtab==='mcu'?760:900 }}>
            {subtab==='mcu' && (
              <>
                <thead><tr>
                  <th style={{ ...th, width:36 }}>No</th><th style={th}>Nama</th><th style={th}>Status</th>
                  <th style={th}>Pelaksanaan MCU</th><th style={th}>Tanggal MCU</th><th style={th}>Hasil</th>
                </tr></thead>
                <tbody>
                  {filteredUsers.map((u,i)=>{ const rec=getRec(idOf(u)); const mcu=rec.mcu||{}; return (
                    <tr key={u._id}>
                      <td style={{ ...td, textAlign:'center', color:'var(--text3)' }}>{i+1}</td>
                      <td style={{ ...td, fontWeight:600 }}>{u.name}<div style={{ fontSize:10, color:'var(--text3)', fontWeight:400 }}>{u.division}</div></td>
                      <td style={td}><StatusCell u={u} /></td>
                      <td style={td}>
                        <select value={mcu.done||'belum'} onChange={e=>saveRec(idOf(u),{ mcu:{ ...mcu, done:e.target.value } })} style={{ ...cellInput, color: mcu.done==='sudah'?'#22c55e':'#dc2626', fontWeight:600 }}>
                          <option value="belum">Belum</option><option value="sudah">Sudah</option>
                        </select>
                      </td>
                      <td style={td}><input type="date" value={mcu.date||''} onChange={e=>saveRec(idOf(u),{ mcu:{ ...mcu, date:e.target.value } })} style={cellInput} /></td>
                      <td style={td}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <select value={mcu.result||''} onChange={e=>saveRec(idOf(u),{ mcu:{ ...mcu, result:e.target.value } })} style={{ ...cellInput, width:80 }}>
                            <option value="">—</option>{MCU_RESULTS.map(r=><option key={r} value={r}>{r}</option>)}
                          </select>
                          {mcu.result && <span title={mcu.result} style={{ width:14, height:14, borderRadius:'50%', background:resultColor(mcu.result), flexShrink:0, boxShadow:'0 0 0 2px var(--bg)' }} />}
                        </div>
                      </td>
                    </tr>
                  )})}
                </tbody>
              </>
            )}

            {subtab==='training' && (
              <>
                <thead><tr>
                  <th style={{ ...th, width:36 }}>No</th><th style={th}>Nama</th><th style={th}>Status</th>
                  <th style={th}>Daftar Training</th><th style={{ ...th, width:90 }}></th>
                </tr></thead>
                <tbody>
                  {filteredUsers.map((u,i)=>{ const rec=getRec(idOf(u)); const list=rec.trainings||[]; return (
                    <tr key={u._id}>
                      <td style={{ ...td, textAlign:'center', color:'var(--text3)' }}>{i+1}</td>
                      <td style={{ ...td, fontWeight:600, whiteSpace:'nowrap' }}>{u.name}<div style={{ fontSize:10, color:'var(--text3)', fontWeight:400 }}>{u.division}</div></td>
                      <td style={td}><StatusCell u={u} /></td>
                      <td style={td}>
                        {list.length===0 && <div style={{ fontSize:11, color:'var(--text3)', padding:'4px 0' }}>Belum ada training.</div>}
                        <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                          {list.map((t:any)=>(
                            <div key={t.id} style={{ display:'grid', gridTemplateColumns:'120px 1fr 130px 1fr 26px', gap:6, alignItems:'center' }}>
                              <select value={t.training||''} onChange={e=>saveRec(idOf(u),{ trainings:list.map((x:any)=>x.id===t.id?{...x,training:e.target.value}:x) })} style={cellInput}>
                                <option value="">Pilih</option>{TRAINING_OPTS.map(o=><option key={o} value={o}>{o==='lainnya'?'Lainnya…':o}</option>)}
                              </select>
                              {t.training==='lainnya'
                                ? <input value={t.customName||''} onChange={e=>saveRec(idOf(u),{ trainings:list.map((x:any)=>x.id===t.id?{...x,customName:e.target.value}:x) })} placeholder="Nama training" style={cellInput} />
                                : <span style={{ fontSize:11, color:'var(--text3)' }} />}
                              <input type="date" value={t.date||''} onChange={e=>saveRec(idOf(u),{ trainings:list.map((x:any)=>x.id===t.id?{...x,date:e.target.value}:x) })} style={cellInput} />
                              <input value={t.note||''} onChange={e=>saveRec(idOf(u),{ trainings:list.map((x:any)=>x.id===t.id?{...x,note:e.target.value}:x) })} placeholder="Keterangan" style={cellInput} />
                              <button onClick={()=>saveRec(idOf(u),{ trainings:list.filter((x:any)=>x.id!==t.id) })} className="btn btn-icon btn-sm" style={{ color:'var(--red)' }}>✕</button>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td style={{ ...td, textAlign:'right' }}>
                        <button onClick={()=>saveRec(idOf(u),{ trainings:[...list, { id:uid(), training:'', customName:'', date:'', note:'' }] })} className="btn btn-sm" style={{ fontSize:10.5, whiteSpace:'nowrap' }}>+ Training</button>
                      </td>
                    </tr>
                  )})}
                </tbody>
              </>
            )}

            {subtab==='kpi' && (
              <>
                <thead><tr>
                  <th style={{ ...th, width:36 }}>No</th><th style={th}>Nama</th><th style={th}>Status</th>
                  <th style={th}>Pengisian Support KPI</th><th style={{ ...th, width:80 }}></th>
                </tr></thead>
                <tbody>
                  {filteredUsers.map((u,i)=>{ const rec=getRec(idOf(u)); const list=rec.supportKpi||[]; return (
                    <tr key={u._id}>
                      <td style={{ ...td, textAlign:'center', color:'var(--text3)' }}>{i+1}</td>
                      <td style={{ ...td, fontWeight:600, whiteSpace:'nowrap' }}>{u.name}<div style={{ fontSize:10, color:'var(--text3)', fontWeight:400 }}>{u.division}</div></td>
                      <td style={td}><StatusCell u={u} /></td>
                      <td style={td}>
                        {list.length===0 && <div style={{ fontSize:11, color:'var(--text3)', padding:'4px 0' }}>Belum ada pengisian.</div>}
                        <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                          {list.map((k:any)=>(
                            <div key={k.id} style={{ display:'grid', gridTemplateColumns:'110px 1fr 70px 130px 1fr 26px', gap:6, alignItems:'center' }}>
                              <select value={k.jenis||''} onChange={e=>saveRec(idOf(u),{ supportKpi:list.map((x:any)=>x.id===k.id?{...x,jenis:e.target.value}:x) })} style={cellInput}>
                                <option value="">Jenis</option>{KPI_OPTS.map(o=><option key={o} value={o}>{o==='lainnya'?'Lainnya…':o}</option>)}
                              </select>
                              {k.jenis==='lainnya'
                                ? <input value={k.customName||''} onChange={e=>saveRec(idOf(u),{ supportKpi:list.map((x:any)=>x.id===k.id?{...x,customName:e.target.value}:x) })} placeholder="Jenis" style={cellInput} />
                                : <span />}
                              <input type="number" min={0} value={k.jumlah||0} onChange={e=>saveRec(idOf(u),{ supportKpi:list.map((x:any)=>x.id===k.id?{...x,jumlah:Number(e.target.value)||0}:x) })} placeholder="Jml" style={cellInput} />
                              <input type="date" value={k.lastDate||''} onChange={e=>saveRec(idOf(u),{ supportKpi:list.map((x:any)=>x.id===k.id?{...x,lastDate:e.target.value}:x) })} style={cellInput} />
                              <input value={k.note||''} onChange={e=>saveRec(idOf(u),{ supportKpi:list.map((x:any)=>x.id===k.id?{...x,note:e.target.value}:x) })} placeholder="Keterangan" style={cellInput} />
                              <button onClick={()=>saveRec(idOf(u),{ supportKpi:list.filter((x:any)=>x.id!==k.id) })} className="btn btn-icon btn-sm" style={{ color:'var(--red)' }}>✕</button>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td style={{ ...td, textAlign:'right' }}>
                        <button onClick={()=>saveRec(idOf(u),{ supportKpi:[...list, { id:uid(), jenis:'', customName:'', jumlah:0, lastDate:'', note:'' }] })} className="btn btn-sm" style={{ fontSize:10.5, whiteSpace:'nowrap' }}>+ Jenis</button>
                      </td>
                    </tr>
                  )})}
                </tbody>
              </>
            )}
          </table>
          {filteredUsers.length===0 && <div style={{ padding:20, textAlign:'center', fontSize:12, color:'var(--text3)' }}>Tidak ada member untuk filter ini.</div>}
        </div>
        )}

        {subtab==='mcu' && (
          <div style={{ display:'flex', gap:16, marginTop:12, fontSize:11, color:'var(--text2)', flexWrap:'wrap' }}>
            <span style={{ display:'flex', alignItems:'center', gap:5 }}><span style={{ width:11, height:11, borderRadius:'50%', background:'#22c55e' }} /> P1–P3 (baik)</span>
            <span style={{ display:'flex', alignItems:'center', gap:5 }}><span style={{ width:11, height:11, borderRadius:'50%', background:'#f59e0b' }} /> P4 (perhatian)</span>
            <span style={{ display:'flex', alignItems:'center', gap:5 }}><span style={{ width:11, height:11, borderRadius:'50%', background:'#dc2626' }} /> P5–P6 (tinggi)</span>
          </div>
        )}
      </div>
    </div>
  )
}
