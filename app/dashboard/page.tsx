'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { DashboardStats, Initiative } from '@/types'
import toast from 'react-hot-toast'

function DonutChart({ pct, color, size=90 }: { pct:number; color:string; size?:number }) {
  const r=size*0.4; const circ=2*Math.PI*r; const offset=circ-(pct/100)*circ
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ transform:'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--bg4)" strokeWidth={size*0.11} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={size*0.11} strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
    </svg>
  )
}

function AIInsight({ type, userName }: { type:'team'|'personal'; userName?:string }) {
  const [insight, setInsight] = useState('')
  const [loading, setLoading] = useState(false)
  const [generated, setGenerated] = useState(false)

  async function generate() {
    setLoading(true)
    try {
      const r = await fetch('/api/ai-insight', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ type, userName }) })
      const d = await r.json()
      setInsight(d.data?.insight || 'Gagal generate insight.')
      setGenerated(true)
    } catch { toast.error('Gagal') } finally { setLoading(false) }
  }

  return (
    <div className="card" style={{ padding:'14px 16px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
        <div style={{ fontSize:12, fontWeight:600, color:'var(--text)' }}>
          {type==='team' ? '🤖 AI Insight — Tim' : `🤖 AI Insight — ${userName}`}
        </div>
        <button onClick={generate} disabled={loading} className="btn btn-sm" style={{ fontSize:11 }}>
          {loading ? '⟳ Menganalisis...' : generated ? '↻ Refresh' : '✨ Generate Insight'}
        </button>
      </div>
      {insight ? (
        <div style={{ fontSize:12, color:'var(--text2)', lineHeight:1.7, whiteSpace:'pre-wrap' }}>{insight}</div>
      ) : (
        <div style={{ fontSize:11, color:'var(--text3)', fontStyle:'italic' }}>
          {loading ? 'AI sedang menganalisis data tim...' : 'Klik "Generate Insight" untuk mendapatkan analisis AI berdasarkan data KPI dan issues terkini.'}
        </div>
      )}
    </div>
  )
}

const PRIORITY_CFG: Record<string,{label:string;color:string;bg:string}> = {
  high:   { label:'High',   color:'var(--red)',    bg:'var(--redbg)' },
  medium: { label:'Medium', color:'var(--amber)',  bg:'var(--amberbg)' },
  low:    { label:'Low',    color:'var(--green)',  bg:'var(--greenbg)' },
}

export default function DashboardPage() {
  const { data:session } = useSession(); const user = session?.user as any
  const [stats, setStats] = useState<DashboardStats|null>(null)
  const [initiatives, setInitiatives] = useState<Initiative[]>([])
  const [issues, setIssues] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [issueFilter, setIssueFilter] = useState<'all'|'high'|'medium'|'low'>('all')

  useEffect(() => {
    async function load() {
      try {
        const [s,i,iss] = await Promise.all([
          fetch('/api/dashboard').then(r=>r.json()),
          fetch('/api/initiatives').then(r=>r.json()),
          fetch('/api/issues').then(r=>r.json()),
        ])
        setStats(s.data); setInitiatives(i.data||[]); setIssues(iss.data||[])
      } catch { toast.error('Gagal memuat data') }
      finally { setLoading(false) }
    }
    load()
  }, [])

  const donutColor = (status:string) => status==='at_risk'||status==='delayed'?'var(--amber)':'var(--blue)'
  const filteredIssues = issueFilter==='all' ? issues : issues.filter(i=>i.priority===issueFilter)
  const highCount = issues.filter(i=>i.priority==='high').length
  const medCount = issues.filter(i=>i.priority==='medium').length

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 20px', borderBottom:'1px solid var(--border)', background:'var(--bg2)', flexShrink:0 }}>
        <div>
          <div style={{ fontSize:16, fontWeight:600 }}>Dashboard</div>
          <div style={{ fontSize:11, color:'var(--text3)' }}>BPD Procurement 2026 · M6 Mid Year Review</div>
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'16px 20px' }}>
        {loading ? <div style={{ textAlign:'center', padding:60, color:'var(--text3)' }}>Memuat data...</div> : (
          <>
            {/* KPI cards */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:14 }}>
              {[
                { label:'Total Initiatives', value:stats?.totalInitiatives??0, sub:'SI & Non-SI aktif', color:'var(--blue)', pct:100 },
                { label:'Avg Progress', value:`${stats?.avgProgress??0}%`, sub:'Target M6: 50%', color:'var(--amber)', pct:stats?.avgProgress??0 },
                { label:'On Track', value:stats?.onTrackCount??0, sub:'Sesuai rencana', color:'var(--green)', pct:((stats?.onTrackCount??0)/(stats?.totalInitiatives||1))*100 },
                { label:'High Priority Issues', value:highCount, sub:`${medCount} medium priority`, color:'var(--red)', pct:(highCount/(issues.length||1))*100 },
              ].map(k=>(
                <div key={k.label} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:'12px 14px' }}>
                  <div style={{ fontSize:10, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:5 }}>{k.label}</div>
                  <div style={{ fontSize:24, fontWeight:700, color:k.color }}>{k.value}</div>
                  <div style={{ fontSize:10, color:'var(--text3)', marginTop:3 }}>{k.sub}</div>
                  <div className="prog-bar" style={{ marginTop:8 }}><div className="prog-fill" style={{ width:`${k.pct}%`, background:k.color }} /></div>
                </div>
              ))}
            </div>

            {/* Donuts */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:14 }}>
              {initiatives.map((ini,i)=>(
                <div key={ini._id} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:'16px', display:'flex', flexDirection:'column', alignItems:'center' }}>
                  <div style={{ fontSize:10, color:'var(--text3)', textAlign:'center', marginBottom:10, lineHeight:1.4, fontWeight:500 }}>{ini.code} — {ini.title.split('(')[0].trim()}</div>
                  <div style={{ position:'relative', width:96, height:96, marginBottom:10 }}>
                    <DonutChart pct={ini.actualProgress} color={donutColor(ini.status)} size={96} />
                    <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', textAlign:'center' }}>
                      <div style={{ fontSize:18, fontWeight:700, color:donutColor(ini.status) }}>{ini.actualProgress}%</div>
                      <div style={{ fontSize:9, color:'var(--text3)' }}>plan {ini.planProgress}%</div>
                    </div>
                  </div>
                  {ini.phases.slice(0,4).map(p=>(
                    <div key={p._id} style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:3, width:'100%', color:'var(--text2)' }}>
                      <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'70%' }}>{p.name}</span>
                      <span style={{ fontWeight:600, color:p.actualPct>=100?'var(--green)':p.actualPct>0?'var(--amber)':'var(--text3)', flexShrink:0 }}>{p.actualPct}%</span>
                    </div>
                  ))}
                  <span style={{ marginTop:8, padding:'2px 10px', borderRadius:20, fontSize:10, fontWeight:600 }} className={`badge-${ini.status}`}>
                    {ini.status==='on_track'?'On Track':ini.status==='at_risk'?'At Risk':'Delayed'}
                  </span>
                </div>
              ))}
            </div>

            {/* AI Insight */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
              <AIInsight type="team" />
              <AIInsight type="personal" userName={user?.name} />
            </div>

            {/* Issues by priority */}
            <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden', marginBottom:14 }}>
              <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>Issues by Priority</div>
                <div style={{ display:'flex', gap:4 }}>
                  {[['all','Semua'],['high','High'],['medium','Medium'],['low','Low']].map(([v,l])=>(
                    <button key={v} onClick={()=>setIssueFilter(v as any)} style={{ padding:'2px 10px', borderRadius:20, fontSize:11, cursor:'pointer', border:`1px solid ${issueFilter===v?'var(--blue)':'var(--border)'}`, background:issueFilter===v?'var(--bluebg)':'var(--bg3)', color:issueFilter===v?'var(--blue)':'var(--text2)' }}>{l}</button>
                  ))}
                </div>
              </div>
              {filteredIssues.length===0 ? (
                <div style={{ textAlign:'center', padding:'24px 0', color:'var(--text3)', fontSize:12 }}>Tidak ada issue dengan filter ini</div>
              ) : (
                <table className="wp-table" style={{ width:'100%' }}>
                  <thead><tr><th>Issue</th><th style={{ width:80 }}>Priority</th><th style={{ width:100 }}>Progress</th><th style={{ width:100 }}>Status</th><th style={{ width:100 }}>Due Date</th><th style={{ width:100 }}>PIC</th></tr></thead>
                  <tbody>
                    {filteredIssues.slice(0,10).map(issue => {
                      const pcfg = PRIORITY_CFG[issue.priority||'medium']
                      return (
                        <tr key={issue._id}>
                          <td><div style={{ fontSize:12, fontWeight:500, color:'var(--text)' }}>{issue.title}</div><div style={{ fontSize:10, color:'var(--text3)' }}>{issue.nextPlan}</div></td>
                          <td><span style={{ padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:700, background:pcfg.bg, color:pcfg.color }}>{pcfg.label}</span></td>
                          <td><div style={{ display:'flex', alignItems:'center', gap:6 }}><div className="prog-bar" style={{ flex:1 }}><div className="prog-fill" style={{ width:`${issue.progress}%`, background:issue.progress>=80?'var(--green)':issue.progress>=40?'var(--blue)':'var(--amber)' }} /></div><span style={{ fontSize:10, fontWeight:600, color:'var(--text2)' }}>{issue.progress}%</span></div></td>
                          <td><span className={`badge badge-${issue.status}`}>{issue.status?.replace('_',' ')}</span></td>
                          <td style={{ fontSize:11, color: issue.dueDate<new Date().toISOString().split('T')[0]&&issue.status!=='completed'?'var(--red)':'var(--text2)' }}>{issue.dueDate}</td>
                          <td style={{ fontSize:11 }}>{issue.picName}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Workload + overdue */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:'14px 16px' }}>
                <div style={{ fontSize:12, fontWeight:600, color:'var(--text)', marginBottom:12 }}>◕ Workload per PIC</div>
                {stats?.workloadByPic.map(w=>(
                  <div key={w.name} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                    <div style={{ fontSize:11, color:'var(--text2)', width:70, textAlign:'right', flexShrink:0 }}>{w.name}</div>
                    <div style={{ flex:1, height:18, background:'var(--bg4)', borderRadius:3, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${(w.count/(stats.totalInitiatives||1))*100}%`, background:w.color, borderRadius:3, display:'flex', alignItems:'center', paddingLeft:6 }}>
                        <span style={{ fontSize:9, fontWeight:700, color:'#fff' }}>{w.count}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:'14px 16px' }}>
                <div style={{ fontSize:12, fontWeight:600, color:'var(--text)', marginBottom:10 }}>⚠ Items Perlu Perhatian</div>
                {stats?.overdueItems.map(item=>(
                  <div key={item.issueId} style={{ display:'flex', gap:8, padding:'7px 10px', background:'var(--bg3)', borderRadius:6, borderLeft:`3px solid ${item.gap>30?'var(--red)':'var(--amber)'}`, marginBottom:7 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:11, fontWeight:500, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.issueTitle}</div>
                      <div style={{ fontSize:10, color:'var(--text3)' }}>Act {item.actualPct}% vs Plan {item.planPct}% · {item.pic}</div>
                    </div>
                    <div style={{ fontSize:11, fontWeight:700, color:item.gap>30?'var(--red)':'var(--amber)', flexShrink:0 }}>-{item.gap}%</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
