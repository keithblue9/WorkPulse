'use client'
import { getConfig } from '@/lib/configCache'
import { picArray } from '@/lib/defaults'
import { useEffect, useState, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { format, subDays } from 'date-fns'

const PRIORITY_CFG: Record<string,{label:string;color:string;bg:string}> = {
  high:{label:'High', color:'var(--red)', bg:'var(--redbg)'},
  medium:{label:'Medium', color:'var(--amber)', bg:'var(--amberbg)'},
  low:{label:'Low', color:'var(--green)', bg:'var(--greenbg)'},
}

function CountUp({ end, prefix='', suffix='' }: { end:number; prefix?:string; suffix?:string }) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    let r=0, start=performance.now()
    const dur=900
    const step = (t:number) => { const p = Math.min(1, (t-start)/dur); r = Math.round(end * (1 - Math.pow(1-p,3))); setVal(r); if (p<1) requestAnimationFrame(step) }
    requestAnimationFrame(step)
  }, [end])
  return <>{prefix}{val.toLocaleString('id-ID')}{suffix}</>
}

// Pie/donut chart component using SVG
function DonutChart({ data, size=180 }: { data: {label:string; value:number; color:string}[]; size?:number }) {
  const total = data.reduce((s,d)=>s+d.value,0) || 1
  let cumAngle = 0
  const radius = size/2 - 12
  const center = size/2
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {data.map((d, i) => {
        const angle = (d.value / total) * Math.PI * 2
        const x1 = center + radius * Math.cos(cumAngle - Math.PI/2)
        const y1 = center + radius * Math.sin(cumAngle - Math.PI/2)
        cumAngle += angle
        const x2 = center + radius * Math.cos(cumAngle - Math.PI/2)
        const y2 = center + radius * Math.sin(cumAngle - Math.PI/2)
        const large = angle > Math.PI ? 1 : 0
        if (d.value === 0) return null
        return (
          <path key={i} d={`M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2} Z`} fill={d.color} opacity={0.85} stroke="var(--bg)" strokeWidth="2" />
        )
      })}
      <circle cx={center} cy={center} r={radius*0.55} fill="var(--bg2)" />
      <text x={center} y={center-4} textAnchor="middle" fontSize="22" fontWeight="700" fill="var(--text)">{total}</text>
      <text x={center} y={center+12} textAnchor="middle" fontSize="9" fill="var(--text3)">Total</text>
    </svg>
  )
}

export default function DashboardPage() {
  const { data:session } = useSession(); const user = session?.user as any
  const [tab, setTab] = useState<'general'|'progress'|'issues'>('general')
  const [activities, setActivities] = useState<any[]>([])
  const [initiatives, setInitiatives] = useState<any[]>([])
  const [issues, setIssues] = useState<any[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [config, setConfig] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [aiQuotes, setAiQuotes] = useState(''); const [loadingQuotes, setLoadingQuotes] = useState(false)
  const [aiTeam, setAiTeam] = useState(''); const [loadingTeam, setLoadingTeam] = useState(false)
  const [aiPersonal, setAiPersonal] = useState(''); const [loadingPersonal, setLoadingPersonal] = useState(false)

  async function load() {
    setLoading(true)
    const [a, init, iss, m, c] = await Promise.all([
      fetch('/api/projects').then(r=>r.json()),
      fetch('/api/initiatives').then(r=>r.json()),
      fetch('/api/issues').then(r=>r.json()),
      fetch('/api/users').then(r=>r.json()),
      getConfig().then((data:any)=>({ data })),
    ])
    setActivities(a.data||[]); setInitiatives(init.data||[]); setIssues(iss.data||[]); setMembers(m.data||[]); setConfig(c.data); setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function genQuotes() {
    setLoadingQuotes(true); setAiQuotes('')
    try {
      const r = await fetch('/api/ai-insight', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ type:'quotes' }) })
      const d = await r.json(); setAiQuotes(d.data?.insight || ('⚠️ '+(d.error||'failed')))
    } finally { setLoadingQuotes(false) }
  }
  async function genTeam() {
    setLoadingTeam(true); setAiTeam('')
    try {
      const r = await fetch('/api/ai-insight', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ type:'team' }) })
      const d = await r.json(); setAiTeam(d.data?.insight || ('⚠️ '+(d.error||'failed')))
    } finally { setLoadingTeam(false) }
  }
  async function genPersonal() {
    setLoadingPersonal(true); setAiPersonal('')
    try {
      const r = await fetch('/api/ai-insight', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ type:'personal', userName: user?.name, userEmail: user?.email }) })
      const d = await r.json(); setAiPersonal(d.data?.insight || ('⚠️ '+(d.error||'failed')))
    } finally { setLoadingPersonal(false) }
  }

  // Stats
  const stats = useMemo(() => {
    const kpi = activities.filter(a => a.subType === 'KPI').length
    const nonKpi = activities.filter(a => a.subType === 'Non-KPI').length
    const goLive = activities.filter(a => a.subType === 'Go-Live').length
    const anggaran = activities.filter(a => a.subType === 'Anggaran').length
    const others = activities.filter(a => a.subType === 'Others').length
    const highPriority = activities.filter(a => a.priority === 'high').length
    return { kpi, nonKpi, goLive, anggaran, others, highPriority, total: activities.length }
  }, [activities])

  // Dashboard widgets toggle
  const widgets = config?.dashboardWidgets || []
  const isWidgetActive = (key:string) => widgets.find((w:any) => w.key === key)?.active !== false

  // Progress chart data
  const progressData = useMemo(() => {
    const cfg = config?.activitySubTypes?.filter((s:any)=>s.active) || []
    return cfg.map((c:any) => ({
      label: c.label,
      value: activities.filter(a => a.subType === c.key).length,
      color: c.color || 'var(--brand)',
    })).filter(d => d.value > 0)
  }, [activities, config])

  // Issue distribution by status
  const issueDist = useMemo(() => {
    const statuses = config?.issueStatuses?.filter((s:any)=>s.active) || []
    return statuses.map((s:any) => ({ label:s.label, value:activities.filter(a=>a.status===s.key).length, color:s.color }))
  }, [activities, config])

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {/* Header with tabs */}
      <div style={{ padding:'12px 20px', borderBottom:'1px solid var(--border)', background:'var(--bg2)', flexShrink:0 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', flexWrap:'wrap', gap:10 }}>
          <div>
            <div style={{ fontSize:14, fontWeight:600 }}>Halo, {user?.name?.split(' ')[0] || 'Mas E'} 👋</div>
            <div style={{ fontSize:11, color:'var(--text3)' }}>{format(new Date(),'EEEE, d MMMM yyyy')}</div>
          </div>
          <div style={{ display:'flex', gap:5 }}>
            <button onClick={()=>setTab('general')} style={tabBtn(tab==='general')}>📊 General</button>
            <button onClick={()=>setTab('progress')} style={tabBtn(tab==='progress')}>📈 Progress Project</button>
            <button onClick={()=>setTab('issues')} style={tabBtn(tab==='issues')}>⚠️ Issues</button>
          </div>
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'14px 20px' }} className="safe-bottom">
        {loading ? <div style={{ textAlign:'center', padding:60, color:'var(--text3)' }}>Memuat data...</div> : (
          <>
            {/* ============ GENERAL TAB ============ */}
            {tab === 'general' && (
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                {/* Stat cards row */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(155px, 1fr))', gap:10 }}>
                  {isWidgetActive('stat-kpi') && <Stat icon="🎯" label="KPI" val={stats.kpi} color="var(--brand)" />}
                  {isWidgetActive('stat-nonkpi') && <Stat icon="📋" label="Non KPI" val={stats.nonKpi} color="var(--purple)" />}
                  {isWidgetActive('stat-golive') && <Stat icon="🚀" label="Go Live" val={stats.goLive} color="var(--green)" />}
                  {isWidgetActive('stat-anggaran') && <Stat icon="💰" label="Anggaran" val={stats.anggaran} color="var(--amber)" />}
                  {isWidgetActive('stat-others') && <Stat icon="📁" label="Others" val={stats.others} color="var(--text3)" />}
                  {isWidgetActive('stat-highpriority') && <Stat icon="🔥" label="High Priority" val={stats.highPriority} color="var(--red)" />}
                </div>

                {/* AI Insights row */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', gap:10 }}>
                  {isWidgetActive('ai-quotes') && (
                    <div className="card glass" style={{ padding:14 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                        <div style={{ fontSize:11, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.06em' }}>💡 Quote of the Day</div>
                        <button onClick={genQuotes} disabled={loadingQuotes} className="btn btn-icon btn-sm">↻</button>
                      </div>
                      {!aiQuotes && !loadingQuotes ? <button onClick={genQuotes} className="btn btn-sm" style={{ width:'100%' }}>✨ Generate Quote</button> :
                       loadingQuotes ? <div style={{ fontSize:11, color:'var(--text3)' }}>Generating...</div> :
                       <div style={{ fontSize:12, lineHeight:1.6, whiteSpace:'pre-wrap', color:'var(--text2)' }}>{aiQuotes}</div>
                      }
                    </div>
                  )}
                  {isWidgetActive('ai-insight-personal') && (
                    <div className="card glass" style={{ padding:14 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                        <div style={{ fontSize:11, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.06em' }}>🤖 AI Insight — Personal</div>
                        <button onClick={genPersonal} disabled={loadingPersonal} className="btn btn-icon btn-sm">↻</button>
                      </div>
                      <div style={{ fontSize:9, color:'var(--text3)', marginBottom:6 }}>Khusus untuk {user?.name}, ga bisa dibaca user lain</div>
                      {!aiPersonal && !loadingPersonal ? <button onClick={genPersonal} className="btn btn-sm" style={{ width:'100%' }}>✨ Generate Next Actions</button> :
                       loadingPersonal ? <div style={{ fontSize:11, color:'var(--text3)' }}>Generating...</div> :
                       <div style={{ fontSize:12, lineHeight:1.6, whiteSpace:'pre-wrap', color:'var(--text2)' }}>{aiPersonal}</div>
                      }
                    </div>
                  )}
                  {isWidgetActive('ai-insight-team') && (
                    <div className="card glass" style={{ padding:14 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                        <div style={{ fontSize:11, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.06em' }}>🤝 AI Insight — Tim</div>
                        <button onClick={genTeam} disabled={loadingTeam} className="btn btn-icon btn-sm">↻</button>
                      </div>
                      {!aiTeam && !loadingTeam ? <button onClick={genTeam} className="btn btn-sm" style={{ width:'100%' }}>✨ Generate Actions</button> :
                       loadingTeam ? <div style={{ fontSize:11, color:'var(--text3)' }}>Generating...</div> :
                       <div style={{ fontSize:12, lineHeight:1.6, whiteSpace:'pre-wrap', color:'var(--text2)' }}>{aiTeam}</div>
                      }
                    </div>
                  )}
                </div>

                {/* Progress chart + upcoming */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  {isWidgetActive('progress-chart') && (
                    <div className="card" style={{ padding:14 }}>
                      <div style={{ fontSize:11, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>📊 Progress Project Distribution</div>
                      <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                        <DonutChart data={progressData} />
                        <div style={{ flex:1, display:'flex', flexDirection:'column', gap:5 }}>
                          {progressData.map((d, i) => (
                            <div key={i} style={{ display:'flex', alignItems:'center', gap:6, fontSize:11 }}>
                              <div style={{ width:10, height:10, borderRadius:2, background:d.color }} />
                              <span style={{ flex:1 }}>{d.label}</span>
                              <span style={{ fontWeight:600 }}>{d.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  {isWidgetActive('upcoming-agenda') && (
                    <div className="card" style={{ padding:14 }}>
                      <div style={{ fontSize:11, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>📅 Agenda Mendatang</div>
                      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                        {activities.filter(a => a.actionDate && new Date(a.actionDate)>=new Date()).sort((a,b)=>(a.actionDate||'').localeCompare(b.actionDate||'')).slice(0,5).map(a => (
                          <Link key={a._id} href={`/dashboard/calendar`} style={{ textDecoration:'none', color:'inherit' }}>
                            <div style={{ padding:'8px 10px', borderRadius:7, background:'var(--bg3)', fontSize:11 }}>
                              <div style={{ fontWeight:600 }}>{a.title}</div>
                              <div style={{ color:'var(--text3)', fontSize:10 }}>{a.actionDate} · {a.category}</div>
                            </div>
                          </Link>
                        ))}
                        {activities.filter(a => a.actionDate && new Date(a.actionDate)>=new Date()).length === 0 && (
                          <div style={{ fontSize:11, color:'var(--text3)', textAlign:'center', padding:20 }}>Tidak ada agenda mendatang</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ============ PROGRESS PROJECT TAB (GANTT CHART) ============ */}
            {tab === 'progress' && (
              <div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:600 }}>Progress Initiatives — Gantt View</div>
                    <div style={{ fontSize:11, color:'var(--text3)' }}>{initiatives.length} initiative · Plan (atas) vs Actual (bawah)</div>
                  </div>
                  <Link href="/dashboard/progress" className="btn btn-primary btn-sm" style={{ textDecoration:'none' }}>📊 Buka Progress Page</Link>
                </div>
                {initiatives.length === 0 ? (
                  <div className="card" style={{ padding:30, textAlign:'center', color:'var(--text3)' }}>Belum ada initiative</div>
                ) : (
                  <div className="card" style={{ padding:14, overflow:'auto' }}>
                    {/* Month headers */}
                    <div style={{ display:'grid', gridTemplateColumns:'240px repeat(12, 1fr) 80px', gap:0, alignItems:'center', minWidth:900, marginBottom:6, fontSize:10, color:'var(--text3)', fontWeight:600 }}>
                      <div style={{ padding:'6px 8px' }}>Initiative</div>
                      {['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'].map(m => (
                        <div key={m} style={{ textAlign:'center', borderLeft:'1px solid var(--border)', padding:'6px 0' }}>{m}</div>
                      ))}
                      <div style={{ textAlign:'right', padding:'6px 8px' }}>%</div>
                    </div>
                    {/* Initiative rows */}
                    {initiatives.map(i => (
                      <div key={i._id} className="glass-hover" style={{ display:'grid', gridTemplateColumns:'240px repeat(12, 1fr) 80px', gap:0, alignItems:'center', minWidth:900, padding:'6px 0', borderTop:'1px solid var(--border)', cursor:'pointer' }} onClick={()=>{ window.location.href='/dashboard/progress' }}>
                        <div style={{ padding:'4px 8px', minWidth:0 }}>
                          <div style={{ fontSize:9, color:'var(--text3)' }}>{i.code}</div>
                          <div style={{ fontSize:12, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{i.title}</div>
                          {picArray(i.pic).length > 0 && <div style={{ fontSize:9, color:'var(--text3)' }}>👤 {picArray(i.pic).slice(0,2).join(', ')}{i.pic.length>2?` +${i.pic.length-2}`:''}</div>}
                        </div>
                        {/* 12 month cells with phase bars */}
                        <div style={{ gridColumn:'2 / span 12', position:'relative', height:36, borderLeft:'1px solid var(--border)' }}>
                          {/* Month grid lines */}
                          {Array.from({length:12}).map((_,m) => (
                            <div key={m} style={{ position:'absolute', left:`${(m/12)*100}%`, top:0, bottom:0, width:'1px', background:'var(--border)' }} />
                          ))}
                          {/* Plan bars (top half, blue) */}
                          {(i.phases||[]).map((ph:any, idx:number) => {
                            if (!ph.planStartMonth || !ph.planEndMonth) return null
                            const start = ((ph.planStartMonth-1)/12)*100
                            const width = ((ph.planEndMonth-ph.planStartMonth+1)/12)*100
                            return (
                              <div key={`p${idx}`} style={{ position:'absolute', left:`${start}%`, width:`${width}%`, top:4, height:12, background:'var(--brand)', borderRadius:3, opacity:0.7, display:'flex', alignItems:'center', justifyContent:'center', fontSize:8, color:'#fff', fontWeight:700 }} title={`Plan ${ph.name}: ${ph.planStartMonth}-${ph.planEndMonth}`}>
                                {width > 8 && (ph.name || 'P'+(idx+1))}
                              </div>
                            )
                          })}
                          {/* Actual bars (bottom half, green) */}
                          {(i.phases||[]).map((ph:any, idx:number) => {
                            if (!ph.actualStartMonth || !ph.actualEndMonth) return null
                            const start = ((ph.actualStartMonth-1)/12)*100
                            const width = ((ph.actualEndMonth-ph.actualStartMonth+1)/12)*100
                            return (
                              <div key={`a${idx}`} style={{ position:'absolute', left:`${start}%`, width:`${width}%`, top:20, height:12, background:'var(--green)', borderRadius:3, opacity:0.85, display:'flex', alignItems:'center', justifyContent:'center', fontSize:8, color:'#fff', fontWeight:700 }} title={`Actual ${ph.name}: ${ph.actualStartMonth}-${ph.actualEndMonth}`}>
                                {width > 8 && (ph.name || 'P'+(idx+1))}
                              </div>
                            )
                          })}
                        </div>
                        <div style={{ padding:'4px 8px', textAlign:'right', fontSize:11 }}>
                          <div style={{ color:'var(--brand)', fontWeight:700 }}>{(i.planProgress||0).toFixed(0)}%</div>
                          <div style={{ color:'var(--green)', fontWeight:700 }}>{(i.actualProgress||0).toFixed(0)}%</div>
                        </div>
                      </div>
                    ))}
                    <div style={{ display:'flex', gap:14, padding:'10px 8px', fontSize:10, color:'var(--text3)' }}>
                      <span style={{ display:'flex', alignItems:'center', gap:5 }}><span style={{ width:14, height:8, background:'var(--brand)', borderRadius:2, opacity:0.7 }} /> Plan</span>
                      <span style={{ display:'flex', alignItems:'center', gap:5 }}><span style={{ width:14, height:8, background:'var(--green)', borderRadius:2, opacity:0.85 }} /> Actual</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ============ ISSUES TAB ============ */}
            {tab === 'issues' && (
              <div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                  <div style={{ fontSize:13, fontWeight:600 }}>Issues Overview (dari Activities)</div>
                  <Link href="/dashboard/issues" className="btn btn-primary btn-sm" style={{ textDecoration:'none' }}>⚠️ Buka Issues Page</Link>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
                  <div className="card" style={{ padding:14 }}>
                    <div style={{ fontSize:11, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>Status Distribution</div>
                    <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                      <DonutChart data={issueDist.filter(d=>d.value>0)} />
                      <div style={{ flex:1, display:'flex', flexDirection:'column', gap:5 }}>
                        {issueDist.map((d, i) => (
                          <div key={i} style={{ display:'flex', alignItems:'center', gap:6, fontSize:11 }}>
                            <div style={{ width:10, height:10, borderRadius:2, background:d.color }} />
                            <span style={{ flex:1 }}>{d.label}</span>
                            <span style={{ fontWeight:600 }}>{d.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="card" style={{ padding:14 }}>
                    <div style={{ fontSize:11, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>High Priority Active</div>
                    {activities.filter(a=>a.priority==='high' && a.status!=='completed').slice(0,5).map(a => (
                      <div key={a._id} style={{ padding:'8px 0', borderBottom:'1px solid var(--border)', fontSize:11 }}>
                        <div style={{ fontWeight:600 }}>{a.title}</div>
                        <div style={{ color:'var(--text3)', fontSize:10 }}>{a.category} · PIC: {picArray(a.pic).join(', ') || a.picName || '—'}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <Link href="/dashboard/issues" style={{ textDecoration:'none' }}>
                  <div className="card glass-hover" style={{ padding:14, textAlign:'center', cursor:'pointer' }}>
                    <div style={{ fontSize:11, color:'var(--text2)' }}>Klik untuk lihat detail tabel Issues</div>
                  </div>
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Stat({ icon, label, val, color }: { icon:string; label:string; val:number; color:string }) {
  return (
    <div className="card glass-hover" style={{ padding:14, borderLeft:`3px solid ${color}` }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5 }}>
        <span style={{ fontSize:9, color:'var(--text3)', textTransform:'uppercase', fontWeight:600, letterSpacing:'0.05em' }}>{label}</span>
        <span style={{ fontSize:14 }}>{icon}</span>
      </div>
      <div style={{ fontSize:24, fontWeight:800, color }}><CountUp end={val} /></div>
    </div>
  )
}
function tabBtn(active:boolean):React.CSSProperties { return { padding:'7px 14px', borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer', border:`1px solid ${active?'var(--brand)':'var(--border)'}`, background:active?'var(--brand-soft)':'var(--bg3)', color:active?'var(--brand)':'var(--text2)' } }
