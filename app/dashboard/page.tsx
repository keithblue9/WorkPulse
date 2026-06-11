'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, AreaChart, Area, Legend,
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
    <div style={{ background:'var(--bg2)', border:'1px solid var(--border2)', borderRadius:8, padding:'8px 12px', boxShadow:'var(--shadow)', fontSize:11 }}>
      {label && <div style={{ fontWeight:600, color:'var(--text)', marginBottom:5 }}>{label}</div>}
      {payload.map((p:any,i:number)=>(
        <div key={i} style={{ display:'flex', alignItems:'center', gap:7, marginTop:i?3:0 }}>
          <span style={{ width:9, height:9, borderRadius:2, background:p.color||p.fill, display:'inline-block' }} />
          <span style={{ color:'var(--text3)' }}>{p.name}:</span>
          <span style={{ color:'var(--text)', fontWeight:600 }}>{typeof p.value==='number' ? p.value.toLocaleString('id') : p.value}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Clickable Stat Card ────────────────────────────────────
function StatCard({ label, value, sub, color, icon, onClick }: { label:string; value:string|number; sub?:string; color:string; icon:string; onClick?:()=>void }) {
  return (
    <div className="card" onClick={onClick} style={{ padding:'14px 16px', position:'relative', overflow:'hidden', cursor: onClick?'pointer':'default', transition:'all 0.15s' }}
      onMouseEnter={e=>onClick&&((e.currentTarget as HTMLElement).style.transform='translateY(-2px)')}
      onMouseLeave={e=>onClick&&((e.currentTarget as HTMLElement).style.transform='translateY(0)')}>
      <div style={{ position:'absolute', top:-12, right:-12, width:60, height:60, borderRadius:'50%', background:color, opacity:0.08 }} />
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
        <div style={{ fontSize:10, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:600 }}>{label}</div>
        <div style={{ width:28, height:28, borderRadius:7, background:`${color}22`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>{icon}</div>
      </div>
      <div style={{ fontSize:24, fontWeight:700, color, lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:10, color:'var(--text3)', marginTop:5 }}>{sub}</div>}
      {onClick && <div style={{ fontSize:9, color:color, marginTop:6, fontWeight:600 }}>Klik untuk detail →</div>}
    </div>
  )
}

// ─── Drill-down Detail Modal ────────────────────────────────
function DetailModal({ title, items, columns, onClose, emptyText }: { title:string; items:any[]; columns:{key:string;label:string;render?:(v:any,row:any)=>any}[]; onClose:()=>void; emptyText?:string }) {
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ width:720, maxWidth:'90vw' }}>
        <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:14, fontWeight:600 }}>{title}</div>
            <div style={{ fontSize:10, color:'var(--text3)' }}>{items.length} item</div>
          </div>
          <button onClick={onClose} className="btn btn-icon">×</button>
        </div>
        <div style={{ overflowY:'auto', maxHeight:'70vh' }}>
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

// ─── AI Insight ─────────────────────────────────────────────
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
    <div className="card" style={{ padding:'14px 16px', height:'100%', display:'flex', flexDirection:'column' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ width:24, height:24, borderRadius:6, background:type==='team'?'var(--bluebg)':'var(--purplebg)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13 }}>🤖</div>
          <div>
            <div style={{ fontSize:12, fontWeight:600, color:'var(--text)' }}>{type==='team'?'AI Insight — Tim':`AI Insight — ${userName||'Personal'}`}</div>
            <div style={{ fontSize:9, color:'var(--text3)' }}>Powered by Claude</div>
          </div>
        </div>
        <button onClick={generate} disabled={loading} className="btn btn-sm">
          {loading ? '⟳ ...' : generated ? '↻ Refresh' : '✨ Generate'}
        </button>
      </div>
      <div style={{ flex:1, overflowY:'auto', minHeight:120 }}>
        {insight ? (
          <div style={{ fontSize:12, color:'var(--text2)', lineHeight:1.7, whiteSpace:'pre-wrap' }}>{insight}</div>
        ) : (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', minHeight:120, textAlign:'center', padding:10 }}>
            <div>
              <div style={{ fontSize:24, marginBottom:6, opacity:0.5 }}>{type==='team'?'📊':'🎯'}</div>
              <div style={{ fontSize:11, color:'var(--text3)', lineHeight:1.5 }}>
                {loading ? 'AI menganalisis...' : 'Klik Generate untuk analisis terkini'}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Mini Donut ─────────────────────────────────────────────
function MiniDonut({ pct, color, size=72, label }: { pct:number; color:string; size?:number; label?:string }) {
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
        {label && <div style={{ fontSize:8, color:'var(--text3)', marginTop:2 }}>{label}</div>}
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
    <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:36, height:36, border:'3px solid var(--border2)', borderTopColor:'var(--blue)', borderRadius:'50%', margin:'0 auto 12px' }} className="spin" />
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

  // ─── Derived data ─────────────────────────────────────────
  const totalIssues = issues.length
  const highIssues = issues.filter((i:any)=>i.priority==='high')
  const completedIssues = issues.filter((i:any)=>i.status==='completed')
  const riskIssues = issues.filter((i:any)=>i.status==='at_risk'||i.status==='delayed')
  const avgProgress = initiatives.length ? Math.round(initiatives.reduce((s:number,i:any)=>s+(i.actualProgress||0),0)/initiatives.length) : 0

  // Filter projects/kpis per segment
  function projectsBySegment(seg:string) {
    if (seg === 'anggaran') return []
    return projects.filter((p:any) => {
      const t = (p.subType||'').toLowerCase()
      const cat = (p.category||'').toLowerCase()
      if (seg === 'kpi') return t.includes('kpi-si') || cat.includes('kpi - si') || (!t && !cat) // empty falls here as default
      if (seg === 'non-si') return t.includes('non-si') || cat.includes('non si')
      if (seg === 'golive') return t.includes('go-live') || cat.includes('golive') || cat.includes('go live')
      if (seg === 'others') return t.includes('others') || cat.includes('others')
      return false
    })
  }

  // Status distribution for issues
  const statusDist = ['on_track','at_risk','delayed','completed'].map(k => ({
    name: k.replace('_',' '),
    value: issues.filter((i:any)=>i.status===k).length,
    color: { on_track:'#22c55e', at_risk:'#f59e0b', delayed:'#ef4444', completed:'#4f8ef7' }[k as any],
  }))

  // Budget summary
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

  // Upcoming agenda
  const today = format(new Date(),'yyyy-MM-dd')
  const upcomingAgenda: any[] = []
  agenda.forEach((day:any) => {
    if (day.date >= today) (day.items||[]).forEach((item:any) => upcomingAgenda.push({ ...item, date: day.date }))
  })
  upcomingAgenda.sort((a,b) => a.date.localeCompare(b.date) || (a.time||'').localeCompare(b.time||''))

  // Detail items for modals
  const detailMap: Record<string, any> = {
    initiatives: {
      title: 'Strategic Initiatives Detail',
      items: initiatives,
      columns: [
        { key:'code', label:'Code' }, { key:'title', label:'Title' },
        { key:'planProgress', label:'Plan %', render:(v:number)=>`${v}%` },
        { key:'actualProgress', label:'Actual %', render:(v:number,r:any)=>(
          <span style={{ color: r.actualProgress>=r.planProgress?'var(--green)':'var(--amber)', fontWeight:600 }}>{v}%</span>
        )},
        { key:'status', label:'Status', render:(v:string)=><span className={`badge badge-${v}`}>{v?.replace('_',' ')}</span> },
      ],
    },
    issues_all: {
      title: 'Semua Issues',
      items: issues,
      columns: [
        { key:'title', label:'Issue' }, { key:'picName', label:'PIC' },
        { key:'progress', label:'Progress', render:(v:number)=>`${v}%` },
        { key:'priority', label:'Priority', render:(v:string)=>{const cfg=PRIORITY_CFG[v||'medium'];return <span style={{ color:cfg.color, fontSize:11, fontWeight:600 }}>{cfg.label}</span>} },
        { key:'status', label:'Status', render:(v:string)=><span className={`badge badge-${v}`}>{v?.replace('_',' ')}</span> },
        { key:'dueDate', label:'Due' },
      ],
    },
    issues_high: {
      title: 'High Priority Issues',
      items: highIssues,
      columns: [
        { key:'title', label:'Issue' }, { key:'picName', label:'PIC' },
        { key:'progress', label:'Progress', render:(v:number)=>`${v}%` },
        { key:'dueDate', label:'Due' },
        { key:'status', label:'Status', render:(v:string)=><span className={`badge badge-${v}`}>{v?.replace('_',' ')}</span> },
      ],
    },
    projects_active: {
      title: 'Active Projects',
      items: projects.filter((p:any)=>p.status==='active'),
      columns: [
        { key:'title', label:'Title' }, { key:'category', label:'Category' },
        { key:'progress', label:'Progress', render:(v:number)=>`${v}%` },
        { key:'members', label:'PIC', render:(v:any)=>v?.join(', ')||'—' },
      ],
    },
    agenda: {
      title: 'Upcoming Agenda',
      items: upcomingAgenda,
      columns: [
        { key:'date', label:'Tanggal' }, { key:'time', label:'Jam' },
        { key:'title', label:'Activity', render:(v:string,r:any)=><span>{ITEM_TYPE_ICONS[r.type]||'📌'} {v}</span> },
        { key:'location', label:'Lokasi' },
      ],
    },
  }

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {detail && <DetailModal {...detailMap[detail]} onClose={()=>setDetail(null)} />}

      <div style={{ padding:'12px 20px', borderBottom:'1px solid var(--border)', background:'var(--bg2)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div>
          <div style={{ fontSize:15, fontWeight:600 }}>Dashboard</div>
          <div style={{ fontSize:11, color:'var(--text3)' }}>{config?.appTagline||'BPD & SS Procurement'} · {format(new Date(),'d MMM yyyy')}</div>
        </div>
        <span style={{ padding:'4px 10px', borderRadius:20, fontSize:10, fontWeight:600, background:'var(--bluebg)', color:'var(--blue)' }}>👤 {user?.name}</span>
      </div>

      {/* Segment tabs */}
      <div style={{ display:'flex', gap:5, padding:'8px 20px', background:'var(--bg2)', borderBottom:'1px solid var(--border)', overflowX:'auto', flexShrink:0 }}>
        <button onClick={()=>setActiveSegment('overview')} style={{ padding:'5px 14px', borderRadius:8, fontSize:12, fontWeight:500, cursor:'pointer', whiteSpace:'nowrap', border:`1px solid ${activeSegment==='overview'?'var(--blue)':'var(--border)'}`, background:activeSegment==='overview'?'var(--bluebg)':'var(--bg3)', color:activeSegment==='overview'?'var(--blue)':'var(--text2)' }}>📊 Overview</button>
        {segments.map((seg:any) => (
          <button key={seg.key} onClick={()=>setActiveSegment(seg.key)} style={{ padding:'5px 14px', borderRadius:8, fontSize:12, fontWeight:500, cursor:'pointer', whiteSpace:'nowrap', border:`1px solid ${activeSegment===seg.key?seg.color:'var(--border)'}`, background:activeSegment===seg.key?seg.color+'22':'var(--bg3)', color:activeSegment===seg.key?seg.color:'var(--text2)' }}>{seg.label}</button>
        ))}
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'14px 20px' }} className="safe-bottom">
        {/* ─── OVERVIEW segment ──────────────────────────── */}
        {activeSegment === 'overview' && (<>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:12 }}>
            <StatCard label="Strategic Initiatives" value={initiatives.length} sub={`Avg progress: ${avgProgress}%`} color="#4f8ef7" icon="🎯" onClick={()=>setDetail('initiatives')} />
            <StatCard label="Total Issues" value={totalIssues} sub={`${completedIssues.length} selesai · ${riskIssues.length} berisiko`} color="#a78bfa" icon="◫" onClick={()=>setDetail('issues_all')} />
            <StatCard label="High Priority" value={highIssues.length} sub={`${Math.round(highIssues.length/Math.max(totalIssues,1)*100)}% dari total`} color="#ef4444" icon="🔴" onClick={()=>setDetail('issues_high')} />
            <StatCard label="Active Projects" value={projects.filter((p:any)=>p.status==='active').length} sub={`${projects.length} total project`} color="#22c55e" icon="🗂" onClick={()=>setDetail('projects_active')} />
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr', gap:10, marginBottom:12 }}>
            <div className="card" style={{ padding:'14px 16px' }}>
              <div style={{ fontSize:13, fontWeight:600, marginBottom:8 }}>Strategic Initiatives</div>
              <div style={{ display:'grid', gridTemplateColumns:`repeat(${Math.max(initiatives.length,1)},1fr)`, gap:10 }}>
                {initiatives.length === 0 ? (
                  <div style={{ textAlign:'center', padding:'20px', color:'var(--text3)', fontSize:12 }}>Belum ada initiative</div>
                ) : initiatives.map((ini:any) => (
                  <div key={ini._id} onClick={()=>router.push('/dashboard/progress')} style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'8px', background:'var(--bg3)', borderRadius:8, cursor:'pointer' }}>
                    <div style={{ fontSize:10, color:'var(--text3)', marginBottom:6 }}>{ini.code}</div>
                    <MiniDonut pct={ini.actualProgress} color={ini.actualProgress>=ini.planProgress?'#22c55e':'#f59e0b'} label={`Plan ${ini.planProgress}%`} />
                    <div style={{ fontSize:9, color:'var(--text3)', marginTop:6, textAlign:'center', height:24, overflow:'hidden' }}>{ini.title.length>30?ini.title.slice(0,30)+'…':ini.title}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card" style={{ padding:'14px 16px' }}>
              <div style={{ fontSize:13, fontWeight:600, marginBottom:8 }}>Issue Status Distribution</div>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={statusDist.filter(s=>s.value>0)} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} innerRadius={32}>
                    {statusDist.map((s,i)=><Cell key={i} fill={s.color} />)}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, justifyContent:'center' }}>
                {statusDist.filter(s=>s.value>0).map(s=>(
                  <div key={s.name} style={{ display:'flex', alignItems:'center', gap:4, fontSize:10, color:'var(--text2)' }}>
                    <span style={{ width:8, height:8, borderRadius:2, background:s.color }} /><span>{s.name} ({s.value})</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
            <AIInsight type="team" />
            <AIInsight type="personal" userName={user?.name} />
          </div>

          <div className="card" style={{ padding:'14px 16px', marginBottom:12 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <div style={{ fontSize:13, fontWeight:600 }}>📅 Agenda Mendatang</div>
              <button onClick={()=>setDetail('agenda')} style={{ fontSize:10, color:'var(--blue)', cursor:'pointer', background:'none', border:'none' }}>Lihat semua →</button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:7 }}>
              {upcomingAgenda.slice(0,6).map((item:any,i:number)=>{
                const isToday = item.date === today
                return (
                  <div key={i} style={{ display:'flex', gap:8, padding:'8px 10px', background:'var(--bg3)', borderRadius:7, borderLeft:`3px solid ${isToday?'var(--blue)':'var(--border2)'}` }}>
                    <div style={{ fontSize:13 }}>{ITEM_TYPE_ICONS[item.type]||'📌'}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:11, fontWeight:500, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.title}</div>
                      <div style={{ fontSize:9, color:'var(--text3)' }}>{isToday?'🔵 Hari ini':format(new Date(item.date),'d MMM')}{item.time && ` · ${item.time}`}</div>
                    </div>
                  </div>
                )
              })}
              {upcomingAgenda.length === 0 && <div style={{ padding:20, textAlign:'center', color:'var(--text3)', fontSize:11 }}>Belum ada agenda</div>}
            </div>
          </div>
        </>)}

        {/* ─── Segment: KPI / Non SI / GoLive / Others ──── */}
        {['kpi','non-si','golive','others'].includes(activeSegment) && (() => {
          const seg = segments.find((s:any)=>s.key===activeSegment)
          const segProjects = projectsBySegment(activeSegment)
          const segIssues = issues.filter((i:any) => {
            const ini = initiatives.find((x:any)=>x._id===i.initiativeId)
            if (!ini) return false
            // Simple match — could be improved with explicit categorization on Issue model
            return true
          })

          return (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:12 }}>
                <StatCard label={`Activities ${seg?.label}`} value={segProjects.length} sub="Total activity" color={seg?.color||'#4f8ef7'} icon="🗂" onClick={()=>router.push('/dashboard/activities')} />
                <StatCard label="Avg Progress" value={`${segProjects.length?Math.round(segProjects.reduce((s:number,p:any)=>s+(p.progress||0),0)/segProjects.length):0}%`} sub="Rata-rata" color="#a78bfa" icon="📊" />
                <StatCard label="Completed" value={segProjects.filter((p:any)=>p.status==='completed').length} sub="Selesai" color="#22c55e" icon="✓" />
                <StatCard label="Active" value={segProjects.filter((p:any)=>p.status==='active').length} sub="Sedang berjalan" color="#f59e0b" icon="⚡" />
              </div>

              {/* Gantt-style mini for this segment */}
              <div className="card" style={{ padding:'14px 16px', marginBottom:12 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:600 }}>Progress Chart — {seg?.label}</div>
                    <div style={{ fontSize:10, color:'var(--text3)' }}>Plan vs Actual per activity</div>
                  </div>
                  <button onClick={()=>router.push('/dashboard/progress')} className="btn btn-sm">Lihat Detail →</button>
                </div>
                {segProjects.length === 0 ? (
                  <div style={{ textAlign:'center', padding:30, color:'var(--text3)', fontSize:12 }}>Belum ada activity di segmen ini</div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {segProjects.slice(0,8).map((p:any) => (
                      <div key={p._id} style={{ display:'grid', gridTemplateColumns:'1fr 60px 1fr', gap:10, alignItems:'center', padding:'6px 0' }}>
                        <div style={{ fontSize:11, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.title}</div>
                        <div style={{ fontSize:11, fontWeight:600, color:seg?.color }}>{p.progress||0}%</div>
                        <div className="prog-bar"><div className="prog-fill" style={{ width:`${p.progress||0}%`, background:seg?.color }} /></div>
                      </div>
                    ))}
                    {segProjects.length > 8 && <div style={{ fontSize:10, color:'var(--text3)', textAlign:'center', padding:6 }}>+ {segProjects.length-8} activity lainnya</div>}
                  </div>
                )}
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <AIInsight type="team" />
                <AIInsight type="personal" userName={user?.name} />
              </div>
            </>
          )
        })()}

        {/* ─── Segment: Anggaran ─────────────────────────── */}
        {activeSegment === 'anggaran' && (<>
          {budgetByCategory.length === 0 ? (
            <div style={{ textAlign:'center', padding:60, color:'var(--text3)' }}>
              <div style={{ fontSize:32, marginBottom:8 }}>💰</div>
              <div>Belum ada anggaran. Set di Konfigurasi → Anggaran.</div>
            </div>
          ) : (<>
            <div style={{ display:'grid', gridTemplateColumns:`repeat(${Math.min(budgetByCategory.length,4)},1fr)`, gap:10, marginBottom:12 }}>
              {budgetByCategory.map((cat:any) => (
                <StatCard key={cat.key} label={cat.label} value={`${cat.pct}%`} sub={`${formatRpShort(cat.totalActual)} / ${formatRpShort(cat.annualBudget)}`} color={cat.isOver?'#ef4444':'#f59e0b'} icon="💰" onClick={()=>router.push('/dashboard/budget')} />
              ))}
            </div>
            <div className="card" style={{ padding:'14px 16px', marginBottom:12 }}>
              <div style={{ fontSize:13, fontWeight:600, marginBottom:8 }}>📈 Anggaran 2026 — Plan vs Realisasi</div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={monthlyBudget}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill:'var(--text2)', fontSize:10 }} />
                  <YAxis tick={{ fill:'var(--text3)', fontSize:9 }} tickFormatter={formatRpShort} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize:11 }} />
                  <Area type="monotone" dataKey="Plan" stroke="#9da3b8" fill="#9da3b8" fillOpacity={0.3} />
                  <Area type="monotone" dataKey="Realisasi" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.4} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="card" style={{ padding:'14px 16px' }}>
              <div style={{ fontSize:13, fontWeight:600, marginBottom:8 }}>Status Per Kategori</div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {budgetByCategory.map((cat:any)=>(
                  <div key={cat.key} style={{ padding:'10px 12px', background:'var(--bg3)', borderRadius:8, borderLeft:`3px solid ${cat.isOver?'var(--red)':'var(--green)'}` }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                      <span style={{ fontSize:12, fontWeight:600 }}>{cat.label}</span>
                      <span style={{ fontSize:12, fontWeight:700, color: cat.isOver?'var(--red)':'var(--text2)' }}>{cat.pct}%</span>
                    </div>
                    <div className="prog-bar" style={{ marginBottom:5 }}>
                      <div className="prog-fill" style={{ width:`${Math.min(100,cat.pct)}%`, background: cat.isOver?'var(--red)':'var(--amber)' }} />
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:'var(--text3)' }}>
                      <span>Realisasi: {formatRpShort(cat.totalActual)}</span>
                      <span>Estimasi: {formatRpShort(cat.estYearEnd)} {cat.estYearEnd>cat.annualBudget?'⚠':''}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>)}
        </>)}
      </div>
    </div>
  )
}
