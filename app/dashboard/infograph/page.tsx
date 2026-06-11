'use client'
import { useEffect, useState, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend,
} from 'recharts'

function AnimatedNumber({ value, suffix='', duration=1200 }: { value:number; suffix?:string; duration?:number }) {
  const [display, setDisplay] = useState(0)
  const ref = useRef<number>()
  useEffect(() => {
    const start = display
    const startTime = performance.now()
    function tick(now: number) {
      const t = Math.min(1, (now - startTime) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round(start + (value - start) * eased))
      if (t < 1) ref.current = requestAnimationFrame(tick)
    }
    ref.current = requestAnimationFrame(tick)
    return () => ref.current && cancelAnimationFrame(ref.current)
  }, [value, duration])
  return <>{display.toLocaleString('id-ID')}{suffix}</>
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

function GlassRing({ pct, color, size=140, label, sublabel }: { pct:number; color:string; size?:number; label?:string; sublabel?:string }) {
  const id = `ring-${color.replace('#','')}-${size}`
  return (
    <div style={{ position:'relative', width:size, height:size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={1} />
              <stop offset="100%" stopColor={color} stopOpacity={0.5} />
            </linearGradient>
          </defs>
          <Pie data={[{v:pct},{v:Math.max(0,100-pct)}]} dataKey="v" innerRadius={size*0.38} outerRadius={size*0.48} startAngle={90} endAngle={-270} stroke="none">
            <Cell fill={`url(#${id})`} /><Cell fill="var(--bg4)" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', textAlign:'center' }}>
        <div style={{ fontSize:Math.round(size*0.27), fontWeight:800, color, letterSpacing:'-0.04em', lineHeight:1 }}>{Math.round(pct)}<span style={{ fontSize:Math.round(size*0.15) }}>%</span></div>
        {label && <div style={{ fontSize:10, color:'var(--text2)', marginTop:4, fontWeight:500 }}>{label}</div>}
        {sublabel && <div style={{ fontSize:9, color:'var(--text3)', marginTop:1 }}>{sublabel}</div>}
      </div>
    </div>
  )
}

function GlassMetric({ icon, label, value, suffix, color, sub }: { icon:string; label:string; value:number; suffix?:string; color:string; sub?:string }) {
  return (
    <div className="glass" style={{ padding:'20px 22px', borderRadius:18, position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', top:-40, right:-40, width:140, height:140, borderRadius:'50%', background:`radial-gradient(circle, ${color}66 0%, transparent 70%)`, filter:'blur(20px)' }} />
      <div style={{ position:'relative', zIndex:1 }}>
        <div style={{ width:42, height:42, borderRadius:12, background:`linear-gradient(135deg, ${color}, ${color}aa)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, color:'#fff', marginBottom:14, boxShadow:`0 8px 20px ${color}40` }}>{icon}</div>
        <div className="stat-display" style={{ color, marginBottom:5 }}><AnimatedNumber value={value} suffix={suffix||''} /></div>
        <div style={{ fontSize:11, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.05em', fontWeight:600 }}>{label}</div>
        {sub && <div style={{ fontSize:10, color:'var(--text3)', marginTop:5 }}>{sub}</div>}
      </div>
    </div>
  )
}

export default function InfografisPage() {
  const { data:session } = useSession()
  const router = useRouter()
  const [data, setData] = useState<any>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [ini, iss, kpi, proj, users] = await Promise.all([
        fetch('/api/initiatives').then(r=>r.json()).catch(()=>({data:[]})),
        fetch('/api/issues').then(r=>r.json()).catch(()=>({data:[]})),
        fetch('/api/kpi?year=2026').then(r=>r.json()).catch(()=>({data:[]})),
        fetch('/api/projects').then(r=>r.json()).catch(()=>({data:[]})),
        fetch('/api/users').then(r=>r.json()).catch(()=>({data:[]})),
      ])
      setData({ initiatives:ini.data||[], issues:iss.data||[], kpis:kpi.data||[], projects:proj.data||[], users:users.data||[] })
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', position:'relative' }}>
      <div className="ambient-bg"><div className="orb" style={{ width:300, height:300, background:'#4f8ef7', top:'30%', left:'40%' }} /></div>
      <div style={{ width:40, height:40, border:'3px solid var(--border2)', borderTopColor:'var(--blue)', borderRadius:'50%' }} className="spin" />
    </div>
  )

  const { initiatives=[], issues=[], kpis=[], projects=[], users=[] } = data
  const avgProgress = initiatives.length ? Math.round(initiatives.reduce((s:number,i:any)=>s+(i.actualProgress||0),0)/initiatives.length) : 0
  const completedIssues = issues.filter((i:any)=>i.status==='completed').length
  const onTrackPct = issues.length ? Math.round(issues.filter((i:any)=>i.status==='on_track').length/issues.length*100) : 0
  const completionPct = issues.length ? Math.round(completedIssues/issues.length*100) : 0
  const activeProjects = projects.filter((p:any)=>p.status==='active').length

  // PIC contribution
  const picMap: Record<string, number> = {}
  issues.forEach((i:any) => { const k = i.picName||'Unknown'; picMap[k] = (picMap[k]||0)+1 })
  const topPics = Object.entries(picMap).map(([name, count]) => ({ name, count })).sort((a:any,b:any)=>b.count-a.count).slice(0,8)

  // Category breakdown
  const categoryData = ['SI','Non-SI','GoLive','Others'].map(cat => {
    const ks = kpis.filter((k:any)=>k.category===cat)
    return { name: cat, value: ks.length, planAvg: ks.length?Math.round(ks.reduce((s:number,k:any)=>s+k.planPct,0)/ks.length):0, actualAvg: ks.length?Math.round(ks.reduce((s:number,k:any)=>s+k.actualPct,0)/ks.length):0 }
  }).filter(c=>c.value>0)

  const radarData = ['SI','Non-SI','GoLive','Others'].map(cat => {
    const ks = kpis.filter((k:any)=>k.category===cat)
    return { category: cat, Plan: ks.length?Math.round(ks.reduce((s:number,k:any)=>s+k.planPct,0)/ks.length):0, Actual: ks.length?Math.round(ks.reduce((s:number,k:any)=>s+k.actualPct,0)/ks.length):0 }
  })

  return (
    <div style={{ flex:1, overflowY:'auto', position:'relative' }} className="safe-bottom">
      {/* Ambient orbs */}
      <div className="ambient-bg" style={{ position:'fixed' }}>
        <div className="orb" style={{ width:500, height:500, background:'#4f8ef7', top:'-10%', left:'-10%' }} />
        <div className="orb" style={{ width:400, height:400, background:'#a78bfa', top:'30%', right:'-10%', animationDelay:'-6s' }} />
        <div className="orb" style={{ width:450, height:450, background:'#22c55e', bottom:'-15%', left:'40%', animationDelay:'-12s' }} />
        <div className="orb" style={{ width:350, height:350, background:'#f59e0b', top:'60%', left:'5%', animationDelay:'-9s' }} />
      </div>

      <div style={{ position:'relative', zIndex:1, padding:'24px 28px 40px' }}>
        {/* ─── HERO ─────────────────────────────────────────── */}
        <div style={{ textAlign:'center', marginBottom:36, paddingTop:16 }} className="fade-in">
          <div style={{ display:'inline-block', padding:'5px 14px', borderRadius:20, background:'var(--glass-bg-strong)', backdropFilter:'blur(20px)', border:'1px solid var(--glass-border)', fontSize:11, fontWeight:600, color:'var(--blue)', marginBottom:14, letterSpacing:'0.05em' }}>
            ✨ INFOGRAFIS 2026
          </div>
          <div className="stat-display-lg gradient-text" style={{ marginBottom:10 }}>BPD Procurement</div>
          <div style={{ fontSize:14, color:'var(--text3)', maxWidth:520, margin:'0 auto', lineHeight:1.5 }}>
            Snapshot performa tim & strategi inisiatif Pertamina — visualisasi data realtime.
          </div>
        </div>

        {/* ─── KEY METRICS ──────────────────────────────────── */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:16, marginBottom:32 }}>
          <GlassMetric icon="🎯" label="Strategic Initiatives" value={initiatives.length} color="#4f8ef7" sub="Active SI" />
          <GlassMetric icon="◫" label="Total Issues" value={issues.length} color="#a78bfa" sub={`${completedIssues} selesai`} />
          <GlassMetric icon="🗂" label="Projects Aktif" value={activeProjects} color="#22c55e" sub={`${projects.length} total`} />
          <GlassMetric icon="👥" label="Tim Members" value={users.filter((u:any)=>u.active!==false).length} color="#f59e0b" sub="Active users" />
        </div>

        {/* ─── BIG RINGS ─────────────────────────────────────── */}
        <div className="glass count-up" style={{ padding:'28px 24px', borderRadius:22, marginBottom:28 }}>
          <div style={{ textAlign:'center', marginBottom:24 }}>
            <div style={{ fontSize:11, color:'var(--text3)', letterSpacing:'0.1em', textTransform:'uppercase', fontWeight:600, marginBottom:4 }}>Performance Overview</div>
            <div style={{ fontSize:20, fontWeight:700, letterSpacing:'-0.02em' }}>Status Tim Saat Ini</div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:20, justifyItems:'center' }}>
            <GlassRing pct={avgProgress} color="#4f8ef7" label="Avg Initiative" sublabel="Progress" />
            <GlassRing pct={completionPct} color="#22c55e" label="Issue Completion" sublabel={`${completedIssues}/${issues.length}`} />
            <GlassRing pct={onTrackPct} color="#a78bfa" label="On Track" sublabel="Issues" />
            <GlassRing pct={Math.min(100, Math.round((kpis.length?kpis.reduce((s:number,k:any)=>s+(k.actualPct||0),0)/kpis.length:0)))} color="#f59e0b" label="KPI Achievement" sublabel="Average" />
          </div>
        </div>

        {/* ─── CHARTS GRID ─────────────────────────────────── */}
        <div style={{ display:'grid', gridTemplateColumns:'1.3fr 1fr', gap:18, marginBottom:28 }}>
          {/* Category radar */}
          <div className="glass count-up" style={{ padding:'22px 24px', borderRadius:20 }}>
            <div style={{ marginBottom:8 }}>
              <div style={{ fontSize:11, color:'var(--text3)', letterSpacing:'0.08em', textTransform:'uppercase', fontWeight:600 }}>KPI Categories</div>
              <div style={{ fontSize:16, fontWeight:600, marginTop:3 }}>Plan vs Actual</div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={radarData}>
                <defs>
                  <linearGradient id="rg-plan" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#9da3b8" stopOpacity={0.7}/><stop offset="100%" stopColor="#9da3b8" stopOpacity={0.2}/></linearGradient>
                  <linearGradient id="rg-actual" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4f8ef7" stopOpacity={0.7}/><stop offset="100%" stopColor="#4f8ef7" stopOpacity={0.2}/></linearGradient>
                </defs>
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="category" tick={{ fill:'var(--text2)', fontSize:11, fontWeight:500 }} />
                <PolarRadiusAxis tick={{ fill:'var(--text3)', fontSize:9 }} angle={90} domain={[0,100]} stroke="var(--border)" />
                <Radar name="Plan" dataKey="Plan" stroke="#9da3b8" fill="url(#rg-plan)" strokeWidth={2} />
                <Radar name="Actual" dataKey="Actual" stroke="#4f8ef7" fill="url(#rg-actual)" strokeWidth={2.5} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize:11, paddingTop:8 }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Category breakdown */}
          <div className="glass count-up" style={{ padding:'22px 24px', borderRadius:20 }}>
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:11, color:'var(--text3)', letterSpacing:'0.08em', textTransform:'uppercase', fontWeight:600 }}>Distribution</div>
              <div style={{ fontSize:16, fontWeight:600, marginTop:3 }}>By Category</div>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <defs>
                  {categoryData.map((c,i)=>(
                    <linearGradient key={i} id={`cd-${c.name}`} x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor={['#4f8ef7','#a78bfa','#22c55e','#f59e0b'][i]} stopOpacity={1}/>
                      <stop offset="100%" stopColor={['#4f8ef7','#a78bfa','#22c55e','#f59e0b'][i]} stopOpacity={0.5}/>
                    </linearGradient>
                  ))}
                </defs>
                <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={84} innerRadius={48} paddingAngle={4} stroke="none" labelLine={false}
                  label={(e:any)=>`${e.name} ${e.value}`}>
                  {categoryData.map((c,i)=><Cell key={i} fill={`url(#cd-${c.name})`} />)}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ─── TOP PIC CONTRIBUTION ────────────────────────── */}
        {topPics.length > 0 && (
          <div className="glass count-up" style={{ padding:'22px 24px', borderRadius:20, marginBottom:28 }}>
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:11, color:'var(--text3)', letterSpacing:'0.08em', textTransform:'uppercase', fontWeight:600 }}>Top Contributors</div>
              <div style={{ fontSize:16, fontWeight:600, marginTop:3 }}>Issue Workload Leaderboard</div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {topPics.map((p, i) => {
                const maxCount = topPics[0].count
                const pct = (p.count/maxCount)*100
                const colors = ['#4f8ef7','#a78bfa','#22c55e','#f59e0b','#ef4444','#2dd4bf','#f472b6','#818cf8']
                return (
                  <div key={p.name} style={{ display:'grid', gridTemplateColumns:'32px 1fr 80px 100px', gap:14, alignItems:'center' }}>
                    <div style={{ fontSize:14, fontWeight:700, color:i<3?'var(--blue)':'var(--text3)', textAlign:'center' }}>{i+1 <=3 ? ['🥇','🥈','🥉'][i] : `#${i+1}`}</div>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ width:30, height:30, borderRadius:'50%', background:`linear-gradient(135deg, ${colors[i]}, ${colors[i]}aa)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'#fff', boxShadow:`0 4px 12px ${colors[i]}40` }}>{p.name[0]}</div>
                      <div style={{ fontSize:13, fontWeight:500 }}>{p.name}</div>
                    </div>
                    <div style={{ fontSize:14, fontWeight:700, color:colors[i] }}>{p.count} <span style={{ fontSize:10, color:'var(--text3)', fontWeight:400 }}>issue</span></div>
                    <div style={{ height:6, background:'var(--bg4)', borderRadius:3, overflow:'hidden' }}>
                      <div style={{ width:`${pct}%`, height:'100%', background:`linear-gradient(90deg, ${colors[i]}, ${colors[i]}aa)`, borderRadius:3, transition:'width 0.8s ease' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ─── CTA ─────────────────────────────────────────── */}
        <div style={{ textAlign:'center', marginTop:32, paddingTop:24 }}>
          <button onClick={()=>router.push('/dashboard')} className="glass-strong glass-hover" style={{ padding:'10px 22px', borderRadius:24, fontSize:13, fontWeight:600, color:'var(--blue)', cursor:'pointer', border:'1px solid var(--glass-border)' }}>
            ← Kembali ke Dashboard
          </button>
        </div>
      </div>
    </div>
  )
}
