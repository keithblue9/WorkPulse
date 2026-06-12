'use client'
import { useEffect, useState, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend,
} from 'recharts'
import { format, addDays } from 'date-fns'

const ITEM_TYPE_ICONS: Record<string,string> = { meeting:'👥', task:'✅', dinas:'✈️', wfo:'🏢', wfh:'🏠', event:'🎉', other:'📌' }

function AnimatedNumber({ value, duration=900 }: { value:number; duration?:number }) {
  const [d, setD] = useState(0)
  const ref = useRef<number | undefined>(undefined)
  useEffect(() => {
    const start = d, st = performance.now()
    function tick(now: number) {
      const t = Math.min(1, (now - st) / duration)
      setD(Math.round(start + (value - start) * (1 - Math.pow(1 - t, 3))))
      if (t < 1) ref.current = requestAnimationFrame(tick)
    }
    ref.current = requestAnimationFrame(tick)
    return () => { if (ref.current) cancelAnimationFrame(ref.current) }
  }, [value, duration])
  return <>{d.toLocaleString('id-ID')}</>
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="glass-strong" style={{ borderRadius:10, padding:'8px 12px', fontSize:11 }}>
      {label && <div style={{ fontWeight:600, marginBottom:4 }}>{label}</div>}
      {payload.map((p:any,i:number)=>(
        <div key={i} style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ width:8, height:8, borderRadius:2, background:p.color||p.fill }} />
          <span style={{ color:'var(--text3)' }}>{p.name}:</span>
          <span style={{ fontWeight:600 }}>{p.value}</span>
        </div>
      ))}
    </div>
  )
}

function StatCard({ label, value, sub, accent, onClick }: { label:string; value:number; sub?:string; accent?:string; onClick?:()=>void }) {
  return (
    <div className="glass glass-hover" onClick={onClick} style={{ padding:'18px 20px', borderRadius:16, cursor:onClick?'pointer':'default', position:'relative', overflow:'hidden' }}>
      {accent && <div style={{ position:'absolute', top:-30, right:-30, width:120, height:120, borderRadius:'50%', background:accent, opacity:0.12, filter:'blur(30px)' }} />}
      <div style={{ position:'relative' }}>
        <div style={{ fontSize:10, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.07em', fontWeight:600, marginBottom:8 }}>{label}</div>
        <div className="stat-display" style={{ color:accent||'var(--brand)' }}><AnimatedNumber value={value} /></div>
        {sub && <div style={{ fontSize:10, color:'var(--text3)', marginTop:6 }}>{sub}</div>}
        {onClick && <div style={{ fontSize:9, color:accent||'var(--brand)', marginTop:6, fontWeight:600, opacity:0.7 }}>Klik untuk detail →</div>}
      </div>
    </div>
  )
}

function GlassRing({ pct, size=120, label, sublabel }: { pct:number; size?:number; label?:string; sublabel?:string }) {
  return (
    <div style={{ position:'relative', width:size, height:size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <defs>
            <linearGradient id={`gr-${label?.replace(/\W/g,'')}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--brand)" stopOpacity={1} />
              <stop offset="100%" stopColor="var(--brand)" stopOpacity={0.5} />
            </linearGradient>
          </defs>
          <Pie data={[{v:pct},{v:Math.max(0,100-pct)}]} dataKey="v" innerRadius={size*0.38} outerRadius={size*0.48} startAngle={90} endAngle={-270} stroke="none">
            <Cell fill={`url(#gr-${label?.replace(/\W/g,'')})`} /><Cell fill="var(--bg4)" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', textAlign:'center' }}>
        <div style={{ fontSize:Math.round(size*0.24), fontWeight:800, color:'var(--brand)', letterSpacing:'-0.04em', lineHeight:1 }}>{Math.round(pct)}<span style={{ fontSize:Math.round(size*0.14) }}>%</span></div>
        {label && <div style={{ fontSize:10, color:'var(--text2)', marginTop:3, fontWeight:500 }}>{label}</div>}
        {sublabel && <div style={{ fontSize:9, color:'var(--text3)' }}>{sublabel}</div>}
      </div>
    </div>
  )
}

function AIInsight({ type, userName }: { type:'team'|'personal'; userName?:string }) {
  const [insight, setInsight] = useState('')
  const [loading, setLoading] = useState(false)
  const [generated, setGenerated] = useState(false)

  async function generate() {
    setLoading(true)
    try {
      const r = await fetch('/api/ai-insight', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ type, userName }) })
      const d = await r.json()
      setInsight(d.data?.insight || d.error || 'Gagal generate insight.'); setGenerated(true)
    } catch (e:any) { setInsight('Network error: '+e.message) } finally { setLoading(false) }
  }

  return (
    <div className="glass" style={{ padding:'16px 18px', borderRadius:14, height:'100%', display:'flex', flexDirection:'column' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:30, height:30, borderRadius:9, background:'var(--brand)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, color:'#fff' }}>🤖</div>
          <div>
            <div style={{ fontSize:12, fontWeight:600 }}>{type==='team'?'AI Insight — Tim':`AI — ${userName||'Personal'}`}</div>
            <div style={{ fontSize:9, color:'var(--text3)' }}>Powered by Claude</div>
          </div>
        </div>
        <button onClick={generate} disabled={loading} className="btn btn-sm">{loading?'⟳':generated?'↻':'✨'}</button>
      </div>
      <div style={{ flex:1, overflowY:'auto', minHeight:110 }}>
        {insight ? (
          <div style={{ fontSize:12, color:'var(--text2)', lineHeight:1.7, whiteSpace:'pre-wrap' }}>{insight}</div>
        ) : (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', minHeight:110, textAlign:'center' }}>
            <div style={{ fontSize:11, color:'var(--text3)' }}>{loading?'AI menganalisis...':'Klik ✨ untuk generate insight'}</div>
          </div>
        )}
      </div>
    </div>
  )
}

function MemberListModal({ users, onClose }: { users:any[]; onClose:()=>void }) {
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="glass-strong scale-in" style={{ borderRadius:14, width:480, maxWidth:'92vw', maxHeight:'80vh', overflow:'hidden', display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--glass-border)', display:'flex', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:14, fontWeight:600 }}>Tim Members</div>
            <div style={{ fontSize:10, color:'var(--text3)' }}>{users.length} active member</div>
          </div>
          <button onClick={onClose} className="btn btn-icon">×</button>
        </div>
        <div style={{ overflowY:'auto', flex:1, padding:12 }}>
          {users.map(u => (
            <div key={u._id} style={{ display:'flex', alignItems:'center', gap:11, padding:'10px 12px', borderRadius:10, marginBottom:5 }} className="glass">
              <div style={{ width:32, height:32, borderRadius:'50%', background:'var(--brand)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'#fff' }}>{u.name[0]}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12, fontWeight:600, color:'var(--text)' }}>{u.name}</div>
                <div style={{ fontSize:10, color:'var(--text3)' }}>{u.email}</div>
              </div>
              <div style={{ fontSize:10, color:'var(--text3)', textTransform:'capitalize' }}>{u.role}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { data:session } = useSession(); const user = session?.user as any
  const router = useRouter()
  const [data, setData] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [showMembers, setShowMembers] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const [ini,iss,proj,users,cfg,agenda] = await Promise.all([
          fetch('/api/initiatives').then(r=>r.json()).catch(()=>({data:[]})),
          fetch('/api/issues').then(r=>r.json()).catch(()=>({data:[]})),
          fetch('/api/projects').then(r=>r.json()).catch(()=>({data:[]})),
          fetch('/api/users').then(r=>r.json()).catch(()=>({data:[]})),
          fetch('/api/config').then(r=>r.json()).catch(()=>({data:null})),
          fetch(`/api/agenda?from=${format(new Date(),'yyyy-MM-dd')}&to=${format(addDays(new Date(),14),'yyyy-MM-dd')}`).then(r=>r.json()).catch(()=>({data:[]})),
        ])
        setData({ initiatives:ini.data||[], issues:iss.data||[], projects:proj.data||[], users:(users.data||[]).filter((u:any)=>u.active!==false), config:cfg.data, agenda:agenda.data||[] })
      } catch {} finally { setLoading(false) }
    }
    load()
  }, [])

  if (loading) return (
    <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', position:'relative' }}>
      <div className="ambient-bg"><div className="orb" style={{ width:300, height:300, top:'30%', left:'40%' }} /></div>
      <div style={{ width:40, height:40, border:'3px solid var(--border2)', borderTopColor:'var(--brand)', borderRadius:'50%', position:'relative' }} className="spin" />
    </div>
  )

  const { initiatives=[], issues=[], projects=[], users=[], config, agenda=[] } = data

  // Category counts (from sub-type field on issues/projects)
  function countByCategory(cat:string) {
    return projects.filter((p:any) => {
      const t = (p.subType||'').toLowerCase()
      if (cat==='KPI') return t==='kpi'
      if (cat==='Non-KPI') return t==='non-kpi'
      if (cat==='Go-Live') return t==='go-live'
      if (cat==='Anggaran') return t==='anggaran'
      if (cat==='Others') return t==='others' || !t
      return false
    }).length
  }

  const highPriority = issues.filter((i:any)=>i.priority==='high').length

  // Status distribution
  const statusDist = ['on_track','at_risk','delayed','completed'].map(k => ({
    name: k.replace('_',' '),
    value: issues.filter((i:any)=>i.status===k).length,
  }))
  const statusColors = ['var(--green)','var(--amber)','var(--red)','var(--brand)']

  // Performance overview (from infografis)
  const avgProgress = initiatives.length ? Math.round(initiatives.reduce((s:number,i:any)=>s+(i.actualProgress||0),0)/initiatives.length) : 0
  const completedIssues = issues.filter((i:any)=>i.status==='completed').length
  const completionPct = issues.length ? Math.round(completedIssues/issues.length*100) : 0
  const onTrackPct = issues.length ? Math.round(issues.filter((i:any)=>i.status==='on_track').length/issues.length*100) : 0

  // Top contributors
  const picMap: Record<string, number> = {}
  issues.forEach((i:any) => { const k = i.picName||'Unknown'; picMap[k] = (picMap[k]||0)+1 })
  projects.forEach((p:any) => { (p.members||[]).forEach((m:string) => { picMap[m] = (picMap[m]||0)+1 }) })
  const topPics = Object.entries(picMap).map(([name,count])=>({name,count})).sort((a:any,b:any)=>b.count-a.count).slice(0,5)

  // Upcoming agenda
  const today = format(new Date(),'yyyy-MM-dd')
  const upcomingAgenda: any[] = []
  agenda.forEach((day:any) => {
    if (day.date >= today) (day.items||[]).forEach((item:any) => upcomingAgenda.push({ ...item, date: day.date }))
  })
  upcomingAgenda.sort((a,b) => a.date.localeCompare(b.date) || (a.time||'').localeCompare(b.time||''))

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', position:'relative' }}>
      {showMembers && <MemberListModal users={users} onClose={()=>setShowMembers(false)} />}

      <div className="ambient-bg" style={{ position:'fixed' }}>
        <div className="orb" style={{ width:420, height:420, top:'5%', left:'-10%' }} />
        <div className="orb" style={{ width:380, height:380, bottom:'5%', right:'-8%', animationDelay:'-8s' }} />
      </div>

      <div className="glass" style={{ padding:'14px 22px', borderBottom:'1px solid var(--glass-border)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0, position:'relative', zIndex:1 }}>
        <div>
          <div style={{ fontSize:17, fontWeight:700, letterSpacing:'-0.02em' }} className="gradient-text">Dashboard</div>
          <div style={{ fontSize:11, color:'var(--text3)' }}>{config?.appTagline||'BPD & SS Procurement'} · {format(new Date(),'EEEE, d MMM yyyy')}</div>
        </div>
        <div className="glass" style={{ padding:'5px 12px', borderRadius:20, fontSize:11, fontWeight:600 }}>👤 {user?.name}</div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'16px 22px 24px', position:'relative', zIndex:1 }} className="safe-bottom">
        {/* Category Cards */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(170px, 1fr))', gap:12, marginBottom:14 }}>
          <StatCard label="KPI" value={countByCategory('KPI')} sub="Total activity" accent="var(--brand)" onClick={()=>router.push('/dashboard/activities?cat=KPI')} />
          <StatCard label="Non KPI" value={countByCategory('Non-KPI')} sub="Total activity" accent="var(--purple)" onClick={()=>router.push('/dashboard/activities?cat=Non-KPI')} />
          <StatCard label="Go Live" value={countByCategory('Go-Live')} sub="Total activity" accent="var(--green)" onClick={()=>router.push('/dashboard/activities?cat=Go-Live')} />
          <StatCard label="Anggaran" value={countByCategory('Anggaran')} sub="Total activity" accent="var(--amber)" onClick={()=>router.push('/dashboard/activities?cat=Anggaran')} />
          <StatCard label="Others" value={countByCategory('Others')} sub="Total activity" accent="var(--text3)" onClick={()=>router.push('/dashboard/activities?cat=Others')} />
          <StatCard label="High Priority" value={highPriority} sub="Across all category" accent="var(--red)" onClick={()=>router.push('/dashboard/issues?priority=high')} />
        </div>

        {/* Performance Overview (from Infografis) */}
        <div className="glass count-up" style={{ padding:'20px 22px', borderRadius:18, marginBottom:14 }}>
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:11, color:'var(--text3)', letterSpacing:'0.08em', textTransform:'uppercase', fontWeight:600 }}>Performance Overview</div>
            <div style={{ fontSize:15, fontWeight:600, marginTop:3 }}>Status Tim Saat Ini</div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:14, justifyItems:'center', alignItems:'center' }}>
            <div onClick={()=>setShowMembers(true)} className="glass glass-hover" style={{ padding:16, borderRadius:14, cursor:'pointer', textAlign:'center', minWidth:140 }}>
              <div className="stat-display" style={{ color:'var(--brand)' }}><AnimatedNumber value={users.length} /></div>
              <div style={{ fontSize:11, color:'var(--text3)', marginTop:6, fontWeight:500 }}>Total Members</div>
              <div style={{ fontSize:9, color:'var(--brand)', marginTop:3, fontWeight:600 }}>Klik untuk list →</div>
            </div>
            <GlassRing pct={avgProgress} label="Avg Initiative" sublabel="Progress" />
            <GlassRing pct={completionPct} label="Issue Completion" sublabel={`${completedIssues}/${issues.length}`} />
            <GlassRing pct={onTrackPct} label="On Track" sublabel="Issues" />
          </div>
        </div>

        {/* Issue Distribution + AI Insights */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14, marginBottom:14 }}>
          <div className="glass count-up" style={{ padding:'16px 18px', borderRadius:14 }}>
            <div style={{ fontSize:13, fontWeight:600, marginBottom:8 }}>Issue Distribution</div>
            <div style={{ fontSize:10, color:'var(--text3)', marginBottom:8 }}>All category</div>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={statusDist.filter(s=>s.value>0)} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={62} innerRadius={34} paddingAngle={3} stroke="none">
                  {statusDist.map((s,i)=><Cell key={i} fill={statusColors[i]} />)}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, justifyContent:'center' }}>
              {statusDist.filter(s=>s.value>0).map((s,i)=>(
                <div key={s.name} style={{ display:'flex', alignItems:'center', gap:4, fontSize:10 }}>
                  <span style={{ width:8, height:8, borderRadius:2, background:statusColors[i] }} />
                  <span style={{ color:'var(--text2)' }}>{s.name} ({s.value})</span>
                </div>
              ))}
            </div>
          </div>
          <AIInsight type="team" />
          <AIInsight type="personal" userName={user?.name} />
        </div>

        {/* Top Contributors (from Infografis) + Upcoming Agenda */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
          {/* Top Contributors */}
          <div className="glass count-up" style={{ padding:'18px 20px', borderRadius:14 }}>
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:11, color:'var(--text3)', letterSpacing:'0.08em', textTransform:'uppercase', fontWeight:600 }}>Top Contributors</div>
              <div style={{ fontSize:13, fontWeight:600, marginTop:3 }}>Workload Leaderboard</div>
            </div>
            {topPics.length === 0 ? (
              <div style={{ textAlign:'center', padding:20, color:'var(--text3)', fontSize:11 }}>Belum ada data</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {topPics.map((p:any,i:number) => {
                  const maxCount = topPics[0].count
                  const pct = (p.count/maxCount)*100
                  return (
                    <div key={p.name} style={{ display:'grid', gridTemplateColumns:'24px 1fr 60px 80px', gap:10, alignItems:'center' }}>
                      <div style={{ fontSize:11, fontWeight:700, color:i<3?'var(--brand)':'var(--text3)', textAlign:'center' }}>{i<3 ? ['🥇','🥈','🥉'][i] : `#${i+1}`}</div>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ width:24, height:24, borderRadius:'50%', background:'var(--brand)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'#fff' }}>{p.name[0]}</div>
                        <div style={{ fontSize:12, fontWeight:500 }}>{p.name}</div>
                      </div>
                      <div style={{ fontSize:13, fontWeight:700, color:'var(--brand)' }}>{p.count}</div>
                      <div style={{ height:5, background:'var(--bg4)', borderRadius:3, overflow:'hidden' }}>
                        <div style={{ width:`${pct}%`, height:'100%', background:'var(--brand)', borderRadius:3 }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Agenda Mendatang */}
          <div className="glass count-up" style={{ padding:'18px 20px', borderRadius:14 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <div>
                <div style={{ fontSize:11, color:'var(--text3)', letterSpacing:'0.08em', textTransform:'uppercase', fontWeight:600 }}>Upcoming</div>
                <div style={{ fontSize:13, fontWeight:600, marginTop:3 }}>📅 Agenda Mendatang</div>
              </div>
              <button onClick={()=>router.push('/dashboard/agenda')} className="btn btn-sm">Lihat semua</button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
              {upcomingAgenda.slice(0,5).map((item:any,i:number)=>{
                const isToday = item.date === today
                return (
                  <div key={i} className="glass" style={{ display:'flex', gap:9, padding:'8px 10px', borderRadius:8, borderLeft:`3px solid ${isToday?'var(--brand)':'var(--border2)'}` }}>
                    <span style={{ fontSize:13 }}>{ITEM_TYPE_ICONS[item.type]||'📌'}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:11, fontWeight:500, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.title}</div>
                      <div style={{ fontSize:9, color:'var(--text3)' }}>{isToday?'🔵 Hari ini':format(new Date(item.date),'d MMM')}{item.time && ` · ${item.time}`}</div>
                    </div>
                  </div>
                )
              })}
              {upcomingAgenda.length === 0 && <div style={{ padding:14, textAlign:'center', color:'var(--text3)', fontSize:11 }}>Belum ada agenda</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
