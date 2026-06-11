'use client'
import { useEffect, useState } from 'react'

export default function ProgressOfProjectsPage() {
  const [config, setConfig] = useState<any>(null)
  const [initiatives, setInitiatives] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    Promise.all([
      fetch('/api/config').then(r=>r.json()),
      fetch('/api/initiatives').then(r=>r.json()),
    ]).then(([c,i]) => { setConfig(c.data); setInitiatives(i.data||[]); setLoading(false) })
  }, [])

  const subTabs = config?.progressSubTabs?.filter((t:any)=>t.active) || []
  const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']
  const CURRENT_MONTH = new Date().getMonth() + 1

  function toggle(id:string) {
    setExpanded(prev => { const s = new Set(prev); s.has(id)?s.delete(id):s.add(id); return s })
  }

  if (loading) return <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text3)' }}>Memuat...</div>

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ padding:'12px 20px', borderBottom:'1px solid var(--border)', background:'var(--bg2)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div>
          <div style={{ fontSize:14, fontWeight:600 }}>Progress of Projects</div>
          <div style={{ fontSize:11, color:'var(--text3)' }}>Plan vs Actual per kategori</div>
        </div>
        <div style={{ display:'flex', gap:12, fontSize:11, color:'var(--text3)', alignItems:'center' }}>
          <span style={{ display:'flex', alignItems:'center', gap:5 }}><span style={{ width:14, height:8, background:'var(--bg5)', borderRadius:3 }} />Plan</span>
          <span style={{ display:'flex', alignItems:'center', gap:5 }}><span style={{ width:14, height:8, background:'var(--blue)', borderRadius:3, opacity:0.8 }} />Actual</span>
          <span style={{ display:'flex', alignItems:'center', gap:5 }}><span style={{ width:14, height:8, background:'var(--green)', borderRadius:3 }} />Selesai</span>
        </div>
      </div>

      {/* Sub-tabs from config */}
      <div style={{ display:'flex', gap:4, padding:'8px 20px', background:'var(--bg2)', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
        <button onClick={()=>setActiveTab('all')} style={{ padding:'5px 14px', borderRadius:8, fontSize:12, fontWeight:500, cursor:'pointer', border:`1px solid ${activeTab==='all'?'var(--blue)':'var(--border)'}`, background:activeTab==='all'?'var(--bluebg)':'var(--bg3)', color:activeTab==='all'?'var(--blue)':'var(--text2)' }}>All</button>
        {subTabs.map((t:any) => (
          <button key={t.key} onClick={()=>setActiveTab(t.key)} style={{ padding:'5px 14px', borderRadius:8, fontSize:12, fontWeight:500, cursor:'pointer', border:`1px solid ${activeTab===t.key?t.color:'var(--border)'}`, background:activeTab===t.key?t.color+'22':'var(--bg3)', color:activeTab===t.key?t.color:'var(--text2)' }}>{t.label}</button>
        ))}
        <div style={{ flex:1 }} />
        <button className="btn btn-sm" onClick={()=>setExpanded(new Set(initiatives.map(i=>i._id)))}>Expand All</button>
        <button className="btn btn-sm" onClick={()=>setExpanded(new Set())}>Collapse All</button>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'14px 20px' }}>
        {initiatives.length === 0 ? (
          <div style={{ textAlign:'center', padding:60, color:'var(--text3)' }}>
            <div style={{ fontSize:32, marginBottom:8 }}>📈</div>
            <div>Belum ada project. Tambah lewat menu Konfigurasi atau API.</div>
          </div>
        ) : (
        <div className="card" style={{ overflow:'hidden' }}>
          <div style={{ display:'grid', gridTemplateColumns:'36px 280px 76px 76px 1fr', background:'var(--bg3)', borderBottom:'1px solid var(--border)' }}>
            {['','Activity','% Plan','% Actual',''].map((h,i) => (
              <div key={i} style={{ padding:'8px 10px', fontSize:10, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.05em', borderRight: i<4?'1px solid var(--border)':'none' }}>
                {i === 4 ? (
                  <div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', marginBottom:4 }}>
                      {['TW1','TW2','TW3','TW4'].map(tw => <div key={tw} style={{ textAlign:'center', fontSize:10, fontWeight:700, color:'var(--text2)' }}>{tw}</div>)}
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(12,1fr)' }}>
                      {months.map((m,mi) => <div key={m} style={{ textAlign:'center', fontSize:9, fontWeight:mi+1===CURRENT_MONTH?700:400, color:mi+1===CURRENT_MONTH?'var(--blue)':'var(--text3)' }}>{m}</div>)}
                    </div>
                  </div>
                ) : h}
              </div>
            ))}
          </div>
          {initiatives.map((ini, idx) => {
            const isExpanded = expanded.has(ini._id)
            return (
              <div key={ini._id}>
                <div style={{ display:'grid', gridTemplateColumns:'36px 280px 76px 76px 1fr', background:'var(--bg3)', borderBottom:'1px solid var(--border)', cursor:'pointer' }} onClick={() => toggle(ini._id)}>
                  <div style={{ padding:'9px 10px', textAlign:'center', fontSize:12, fontWeight:700, color:'var(--blue)', borderRight:'1px solid var(--border)' }}>{idx+1}</div>
                  <div style={{ padding:'9px 10px', fontSize:12, fontWeight:700, color:'var(--blue)', display:'flex', alignItems:'center', gap:6, borderRight:'1px solid var(--border)', gridColumn:'2/5' }}>
                    <span style={{ fontSize:10, color:'var(--text3)', transition:'transform 0.2s', display:'inline-block', transform: isExpanded?'rotate(90deg)':'rotate(0)' }}>▶</span>
                    <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ini.code} — {ini.title}</span>
                  </div>
                  <div style={{ padding:'9px 10px' }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                      <span style={{ fontSize:11, color:'var(--text3)' }}>Plan: <b style={{ color:'var(--text)' }}>{ini.planProgress}%</b></span>
                      <span style={{ fontSize:11, color:'var(--text3)' }}>Actual: <b style={{ color: ini.actualProgress >= ini.planProgress ? 'var(--green)' : 'var(--amber)' }}>{ini.actualProgress}%</b></span>
                    </div>
                  </div>
                </div>

                {isExpanded && ini.phases.map((phase:any, pi:number) => {
                  const planLeft = ((phase.planStartMonth-1)/12*100).toFixed(1)
                  const planWidth = (((phase.planEndMonth||12)-phase.planStartMonth+1)/12*100).toFixed(1)
                  const actLeft = phase.actualStartMonth ? (((phase.actualStartMonth||1)-1)/12*100).toFixed(1) : null
                  const actWidth = phase.actualStartMonth && phase.actualEndMonth ? (((phase.actualEndMonth||1)-(phase.actualStartMonth||1)+1)/12*100).toFixed(1) : null
                  const pctColor = phase.actualPct>=100?'var(--green)':phase.actualPct>0?'var(--blue)':'var(--text3)'
                  return (
                    <div key={phase._id||pi} style={{ display:'grid', gridTemplateColumns:'36px 280px 76px 76px 1fr', borderBottom:'1px solid var(--border)', background:'var(--bg2)' }}>
                      <div style={{ padding:'8px', fontSize:10, color:'var(--text3)', textAlign:'center', borderRight:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center' }}>{idx+1}.{pi+1}</div>
                      <div style={{ padding:'8px 10px', fontSize:11, color:'var(--text)', borderRight:'1px solid var(--border)', display:'flex', alignItems:'center' }}>{phase.name}</div>
                      <div style={{ padding:'8px 10px', borderRight:'1px solid var(--border)', display:'flex', alignItems:'center' }}>
                        <div style={{ textAlign:'center', width:'100%', fontSize:12, fontWeight:600, color:'var(--text2)' }}>{phase.planPct}%</div>
                      </div>
                      <div style={{ padding:'8px 10px', borderRight:'1px solid var(--border)', display:'flex', alignItems:'center' }}>
                        <div style={{ textAlign:'center', width:'100%', fontSize:12, fontWeight:600, color:pctColor }}>{phase.actualPct}%</div>
                      </div>
                      <div style={{ padding:'8px', position:'relative', display:'flex', flexDirection:'column', gap:3, justifyContent:'center' }}>
                        <div style={{ position:'absolute', left:`${((CURRENT_MONTH-0.5)/12*100).toFixed(1)}%`, top:0, bottom:0, width:1, background:'var(--blue)', opacity:0.3 }} />
                        <div style={{ position:'relative', height:10, background:'var(--bg4)', borderRadius:3 }}>
                          <div style={{ position:'absolute', top:0, left:`${planLeft}%`, width:`${planWidth}%`, height:'100%', background:'var(--bg5)', borderRadius:3 }} />
                        </div>
                        <div style={{ position:'relative', height:10, background:'var(--bg4)', borderRadius:3 }}>
                          {actLeft !== null && actWidth !== null && (
                            <div style={{ position:'absolute', top:0, left:`${actLeft}%`, width:`${actWidth}%`, height:'100%', background:pctColor, borderRadius:3, opacity:0.85 }} />
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
        )}
      </div>
    </div>
  )
}
