'use client'
import { getConfig } from '@/lib/configCache'
// Normalize keys for filtering — handles 'KPI-SI' vs 'KPI - SI' vs 'kpi_si' etc.
function normKey(s:any):string { return String(s||'').toLowerCase().replace(/[\s\-_]/g,'') }

import { picArray } from '@/lib/defaults'
import { useEffect, useState } from 'react'
import { format, subDays } from 'date-fns'
import { Empty, Icon, PageHeader, Pill, Seg } from '@/components/ui'
import { useYear } from '@/lib/year'
import { activityInYear } from '@/lib/dashboard'

const PRIORITY_CFG: Record<string,{label:string;tone:'bad'|'warn'|'ok'}> = {
  high:{label:'High', tone:'bad'}, medium:{label:'Medium', tone:'warn'}, low:{label:'Low', tone:'ok'},
}
const BLN = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']
const fmtD = (s?:string) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s||'')); return m ? `${Number(m[3])} ${BLN[Number(m[2])-1]} ${m[1]}` : '–' }

export default function IssuesPage() {
  const [activities, setActivities] = useState<any[]>([])
  const [config, setConfig] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const { year } = useYear()
  const nowYear = new Date().getFullYear()
  const [filterSub, setFilterSub] = useState('All')
  const [period, setPeriod] = useState<'today'|'lastweek'|'all'|'custom'>('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  async function load() {
    setLoading(true); setFailed(false)
    try {
      const [a, c] = await Promise.all([fetch('/api/projects').then(r=>{ if (!r.ok) throw new Error(); return r.json() }), getConfig().then((data:any)=>({ data }))])
      setActivities(a.data||[]); setConfig(c.data)
    } catch { setFailed(true) } finally { setLoading(false) }
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
    if (a.showInList === false) return false
    if (period === 'all' && !activityInYear(a, year, nowYear)) return false
    if (filterSub !== 'All' && normKey(a.subType) !== normKey(filterSub) && normKey(a.category) !== normKey(filterSub)) return false
    if (dateFrom && a.actionDate < dateFrom) return false
    if (dateTo && a.actionDate > dateTo) return false
    return true
  })

  return (
    <div className="au-page">
      <div className="au-view au-anim">
        <PageHeader eyebrow={`Activities · ${filtered.length} issue · baca saja`} title="Issues" actions={<a href="/dashboard/activities" className="btn btn-ghost"><Icon name="act" size={15} />Edit di Activities</a>} />
        <div className="au-row au-wrap" style={{ gap:10 }}>
          <Seg label="Periode" value={period} onChange={setPeriod} options={[['all', `Tahun ${year}`], ['today','Hari ini'], ['lastweek','7 hari'], ['custom','Rentang']] as const} />
          {period === 'custom' && <span className="au-row" style={{ gap:6 }}>
            <input type="date" className="input" aria-label="Dari tanggal" value={customFrom} onChange={e=>setCustomFrom(e.target.value)} style={{ width:160 }} />
            <span className="au-muted">–</span>
            <input type="date" className="input" aria-label="Sampai tanggal" value={customTo} min={customFrom||undefined} onChange={e=>setCustomTo(e.target.value)} style={{ width:160 }} />
          </span>}
        </div>
        <div className="au-chips" role="group" aria-label="Filter sub tipe">
          <button type="button" className="au-chip" aria-pressed={filterSub==='All'} onClick={()=>setFilterSub('All')}>Semua</button>
          {subs.map((st:any) => <button key={st.key} type="button" className="au-chip" aria-pressed={filterSub===st.key} onClick={()=>setFilterSub(st.key)}>{st.label}</button>)}
        </div>
        {failed && <div className="au-row au-wrap p-bad" role="alert" style={{ borderRadius:14, padding:12 }}><span className="au-small" style={{ flex:1 }}>Issues gagal dimuat.</span><button type="button" className="btn btn-sm" onClick={load}>Coba lagi</button></div>}
        {loading ? <div className="au-card"><div className="au-skel" /><div className="au-skel" style={{ width:'70%' }} /><div className="au-skel" style={{ width:'50%' }} /></div>
          : filtered.length === 0 ? <div className="au-card"><Empty title="Belum ada issue di filter ini" text="Issues diambil dari Activities. Ubah periode atau sub tipe." /></div>
          : <div className="au-tblw" tabIndex={0} role="region" aria-label="Tabel issues" style={{ maxHeight:'calc(100dvh - 280px)', overflow:'auto' }}>
              <table className="wp-table" style={{ minWidth:1100 }}>
                <thead style={{ position:'sticky', top:0, zIndex:2 }}><tr><th style={{ minWidth:220 }}>Issue</th><th style={{ minWidth:240 }}>Progress</th><th>Tanggal</th><th style={{ minWidth:200 }}>Next plan</th><th>Target week</th><th>Status</th><th>Prioritas</th><th>PIC</th></tr></thead>
                <tbody>{filtered.map(a => {
                  const catColor = config?.activityCategories?.find((c:any)=>c.key===a.category)?.color || 'var(--accent)'
                  const st = statuses.find((x:any)=>normKey(x.key)===normKey(a.status))
                  return (
                    <tr key={a._id}>
                      <td><b style={{ fontSize:13.5, color:'var(--ink)' }}>{a.title}</b>
                        <div className="au-row au-wrap" style={{ gap:4, marginTop:6 }}><span className="au-tag"><i style={{ background:catColor }} />{a.category}</span>{a.subType && <span className="au-tag">{a.subType}</span>}</div></td>
                      <td style={{ whiteSpace:'pre-wrap' }}>{a.description || a.progressNotes || <span className="au-muted">–</span>}</td>
                      <td style={{ whiteSpace:'nowrap' }}>{fmtD(a.actionDate)}</td>
                      <td style={{ whiteSpace:'pre-wrap' }}>{a.nextPlan || <span className="au-muted">–</span>}</td>
                      <td>{a.targetWeek || '–'}</td>
                      <td>{st ? <span className="au-tag"><i style={{ background:st.color }} />{st.label}</span> : '–'}</td>
                      <td>{a.priority && PRIORITY_CFG[a.priority] ? <Pill tone={PRIORITY_CFG[a.priority].tone}>{PRIORITY_CFG[a.priority].label}</Pill> : '–'}</td>
                      <td>{picArray(a.pic).length ? picArray(a.pic).join(', ') : (a.picName || '–')}</td>
                    </tr>
                  )
                })}</tbody>
              </table>
            </div>}
      </div>
    </div>
  )
}
