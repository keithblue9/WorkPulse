'use client'
// Normalize keys for filtering — handles 'KPI-SI' vs 'KPI - SI' vs 'kpi_si' etc.
function normKey(s:any):string { return String(s||'').toLowerCase().replace(/[\s\-_]/g,'') }

import { picArray } from '@/lib/defaults'
import { useEffect, useState } from 'react'
import { format, startOfWeek, subDays } from 'date-fns'

const PRIORITY_CFG: Record<string,{label:string;color:string;bg:string}> = {
  high:{label:'High', color:'var(--red)', bg:'var(--redbg)'},
  medium:{label:'Medium', color:'var(--amber)', bg:'var(--amberbg)'},
  low:{label:'Low', color:'var(--green)', bg:'var(--greenbg)'},
}

export default function IssuesPage() {
  const [activities, setActivities] = useState<any[]>([])
  const [config, setConfig] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [filterSub, setFilterSub] = useState('All')
  const [period, setPeriod] = useState<'today'|'lastweek'|'all'|'custom'>('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  async function load() {
    setLoading(true)
    const [a, c] = await Promise.all([fetch('/api/projects').then(r=>r.json()), fetch('/api/config').then(r=>r.json())])
    setActivities(a.data||[]); setConfig(c.data); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const subs = config?.activitySubTypes?.filter((s:any)=>s.active) || []
  const statuses = config?.issueStatuses?.filter((s:any)=>s.active) || []

  let dateFrom = '', dateTo = ''
  const today = format(new Date(),'yyyy-MM-dd')
  if (period === 'today') { dateFrom = today; dateTo = today }
  else if (period === 'lastweek') {
    dateFrom = format(subDays(new Date(),7),'yyyy-MM-dd')
    dateTo = today
  } else if (period === 'custom') { dateFrom = customFrom; dateTo = customTo }

  const filtered = activities.filter(a => {
    if (filterSub !== 'All' && normKey(a.subType) !== normKey(filterSub) && normKey(a.category) !== normKey(filterSub)) return false
    if (dateFrom && a.actionDate < dateFrom) return false
    if (dateTo && a.actionDate > dateTo) return false
    return true
  })

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ padding:'12px 20px', borderBottom:'1px solid var(--border)', background:'var(--bg2)', flexShrink:0 }}>
        <div style={{ fontSize:14, fontWeight:600 }}>Issues — Overview</div>
        <div style={{ fontSize:11, color:'var(--text3)' }}>Display dari Activities · Read-only. Edit lewat menu <b>Activities</b>.</div>
      </div>

      {/* Filter row */}
      <div style={{ display:'flex', gap:10, padding:'10px 20px', background:'var(--bg2)', borderBottom:'1px solid var(--border)', flexShrink:0, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
          <button onClick={()=>setFilterSub('All')} style={chip(filterSub==='All')}>All</button>
          {subs.map((s:any) => (
            <button key={s.key} onClick={()=>setFilterSub(s.key)} style={chip(filterSub===s.key, s.color)}>{s.label}</button>
          ))}
        </div>
        <div style={{ width:1, height:20, background:'var(--border)' }} />
        <div style={{ display:'flex', gap:5 }}>
          {[['all','Semua'],['today','Today'],['lastweek','Last Week'],['custom','Custom']].map(([k,l]) => (
            <button key={k} onClick={()=>setPeriod(k as any)} style={chip(period===k)}>{l}</button>
          ))}
        </div>
        {period === 'custom' && (
          <div style={{ display:'flex', gap:6 }}>
            <input type="date" className="input" value={customFrom} onChange={e=>setCustomFrom(e.target.value)} style={{ width:140 }} />
            <input type="date" className="input" value={customTo} onChange={e=>setCustomTo(e.target.value)} style={{ width:140 }} />
          </div>
        )}
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'14px 20px' }} className="safe-bottom">
        {loading ? <div style={{ textAlign:'center', padding:40, color:'var(--text3)' }}>Memuat...</div> :
         filtered.length === 0 ? (
           <div className="card" style={{ textAlign:'center', padding:40, color:'var(--text3)' }}>
             <div style={{ fontSize:34, marginBottom:8 }}>📋</div>
             <div>Belum ada issue di filter ini</div>
           </div>
         ) : (
          <div className="card" style={{ overflow:'auto' }}>
            <table className="wp-table" style={{ minWidth:1100 }}>
              <thead>
                <tr>
                  <th style={{ minWidth:200 }}>Issues</th>
                  <th style={{ minWidth:240 }}>Progress</th>
                  <th>Action Date</th>
                  <th style={{ minWidth:200 }}>Next Plan</th>
                  <th>Target Week</th>
                  <th>Priority</th>
                  <th>PIC</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => {
                  const catColor = config?.activityCategories?.find((c:any)=>c.key===a.category)?.color || 'var(--brand)'
                  return (
                    <tr key={a._id}>
                      <td>
                        <div style={{ fontSize:12, fontWeight:600, color:'var(--text)' }}>{a.title}</div>
                        <div style={{ display:'flex', gap:5, marginTop:4, flexWrap:'wrap' }}>
                          <span className="badge" style={{ background:catColor+'22', color:catColor, fontSize:9 }}>{a.category}</span>
                          <span className="badge" style={{ background:'var(--bg3)', color:'var(--text2)', fontSize:9 }}>{a.subType}</span>
                        </div>
                      </td>
                      <td style={{ whiteSpace:'pre-wrap', fontSize:11 }}>{a.description || a.progressNotes || <span style={{ color:'var(--text3)' }}>—</span>}</td>
                      <td style={{ fontSize:11 }}>{a.actionDate || '—'}</td>
                      <td style={{ whiteSpace:'pre-wrap', fontSize:11 }}>{a.nextPlan || <span style={{ color:'var(--text3)' }}>—</span>}</td>
                      <td style={{ fontSize:11 }}>{a.targetWeek || '—'}</td>
                      <td>{a.priority && <span className="badge" style={{ background:PRIORITY_CFG[a.priority]?.bg, color:PRIORITY_CFG[a.priority]?.color, fontSize:10 }}>{PRIORITY_CFG[a.priority]?.label}</span>}</td>
                      <td style={{ fontSize:11 }}>{picArray(a.pic).length ? picArray(a.pic).join(', ') : (a.picName || '—')}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
         )
        }
      </div>
    </div>
  )
}
function chip(active:boolean, color:string='var(--brand)'):React.CSSProperties { return { padding:'4px 11px', borderRadius:20, fontSize:11, fontWeight:600, cursor:'pointer', border:`1px solid ${active?color:'var(--border)'}`, background:active?color+'1a':'var(--bg3)', color:active?color:'var(--text2)' } }
