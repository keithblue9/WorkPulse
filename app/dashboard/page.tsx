'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, AreaChart, Area, LineChart, Line, Legend,
} from 'recharts'
import { format, addDays, startOfWeek } from 'date-fns'

// ─── Constants ──────────────────────────────────────────────
const PRIORITY_CFG: Record<string,{label:string;color:string;bg:string}> = {
  high:   { label:'High',   color:'#ef4444', bg:'rgba(239,68,68,0.12)' },
  medium: { label:'Medium', color:'#f59e0b', bg:'rgba(245,158,11,0.12)' },
  low:    { label:'Low',    color:'#22c55e', bg:'rgba(34,197,94,0.12)' },
}
const STATUS_CFG: Record<string,{label:string;color:string}> = {
  on_track:    { label:'On Track',  color:'#22c55e' },
  at_risk:     { label:'At Risk',   color:'#f59e0b' },
  delayed:     { label:'Delayed',   color:'#ef4444' },
  completed:   { label:'Completed', color:'#4f8ef7' },
}
const CAT_COLORS: Record<string,string> = { 'SI':'#4f8ef7', 'Non-SI':'#a78bfa', 'Others':'#2dd4bf', 'GoLive':'#22c55e' }
const ITEM_TYPE_ICONS: Record<string,string> = { meeting:'👥', task:'✅', dinas:'✈️', wfo:'🏢', wfh:'🏠', event:'🎉', other:'📌' }

function formatRp(n:number) { return new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',minimumFractionDigits:0,maximumFractionDigits:0}).format(n) }
function formatRpShort(n:number) {
  if (n>=1e9) return `Rp ${(n/1e9).toFixed(1)}M`
  if (n>=1e6) return `Rp ${(n/1e6).toFixed(0)}jt`
  if (n>=1e3) return `Rp ${(n/1e3).toFixed(0)}rb`
  return `Rp ${n}`
}

// ─── Tooltip skin ──────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:'var(--bg2)', border:'1px solid var(--border2)', borderRadius:8, padding:'8px 12px', boxShadow:'var(--shadow)', fontSize:11 }}>
      {label && <div style={{ fontWeight:600, color:'var(--text)', marginBottom:5, fontSize:11 }}>{label}</div>}
      {payload.map((p:any,i:number)=>(
        <div key={i} style={{ display:'flex', alignItems:'center', gap:7, marginTop:i?3:0 }}>
          <span style={{ width:9, height:9, borderRadius:2, background:p.color||p.fill, display:'inline-block' }} />
          <span style={{ color:'var(--text3)' }}>{p.name}:</span>
          <span style={{ color:'var(--text)', fontWeight:600 }}>{typeof p.value==='number' ? p.value.toLocaleString('id') : p.value}{p.unit||''}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Donut chart ───────────────────────────────────────────
function MiniDonut({ pct, color, size=82, label }: { pct:number; color:string; size?:number; label?:string }) {
  const data = [{ name:'done', value:pct }, { name:'left', value:Math.max(0,100-pct) }]
  return (
    <div style={{ position:'relative', width:size, height:size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" innerRadius={size*0.32} outerRadius={size*0.46} startAngle={90} endAngle={-270} stroke="none">
            <Cell fill={color} /><Cell fill="var(--bg4)" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', textAlign:'center' }}>
        <div style={{ fontSize:Math.round(size*0.21), fontWeight:700, color, lineHeight:1 }}>{Math.round(pct)}<span style={{ fontSize:Math.round(size*0.14) }}>%</span></div>
        {label && <div style={{ fontSize:9, color:'var(--text3)', marginTop:2 }}>{label}</div>}
      </div>
    </div>
  )
}

// ─── Stat card ─────────────────────────────────────────────
function StatCard({ label, value, sub, color, icon, trend }: { label:string; value:string|number; sub?:string; color:string; icon:string; trend?:{value:number;positive:boolean} }) {
  return (
    <div className="card" style={{ padding:'14px 16px', position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', top:-12, right:-12, width:60, height:60, borderRadius:'50%', background:color, opacity:0.08 }} />
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
        <div style={{ fontSize:10, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:600 }}>{label}</div>
        <div style={{ width:28, height:28, borderRadius:7, background:`${color}22`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>{icon}</div>
      </div>
      <div style={{ display:'flex', alignItems:'baseline', gap:6 }}>
        <div style={{ fontSize:24, fontWeight:700, color, lineHeight:1 }}>{value}</div>
        {trend && <div style={{ fontSize:10, fontWeight:600, color:trend.positive?'var(--green)':'var(--red)' }}>{trend.positive?'▲':'▼'} {trend.value}%</div>}
      </div>
      {sub && <div style={{ fontSize:10, color:'var(--text3)', marginTop:5 }}>{sub}</div>}
    </div>
  )
}

// ─── AI Insight ────────────────────────────────────────────
function AIInsight({ type, userName }: { type:'team'|'personal'; userName?:string }) {
  const [insight, setInsight] = useState('')
  const [loading, setLoading] = useState(false)
  const [generated, setGenerated] = useState(false)

  async function generate() {
    setLoading(true)
    try {
      const r = await fetch('/api/ai-insight', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ type, userName }) })
      const d = await r.json()
      setInsight(d.data?.insight || 'Gagal generate insight.'); setGenerated(true)
    } catch { toast.error('Gagal') } finally { setLoading(false) }
  }

  return (
    <div className="card" style={{ padding:'14px 16px', height:'100%', display:'flex', flexDirection:'column' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10, flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ width:24, height:24, borderRadius:6, background:type==='team'?'var(--bluebg)':'var(--purplebg)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13 }}>🤖</div>
          <div>
            <div style={{ fontSize:12, fontWeight:600, color:'var(--text)' }}>{type==='team'?'AI Insight — Tim':`AI Insight — ${userName}`}</div>
            <div style={{ fontSize:9, color:'var(--text3)' }}>Powered by Claude</div>
          </div>
        </div>
        <button onClick={generate} disabled={loading} className="btn btn-sm" style={{ fontSize:11 }}>
          {loading ? '⟳' : generated ? '↻' : '✨'} {loading ? 'Analisis...' : generated ? 'Refresh' : 'Generate'}
        </button>
      </div>
      <div style={{ flex:1, overflowY:'auto', minHeight:0 }}>
        {insight ? (
          <div style={{ fontSize:12, color:'var(--text2)', lineHeight:1.7, whiteSpace:'pre-wrap' }}>{insight}</div>
        ) : (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', textAlign:'center', padding:'10px' }}>
            <div>
              <div style={{ fontSize:24, marginBottom:6, opacity:0.5 }}>{type==='team'?'📊':'🎯'}</div>
              <div style={{ fontSize:11, color:'var(--text3)', lineHeight:1.5 }}>
                {loading ? 'AI sedang menganalisis...' : `Klik Generate untuk analisis ${type==='team'?'tim':'personal'} berdasarkan data terkini`}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Section header ────────────────────────────────────────
function Section({ title, sub, action }: { title:string; sub?:string; action?:React.ReactNode }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
      <div>
        <div style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{title}</div>
        {sub && <div style={{ fontSize:10, color:'var(--text3)' }}>{sub}</div>}
      </div>
      {action}
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────
export default function DashboardPage() {
  const { data:session } = useSession(); const user = session?.user as any
  const [data, setData] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [issueFilter, setIssueFilter] = useState<'all'|'high'|'medium'|'low'>('all')

  useEffect(() => {
    async function load() {
      try {
        const [s,ini,iss,kpi,proj,bud,cfg,agenda] = await Promise.all([
          fetch('/api/dashboard').then(r=>r.json()).catch(()=>({data:null})),
          fetch('/api/initiatives').then(r=>r.json()).catch(()=>({data:[]})),
          fetch('/api/issues').then(r=>r.json()).catch(()=>({data:[]})),
          fetch('/api/kpi?year=2026').then(r=>r.json()).catch(()=>({data:[]})),
          fetch('/api/projects').then(r=>r.json()).catch(()=>({data:[]})),
          fetch('/api/budget?year=2026').then(r=>r.json()).catch(()=>({data:[]})),
          fetch('/api/config').then(r=>r.json()).catch(()=>({data:null})),
          fetch(`/api/agenda?from=${format(new Date(),'yyyy-MM-dd')}&to=${format(addDays(new Date(),14),'yyyy-MM-dd')}`).then(r=>r.json()).catch(()=>({data:[]})),
        ])
        setData({ stats:s.data, initiatives:ini.data||[], issues:iss.data||[], kpis:kpi.data||[], projects:proj.data||[], budgets:bud.data||[], config:cfg.data, agenda:agenda.data||[] })
      } catch { toast.error('Gagal memuat data') } finally { setLoading(false) }
    }
    load()
  }, [])

  if (loading) return <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
    <div style={{ textAlign:'center' }}>
      <div style={{ width:36, height:36, border:'3px solid var(--border2)', borderTopColor:'var(--blue)', borderRadius:'50%', margin:'0 auto 12px' }} className="spin" />
      <div style={{ color:'var(--text3)', fontSize:12 }}>Memuat dashboard...</div>
    </div>
  </div>

  const { stats, initiatives, issues, kpis, projects, budgets, config, agenda } = data

  // ─── Derived data ─────────────────────────────────────────
  const totalIssues = issues.length
  const highIssues = issues.filter((i:any)=>i.priority==='high')
  const completedIssues = issues.filter((i:any)=>i.status==='completed')
  const riskIssues = issues.filter((i:any)=>i.status==='at_risk'||i.status==='delayed')
  const avgProgress = initiatives.length ? Math.round(initiatives.reduce((s:number,i:any)=>s+i.actualProgress,0)/initiatives.length) : 0
  const avgPlan = initiatives.length ? Math.round(initiatives.reduce((s:number,i:any)=>s+i.planProgress,0)/initiatives.length) : 0
  const filteredIssues = issueFilter==='all' ? issues : issues.filter((i:any)=>(i.priority||'medium')===issueFilter)

  // KPI breakdown by category
  const kpiByCat = ['SI','Non-SI','Others','GoLive'].map(cat => {
    const items = kpis.filter((k:any)=>k.category===cat)
    return { name:cat, plan: items.reduce((s:number,k:any)=>s+k.planPct,0)/Math.max(items.length,1), actual: items.reduce((s:number,k:any)=>s+k.actualPct,0)/Math.max(items.length,1), count: items.length, color: CAT_COLORS[cat] }
  }).filter(c=>c.count>0)

  // Status distribution
  const statusDist = Object.entries(STATUS_CFG).map(([key,cfg]) => ({ name:cfg.label, value: issues.filter((i:any)=>i.status===key).length, color:cfg.color }))

  // Priority distribution
  const priorityDist = Object.entries(PRIORITY_CFG).map(([key,cfg]) => ({ name:cfg.label, value: issues.filter((i:any)=>(i.priority||'medium')===key).length, color:cfg.color }))

  // Workload per PIC (from issues + projects)
  const picMap: Record<string,{ name:string; issues:number; projects:number; avgProgress:number; color:string }> = {}
  const colors = ['#4f8ef7','#a78bfa','#2dd4bf','#f59e0b','#22c55e','#f472b6','#ef4444','#818cf8']
  issues.forEach((i:any) => {
    const pic = i.picName || 'Unknown'
    if (!picMap[pic]) picMap[pic] = { name:pic, issues:0, projects:0, avgProgress:0, color:colors[Object.keys(picMap).length%colors.length] }
    picMap[pic].issues++; picMap[pic].avgProgress += i.progress
  })
  projects.forEach((p:any) => {
    const pic = p.pic || 'Unknown'
    if (!picMap[pic]) picMap[pic] = { name:pic, issues:0, projects:0, avgProgress:0, color:colors[Object.keys(picMap).length%colors.length] }
    picMap[pic].projects++
  })
  const workload = Object.values(picMap).map(w => ({ ...w, avgProgress: w.issues ? Math.round(w.avgProgress/w.issues) : 0 })).sort((a,b)=>(b.issues+b.projects)-(a.issues+a.projects)).slice(0,8)

  // Budget summary
  const budgetByCategory = (config?.budgetCategories || []).map((cat:any) => {
    const catEntries = budgets.filter((b:any) => b.categoryKey === cat.key)
    const totalActual = catEntries.reduce((s:number,e:any)=>s+e.actualAmount, 0)
    const currentMonth = new Date().getMonth()+1
    const burnRate = currentMonth ? totalActual/currentMonth : 0
    const estYearEnd = burnRate * 12
    const pct = cat.annualBudget ? Math.round(totalActual/cat.annualBudget*100) : 0
    return { ...cat, totalActual, estYearEnd, pct, isOver: pct >= cat.threshold }
  }).filter((b:any) => b.annualBudget > 0)

  // Monthly budget trend
  const monthlyBudget = Array.from({length:12}, (_,i)=>{
    const month = i+1
    const monthEntries = budgets.filter((b:any) => b.month === month)
    return {
      name: ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'][i],
      Plan: monthEntries.reduce((s:number,e:any)=>s+e.planAmount,0),
      Realisasi: monthEntries.reduce((s:number,e:any)=>s+e.actualAmount,0),
    }
  })

  // Upcoming agenda (next 14 days, top 6)
  const today = format(new Date(),'yyyy-MM-dd')
  const upcomingAgenda: any[] = []
  agenda.forEach((day:any) => {
    if (day.date >= today) {
      (day.items||[]).forEach((item:any) => upcomingAgenda.push({ ...item, date: day.date, userId: day.userId }))
    }
  })
  upcomingAgenda.sort((a,b) => a.date.localeCompare(b.date) || (a.time||'').localeCompare(b.time||''))
  const nextAgenda = upcomingAgenda.slice(0,6)

  // Issue radar by category
  const radarData = ['SI','Non-SI','Others','GoLive'].map(cat => {
    const catItems = kpis.filter((k:any)=>k.category===cat)
    return { category:cat, plan: catItems.length?Math.round(catItems.reduce((s:number,k:any)=>s+k.planPct,0)/catItems.length):0, actual: catItems.length?Math.round(catItems.reduce((s:number,k:any)=>s+k.actualPct,0)/catItems.length):0 }
  })

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ padding:'12px 20px', borderBottom:'1px solid var(--border)', background:'var(--bg2)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div>
          <div style={{ fontSize:15, fontWeight:600, color:'var(--text)' }}>Dashboard</div>
          <div style={{ fontSize:11, color:'var(--text3)' }}>BPD Procurement 2026 · {format(new Date(),'d MMM yyyy')} · M6 Mid Year Review</div>
        </div>
        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
          <span style={{ padding:'4px 10px', borderRadius:20, fontSize:10, fontWeight:600, background:'var(--bluebg)', color:'var(--blue)' }}>👤 {user?.name}</span>
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'14px 20px' }}>
        {/* ROW 1: KPI cards */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:12 }}>
          <StatCard label="Strategic Initiatives" value={initiatives.length} sub={`Avg progress: ${avgProgress}%`} color="#4f8ef7" icon="🎯" trend={avgProgress>=avgPlan?{value:avgProgress-avgPlan,positive:true}:{value:avgPlan-avgProgress,positive:false}} />
          <StatCard label="Total Issues" value={totalIssues} sub={`${completedIssues.length} selesai · ${riskIssues.length} berisiko`} color="#a78bfa" icon="◫" />
          <StatCard label="High Priority" value={highIssues.length} sub={`${Math.round(highIssues.length/Math.max(totalIssues,1)*100)}% dari total issues`} color="#ef4444" icon="🔴" />
          <StatCard label="Active Projects" value={projects.filter((p:any)=>p.status==='active').length} sub={`${projects.length} total project`} color="#22c55e" icon="🗂" />
        </div>

        {/* ROW 2: Initiative donuts + KPI bars side by side */}
        <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr', gap:10, marginBottom:12 }}>
          {/* Initiatives donuts */}
          <div className="card" style={{ padding:'14px 16px' }}>
            <Section title="Strategic Initiatives Progress" sub="Plan vs Actual per initiative" />
            <div style={{ display:'grid', gridTemplateColumns:`repeat(${Math.max(initiatives.length,1)},1fr)`, gap:10 }}>
              {initiatives.length === 0 ? (
                <div style={{ textAlign:'center', padding:'20px', color:'var(--text3)', fontSize:12 }}>Belum ada initiative</div>
              ) : initiatives.map((ini:any) => (
                <div key={ini._id} style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'8px', background:'var(--bg3)', borderRadius:8 }}>
                  <div style={{ fontSize:10, color:'var(--text3)', textAlign:'center', marginBottom:8, lineHeight:1.3, height:24, overflow:'hidden' }}>{ini.code}</div>
                  <MiniDonut pct={ini.actualProgress} color={ini.actualProgress>=ini.planProgress?'#22c55e':ini.actualProgress>=ini.planProgress*0.8?'#4f8ef7':'#f59e0b'} label={`Plan ${ini.planProgress}%`} />
                  <div style={{ fontSize:9, color:'var(--text3)', marginTop:6, textAlign:'center', lineHeight:1.3, height:24, overflow:'hidden', width:'100%' }}>{ini.title.length>30?ini.title.slice(0,30)+'…':ini.title}</div>
                  <span className={`badge badge-${ini.status}`} style={{ marginTop:4, fontSize:9 }}>{ini.status?.replace('_',' ')}</span>
                </div>
              ))}
            </div>
          </div>

          {/* KPI radar */}
          <div className="card" style={{ padding:'14px 16px' }}>
            <Section title="KPI by Category" sub="Plan vs Actual per kategori" />
            <ResponsiveContainer width="100%" height={210}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="category" tick={{ fill:'var(--text2)', fontSize:10 }} />
                <PolarRadiusAxis tick={{ fill:'var(--text3)', fontSize:9 }} angle={90} domain={[0,100]} stroke="var(--border)" />
                <Radar name="Plan" dataKey="plan" stroke="#9da3b8" fill="#9da3b8" fillOpacity={0.2} strokeWidth={1.5} />
                <Radar name="Actual" dataKey="actual" stroke="#4f8ef7" fill="#4f8ef7" fillOpacity={0.35} strokeWidth={2} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize:11, paddingTop:6 }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ROW 3: KPI bars + status pie + priority pie */}
        <div style={{ display:'grid', gridTemplateColumns:'1.5fr 1fr 1fr', gap:10, marginBottom:12 }}>
          <div className="card" style={{ padding:'14px 16px' }}>
            <Section title="KPI Detail per Category" sub={`${kpis.length} items tracked`} />
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={kpiByCat} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill:'var(--text2)', fontSize:10 }} axisLine={{ stroke:'var(--border)' }} tickLine={false} />
                <YAxis tick={{ fill:'var(--text3)', fontSize:10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill:'var(--bg3)' }} />
                <Legend wrapperStyle={{ fontSize:11 }} />
                <Bar dataKey="plan" fill="#9da3b8" name="Plan %" radius={[3,3,0,0]} />
                <Bar dataKey="actual" name="Actual %" radius={[3,3,0,0]}>
                  {kpiByCat.map((entry,i)=><Cell key={i} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card" style={{ padding:'14px 16px' }}>
            <Section title="Issue Status" sub={`${totalIssues} issues total`} />
            <ResponsiveContainer width="100%" height={170}>
              <PieChart>
                <Pie data={statusDist.filter(s=>s.value>0)} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} innerRadius={32} paddingAngle={2}>
                  {statusDist.map((s,i)=><Cell key={i} fill={s.color} />)}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, justifyContent:'center', marginTop:-8 }}>
              {statusDist.filter(s=>s.value>0).map(s=>(
                <div key={s.name} style={{ display:'flex', alignItems:'center', gap:4, fontSize:10, color:'var(--text2)' }}>
                  <span style={{ width:8, height:8, borderRadius:2, background:s.color }} /><span>{s.name} ({s.value})</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding:'14px 16px' }}>
            <Section title="Issue Priority" sub="Severity distribution" />
            <ResponsiveContainer width="100%" height={170}>
              <PieChart>
                <Pie data={priorityDist.filter(p=>p.value>0)} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} innerRadius={32} paddingAngle={2}>
                  {priorityDist.map((p,i)=><Cell key={i} fill={p.color} />)}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, justifyContent:'center', marginTop:-8 }}>
              {priorityDist.filter(p=>p.value>0).map(p=>(
                <div key={p.name} style={{ display:'flex', alignItems:'center', gap:4, fontSize:10, color:'var(--text2)' }}>
                  <span style={{ width:8, height:8, borderRadius:2, background:p.color }} /><span>{p.name} ({p.value})</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ROW 4: AI Insights */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
          <AIInsight type="team" />
          <AIInsight type="personal" userName={user?.name} />
        </div>

        {/* ROW 5: Workload + Upcoming Agenda */}
        <div style={{ display:'grid', gridTemplateColumns:'1.3fr 1fr', gap:10, marginBottom:12 }}>
          <div className="card" style={{ padding:'14px 16px' }}>
            <Section title="Workload per PIC" sub="Distribusi issues & projects per anggota" />
            <ResponsiveContainer width="100%" height={Math.max(180, workload.length*30)}>
              <BarChart data={workload} layout="vertical" barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tick={{ fill:'var(--text3)', fontSize:10 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill:'var(--text2)', fontSize:10 }} axisLine={false} tickLine={false} width={70} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill:'var(--bg3)' }} />
                <Legend wrapperStyle={{ fontSize:10 }} />
                <Bar dataKey="issues" stackId="a" fill="#4f8ef7" name="Issues" radius={[0,0,0,0]} />
                <Bar dataKey="projects" stackId="a" fill="#a78bfa" name="Projects" radius={[0,3,3,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card" style={{ padding:'14px 16px' }}>
            <Section title="📅 Agenda Mendatang" sub={`${nextAgenda.length} item dalam 14 hari ke depan`} />
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {nextAgenda.length === 0 ? (
                <div style={{ textAlign:'center', padding:'20px 0', color:'var(--text3)', fontSize:11 }}>Belum ada agenda mendatang</div>
              ) : nextAgenda.map((item:any,i:number)=>{
                const isToday = item.date === today
                return (
                  <div key={i} style={{ display:'flex', gap:8, padding:'7px 10px', background:'var(--bg3)', borderRadius:7, borderLeft:`3px solid ${isToday?'var(--blue)':'var(--border2)'}` }}>
                    <div style={{ flexShrink:0, fontSize:14 }}>{ITEM_TYPE_ICONS[item.type]||'📌'}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:11, fontWeight:500, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.title}</div>
                      <div style={{ fontSize:9, color:'var(--text3)' }}>
                        {isToday ? '🔵 Hari ini' : format(new Date(item.date),'d MMM')}
                        {item.time && ` · ⏰ ${item.time}`}
                        {item.userId && ` · ${item.userId}`}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ROW 6: Budget overview */}
        {budgetByCategory.length > 0 && (
          <div style={{ display:'grid', gridTemplateColumns:'1.3fr 1fr', gap:10, marginBottom:12 }}>
            <div className="card" style={{ padding:'14px 16px' }}>
              <Section title="💰 Anggaran 2026" sub="Plan vs Realisasi bulanan (semua kategori)" />
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={monthlyBudget}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill:'var(--text2)', fontSize:10 }} axisLine={{ stroke:'var(--border)' }} tickLine={false} />
                  <YAxis tick={{ fill:'var(--text3)', fontSize:9 }} axisLine={false} tickLine={false} tickFormatter={formatRpShort} />
                  <Tooltip content={<ChartTooltip />} formatter={(v:any)=>formatRp(v)} />
                  <Legend wrapperStyle={{ fontSize:11 }} />
                  <Area type="monotone" dataKey="Plan" stroke="#9da3b8" fill="#9da3b8" fillOpacity={0.3} strokeWidth={1.5} />
                  <Area type="monotone" dataKey="Realisasi" stroke="#4f8ef7" fill="#4f8ef7" fillOpacity={0.4} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="card" style={{ padding:'14px 16px' }}>
              <Section title="Status Anggaran" sub="Per kategori dengan threshold alert" />
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {budgetByCategory.map((cat:any)=>(
                  <div key={cat.key} style={{ padding:'10px 12px', background:'var(--bg3)', borderRadius:8, borderLeft:`3px solid ${cat.isOver?'var(--red)':cat.pct>=cat.threshold*0.7?'var(--amber)':'var(--green)'}` }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                      <span style={{ fontSize:11, fontWeight:600, color:'var(--text)' }}>{cat.label}</span>
                      <span style={{ fontSize:11, fontWeight:700, color: cat.isOver?'var(--red)':'var(--text2)' }}>{cat.pct}%</span>
                    </div>
                    <div className="prog-bar" style={{ marginBottom:5 }}>
                      <div className="prog-fill" style={{ width:`${Math.min(100,cat.pct)}%`, background: cat.isOver?'var(--red)':cat.pct>=cat.threshold*0.7?'var(--amber)':'var(--green)' }} />
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:'var(--text3)' }}>
                      <span>Realisasi: {formatRpShort(cat.totalActual)}</span>
                      <span>Anggaran: {formatRpShort(cat.annualBudget)}</span>
                    </div>
                    <div style={{ fontSize:9, color: cat.estYearEnd>cat.annualBudget?'var(--red)':'var(--text3)', marginTop:3, fontWeight: cat.estYearEnd>cat.annualBudget?600:400 }}>
                      Estimasi akhir tahun: {formatRpShort(cat.estYearEnd)} {cat.estYearEnd>cat.annualBudget?'⚠ MELEBIHI':''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ROW 7: Issues table by priority */}
        <div className="card" style={{ marginBottom:12, overflow:'hidden' }}>
          <div style={{ padding:'10px 16px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <Section title="Issues by Priority" sub={`${filteredIssues.length} dari ${totalIssues} issues`} />
            <div style={{ display:'flex', gap:4 }}>
              {[['all','Semua',totalIssues],['high','🔴 High',highIssues.length],['medium','🟡 Medium',issues.filter((i:any)=>(i.priority||'medium')==='medium').length],['low','🟢 Low',issues.filter((i:any)=>i.priority==='low').length]].map(([v,l,c])=>(
                <button key={v as string} onClick={()=>setIssueFilter(v as any)} style={{ padding:'3px 11px', borderRadius:20, fontSize:11, cursor:'pointer', border:`1px solid ${issueFilter===v?'var(--blue)':'var(--border)'}`, background:issueFilter===v?'var(--bluebg)':'var(--bg3)', color:issueFilter===v?'var(--blue)':'var(--text2)' }}>{l} <span style={{ opacity:0.6 }}>({c})</span></button>
              ))}
            </div>
          </div>
          {filteredIssues.length === 0 ? (
            <div style={{ textAlign:'center', padding:'30px 0', color:'var(--text3)', fontSize:12 }}>Tidak ada issue dengan filter ini</div>
          ) : (
            <table className="wp-table" style={{ width:'100%' }}>
              <thead><tr>
                <th>Issue</th>
                <th style={{ width:80 }}>Priority</th>
                <th style={{ width:140 }}>Progress</th>
                <th style={{ width:100 }}>Status</th>
                <th style={{ width:100 }}>Due Date</th>
                <th style={{ width:120 }}>PIC</th>
              </tr></thead>
              <tbody>
                {filteredIssues.slice(0,10).map((issue:any)=>{
                  const pcfg = PRIORITY_CFG[issue.priority||'medium']
                  const isOverdue = issue.dueDate < today && issue.status !== 'completed'
                  return (
                    <tr key={issue._id}>
                      <td>
                        <div style={{ fontSize:12, fontWeight:500, color:'var(--text)' }}>{issue.title}</div>
                        {issue.nextPlan && <div style={{ fontSize:10, color:'var(--text3)' }}>→ {issue.nextPlan}</div>}
                      </td>
                      <td><span style={{ padding:'2px 9px', borderRadius:20, fontSize:10, fontWeight:700, background:pcfg.bg, color:pcfg.color }}>{pcfg.label}</span></td>
                      <td>
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <div className="prog-bar" style={{ flex:1 }}>
                            <div className="prog-fill" style={{ width:`${issue.progress}%`, background: issue.progress>=80?'#22c55e':issue.progress>=40?'#4f8ef7':'#f59e0b' }} />
                          </div>
                          <span style={{ fontSize:10, fontWeight:600, color:'var(--text2)', minWidth:32 }}>{issue.progress}%</span>
                        </div>
                      </td>
                      <td><span className={`badge badge-${issue.status}`}>{issue.status?.replace('_',' ')}</span></td>
                      <td style={{ fontSize:11, color: isOverdue?'var(--red)':'var(--text2)', fontWeight: isOverdue?600:400 }}>{issue.dueDate}{isOverdue?' ⚠':''}</td>
                      <td>
                        <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                          <div style={{ width:20, height:20, borderRadius:'50%', background:'var(--blue2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700, color:'#fff' }}>{issue.picName?.[0]}</div>
                          <span style={{ fontSize:11 }}>{issue.picName}</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
