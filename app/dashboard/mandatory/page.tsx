'use client'
import { useEffect, useState, useMemo } from 'react'
import toast from 'react-hot-toast'
import { useYear } from '@/lib/year'
import { Empty, Icon, PageHeader, Seg, Tile } from '@/components/ui'

type Rec = { userId:string; year:number; mcu?:any; trainings?:any[]; supportKpi?:any[] }
function uid(){ return Math.random().toString(36).slice(2,9) }

const MCU_RESULTS = ['P1','P2','P3','P4','P5','P6']
function resultColor(r:string){ if(['P1','P2','P3'].includes(r)) return 'var(--ok)'; if(r==='P4') return 'var(--warn-bar)'; if(['P5','P6'].includes(r)) return 'var(--bad)'; return 'var(--line2)' }
const TRAINING_OPTS = ['ISEC','SMART','lainnya']
const KPI_OPTS = ['P-HORSE','Survey','lainnya']

export default function MandatoryPage() {
  const [users, setUsers] = useState<any[]>([])
  const [recs, setRecs] = useState<Record<string, Rec>>({})
  const [loading, setLoading] = useState(true)
  const { year } = useYear()
  const [failed, setFailed] = useState(false)
  const [subtab, setSubtab] = useState<'mcu'|'training'|'kpi'>('mcu')
  const [statusFilter, setStatusFilter] = useState<'all'|'pekerja'|'TAD'>('all')

  async function load() {
    setLoading(true); setFailed(false)
    const [u, m] = await Promise.all([
      fetch('/api/users').then(r=>r.ok ? r.json() : Promise.reject()),
      fetch(`/api/mandatory?year=${year}`).then(r=>r.ok ? r.json() : Promise.reject()),
    ]).catch(() => { setFailed(true); return [{ data: [] }, { data: [] }] })
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
      const r = await fetch('/api/mandatory', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ userId, year, patch }) })
      if (!r.ok) throw new Error()
    } catch { toast.error('Gagal menyimpan') }
  }

  async function saveStatus(user:any, status:string) {
    setUsers(prev => prev.map(u => u._id===user._id ? { ...u, status } : u))
    try { const r = await fetch(`/api/users/${user._id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ status }) }); if (!r.ok) throw new Error() }
    catch { toast.error('Gagal update status'); setUsers(prev => prev.map(u => u._id===user._id ? { ...u, status: user.status } : u)) }
  }

  const idOf = (u:any) => u.email || u.id || u._id
  const th: React.CSSProperties = { padding:'10px 12px', font:'500 11px var(--mono)', letterSpacing:'.06em', color:'var(--muted)', textTransform:'uppercase', background:'var(--surface)', borderBottom:'1px solid var(--line)', textAlign:'left', whiteSpace:'nowrap', position:'sticky', top:0, zIndex:1 }
  const td: React.CSSProperties = { padding:'10px 12px', fontSize:13, borderBottom:'1px solid var(--line)', verticalAlign:'top' }
  const cellInput: React.CSSProperties = { width:'100%', border:'1px solid var(--line)', borderRadius:10, padding:'6px 10px', fontSize:13, background:'var(--surface)', color:'var(--ink)', outline:'none', minHeight:36 }
  const doneMcu = filteredUsers.filter(u => getRec(idOf(u)).mcu?.done === 'sudah').length
  const doneTr = filteredUsers.filter(u => (getRec(idOf(u)).trainings||[]).length > 0).length
  const doneKpi = filteredUsers.filter(u => (getRec(idOf(u)).supportKpi||[]).length > 0).length
  const pct = (n:number) => filteredUsers.length ? `${Math.round(n / filteredUsers.length * 100)}%` : '–'

  function StatusCell({ u }:{ u:any }) {
    return (
      <select aria-label={`Status kepegawaian ${u.name}`} value={u.status||'pekerja'} onChange={e=>saveStatus(u, e.target.value)} style={{ ...cellInput, width:100 }}>
        <option value="pekerja">Pekerja</option>
        <option value="TAD">TAD</option>
      </select>
    )
  }

  return (
    <div className="au-page">
      <div className="au-view au-anim">
        <PageHeader eyebrow={`Activities · ${year} · bisa diisi siapa saja`} title="Mandatory" actions={
          <Seg label="Jenis" value={subtab} onChange={setSubtab} options={[['mcu','MCU'],['training','Training'],['kpi','Support KPI']] as const} />
        } />
        <div className="au-grid au-tiles g3">
          <Tile icon="shield" color="var(--ok)" value={`${doneMcu}/${filteredUsers.length}`} label="Sudah MCU" hint={pct(doneMcu)} active={subtab==='mcu'} onClick={()=>setSubtab('mcu')} />
          <Tile icon="spark" color="#7B6BFF" value={`${doneTr}/${filteredUsers.length}`} label="Sudah training" hint={pct(doneTr)} active={subtab==='training'} onClick={()=>setSubtab('training')} />
          <Tile icon="act" color="var(--accent)" value={`${doneKpi}/${filteredUsers.length}`} label="Mengisi Support KPI" hint={pct(doneKpi)} active={subtab==='kpi'} onClick={()=>setSubtab('kpi')} />
        </div>
        <div className="au-row au-wrap" style={{ gap:8 }}>
          <span className="lbl">Status</span>
          <Seg label="Status pegawai" value={statusFilter} onChange={setStatusFilter} options={[['all','Semua'],['pekerja','Pekerja'],['TAD','TAD']] as const} />
        </div>
        {failed && <div className="au-row au-wrap p-bad" role="alert" style={{ borderRadius:14, padding:12 }}><span className="au-small" style={{ flex:1 }}>Data mandatory gagal dimuat.</span><button type="button" className="btn btn-sm" onClick={load}>Coba lagi</button></div>}

        {loading ? <div className="au-card"><div className="au-skel" /><div className="au-skel" style={{ width:'70%' }} /><div className="au-skel" style={{ width:'55%' }} /></div> : (
        <div className="au-tblw" style={{ maxHeight:'calc(100dvh - 330px)', minHeight:240, overflow:'auto' }}>
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
                        <select aria-label={`Pelaksanaan MCU ${u.name}`} value={mcu.done||'belum'} onChange={e=>saveRec(idOf(u),{ mcu:{ ...mcu, done:e.target.value } })} style={{ ...cellInput, color: mcu.done==='sudah'?'var(--ok)':'var(--bad)', fontWeight:600 }}>
                          <option value="belum">Belum</option><option value="sudah">Sudah</option>
                        </select>
                      </td>
                      <td style={td}><input type="date" aria-label={`Tanggal MCU ${u.name}`} value={mcu.date||''} onChange={e=>saveRec(idOf(u),{ mcu:{ ...mcu, date:e.target.value } })} style={cellInput} /></td>
                      <td style={td}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <select aria-label={`Hasil MCU ${u.name}`} value={mcu.result||''} onChange={e=>saveRec(idOf(u),{ mcu:{ ...mcu, result:e.target.value } })} style={{ ...cellInput, width:80 }}>
                            <option value="">—</option>{MCU_RESULTS.map(r=><option key={r} value={r}>{r}</option>)}
                          </select>
                          {mcu.result && <span title={mcu.result} style={{ width:14, height:14, borderRadius:'50%', background:resultColor(mcu.result), flexShrink:0, boxShadow:'0 0 0 2px var(--surface)' }} />}
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
                              <select aria-label={`Jenis training ${u.name}`} value={t.training||''} onChange={e=>saveRec(idOf(u),{ trainings:list.map((x:any)=>x.id===t.id?{...x,training:e.target.value}:x) })} style={cellInput}>
                                <option value="">Pilih</option>{TRAINING_OPTS.map(o=><option key={o} value={o}>{o==='lainnya'?'Lainnya…':o}</option>)}
                              </select>
                              {t.training==='lainnya'
                                ? <input value={t.customName||''} onChange={e=>saveRec(idOf(u),{ trainings:list.map((x:any)=>x.id===t.id?{...x,customName:e.target.value}:x) })} placeholder="Nama training" style={cellInput} />
                                : <span style={{ fontSize:11, color:'var(--text3)' }} />}
                              <input type="date" value={t.date||''} onChange={e=>saveRec(idOf(u),{ trainings:list.map((x:any)=>x.id===t.id?{...x,date:e.target.value}:x) })} style={cellInput} />
                              <input value={t.note||''} onChange={e=>saveRec(idOf(u),{ trainings:list.map((x:any)=>x.id===t.id?{...x,note:e.target.value}:x) })} placeholder="Keterangan" style={cellInput} />
                              <button onClick={()=>saveRec(idOf(u),{ trainings:list.filter((x:any)=>x.id!==t.id) })} className="btn btn-icon btn-sm" aria-label="Hapus baris" style={{ color:'var(--bad)' }}><Icon name="x" size={14} /></button>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td style={{ ...td, textAlign:'right' }}>
                        <button onClick={()=>saveRec(idOf(u),{ trainings:[...list, { id:uid(), training:'', customName:'', date:'', note:'' }] })} className="btn btn-sm" style={{ whiteSpace:'nowrap' }}><Icon name="plus" size={13} />Training</button>
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
                              <select aria-label={`Jenis support KPI ${u.name}`} value={k.jenis||''} onChange={e=>saveRec(idOf(u),{ supportKpi:list.map((x:any)=>x.id===k.id?{...x,jenis:e.target.value}:x) })} style={cellInput}>
                                <option value="">Jenis</option>{KPI_OPTS.map(o=><option key={o} value={o}>{o==='lainnya'?'Lainnya…':o}</option>)}
                              </select>
                              {k.jenis==='lainnya'
                                ? <input value={k.customName||''} onChange={e=>saveRec(idOf(u),{ supportKpi:list.map((x:any)=>x.id===k.id?{...x,customName:e.target.value}:x) })} placeholder="Jenis" style={cellInput} />
                                : <span />}
                              <input type="number" min={0} value={k.jumlah||0} onChange={e=>saveRec(idOf(u),{ supportKpi:list.map((x:any)=>x.id===k.id?{...x,jumlah:Number(e.target.value)||0}:x) })} placeholder="Jml" style={cellInput} />
                              <input type="date" value={k.lastDate||''} onChange={e=>saveRec(idOf(u),{ supportKpi:list.map((x:any)=>x.id===k.id?{...x,lastDate:e.target.value}:x) })} style={cellInput} />
                              <input value={k.note||''} onChange={e=>saveRec(idOf(u),{ supportKpi:list.map((x:any)=>x.id===k.id?{...x,note:e.target.value}:x) })} placeholder="Keterangan" style={cellInput} />
                              <button onClick={()=>saveRec(idOf(u),{ supportKpi:list.filter((x:any)=>x.id!==k.id) })} className="btn btn-icon btn-sm" aria-label="Hapus baris" style={{ color:'var(--bad)' }}><Icon name="x" size={14} /></button>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td style={{ ...td, textAlign:'right' }}>
                        <button onClick={()=>saveRec(idOf(u),{ supportKpi:[...list, { id:uid(), jenis:'', customName:'', jumlah:0, lastDate:'', note:'' }] })} className="btn btn-sm" style={{ whiteSpace:'nowrap' }}><Icon name="plus" size={13} />Jenis</button>
                      </td>
                    </tr>
                  )})}
                </tbody>
              </>
            )}
          </table>
          {filteredUsers.length===0 && <Empty title="Tidak ada member" text="Tidak ada member untuk filter status ini." />}
        </div>
        )}

        {subtab==='mcu' && (
          <div className="au-key"><span><i style={{ background:'var(--ok)', borderRadius:'50%' }} />P1–P3 baik</span><span><i style={{ background:'var(--warn-bar)', borderRadius:'50%' }} />P4 perhatian</span><span><i style={{ background:'var(--bad)', borderRadius:'50%' }} />P5–P6 tinggi</span></div>
        )}
      </div>
    </div>
  )
}
