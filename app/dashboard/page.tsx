'use client'
import { useEffect, useState, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  AreaChart, Area, Legend,
} from 'recharts'
import { format, addDays } from 'date-fns'

const PRIORITY_CFG: Record<string,{label:string;color:string;bg:string}> = {
  high:   { label:'High',   color:'#ef4444', bg:'rgba(239,68,68,0.12)' },
  medium: { label:'Medium', color:'#f59e0b', bg:'rgba(245,158,11,0.12)' },
  low:    { label:'Low',    color:'#22c55e', bg:'rgba(34,197,94,0.12)' },
}
const ITEM_TYPE_ICONS: Record<string,string> = { meeting:'👥', task:'✅', dinas:'✈️', wfo:'🏢', wfh:'🏠', event:'🎉', other:'📌' }

function formatRpShort(n:number) {
  if (n>=1e9) return `Rp ${(n/1e9).toFixed(1)}M`
  if (n>=1e6) return `Rp ${(n/1e6).toFixed(0)}jt`
  if (n>=1e3) return `Rp ${(n/1e3).toFixed(0)}rb`
  return `Rp ${n}`
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="glass-strong" style={{ borderRadius:10, padding:'8px 12px', fontSize:11 }}>
      {label && <div style={{ fontWeight:600, color:'var(--text)', marginBottom:5 }}>{label}</div>}
      {payload.map((p:any,i:number)=>(
        <div key={i} style={{ display:'flex', alignItems:'center', gap:7, marginTop:i?3:0 }}>
          <span style={{ width:9, height:9, borderRadius:2, background:p.color||p.fill }} />
          <span style={{ color:'var(--text3)' }}>{p.name}:</span>
          <span style={{ color:'var(--text)', fontWeight:600 }}>{typeof p.value==='number' ? p.value.toLocaleString('id') : p.value}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Animated count-up ──────────────────────────────────────
function AnimatedNumber({ value, prefix='', suffix='', duration=900 }: { value:number; prefix?:string; suffix?:string; duration?:number }) {
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
  return <>{prefix}{display.toLocaleString('id-ID')}{suffix}</>
}

// ─── Glass Stat Card with tilt ──────────────────────────────
function GlassStatCard({ label, value, sub, color, icon, onClick, trend }: { label:string; value:number; sub?:string; color:string; icon:string; onClick?:()=>void; trend?:string }) {
  const ref = useRef<HTMLDivElement>(null)
  function handleMove(e: React.MouseEvent) {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 6
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * -6
    ref.current.style.transform = `perspective(800px) rotateY(${x}deg) rotateX(${y}deg) translateY(-3px)`
  }
  function handleLeave() { if (ref.current) ref.current.style.transform = '' }

  return (
    <div ref={ref} className="glass glass-hover count-up" onClick={onClick} onMouseMove={handleMove} onMouseLeave={handleLeave}
      style={{ padding:'18px 20px', borderRadius:18, position:'relative', overflow:'hidden', cursor: onClick?'pointer':'default' }}>
      <div style={{ position:'absolute', top:-30, right:-30, width:120, height:120, borderRadius:'50%', background:`radial-gradient(circle, ${color}55 0%, transparent 70%)`, filter:'blur(20px)' }} />
      <div style={{ position:'relative', zIndex:1 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
          <div style={{ fontSize:10, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.07em', fontWeight:600 }}>{label}</div>
          <div className="glass" style={{ width:34, height:34, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>{icon}</div>
        </div>
        <div className="stat-display" style={{ color, marginBottom:6 }}><AnimatedNumber value={value} /></div>
        {sub && <div style={{ fontSize:11, color:'var(--text3)' }}>{sub}</div>}
        {trend && <div style={{ fontSize:10, color, marginTop:6, fontWeight:600, opacity:0.8 }}>{trend}</div>}
        {onClick && <div style={{ fontSize:9, color:color, marginTop:8, fontWeight:600, opacity:0.7 }}>Klik untuk detail →</div>}
      </div>
    </div>
  )
}

// ─── Detail Modal ───────────────────────────────────────────
function DetailModal({ title, items, columns, onClose, emptyText }: { title:string; items:any[]; columns:{key:string;label:string;render?:(v:any,row:any)=>any}[]; onClose:()=>void; emptyText?:string }) {
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="glass-strong scale-in" style={{ borderRadius:18, width:760, maxWidth:'92vw', maxHeight:'88vh', overflow:'hidden', display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'16px 22px', borderBottom:'1px solid var(--glass-border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontSize:15, fontWeight:600 }}>{title}</div>
            <div style={{ fontSize:10, color:'var(--text3)' }}>{items.length} item</div>
          </div>
          <button onClick={onClose} className="btn btn-icon">×</button>
        </div>
        <div style={{ overflowY:'auto', flex:1 }}>
          {items.length === 0 ? (
            <div style={{ padding:'40px 20px', textAlign:'center', color:'var(--text3)', fontSize:12 }}>{emptyText||'Belum ada data'}</div>
          ) : (
            <table className="wp-table" style={{ width:'100%' }}>
              <thead><tr>{columns.map(c=><th key={c.key}>{c.label}</th>)}</tr></thead>
              <tbody>{items.map((row,i)=>(
                <tr key={i}>{columns.map(c=>(<td key={c.key}>{c.render?c.render(row[c.key],row):(row[c.key]||'—')}</td>))}</tr>
              ))}</tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── AI Insight in glass ────────────────────────────────────
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
    <div className="glass" style={{ padding:'16px 18px', borderRadius:16, height:'100%', display:'flex', flexDirection:'column' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:34, height:34, borderRadius:11, background:`linear-gradient(135deg, ${type==='team'?'#4f8ef7':'#a78bfa'}, ${type==='team'?'#2563d4':'#7c3aed'})`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, color:'#fff', boxShadow:'0 6px 16px rgba(79,142,247,0.3)' }}>🤖</div>
          <div>
            <div style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{type==='team'?'AI Insight — Tim':`AI — ${userName||'Personal'}`}</div>
            <div style={{ fontSize:9, color:'var(--text3)' }}>Powered by Claude</div>
          </div>
        </div>
        <button onClick={generate} disabled={loading} className="btn btn-sm">
          {loading ? '⟳ ...' : generated ? '↻' : '✨ Generate'}
        </button>
      </div>
      <div style={{ flex:1, overflowY:'auto', minHeight:120 }}>
        {insight ? (
          <div style={{ fontSize:12, color:'var(--text2)', lineHeight:1.7, whiteSpace:'pre-wrap' }}>{insight}</div>
        ) : (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', minHeight:120, textAlign:'center' }}>
            <div>
              <div style={{ fontSize:32, marginBottom:6, opacity:0.4 }}>{type==='team'?'📊':'🎯'}</div>
              <div style={{ fontSize:11, color:'var(--text3)' }}>{loading ? 'AI menganalisis...' : 'Klik Generate untuk analisis'}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Donut with glass ───────────────────────────────────────
function GlassDonut({ pct, color, size=80, label, sublabel }: { pct:number; color:string; size?:number; label?:string; sublabel?:string }) {
  const data = [{ name:'done', value:pct }, { name:'left', value:Math.max(0,100-pct) }]
  return (
    <div style={{ position:'relative', width:size, height:size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <defs>
            <linearGradient id={`grad-${label?.replace(/\W/g,'')}-${color.replace('#','')}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={1} />
              <stop offset="100%" stopColor={color} stopOpacity={0.6} />
            </linearGradient>
          </defs>
          <Pie data={data} dataKey="value" innerRadius={size*0.34} outerRadius={size*0.48} startAngle={90} endAngle={-270} stroke="none">
            <Cell fill={`url(#grad-${label?.replace(/\W/g,'')}-${color.replace('#','')})`} /><Cell fill="var(--bg4)" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', textAlign:'center' }}>
        <div style={{ fontSize:Math.round(size*0.22), fontWeight:800, color, lineHeight:1, letterSpacing:'-0.03em' }}>{Math.round(pct)}<span style={{ fontSize:Math.round(size*0.14) }}>%</span></div>
        {sublabel && <div style={{ fontSize:8, color:'var(--text3)', marginTop:2 }}>{sublabel}</div>}
      </div>
    </div>
  )
}

// ─── Main Dashboard ─────────────────────────────────────────
export default function DashboardPage() {
  const { data:session } = useSession(); const user = session?.user as any
  const router = useRouter()
  const [data, setData] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [activeSegment, setActiveSegment] = useState('overview')
  const [detail, setDetail] = useState<any>(null)

  useEffect(() => {
    async function load() {
      try {
        const [ini,iss,kpi,proj,bud,cfg,agenda] = await Promise.all([
          fetch('/api/initiatives').then(r=>r.json()).catch(()=>({data:[]})),
          fetch('/api/issues').then(r=>r.json()).catch(()=>({data:[]})),
          fetch('/api/kpi?year=2026').then(r=>r.json()).catch(()=>({data:[]})),
          fetch('/api/projects').then(r=>r.json()).catch(()=>({data:[]})),
          fetch('/api/budget?year=2026').then(r=>r.json()).catch(()=>({data:[]})),
          fetch('/api/config').then(r=>r.json()).catch(()=>({data:null})),
          fetch(`/api/agenda?from=${format(new Date(),'yyyy-MM-dd')}&to=${format(addDays(new Date(),14),'yyyy-MM-dd')}`).then(r=>r.json()).catch(()=>({data:[]})),
        ])
        setData({ initiatives:ini.data||[], issues:iss.data||[], kpis:kpi.data||[], projects:proj.data||[], budgets:bud.data||[], config:cfg.data, agenda:agenda.data||[] })
      } catch { toast.error('Gagal memuat data') } finally { setLoading(false) }
    }
    load()
  }, [])

  if (loading) return (
    <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', position:'relative' }}>
      <div className="ambient-bg">
        <div className="orb" style={{ width:300, height:300, background:'#4f8ef7', top:'30%', left:'40%' }} />
      </div>
      <div style={{ position:'relative', textAlign:'center' }}>
        <div style={{ width:40, height:40, border:'3px solid var(--border2)', borderTopColor:'var(--blue)', borderRadius:'50%', margin:'0 auto 14px' }} className="spin" />
        <div style={{ color:'var(--text3)', fontSize:12 }}>Memuat dashboard...</div>
      </div>
    </div>
  )

  const { initiatives=[], issues=[], kpis=[], projects=[], budgets=[], config, agenda=[] } = data
  const segments = config?.dashboardSegments?.filter((s:any)=>s.active) || [
    { key:'kpi', label:'KPI', color:'#4f8ef7' },
    { key:'non-si', label:'Non SI', color:'#a78bfa' },
    { key:'golive', label:'GoLive', color:'#22c55e' },
    { key:'anggaran', label:'Anggaran', color:'#f59e0b' },
    { key:'others', label:'Others', color:'#9da3b8' },
  ]

  const totalIssues = issues.length
  const highIssues = issues.filter((i:any)=>i.priority==='high')
  const completedIssues = issues.filter((i:any)=>i.status==='completed')
  const riskIssues = issues.filter((i:any)=>i.status==='at_risk'||i.status==='delayed')
  const avgProgress = initiatives.length ? Math.round(initiatives.reduce((s:number,i:any)=>s+(i.actualProgress||0),0)/initiatives.length) : 0
  const avgPlan = initiatives.length ? Math.round(initiatives.reduce((s:number,i:any)=>s+(i.planProgress||0),0)/initiatives.length) : 0

  function projectsBySegment(seg:string) {
    if (seg === 'anggaran') return []
    return projects.filter((p:any) => {
      const t = (p.subType||'').toLowerCase(); const cat = (p.category||'').toLowerCase()
      if (seg === 'kpi') return t.includes('kpi-si')
      if (seg === 'non-si') return t.includes('non-si') || t.includes('non si')
      if (seg === 'golive') return t.includes('go-live') || cat.includes('golive')
      if (seg === 'others') return t.includes('others') || cat.includes('others')
      return false
    })
  }

  const statusDist = ['on_track','at_risk','delayed','completed'].map(k => ({
    name: k.replace('_',' '),
    value: issues.filter((i:any)=>i.status===k).length,
    color: { on_track:'#22c55e', at_risk:'#f59e0b', delayed:'#ef4444', completed:'#4f8ef7' }[k as any],
  }))

  const budgetByCategory = (config?.budgetCategories || []).map((cat:any) => {
    const catEntries = budgets.filter((b:any) => b.categoryKey === cat.key)
    const totalActual = catEntries.reduce((s:number,e:any)=>s+(e.actualAmount||0), 0)
    const currentMonth = new Date().getMonth()+1
    const burnRate = currentMonth ? totalActual/currentMonth : 0
    const estYearEnd = burnRate * 12
    const pct = cat.annualBudget ? Math.round(totalActual/cat.annualBudget*100) : 0
    return { ...cat, totalActual, estYearEnd, pct, isOver: pct >= cat.threshold }
  }).filter((b:any) => b.annualBudget > 0)

  const monthlyBudget = Array.from({length:12}, (_,i)=>{
    const month = i+1
    const monthEntries = budgets.filter((b:any) => b.month === month)
    return {
      name: ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'][i],
      Plan: monthEntries.reduce((s:number,e:any)=>s+(e.planAmount||0),0),
      Realisasi: monthEntries.reduce((s:number,e:any)=>s+(e.actualAmount||0),0),
    }
  })

  const today = format(new Date(),'yyyy-MM-dd')
  const upcomingAgenda: any[] = []
  agenda.forEach((day:any) => {
    if (day.date >= today) (day.items||[]).forEach((item:any) => upcomingAgenda.push({ ...item, date: day.date }))
  })
  upcomingAgenda.sort((a,b) => a.date.localeCompare(b.date) || (a.time||'').localeCompare(b.time||''))

  const detailMap: Record<string, any> = {
    initiatives: { title: 'Strategic Initiatives', items: initiatives, columns: [
      { key:'code', label:'Code' }, { key:'title', label:'Title' },
      { key:'planProgress', label:'Plan', render:(v:number)=>`${v}%` },
      { key:'actualProgress', label:'Actual', render:(v:number,r:any)=>(<span style={{ color: r.actualProgress>=r.planProgress?'var(--green)':'var(--amber)', fontWeight:600 }}>{v}%</span>)},
      { key:'status', label:'Status', render:(v:string)=><span className={`badge badge-${v}`}>{v?.replace('_',' ')}</span> },
    ]},
    issues_all: { title: 'Semua Issues', items: issues, columns: [
      { key:'title', label:'Issue' }, { key:'picName', label:'PIC' },
      { key:'progress', label:'Progress', render:(v:number)=>`${v}%` },
      { key:'priority', label:'Priority', render:(v:string)=>{const cfg=PRIORITY_CFG[v||'medium'];return <span style={{ color:cfg.color, fontSize:11, fontWeight:600 }}>{cfg.label}</span>} },
      { key:'status', label:'Status', render:(v:string)=><span className={`badge badge-${v}`}>{v?.replace('_',' ')}</span> },
      { key:'dueDate', label:'Due' },
    ]},
    issues_high: { title: 'High Priority Issues', items: highIssues, columns: [
      { key:'title', label:'Issue' }, { key:'picName', label:'PIC' },
      { key:'progress', label:'Progress', render:(v:number)=>`${v}%` },
      { key:'dueDate', label:'Due' },
      { key:'status', label:'Status', render:(v:string)=><span className={`badge badge-${v}`}>{v?.replace('_',' ')}</span> },
    ]},
    projects_active: { title: 'Active Projects', items: projects.filter((p:any)=>p.status==='active'), columns: [
      { key:'title', label:'Title' }, { key:'category', label:'Category' }, { key:'subType', label:'Sub-type' },
      { key:'progress', label:'Progress', render:(v:number)=>`${v}%` },
      { key:'members', label:'PIC', render:(v:any)=>v?.join(', ')||'—' },
    ]},
    agenda: { title: 'Upcoming Agenda', items: upcomingAgenda, columns: [
      { key:'date', label:'Tanggal' }, { key:'time', label:'Jam' },
      { key:'title', label:'Activity', render:(v:string,r:any)=><span>{ITEM_TYPE_ICONS[r.type]||'📌'} {v}</span> },
      { key:'location', label:'Lokasi' },
    ]},
  }

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', position:'relative' }}>
      {detail && <DetailModal {...detailMap[detail]} onClose={()=>setDetail(null)} />}

      {/* Ambient gradient orbs background */}
      <div className="ambient-bg" style={{ position:'fixed' }}>
        <div className="orb" style={{ width:420, height:420, background:'#4f8ef7', top:'5%', left:'-10%' }} />
        <div className="orb" style={{ width:380, height:380, background:'#a78bfa', top:'40%', right:'-8%', animationDelay:'-6s' }} />
        <div className="orb" style={{ width:340, height:340, background:'#22c55e', bottom:'5%', left:'30%', animationDelay:'-12s' }} />
      </div>

      <div style={{ padding:'14px 24px', borderBottom:'1px solid var(--glass-border)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0, position:'relative', zIndex:1 }} className="glass">
        <div>
          <div style={{ fontSize:18, fontWeight:700, letterSpacing:'-0.02em' }} className="gradient-text">Dashboard</div>
          <div style={{ fontSize:11, color:'var(--text3)' }}>{config?.appTagline||'BPD & SS Procurement'} · {format(new Date(),'EEEE, d MMM yyyy')}</div>
        </div>
        <div className="glass" style={{ padding:'5px 12px', borderRadius:20, fontSize:11, fontWeight:600 }}>👤 {user?.name}</div>
      </div>

      {/* Segment tabs */}
      <div style={{ display:'flex', gap:5, padding:'10px 24px', overflowX:'auto', flexShrink:0, position:'relative', zIndex:1 }}>
        <button onClick={()=>setActiveSegment('overview')} className={activeSegment==='overview'?'glass-strong':'glass'} style={{ padding:'6px 16px', borderRadius:20, fontSize:12, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap', color:activeSegment==='overview'?'var(--blue)':'var(--text2)', border: activeSegment==='overview'?'1px solid var(--blue)':'1px solid var(--glass-border)' }}>📊 Overview</button>
        {segments.map((seg:any) => (
          <button key={seg.key} onClick={()=>setActiveSegment(seg.key)} className={activeSegment===seg.key?'glass-strong':'glass'} style={{ padding:'6px 16px', borderRadius:20, fontSize:12, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap', color:activeSegment===seg.key?seg.color:'var(--text2)', border: activeSegment===seg.key?`1px solid ${seg.color}`:'1px solid var(--glass-border)' }}>{seg.label}</button>
        ))}
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'14px 24px 24px', position:'relative', zIndex:1 }} className="safe-bottom">
        {activeSegment === 'overview' && (<>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:14, marginBottom:14 }}>
            <GlassStatCard label="Strategic Initiatives" value={initiatives.length} sub={`Avg progress: ${avgProgress}%`} color="#4f8ef7" icon="🎯" onClick={()=>setDetail('initiatives')} trend={avgProgress>avgPlan?`▲ ${avgProgress-avgPlan}% ahead`:avgPlan>avgProgress?`▼ ${avgPlan-avgProgress}% behind`:''} />
            <GlassStatCard label="Total Issues" value={totalIssues} sub={`${completedIssues.length} selesai · ${riskIssues.length} berisiko`} color="#a78bfa" icon="◫" onClick={()=>setDetail('issues_all')} />
            <GlassStatCard label="High Priority" value={highIssues.length} sub={`${Math.round(highIssues.length/Math.max(totalIssues,1)*100)}% dari total`} color="#ef4444" icon="🔴" onClick={()=>setDetail('issues_high')} />
            <GlassStatCard label="Active Projects" value={projects.filter((p:any)=>p.status==='active').length} sub={`${projects.length} total project`} color="#22c55e" icon="🗂" onClick={()=>setDetail('projects_active')} />
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr', gap:14, marginBottom:14 }}>
            <div className="glass count-up" style={{ padding:'18px 20px', borderRadius:18 }}>
              <div style={{ fontSize:14, fontWeight:600, marginBottom:14 }}>Strategic Initiatives</div>
              <div style={{ display:'grid', gridTemplateColumns:`repeat(${Math.max(initiatives.length,1)},1fr)`, gap:12 }}>
                {initiatives.length === 0 ? (
                  <div style={{ textAlign:'center', padding:'20px', color:'var(--text3)', fontSize:12 }}>Belum ada initiative</div>
                ) : initiatives.map((ini:any) => (
                  <div key={ini._id} onClick={()=>router.push('/dashboard/progress')} className="glass glass-hover" style={{ padding:'12px', borderRadius:12, cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center' }}>
                    <div style={{ fontSize:10, color:'var(--text3)', marginBottom:8 }}>{ini.code}</div>
                    <GlassDonut pct={ini.actualProgress} color={ini.actualProgress>=ini.planProgress?'#22c55e':'#f59e0b'} sublabel={`Plan ${ini.planProgress}%`} />
                    <div style={{ fontSize:10, color:'var(--text2)', marginTop:8, textAlign:'center', height:28, overflow:'hidden', lineHeight:1.3 }}>{ini.title.length>34?ini.title.slice(0,34)+'…':ini.title}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass count-up" style={{ padding:'18px 20px', borderRadius:18 }}>
              <div style={{ fontSize:14, fontWeight:600, marginBottom:8 }}>Issue Distribution</div>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <defs>
                    {statusDist.map((s,i) => (
                      <linearGradient key={i} id={`pie-${s.name.replace(/\s/g,'')}`} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor={s.color} stopOpacity={1} /><stop offset="100%" stopColor={s.color} stopOpacity={0.6} />
                      </linearGradient>
                    ))}
                  </defs>
                  <Pie data={statusDist.filter(s=>s.value>0)} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={66} innerRadius={36} paddingAngle={3} stroke="none">
                    {statusDist.map((s,i)=><Cell key={i} fill={`url(#pie-${s.name.replace(/\s/g,'')})`} />)}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8, justifyContent:'center', marginTop:4 }}>
                {statusDist.filter(s=>s.value>0).map(s=>(
                  <div key={s.name} style={{ display:'flex', alignItems:'center', gap:5, fontSize:10, color:'var(--text2)' }}>
                    <span style={{ width:8, height:8, borderRadius:2, background:s.color }} /><span style={{ fontWeight:500 }}>{s.name}</span><span style={{ color:'var(--text3)' }}>({s.value})</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
            <AIInsight type="team" />
            <AIInsight type="personal" userName={user?.name} />
          </div>

          <div className="glass count-up" style={{ padding:'18px 20px', borderRadius:18 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <div>
                <div style={{ fontSize:14, fontWeight:600 }}>📅 Agenda Mendatang</div>
                <div style={{ fontSize:10, color:'var(--text3)' }}>{upcomingAgenda.length} aktivitas dalam 2 minggu ke depan</div>
              </div>
              <button onClick={()=>setDetail('agenda')} className="btn btn-sm">Lihat semua →</button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))', gap:8 }}>
              {upcomingAgenda.slice(0,6).map((item:any,i:number)=>{
                const isToday = item.date === today
                return (
                  <div key={i} className="glass glass-hover" style={{ display:'flex', gap:9, padding:'10px 12px', borderRadius:10, borderLeft:`3px solid ${isToday?'var(--blue)':'var(--border2)'}` }}>
                    <div style={{ fontSize:14 }}>{ITEM_TYPE_ICONS[item.type]||'📌'}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:11, fontWeight:500, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.title}</div>
                      <div style={{ fontSize:9, color:'var(--text3)' }}>{isToday?'🔵 Hari ini':format(new Date(item.date),'d MMM')}{item.time && ` · ${item.time}`}</div>
                    </div>
                  </div>
                )
              })}
              {upcomingAgenda.length === 0 && <div style={{ padding:20, textAlign:'center', color:'var(--text3)', fontSize:11, gridColumn:'1/-1' }}>Belum ada agenda</div>}
            </div>
          </div>
        </>)}

        {['kpi','non-si','golive','others'].includes(activeSegment) && (() => {
          const seg = segments.find((s:any)=>s.key===activeSegment)
          const segProjects = projectsBySegment(activeSegment)
          return (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:14, marginBottom:14 }}>
                <GlassStatCard label={`Activities ${seg?.label}`} value={segProjects.length} sub="Total activity" color={seg?.color||'#4f8ef7'} icon="🗂" onClick={()=>router.push('/dashboard/activities')} />
                <GlassStatCard label="Avg Progress" value={segProjects.length?Math.round(segProjects.reduce((s:number,p:any)=>s+(p.progress||0),0)/segProjects.length):0} sub="Rata-rata %" color="#a78bfa" icon="📊" />
                <GlassStatCard label="Completed" value={segProjects.filter((p:any)=>p.status==='completed').length} sub="Selesai" color="#22c55e" icon="✓" />
                <GlassStatCard label="Active" value={segProjects.filter((p:any)=>p.status==='active').length} sub="Sedang berjalan" color="#f59e0b" icon="⚡" />
              </div>

              <div className="glass count-up" style={{ padding:'18px 20px', borderRadius:18, marginBottom:14 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                  <div>
                    <div style={{ fontSize:14, fontWeight:600 }}>Progress Chart — {seg?.label}</div>
                    <div style={{ fontSize:10, color:'var(--text3)' }}>Plan vs Actual per activity</div>
                  </div>
                  <button onClick={()=>router.push('/dashboard/progress')} className="btn btn-sm">Detail Gantt →</button>
                </div>
                {segProjects.length === 0 ? (
                  <div style={{ textAlign:'center', padding:30, color:'var(--text3)', fontSize:12 }}>Belum ada activity di segmen ini</div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {segProjects.slice(0,8).map((p:any) => (
                      <div key={p._id} style={{ display:'grid', gridTemplateColumns:'1fr 70px 1.4fr', gap:14, alignItems:'center', padding:'6px 0' }}>
                        <div style={{ fontSize:12, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.title}</div>
                        <div style={{ fontSize:13, fontWeight:700, color:seg?.color }}>{p.progress||0}%</div>
                        <div style={{ height:8, background:'var(--bg4)', borderRadius:4, overflow:'hidden' }}>
                          <div style={{ width:`${p.progress||0}%`, height:'100%', background:`linear-gradient(90deg, ${seg?.color}, ${seg?.color}aa)`, borderRadius:4, transition:'width 0.6s ease' }} />
                        </div>
                      </div>
                    ))}
                    {segProjects.length > 8 && <div style={{ fontSize:10, color:'var(--text3)', textAlign:'center', padding:6 }}>+ {segProjects.length-8} activity lainnya</div>}
                  </div>
                )}
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                <AIInsight type="team" />
                <AIInsight type="personal" userName={user?.name} />
              </div>
            </>
          )
        })()}

        {activeSegment === 'anggaran' && (<>
          {budgetByCategory.length === 0 ? (
            <div className="glass" style={{ textAlign:'center', padding:60, color:'var(--text3)', borderRadius:18 }}>
              <div style={{ fontSize:36, marginBottom:8 }}>💰</div>
              <div style={{ fontSize:12 }}>Belum ada anggaran. Set di Konfigurasi → Anggaran.</div>
            </div>
          ) : (<>
            <div style={{ display:'grid', gridTemplateColumns:`repeat(${Math.min(budgetByCategory.length,4)},1fr)`, gap:14, marginBottom:14 }}>
              {budgetByCategory.map((cat:any) => (
                <GlassStatCard key={cat.key} label={cat.label} value={cat.pct} sub={`${formatRpShort(cat.totalActual)} / ${formatRpShort(cat.annualBudget)}`} color={cat.isOver?'#ef4444':'#f59e0b'} icon="💰" onClick={()=>router.push('/dashboard/budget')} />
              ))}
            </div>
            <div className="glass count-up" style={{ padding:'18px 20px', borderRadius:18, marginBottom:14 }}>
              <div style={{ fontSize:14, fontWeight:600, marginBottom:8 }}>📈 Anggaran 2026 — Plan vs Realisasi</div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={monthlyBudget}>
                  <defs>
                    <linearGradient id="grad-plan" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#9da3b8" stopOpacity={0.5}/><stop offset="100%" stopColor="#9da3b8" stopOpacity={0.05}/></linearGradient>
                    <linearGradient id="grad-real" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f59e0b" stopOpacity={0.6}/><stop offset="100%" stopColor="#f59e0b" stopOpacity={0.05}/></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill:'var(--text2)', fontSize:10 }} />
                  <YAxis tick={{ fill:'var(--text3)', fontSize:9 }} tickFormatter={formatRpShort} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize:11 }} />
                  <Area type="monotone" dataKey="Plan" stroke="#9da3b8" strokeWidth={2} fill="url(#grad-plan)" />
                  <Area type="monotone" dataKey="Realisasi" stroke="#f59e0b" strokeWidth={2} fill="url(#grad-real)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </>)}
        </>)}
      </div>
    </div>
  )
}
