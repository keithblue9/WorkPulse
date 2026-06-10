'use client'
import { useEffect, useState } from 'react'
import { Initiative } from '@/types'

export default function GanttPage() {
  const [initiatives, setInitiatives] = useState<Initiative[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['all']))

  useEffect(() => {
    fetch('/api/initiatives').then(r => r.json()).then(d => { setInitiatives(d.data || []); setLoading(false) })
  }, [])

  const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']
  const CURRENT_MONTH = 6

  function toggleSection(id: string) {
    setExpandedSections(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ padding:'12px 20px', borderBottom:'1px solid var(--border)', background:'var(--bg2)', display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:14, fontWeight:600, color:'var(--text)' }}>Gantt Chart 2026</div>
          <div style={{ fontSize:11, color:'var(--text3)' }}>Plan vs Actual progress per phase</div>
        </div>
        <div style={{ display:'flex', gap:12, fontSize:11, color:'var(--text3)', alignItems:'center' }}>
          <span style={{ display:'flex', alignItems:'center', gap:5 }}><span style={{ width:14, height:8, background:'var(--bg5)', borderRadius:3, display:'inline-block' }}></span>Plan</span>
          <span style={{ display:'flex', alignItems:'center', gap:5 }}><span style={{ width:14, height:8, background:'var(--blue)', borderRadius:3, display:'inline-block', opacity:0.8 }}></span>Actual</span>
          <span style={{ display:'flex', alignItems:'center', gap:5 }}><span style={{ width:14, height:8, background:'var(--green)', borderRadius:3, display:'inline-block' }}></span>Selesai</span>
        </div>
        <button className="btn btn-sm" onClick={() => setExpandedSections(new Set(initiatives.map(i => i._id)))}>Expand All</button>
        <button className="btn btn-sm" onClick={() => setExpandedSections(new Set())}>Collapse All</button>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'16px 20px' }}>
        {loading ? <div style={{ textAlign:'center', padding:60, color:'var(--text3)' }}>Memuat...</div> : (
          <div className="card" style={{ overflow:'hidden' }}>
            {/* Header */}
            <div style={{ display:'grid', gridTemplateColumns:'36px 260px 76px 76px 1fr', background:'var(--bg3)', borderBottom:'1px solid var(--border)' }}>
              {['','Activity','% Plan','% Actual',''].map((h,i) => (
                <div key={i} style={{ padding:'8px 10px', fontSize:10, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.05em', borderRight: i<4 ? '1px solid var(--border)' : 'none' }}>
                  {i === 4 ? (
                    <div>
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', marginBottom:4 }}>
                        {['TW1','TW2','TW3','TW4'].map(tw => <div key={tw} style={{ textAlign:'center', fontSize:10, fontWeight:700, color:'var(--text2)' }}>{tw}</div>)}
                      </div>
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(12,1fr)' }}>
                        {months.map((m,mi) => <div key={m} style={{ textAlign:'center', fontSize:9, fontWeight: mi+1===CURRENT_MONTH?700:400, color: mi+1===CURRENT_MONTH?'var(--blue)':'var(--text3)', padding:'1px 0' }}>{m}</div>)}
                      </div>
                    </div>
                  ) : h}
                </div>
              ))}
            </div>

            {initiatives.map((ini, idx) => {
              const isExpanded = expandedSections.has(ini._id)
              return (
                <div key={ini._id}>
                  {/* Section header */}
                  <div style={{ display:'grid', gridTemplateColumns:'36px 260px 76px 76px 1fr', background:'var(--bg3)', borderBottom:'1px solid var(--border)', cursor:'pointer' }} onClick={() => toggleSection(ini._id)}>
                    <div style={{ padding:'9px 10px', textAlign:'center', fontSize:12, fontWeight:700, color:'var(--blue)', borderRight:'1px solid var(--border)' }}>{idx+1}</div>
                    <div style={{ padding:'9px 10px', fontSize:12, fontWeight:700, color:'var(--blue)', display:'flex', alignItems:'center', gap:6, borderRight:'1px solid var(--border)', gridColumn:'2/5' }}>
                      <span style={{ fontSize:10, color:'var(--text3)', transition:'transform 0.2s', display:'inline-block', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0)' }}>▶</span>
                      <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ini.code} — {ini.title}</span>
                    </div>
                    <div style={{ padding:'9px 10px', position:'relative' }}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                        <span style={{ fontSize:11, color:'var(--text3)' }}>Plan: <b style={{ color:'var(--text)' }}>{ini.planProgress}%</b></span>
                        <span style={{ fontSize:11, color:'var(--text3)' }}>Actual: <b style={{ color: ini.actualProgress >= ini.planProgress ? 'var(--green)' : 'var(--amber)' }}>{ini.actualProgress}%</b></span>
                      </div>
                    </div>
                  </div>

                  {/* Phase rows */}
                  {isExpanded && ini.phases.map((phase, pi) => {
                    const planLeft = ((phase.planStartMonth-1)/12*100).toFixed(1)
                    const planWidth = (((phase.planEndMonth||12)-phase.planStartMonth+1)/12*100).toFixed(1)
                    const actLeft = phase.actualStartMonth ? (((phase.actualStartMonth||1)-1)/12*100).toFixed(1) : null
                    const actWidth = phase.actualStartMonth && phase.actualEndMonth ? (((phase.actualEndMonth||1)-(phase.actualStartMonth||1)+1)/12*100).toFixed(1) : null
                    const pctColor = phase.actualPct>=100?'var(--green)':phase.actualPct>0?'var(--blue)':'var(--text3)'
                    return (
                      <div key={phase._id} style={{ display:'grid', gridTemplateColumns:'36px 260px 76px 76px 1fr', borderBottom:'1px solid var(--border)', background:'var(--bg2)', transition:'background 0.1s' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='var(--bg3)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background='var(--bg2)'}>
                        <div style={{ padding:'8px', fontSize:10, color:'var(--text3)', textAlign:'center', borderRight:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center' }}>{idx+1}.{pi+1}</div>
                        <div style={{ padding:'8px 10px', fontSize:11, color:'var(--text)', borderRight:'1px solid var(--border)', display:'flex', alignItems:'center' }}>{phase.name}</div>
                        <div style={{ padding:'8px 10px', borderRight:'1px solid var(--border)', display:'flex', alignItems:'center' }}>
                          <div style={{ textAlign:'center', width:'100%' }}>
                            <div style={{ fontSize:12, fontWeight:600, color:'var(--text2)' }}>{phase.planPct}%</div>
                          </div>
                        </div>
                        <div style={{ padding:'8px 10px', borderRight:'1px solid var(--border)', display:'flex', alignItems:'center' }}>
                          <div style={{ textAlign:'center', width:'100%' }}>
                            <div style={{ fontSize:12, fontWeight:600, color:pctColor }}>{phase.actualPct}%</div>
                          </div>
                        </div>
                        {/* Bar area */}
                        <div style={{ padding:'8px 8px', position:'relative', display:'flex', flexDirection:'column', gap:3, justifyContent:'center' }}>
                          {/* Current month indicator */}
                          <div style={{ position:'absolute', left:`${((CURRENT_MONTH-0.5)/12*100).toFixed(1)}%`, top:0, bottom:0, width:1, background:'var(--blue)', opacity:0.3, pointerEvents:'none' }} />
                          {/* Plan bar */}
                          <div style={{ position:'relative', height:10, background:'var(--bg4)', borderRadius:3 }}>
                            <div style={{ position:'absolute', top:0, left:`${planLeft}%`, width:`${planWidth}%`, height:'100%', background:'var(--bg5)', borderRadius:3 }} />
                          </div>
                          {/* Actual bar */}
                          <div style={{ position:'relative', height:10, background:'var(--bg4)', borderRadius:3 }}>
                            {actLeft !== null && actWidth !== null && (
                              <div style={{ position:'absolute', top:0, left:`${actLeft}%`, width:`${actWidth}%`, height:'100%', background: pctColor, borderRadius:3, opacity:0.85 }} />
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}

            <div style={{ background:'var(--bg3)', borderTop:'1px solid var(--border)', padding:'8px 16px', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
              <span style={{ fontSize:11, color:'var(--text3)' }}>Checkpoint M6 (Mid Year) — Target kumulatif:</span>
              <span style={{ fontSize:13, fontWeight:700, color:'var(--amber)' }}>50%</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
