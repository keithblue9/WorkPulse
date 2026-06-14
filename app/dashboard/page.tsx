'use client'
import { getConfig } from '@/lib/configCache'
import { picArray, calcInitiativeProgress } from '@/lib/defaults'
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
  const realTotal = data.reduce((s,d)=>s+d.value,0)
  const total = realTotal || 1  // avoid divide-by-zero for angles only
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
      <text x={center} y={center-4} textAnchor="middle" fontSize="22" fontWeight="700" fill="var(--text)">{realTotal}</text>
      <text x={center} y={center+12} textAnchor="middle" fontSize="9" fill="var(--text3)">Total</text>
    </svg>
  )
}

function Linkify({ text }: { text:string }) {
  if (!text) return null
  const parts = text.split(/(https?:\/\/[^\s]+)/g)
  return (
    <>
      {parts.map((part, i) =>
        /^https?:\/\//.test(part)
          ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" style={{ color:'var(--brand)', textDecoration:'underline', wordBreak:'break-all' }}>🔗 Buka link</a>
          : <span key={i}>{part}</span>
      )}
    </>
  )
}

function stripMd(t:string):string {
  if (!t) return ''
  return t
    .replace(/^#{1,6}\s+/gm, '')        // headings
    .replace(/\*\*(.+?)\*\*/g, '$1')   // bold
    .replace(/\*(.+?)\*/g, '$1')         // italic
    .replace(/`(.+?)`/g, '$1')             // inline code
    .trim()
}

function ProgressRing({ plan, actual, size=120 }: { plan:number; actual:number; size?:number }) {
  const r = size/2 - 10
  const circ = 2 * Math.PI * r
  const actualOffset = circ - (Math.min(100,actual)/100) * circ
  const planOffset = circ - (Math.min(100,plan)/100) * circ
  const center = size/2
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={center} cy={center} r={r} fill="none" stroke="var(--bg3)" strokeWidth="9" />
      <circle cx={center} cy={center} r={r} fill="none" stroke="var(--brand)" strokeWidth="9" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={planOffset} opacity={0.25} transform={`rotate(-90 ${center} ${center})`} />
      <circle cx={center} cy={center} r={r} fill="none" stroke="var(--green)" strokeWidth="9" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={actualOffset} transform={`rotate(-90 ${center} ${center})`} style={{ transition:'stroke-dashoffset 0.6s ease' }} />
      <text x={center} y={center-2} textAnchor="middle" fontSize="22" fontWeight="800" fill="var(--green)">{actual.toFixed(0)}%</text>
      <text x={center} y={center+14} textAnchor="middle" fontSize="9" fill="var(--text3)">dari {plan.toFixed(0)}% plan</text>
    </svg>
  )
}

function MiniGantt({ phases }: { phases:any[] }) {
  const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']
  // collect plan/actual week cells per phase. Cell key "M-W" (month 1-12, week 1-4)
  function cellsToSegments(cells:string[]) {
    // returns array of {month, week} for rendering
    return (cells||[]).map((c:string) => { const [m,w] = c.split('-').map(Number); return { m, w } })
  }
  return (
    <div style={{ overflowX:'auto', marginTop:8, marginBottom:4 }}>
      <div style={{ minWidth:720 }}>
        {/* Month header */}
        <div style={{ display:'grid', gridTemplateColumns:'90px repeat(12, 1fr)', gap:0, fontSize:8, color:'var(--text3)', fontWeight:600 }}>
          <div />
          {MONTHS.map(m => <div key={m} style={{ textAlign:'center', borderLeft:'1px solid var(--border)', padding:'3px 0' }}>{m}</div>)}
        </div>
        {/* Phase rows */}
        {phases.map((ph:any, idx:number) => {
          const planSeg = cellsToSegments(ph.planCells)
          const actualSeg = cellsToSegments(ph.actualCells)
          return (
            <div key={idx} style={{ display:'grid', gridTemplateColumns:'90px repeat(12, 1fr)', gap:0, alignItems:'center', borderTop:'1px solid var(--border)', minHeight:30 }}>
              <div style={{ fontSize:9, fontWeight:600, padding:'2px 4px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ph.name || `Phase ${idx+1}`}</div>
              {/* 12 month columns, each split into 4 weeks */}
              {Array.from({length:12}).map((_, mi) => {
                const m = mi+1
                return (
                  <div key={m} style={{ position:'relative', height:24, borderLeft:'1px solid var(--border)', display:'flex' }}>
                    {[1,2,3,4].map(w => {
                      const hasPlan = planSeg.some((s:any)=>s.m===m && s.w===w)
                      const hasActual = actualSeg.some((s:any)=>s.m===m && s.w===w)
                      return (
                        <div key={w} style={{ flex:1, display:'flex', flexDirection:'column', gap:1, padding:'2px 0.5px' }}>
                          <div style={{ flex:1, background: hasPlan?'var(--brand)':'transparent', opacity:0.6, borderRadius:1 }} />
                          <div style={{ flex:1, background: hasActual?'var(--green)':'transparent', borderRadius:1 }} />
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )
        })}
        <div style={{ display:'flex', gap:12, padding:'6px 4px', fontSize:8, color:'var(--text3)' }}>
          <span style={{ display:'flex', alignItems:'center', gap:4 }}><span style={{ width:12, height:6, background:'var(--brand)', opacity:0.6, borderRadius:1 }} /> Plan</span>
          <span style={{ display:'flex', alignItems:'center', gap:4 }}><span style={{ width:12, height:6, background:'var(--green)', borderRadius:1 }} /> Actual</span>
          <span style={{ marginLeft:'auto' }}>tiap bulan dibagi 4 minggu</span>
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { data:session } = useSession(); const user = session?.user as any
  const [tab, setTab] = useState<'general'|'progress'|'issues'>('general')
  const [activities, setActivities] = useState<any[]>([])
  const [initiatives, setInitiatives] = useState<any[]>([])
  const [issues, setIssues] = useState<any[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [attendance, setAttendance] = useState<any[]>([])
  const [config, setConfig] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [aiQuotes, setAiQuotes] = useState(''); const [loadingQuotes, setLoadingQuotes] = useState(false)
  const [aiTeam, setAiTeam] = useState(''); const [loadingTeam, setLoadingTeam] = useState(false)
  const [aiPersonal, setAiPersonal] = useState(''); const [loadingPersonal, setLoadingPersonal] = useState(false)
  const [statDetail, setStatDetail] = useState<{title:string; items:any[]}|null>(null)

  async function load() {
    setLoading(true)
    const ym = new Date().toISOString().slice(0,7)
    const [a, init, iss, m, c, att] = await Promise.all([
      fetch('/api/projects').then(r=>r.json()),
      fetch('/api/initiatives').then(r=>r.json()),
      fetch('/api/issues').then(r=>r.json()),
      fetch('/api/users').then(r=>r.json()),
      getConfig().then((data:any)=>({ data })),
      fetch(`/api/attendance?month=${ym}`).then(r=>r.json()).catch(()=>({data:[]})),
    ])
    setActivities(a.data||[]); setInitiatives(init.data||[]); setIssues(iss.data||[]); setMembers(m.data||[]); setConfig(c.data); setAttendance(att.data||[]); setLoading(false)
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
  const wfoToday = useMemo(() => {
    const today = new Date().toISOString().slice(0,10)
    return attendance.filter((r:any) => r.date === today && (
      (r.slots && r.slots.some((s:any)=>String(s.type).toLowerCase()==='wfo')) ||
      String(r.type||'').toLowerCase()==='wfo'
    )).length
  }, [attendance])

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
    // Distribution of PROGRESS PROJECTS (initiatives) by status
    const STATUS_META: Record<string,{label:string;color:string}> = {
      on_track:  { label:'On Track',  color:'var(--green)' },
      at_risk:   { label:'At Risk',   color:'var(--amber)' },
      delayed:   { label:'Delayed',   color:'var(--red)' },
      completed: { label:'Completed', color:'var(--brand)' },
    }
    const counts: Record<string, number> = {}
    initiatives.forEach((i:any) => {
      const k = i.status || 'on_track'
      counts[k] = (counts[k] || 0) + 1
    })
    return Object.keys(STATUS_META).map(k => ({
      key: k,
      label: STATUS_META[k].label,
      value: counts[k] || 0,
      color: STATUS_META[k].color,
    })).filter(d => d.value > 0)
  }, [initiatives])

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

      <div style={{ flex:1, overflowY:'auto', padding:'14px 20px' }} className="safe-bottom page-pad">
        {loading ? <div style={{ textAlign:'center', padding:60, color:'var(--text3)' }}>Memuat data...</div> : (
          <>
            {/* ============ GENERAL TAB ============ */}
            {tab === 'general' && (
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                {/* Stat cards row */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(155px, 1fr))', gap:10 }}>
                  {isWidgetActive('stat-kpi') && <Stat icon="🎯" label="KPI" val={stats.kpi} color="var(--brand)" onClick={()=>setStatDetail({title:'Aktivitas KPI', items:activities.filter(a=>a.subType==='KPI')})} />}
                  {isWidgetActive('stat-nonkpi') && <Stat icon="📋" label="Non KPI" val={stats.nonKpi} color="var(--purple)" onClick={()=>setStatDetail({title:'Aktivitas Non-KPI', items:activities.filter(a=>a.subType==='Non-KPI')})} />}
                  {isWidgetActive('stat-golive') && <Stat icon="🚀" label="Go Live" val={stats.goLive} color="var(--green)" onClick={()=>setStatDetail({title:'Aktivitas Go-Live', items:activities.filter(a=>a.subType==='Go-Live')})} />}
                  {isWidgetActive('stat-anggaran') && <Stat icon="💰" label="Anggaran" val={stats.anggaran} color="var(--amber)" onClick={()=>setStatDetail({title:'Aktivitas Anggaran', items:activities.filter(a=>a.subType==='Anggaran')})} />}
                  {isWidgetActive('stat-others') && <Stat icon="📁" label="Others" val={stats.others} color="var(--text3)" onClick={()=>setStatDetail({title:'Aktivitas Others', items:activities.filter(a=>a.subType==='Others')})} />}
                  {isWidgetActive('stat-highpriority') && <Stat icon="🔥" label="High Priority" val={stats.highPriority} color="var(--red)" onClick={()=>setStatDetail({title:'High Priority', items:activities.filter(a=>a.priority==='high')})} />}
                  {isWidgetActive('member-count') && <Stat icon="🏢" label="WFO Hari Ini" val={wfoToday} color="var(--green)" onClick={()=>{ const today=new Date().toISOString().slice(0,10); const ids=attendance.filter((r:any)=>r.date===today && ((r.slots&&r.slots.some((s:any)=>String(s.type).toLowerCase()==='wfo'))||String(r.type||'').toLowerCase()==='wfo')).map((r:any)=>r.userId); setStatDetail({title:'WFO Hari Ini', items: members.filter((m:any)=>ids.includes(m._id)||ids.includes(m.email)).map((m:any)=>({title:m.name, category:m.division||'', subType:'WFO'}))}) }} />}
                </div>

                {/* AI Insights row */}
                <div className="responsive-grid" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', gap:10 }}>
                  {isWidgetActive('ai-quotes') && (
                    <div className="card glass" style={{ padding:14 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                        <div style={{ fontSize:11, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.06em' }}>📅 Inspirasi & Info Hari Ini</div>
                        <button onClick={genQuotes} disabled={loadingQuotes} className="btn btn-icon btn-sm">↻</button>
                      </div>
                      {!aiQuotes && !loadingQuotes ? <button onClick={genQuotes} className="btn btn-sm" style={{ width:'100%' }}>✨ Tampilkan</button> :
                       loadingQuotes ? <div style={{ fontSize:11, color:'var(--text3)' }}>Generating...</div> :
                       <div style={{ fontSize:12, lineHeight:1.6, whiteSpace:'pre-wrap', color:'var(--text2)' }}><Linkify text={stripMd(aiQuotes)} /></div>
                      }
                    </div>
                  )}
                  {isWidgetActive('ai-insight-personal') && (
                    <div className="card glass" style={{ padding:14 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                        <div style={{ fontSize:11, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.06em' }}>🤖 AI Insight — Personal</div>
                        <button onClick={genPersonal} disabled={loadingPersonal} className="btn btn-icon btn-sm">↻</button>
                      </div>
                      <div style={{ fontSize:9, color:'var(--text3)', marginBottom:6 }}>Rekomendasi tindakan untuk {user?.name?.split(' ')[0]}</div>
                      {!aiPersonal && !loadingPersonal ? <button onClick={genPersonal} className="btn btn-sm" style={{ width:'100%' }}>✨ Generate Next Actions</button> :
                       loadingPersonal ? <div style={{ fontSize:11, color:'var(--text3)' }}>Generating...</div> :
                       <div style={{ fontSize:12, lineHeight:1.6, whiteSpace:'pre-wrap', color:'var(--text2)' }}>{stripMd(aiPersonal)}</div>
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
                       <div style={{ fontSize:12, lineHeight:1.6, whiteSpace:'pre-wrap', color:'var(--text2)' }}>{stripMd(aiTeam)}</div>
                      }
                    </div>
                  )}
                </div>

                {/* Progress chart + upcoming */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  {isWidgetActive('progress-chart') && (
                    <div className="card glass-hover" style={{ padding:14, cursor:'pointer' }} onClick={()=>setTab('progress')}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                        <div style={{ fontSize:11, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.06em' }}>📊 Progress Project Distribution</div>
                        <span style={{ fontSize:10, color:'var(--brand)' }}>Lihat detail →</span>
                      </div>
                      {progressData.length === 0 ? (
                        <div style={{ textAlign:'center', padding:'24px 0', color:'var(--text3)', fontSize:12 }}>
                          Belum ada progress project.<br/>
                          <span style={{ fontSize:11 }}>Tambah di tab Progress Project</span>
                        </div>
                      ) : (
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
                      )}
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

            {/* ============ PROGRESS PROJECT TAB (inline detail, no nav) ============ */}
            {tab === 'progress' && (
              <div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:600 }}>Progress Initiatives</div>
                    <div style={{ fontSize:11, color:'var(--text3)' }}>{initiatives.length} initiative · klik card untuk edit/update</div>
                  </div>
                </div>
                {initiatives.length === 0 ? (
                  <div className="card" style={{ padding:30, textAlign:'center', color:'var(--text3)' }}>Belum ada initiative</div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                    {initiatives.map(i => {
                      const calc = calcInitiativeProgress(i.phases || [])
                      return (
                        <div key={i._id} className="card glass-hover" style={{ padding:16, cursor:'pointer' }} onClick={()=>{ window.location.href='/dashboard/progress' }}>
                          <div className="initiative-card-inner" style={{ display:'flex', gap:16 }}>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:9, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.05em' }}>{i.code} · {i.year}</div>
                              <div style={{ fontSize:15, fontWeight:700, marginBottom:4 }}>{i.title}</div>
                              {picArray(i.pic).length > 0 && <div style={{ fontSize:10, color:'var(--text3)', marginBottom:8 }}>👤 {picArray(i.pic).join(', ')}</div>}
                              {i.progressNotes && <div style={{ fontSize:11, color:'var(--text2)', whiteSpace:'pre-wrap', marginBottom:10, padding:'8px 10px', background:'var(--bg3)', borderRadius:6, lineHeight:1.5 }}>{i.progressNotes}</div>}
                              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                                {calc.phases.map((ph, idx) => (
                                  <div key={idx} style={{ borderLeft:'3px solid var(--brand)', paddingLeft:12 }}>
                                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                                      <div style={{ fontSize:12, fontWeight:600 }}>{ph.name || `Phase ${idx+1}`}</div>
                                      <div style={{ fontSize:11 }}>
                                        <span style={{ color:'var(--brand)', fontWeight:700 }}>Plan {ph.planPct.toFixed(0)}%</span>
                                        <span style={{ color:'var(--text3)' }}> · </span>
                                        <span style={{ color:'var(--green)', fontWeight:700 }}>Actual {ph.actualPct.toFixed(1)}%</span>
                                      </div>
                                    </div>
                                    <div style={{ height:5, background:'var(--bg3)', borderRadius:3, overflow:'hidden', margin:'4px 0' }}>
                                      <div style={{ width:`${Math.min(100, ph.planPct>0?(ph.actualPct/ph.planPct)*100:0)}%`, height:'100%', background:'var(--green)' }} />
                                    </div>
                                    {ph.progressNotes && <div style={{ fontSize:10.5, color:'var(--text2)', whiteSpace:'pre-wrap', lineHeight:1.5 }}>{ph.progressNotes}</div>}
                                  </div>
                                ))}
                              </div>
                              <MiniGantt phases={i.phases || []} />
                            </div>
                            <div className="initiative-ring-panel" style={{ flexShrink:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minWidth:140, borderLeft:'1px solid var(--border)', paddingLeft:16 }}>
                              <ProgressRing plan={calc.planProgress} actual={calc.actualProgress} size={130} />
                              <div style={{ fontSize:10, color:'var(--text3)', marginTop:6 }}>{calc.phases.length} phase{calc.phases.length>1?'s':''}</div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ============ ISSUES TAB (inline detail, compact) ============ */}
            {tab === 'issues' && (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {/* Compact summary row */}
                <div className="dash-2col" style={{ display:'grid', gridTemplateColumns:'minmax(220px, 0.6fr) 1fr', gap:10 }}>
                  <div className="card" style={{ padding:12 }}>
                    <div style={{ fontSize:10, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>Status Distribution</div>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <DonutChart data={issueDist.filter(d=>d.value>0)} size={120} />
                      <div style={{ flex:1, display:'flex', flexDirection:'column', gap:3 }}>
                        {issueDist.map((d, i) => (
                          <div key={i} style={{ display:'flex', alignItems:'center', gap:5, fontSize:10 }}>
                            <div style={{ width:8, height:8, borderRadius:2, background:d.color }} />
                            <span style={{ flex:1 }}>{d.label}</span>
                            <span style={{ fontWeight:600 }}>{d.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="card" style={{ padding:12 }}>
                    <div style={{ fontSize:10, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>🔥 High Priority Active</div>
                    <div style={{ maxHeight:140, overflowY:'auto' }}>
                      {activities.filter(a=>a.priority==='high' && a.status!=='completed').length === 0 ? (
                        <div style={{ fontSize:10, color:'var(--text3)', padding:'10px 0' }}>Tidak ada high priority aktif</div>
                      ) : activities.filter(a=>a.priority==='high' && a.status!=='completed').map(a => (
                        <div key={a._id} style={{ padding:'6px 0', borderBottom:'1px solid var(--border)', fontSize:10.5 }}>
                          <div style={{ fontWeight:600 }}>{a.title}</div>
                          <div style={{ color:'var(--text3)', fontSize:9.5 }}>{a.category} · PIC: {picArray(a.pic).join(', ') || a.picName || '—'}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Inline detail table — scrollable */}
                <div className="card" style={{ padding:0, overflow:'hidden' }}>
                  <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--border)', fontSize:12, fontWeight:600 }}>
                    Detail Issues <span style={{ color:'var(--text3)', fontWeight:400 }}>({activities.length})</span>
                  </div>
                  <div style={{ maxHeight:'calc(100vh - 420px)', minHeight:200, overflowY:'auto' }}>
                    <table className="wp-table" style={{ minWidth:900 }}>
                      <thead style={{ position:'sticky', top:0, zIndex:2, background:'var(--bg2)' }}>
                        <tr>
                          <th style={{ minWidth:180 }}>Issue</th>
                          <th style={{ minWidth:200 }}>Progress</th>
                          <th>Action Date</th>
                          <th style={{ minWidth:160 }}>Next Plan</th>
                          <th>Target Week</th>
                          <th>Priority</th>
                          <th>PIC</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activities.length === 0 ? (
                          <tr><td colSpan={7} style={{ textAlign:'center', padding:24, color:'var(--text3)' }}>Belum ada activity/issue</td></tr>
                        ) : activities.map(a => {
                          const catColor = (config?.activityCategories||[]).find((c:any)=>c.key===a.category)?.color || 'var(--brand)'
                          const pc: any = { high:{l:'High',c:'var(--red)',b:'var(--redbg)'}, medium:{l:'Medium',c:'var(--amber)',b:'var(--amberbg)'}, low:{l:'Low',c:'var(--green)',b:'var(--greenbg)'} }
                          return (
                            <tr key={a._id}>
                              <td>
                                <div style={{ fontSize:11.5, fontWeight:600 }}>{a.title}</div>
                                <div style={{ display:'flex', gap:4, marginTop:3, flexWrap:'wrap' }}>
                                  <span className="badge" style={{ background:catColor+'22', color:catColor, fontSize:9 }}>{a.category}</span>
                                  <span className="badge" style={{ background:'var(--bg3)', color:'var(--text2)', fontSize:9 }}>{a.subType}</span>
                                </div>
                              </td>
                              <td style={{ fontSize:10.5, whiteSpace:'pre-wrap' }}>{a.description || a.progressNotes || '—'}</td>
                              <td style={{ fontSize:10.5 }}>{a.actionDate || '—'}</td>
                              <td style={{ fontSize:10.5, whiteSpace:'pre-wrap' }}>{a.nextPlan || '—'}</td>
                              <td style={{ fontSize:10.5 }}>{a.targetWeek || '—'}</td>
                              <td>{a.priority && <span className="badge" style={{ background:pc[a.priority]?.b, color:pc[a.priority]?.c, fontSize:9 }}>{pc[a.priority]?.l}</span>}</td>
                              <td style={{ fontSize:10.5 }}>{picArray(a.pic).join(', ') || a.picName || '—'}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {statDetail && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setStatDetail(null)}>
          <div className="modal" style={{ width:520, maxHeight:'80vh' }}>
            <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between' }}>
              <span style={{ fontSize:14, fontWeight:600 }}>{statDetail.title} ({statDetail.items.length})</span>
              <button onClick={()=>setStatDetail(null)} className="btn btn-icon">×</button>
            </div>
            <div style={{ padding:'14px 20px', overflowY:'auto', maxHeight:'66vh' }}>
              {statDetail.items.length === 0 ? <div style={{ textAlign:'center', color:'var(--text3)', padding:20, fontSize:12 }}>Tidak ada data</div> :
                statDetail.items.map((it:any, idx:number) => (
                  <div key={idx} style={{ padding:'9px 0', borderBottom:'1px solid var(--border)' }}>
                    <div style={{ fontSize:12, fontWeight:600 }}>{it.title}</div>
                    <div style={{ fontSize:10, color:'var(--text3)' }}>{it.category}{it.subType?` · ${it.subType}`:''}{it.actionDate?` · 📅 ${it.actionDate}`:''}{picArray(it.pic).length?` · 👤 ${picArray(it.pic).join(', ')}`:''}</div>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ icon, label, val, color, onClick }: { icon:string; label:string; val:number; color:string; onClick?:()=>void }) {
  return (
    <div className="card glass-hover" onClick={onClick} style={{ padding:14, borderLeft:`3px solid ${color}`, cursor: onClick?'pointer':'default' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5 }}>
        <span style={{ fontSize:9, color:'var(--text3)', textTransform:'uppercase', fontWeight:600, letterSpacing:'0.05em' }}>{label}</span>
        <span style={{ fontSize:14 }}>{icon}</span>
      </div>
      <div style={{ fontSize:24, fontWeight:800, color }}><CountUp end={val} /></div>
    </div>
  )
}
function tabBtn(active:boolean):React.CSSProperties { return { padding:'7px 14px', borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer', border:`1px solid ${active?'var(--brand)':'var(--border)'}`, background:active?'var(--brand-soft)':'var(--bg3)', color:active?'var(--brand)':'var(--text2)' } }
