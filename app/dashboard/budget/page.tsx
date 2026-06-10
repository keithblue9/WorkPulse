'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'

const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']
function formatRp(n:number) { return new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',minimumFractionDigits:0}).format(n) }

export default function BudgetPage() {
  const { data:session } = useSession(); const user = session?.user as any
  const [config, setConfig] = useState<any>(null)
  const [entries, setEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editCell, setEditCell] = useState<{key:string;month:number;field:'plan'|'actual'}|null>(null)
  const [editVal, setEditVal] = useState('')
  const [activeCat, setActiveCat] = useState('')
  const [year] = useState(2026)

  async function load() {
    const [cfg, bud] = await Promise.all([
      fetch('/api/config').then(r=>r.json()),
      fetch(`/api/budget?year=${year}`).then(r=>r.json()),
    ])
    setConfig(cfg.data)
    setEntries(bud.data||[])
    if (cfg.data?.budgetCategories?.length > 0) setActiveCat(cfg.data.budgetCategories[0].key)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const categories = config?.budgetCategories || []
  const activeCatDef = categories.find((c:any) => c.key === activeCat)

  function getEntry(catKey:string, month:number) {
    return entries.find(e => e.categoryKey===catKey && e.month===month)
  }

  async function saveCell(catKey:string, month:number, field:'plan'|'actual') {
    const val = parseInt(editVal.replace(/\D/g,'')) || 0
    await fetch('/api/budget', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ categoryKey:catKey, year, month, [field==='plan'?'planAmount':'actualAmount']:val }) })
    await load(); setEditCell(null); setEditVal('')
    toast.success('Anggaran diperbarui')
  }

  async function updateCatBudget(key:string, annualBudget:number, threshold:number) {
    const updated = categories.map((c:any) => c.key===key ? {...c, annualBudget, threshold} : c)
    await fetch('/api/config', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ budgetCategories: updated }) })
    load(); toast.success('Anggaran tahunan diperbarui')
  }

  const canManage = ['admin','manager','finance'].includes(user?.role||'')

  if (loading) return <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text3)' }}>Memuat...</div>

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ padding:'12px 20px', borderBottom:'1px solid var(--border)', background:'var(--bg2)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div><div style={{ fontSize:14, fontWeight:600 }}>Manajemen Anggaran {year}</div><div style={{ fontSize:11, color:'var(--text3)' }}>Dinas & Akomodasi — Plan vs Realisasi</div></div>
      </div>

      {/* Category tabs */}
      <div style={{ display:'flex', gap:6, padding:'8px 20px', background:'var(--bg2)', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
        {categories.map((cat:any) => {
          const totalPlan = entries.filter(e=>e.categoryKey===cat.key).reduce((s:number,e:any)=>s+e.planAmount,0)
          const totalActual = entries.filter(e=>e.categoryKey===cat.key).reduce((s:number,e:any)=>s+e.actualAmount,0)
          const pct = cat.annualBudget > 0 ? Math.round(totalActual/cat.annualBudget*100) : 0
          const isOver = pct >= cat.threshold
          return (
            <button key={cat.key} onClick={()=>setActiveCat(cat.key)} style={{ padding:'6px 14px', borderRadius:8, fontSize:12, fontWeight:500, cursor:'pointer', border:`1px solid ${activeCat===cat.key?'var(--blue)':'var(--border)'}`, background:activeCat===cat.key?'var(--bluebg)':'var(--bg3)', color:activeCat===cat.key?'var(--blue)':'var(--text2)' }}>
              {cat.label}
              {cat.annualBudget > 0 && <span style={{ marginLeft:6, fontSize:10, color:isOver?'var(--red)':'var(--text3)', fontWeight:600 }}>{pct}%</span>}
            </button>
          )
        })}
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'16px 20px' }}>
        {activeCatDef && (
          <>
            {/* Summary cards */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:16 }}>
              {(() => {
                const catEntries = entries.filter(e=>e.categoryKey===activeCat)
                const totalPlan = catEntries.reduce((s:number,e:any)=>s+e.planAmount,0)
                const totalActual = catEntries.reduce((s:number,e:any)=>s+e.actualAmount,0)
                const remaining = activeCatDef.annualBudget - totalActual
                const currentMonth = new Date().getMonth()+1
                const monthsLeft = 12 - currentMonth
                const burnRate = currentMonth > 0 ? totalActual/currentMonth : 0
                const estYearEnd = burnRate * 12
                const pct = activeCatDef.annualBudget > 0 ? Math.round(totalActual/activeCatDef.annualBudget*100) : 0
                const isOver = pct >= activeCatDef.threshold
                return (<>
                  <div className="card" style={{ padding:'12px 14px' }}>
                    <div style={{ fontSize:10, color:'var(--text3)', marginBottom:3 }}>Anggaran Tahunan</div>
                    <div style={{ fontSize:16, fontWeight:700, color:'var(--text)' }}>{formatRp(activeCatDef.annualBudget)}</div>
                    <div style={{ fontSize:10, color:'var(--text3)', marginTop:2 }}>Threshold alert: {activeCatDef.threshold}%</div>
                  </div>
                  <div className="card" style={{ padding:'12px 14px' }}>
                    <div style={{ fontSize:10, color:'var(--text3)', marginBottom:3 }}>Realisasi s.d. Sekarang</div>
                    <div style={{ fontSize:16, fontWeight:700, color: isOver?'var(--red)':'var(--blue)' }}>{formatRp(totalActual)}</div>
                    <div style={{ fontSize:10, color: isOver?'var(--red)':'var(--text3)', fontWeight: isOver?600:400, marginTop:2 }}>{pct}% dari anggaran {isOver?'⚠ MELEBIHI THRESHOLD':''}</div>
                  </div>
                  <div className="card" style={{ padding:'12px 14px' }}>
                    <div style={{ fontSize:10, color:'var(--text3)', marginBottom:3 }}>Sisa Anggaran</div>
                    <div style={{ fontSize:16, fontWeight:700, color: remaining<0?'var(--red)':'var(--green)' }}>{formatRp(remaining)}</div>
                    <div style={{ fontSize:10, color:'var(--text3)', marginTop:2 }}>untuk {monthsLeft} bulan lagi</div>
                  </div>
                  <div className="card" style={{ padding:'12px 14px', borderLeft:`3px solid ${estYearEnd>activeCatDef.annualBudget?'var(--red)':'var(--amber)'}` }}>
                    <div style={{ fontSize:10, color:'var(--text3)', marginBottom:3 }}>Estimasi Akhir Tahun</div>
                    <div style={{ fontSize:16, fontWeight:700, color: estYearEnd>activeCatDef.annualBudget?'var(--red)':'var(--amber)' }}>{formatRp(estYearEnd)}</div>
                    <div style={{ fontSize:10, color:'var(--text3)', marginTop:2 }}>Burn rate: {formatRp(burnRate)}/bln</div>
                  </div>
                </>)
              })()}
            </div>

            {/* Config annual budget */}
            {canManage && (
              <div className="card" style={{ padding:'12px 16px', marginBottom:16 }}>
                <div style={{ fontSize:12, fontWeight:600, color:'var(--text)', marginBottom:10 }}>⚙️ Set Anggaran {activeCatDef.label}</div>
                <div style={{ display:'flex', gap:10, alignItems:'flex-end', flexWrap:'wrap' }}>
                  <div><label style={lbl}>Anggaran Tahunan (Rp)</label>
                    <input className="input" style={{ width:200 }} defaultValue={activeCatDef.annualBudget} id={`budget-${activeCat}`} placeholder="0" /></div>
                  <div><label style={lbl}>Threshold Alert (%)</label>
                    <input type="number" className="input" style={{ width:100 }} defaultValue={activeCatDef.threshold} id={`threshold-${activeCat}`} min={50} max={100} /></div>
                  <button className="btn btn-primary btn-sm" onClick={()=>{
                    const budEl = document.getElementById(`budget-${activeCat}`) as HTMLInputElement
                    const thrEl = document.getElementById(`threshold-${activeCat}`) as HTMLInputElement
                    updateCatBudget(activeCat, parseInt(budEl.value.replace(/\D/g,''))||0, parseInt(thrEl.value)||80)
                  }}>Simpan</button>
                </div>
              </div>
            )}

            {/* Monthly table */}
            <div className="card" style={{ overflow:'hidden' }}>
              <table className="wp-table" style={{ width:'100%' }}>
                <thead><tr>
                  <th style={{ width:80 }}>Bulan</th>
                  <th style={{ textAlign:'right' }}>Plan (Rp)</th>
                  <th style={{ textAlign:'right' }}>Realisasi (Rp)</th>
                  <th style={{ width:100 }}>Progress</th>
                  <th style={{ width:80 }}>Selisih</th>
                </tr></thead>
                <tbody>
                  {MONTHS.map((m,i) => {
                    const month = i+1
                    const entry = getEntry(activeCat, month)
                    const plan = entry?.planAmount || 0
                    const actual = entry?.actualAmount || 0
                    const diff = actual - plan
                    const isPast = month <= new Date().getMonth()+1
                    const isEditing = editCell?.key===activeCat && editCell?.month===month

                    return (
                      <tr key={m} style={{ opacity: !isPast&&month>new Date().getMonth()+1 ? 0.5 : 1 }}>
                        <td style={{ fontWeight:month===new Date().getMonth()+1?600:400, color:month===new Date().getMonth()+1?'var(--blue)':'var(--text2)' }}>{m} {month===new Date().getMonth()+1?'▸':''}</td>
                        <td style={{ textAlign:'right' }}>
                          {canManage && editCell?.key===activeCat && editCell?.month===month && editCell?.field==='plan' ? (
                            <input autoFocus className="input" style={{ width:140, textAlign:'right' }} value={editVal} onChange={e=>setEditVal(e.target.value)} onBlur={()=>saveCell(activeCat,month,'plan')} onKeyDown={e=>{if(e.key==='Enter')saveCell(activeCat,month,'plan');if(e.key==='Escape')setEditCell(null)}} />
                          ) : (
                            <span style={{ cursor:canManage?'pointer':'default', color:'var(--text2)' }} onClick={()=>{if(!canManage)return;setEditCell({key:activeCat,month,field:'plan'});setEditVal(String(plan))}}>{plan>0?formatRp(plan):'—'}</span>
                          )}
                        </td>
                        <td style={{ textAlign:'right' }}>
                          {canManage && editCell?.key===activeCat && editCell?.month===month && editCell?.field==='actual' ? (
                            <input autoFocus className="input" style={{ width:140, textAlign:'right' }} value={editVal} onChange={e=>setEditVal(e.target.value)} onBlur={()=>saveCell(activeCat,month,'actual')} onKeyDown={e=>{if(e.key==='Enter')saveCell(activeCat,month,'actual');if(e.key==='Escape')setEditCell(null)}} />
                          ) : (
                            <span style={{ cursor:canManage?'pointer':'default', color:actual>plan&&plan>0?'var(--red)':'var(--green)' }} onClick={()=>{if(!canManage)return;setEditCell({key:activeCat,month,field:'actual'});setEditVal(String(actual))}}>{actual>0?formatRp(actual):'—'}</span>
                          )}
                        </td>
                        <td>
                          {plan > 0 && (
                            <div className="prog-bar"><div className="prog-fill" style={{ width:`${Math.min(100,Math.round(actual/plan*100))}%`, background:actual>plan?'var(--red)':actual>plan*0.8?'var(--amber)':'var(--blue)' }} /></div>
                          )}
                        </td>
                        <td style={{ fontSize:11, fontWeight:600, color:diff>0?'var(--red)':diff<0?'var(--green)':'var(--text3)' }}>
                          {diff!==0 ? (diff>0?'+':'')+formatRp(diff) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {canManage && <div style={{ padding:'8px 12px', fontSize:11, color:'var(--text3)', borderTop:'1px solid var(--border)' }}>Klik nilai Plan atau Realisasi untuk mengedit langsung</div>}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
const lbl: React.CSSProperties = { display:'block', fontSize:11, fontWeight:500, color:'var(--text2)', marginBottom:5 }
