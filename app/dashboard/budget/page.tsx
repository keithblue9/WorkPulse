'use client'
import { getConfig, invalidateConfig } from '@/lib/configCache'
import { MoneyInput } from '@/components/MoneyInput'
import { fmtMoney } from '@/lib/money'
import { useEffect, useMemo, useState, useCallback } from 'react'
import toast from 'react-hot-toast'

const fmt = (n:number) => new Intl.NumberFormat('id-ID').format(Math.round(n||0))
const pct = (n:number) => (isFinite(n)?n:0).toFixed(1) + '%'

// Cost elements (slide 9/10)
const COST_ELEMENTS = [
  { key:'travel',        code:'6001008100', name:'EMPLOYEE TRAVEL',           short:'Travel Expense' },
  { key:'accommodation', code:'6001016170', name:'GROUP/EXTERN ACCOMODATION', short:'External Accommodation' },
]

export default function BudgetReportPage() {
  const [tab, setTab] = useState<'yield'|'realisasi'>('yield')
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [cur, setCur] = useState<any[]>([])
  const [config, setConfig] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [c, b] = await Promise.all([
      getConfig(),
      fetch(`/api/budget?year=${year}`).then(r=>r.json()),
    ])
    setConfig(c); setCur(b.data||[]); setLoading(false)
  }, [year])
  useEffect(()=>{ load() }, [load])

  function rowFor(list:any[], key:string){ return list.find(x=>x.category===key) || {} }
  const realIDRof = (r:any)=> r.annualRealIDR || (r.monthly||[]).reduce((s:number,m:any)=>s+(m.realisasiIDR||0),0)

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ padding:'12px 20px 0', borderBottom:'1px solid var(--border)', background:'var(--bg2)', flexShrink:0 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontSize:14, fontWeight:600 }}>Budget Report</div>
          {tab==='realisasi' && (
            <select className="input input-sm" style={{ width:100 }} value={year} onChange={e=>setYear(Number(e.target.value))}>
              {[now.getFullYear()+1, now.getFullYear(), now.getFullYear()-1, now.getFullYear()-2].map(y=><option key={y} value={y}>{y}</option>)}
            </select>
          )}
        </div>
        <div style={{ display:'flex', gap:4, marginTop:10 }}>
          <button onClick={()=>setTab('yield')} style={subtab(tab==='yield')}>Yield</button>
          <button onClick={()=>setTab('realisasi')} style={subtab(tab==='realisasi')}>Realisasi</button>
        </div>
      </div>
      {tab==='yield'
        ? <YieldTab />
        : (loading ? <div style={{ padding:40, textAlign:'center', color:'var(--text3)' }}>Memuat...</div>
            : <RealisasiTab year={year} cur={cur} config={config} setConfig={setConfig} rowFor={rowFor} realIDRof={realIDRof} reload={load} />)}
    </div>
  )
}

// =====================  YIELD (multi-tahun)  =====================
function YieldTab() {
  const now = new Date()
  const [years, setYears] = useState<number[]>([])
  const [byYear, setByYear] = useState<Record<number, Record<string, any>>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const emptyCE = ()=> Object.fromEntries(COST_ELEMENTS.map(ce=>[ce.key,{ planIDR:0, planUSD:0, realIDR:0, realUSD:0, monthly:[] }]))

  const load = useCallback(async () => {
    setLoading(true)
    const start = 2024
    const end = Math.max(now.getFullYear(), start)
    const yrs:number[] = []; for (let y=start; y<=end; y++) yrs.push(y)
    const results = await Promise.all(yrs.map(y => fetch(`/api/budget?year=${y}`).then(r=>r.json()).then(j=>({ y, data:j.data||[] }))))
    const map:Record<number, any> = {}
    results.forEach(({y,data}) => {
      const d:any = {}
      COST_ELEMENTS.forEach(ce => { const r = (data as any[]).find(x=>x.category===ce.key)||{}
        d[ce.key] = { planIDR:r.annualBudgetIDR||0, planUSD:r.annualBudgetUSD||0, realIDR:r.annualRealIDR||0, realUSD:r.annualRealUSD||0, monthly:r.monthly||[] } })
      map[y] = d
    })
    setYears(yrs); setByYear(map); setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(()=>{ load() }, [load])

  function addYear() {
    const next = (years.length ? Math.max(...years) : 2023) + 1
    setYears(ys => [...ys, next]); setByYear(m => ({ ...m, [next]: emptyCE() }))
  }
  const setVal = (year:number, ce:string, f:string, v:number) =>
    setByYear(m => ({ ...m, [year]: { ...m[year], [ce]: { ...m[year][ce], [f]: v } } }))
  const yoy = (cur:number, before:number)=> before>0 ? ((cur-before)/before*100) : 0

  async function saveAll() {
    setSaving(true)
    try {
      for (const y of years) {
        for (const ce of COST_ELEMENTS) {
          const d = byYear[y]?.[ce.key] || {}
          await fetch('/api/budget', { method:'PUT', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ year:y, category:ce.key, budget:{ annualBudgetIDR:d.planIDR||0, annualBudgetUSD:d.planUSD||0, annualRealIDR:d.realIDR||0, annualRealUSD:d.realUSD||0, monthly:d.monthly||[] } }) })
        }
      }
      toast.success('Yield tersimpan'); load()
    } finally { setSaving(false) }
  }

  return (
    <div style={{ flex:1, overflowY:'auto', padding:'16px 20px' }} className="safe-bottom page-pad">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10, gap:8, flexWrap:'wrap' }}>
        <div style={{ fontSize:12, color:'var(--text3)' }}>Plan &amp; Realisasi per cost element (USD &amp; IDR) dari tahun ke tahun. Yield YoY = pertumbuhan vs tahun sebelumnya.</div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={addYear} className="btn btn-sm">+ Tahun</button>
          <button onClick={saveAll} disabled={saving} className="btn btn-sm btn-primary">{saving?'...':'Simpan'}</button>
        </div>
      </div>

      {loading ? <div style={{ textAlign:'center', padding:40, color:'var(--text3)' }}>Memuat...</div> :
       years.map(y => {
        const d = byYear[y] || emptyCE(); const prevD = byYear[y-1]
        return (
          <div key={y} style={{ marginBottom:18 }}>
            <div style={{ fontSize:13, fontWeight:700, marginBottom:6 }}>Tahun {y}</div>
            <div className="card" style={{ overflow:'auto' }}>
              <table className="wp-table" style={{ minWidth:1180 }}>
                <thead>
                  <tr>
                    <th rowSpan={2}>Cost Element</th>
                    <th colSpan={2} style={{ textAlign:'center', borderLeft:'1px solid var(--border)' }}>USD</th>
                    <th colSpan={2} style={{ textAlign:'center', borderLeft:'1px solid var(--border)' }}>IDR</th>
                    <th colSpan={2} style={{ textAlign:'center', borderLeft:'1px solid var(--border)' }}>Yield YoY (%)</th>
                  </tr>
                  <tr>
                    <th style={{ borderLeft:'1px solid var(--border)' }}>Plan</th><th>Realisasi</th>
                    <th style={{ borderLeft:'1px solid var(--border)' }}>Plan</th><th>Realisasi</th>
                    <th style={{ borderLeft:'1px solid var(--border)' }}>Plan</th><th>Realisasi</th>
                  </tr>
                </thead>
                <tbody>
                  {COST_ELEMENTS.map(ce => {
                    const v = d[ce.key]||{}; const pv = prevD?.[ce.key]
                    const yPlan = pv ? yoy(v.planIDR||0, pv.planIDR||0) : 0
                    const yReal = pv ? yoy(v.realIDR||0, pv.realIDR||0) : 0
                    return (
                      <tr key={ce.key}>
                        <td style={{ fontSize:11 }}><div style={{ fontWeight:600 }}>{ce.short}</div><div style={{ color:'var(--text3)', fontSize:10 }}>{ce.code} · {ce.name}</div></td>
                        <td style={{ borderLeft:'1px solid var(--border)' }}><MoneyInput currency="USD" style={{ width:110 }} value={v.planUSD||0} onChange={n=>setVal(y,ce.key,'planUSD',n)} /></td>
                        <td><MoneyInput currency="USD" style={{ width:110 }} value={v.realUSD||0} onChange={n=>setVal(y,ce.key,'realUSD',n)} /></td>
                        <td style={{ borderLeft:'1px solid var(--border)' }}><MoneyInput currency="IDR" style={{ width:140 }} value={v.planIDR||0} onChange={n=>setVal(y,ce.key,'planIDR',n)} /></td>
                        <td><MoneyInput currency="IDR" style={{ width:140 }} value={v.realIDR||0} onChange={n=>setVal(y,ce.key,'realIDR',n)} /></td>
                        <td style={{ borderLeft:'1px solid var(--border)', color: !pv?'var(--text3)':yPlan>=0?'var(--green)':'var(--red)', fontWeight:600 }}>{!pv?'—':`${yPlan>=0?'+':''}${pct(yPlan)}`}</td>
                        <td style={{ color: !pv?'var(--text3)':yReal>=0?'var(--green)':'var(--red)', fontWeight:600 }}>{!pv?'—':`${yReal>=0?'+':''}${pct(yReal)}`}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
      <div style={{ fontSize:10, color:'var(--text3)', marginTop:4 }}>Yield YoY membandingkan tiap tahun dengan tahun sebelumnya. Tahun paling awal (2024) tidak punya pembanding (—). Klik &quot;+ Tahun&quot; untuk menambah tahun.</div>
    </div>
  )
}

// =====================  REALISASI  =====================
function RealisasiTab({ year, cur, config, setConfig, rowFor, reload }: any) {
  const getThr = (key:string)=> (config?.budgetCategories||[]).find((c:any)=>c.key===key)?.threshold ?? 80
  const [curr, setCurr] = useState<'IDR'|'USD'>('IDR')
  const [travelPct, setTravelPct] = useState<number>(getThr('travel'))
  const [externalPct, setExternalPct] = useState<number>(getThr('accommodation'))
  const [totalPct, setTotalPct] = useState<number>(config?.budgetThresholdTotal ?? 80)
  const [real, setReal] = useState<Record<string,{idr:number;usd:number}>>({})
  const [savingThr, setSavingThr] = useState(false)
  const [savingReal, setSavingReal] = useState(false)

  useEffect(()=>{
    setTravelPct(getThr('travel')); setExternalPct(getThr('accommodation')); setTotalPct(config?.budgetThresholdTotal ?? 80)
    const d:Record<string,{idr:number;usd:number}> = {}
    COST_ELEMENTS.forEach(ce=>{ const r=rowFor(cur,ce.key); d[ce.key]={ idr:r.annualRealIDR||0, usd:r.annualRealUSD||0 } }); setReal(d)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur, config])

  const thrFor = (key:string)=> key==='travel'?travelPct: externalPct
  const money = (n:number)=> fmtMoney(n, curr)
  const planOf = (r:any)=> curr==='IDR' ? (r.annualBudgetIDR||0) : (r.annualBudgetUSD||0)
  const realOf = (ce:string)=> curr==='IDR' ? (real[ce]?.idr||0) : (real[ce]?.usd||0)
  const setRealVal = (ce:string,v:number)=> setReal(p=>({ ...p, [ce]: { ...(p[ce]||{idr:0,usd:0}), [curr==='IDR'?'idr':'usd']: v } }))

  async function saveThreshold() {
    setSavingThr(true)
    try {
      const newCats = (config?.budgetCategories||[]).map((c:any)=> c.key==='travel'?{...c,threshold:travelPct}: c.key==='accommodation'?{...c,threshold:externalPct}:c)
      await fetch('/api/config', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ budgetCategories:newCats, budgetThresholdTotal: totalPct }) })
      setConfig({ ...config, budgetCategories:newCats, budgetThresholdTotal: totalPct }); invalidateConfig()
      toast.success('Threshold tersimpan')
    } finally { setSavingThr(false) }
  }

  async function saveRealisasi() {
    setSavingReal(true)
    try {
      for (const ce of COST_ELEMENTS) {
        const r = rowFor(cur, ce.key)
        await fetch('/api/budget', { method:'PUT', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ year, category:ce.key, budget:{ annualBudgetIDR:r.annualBudgetIDR||0, annualBudgetUSD:r.annualBudgetUSD||0, annualRealIDR:real[ce.key]?.idr||0, annualRealUSD:real[ce.key]?.usd||0, monthly:(r.monthly||[]) } }) })
      }
      toast.success('Realisasi tersimpan'); reload()
    } finally { setSavingReal(false) }
  }

  return (
    <div style={{ flex:1, overflowY:'auto', padding:'16px 20px' }} className="safe-bottom page-pad">
      <div className="card" style={{ padding:'12px 16px', marginBottom:14 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <div style={{ fontSize:12, fontWeight:600 }}>Threshold Prognosa</div>
          <button onClick={saveThreshold} disabled={savingThr} className="btn btn-sm btn-primary">{savingThr?'...':'Simpan Threshold'}</button>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
          <div><label style={lbl}>Total %</label><input type="number" className="input input-sm" value={totalPct} onChange={e=>setTotalPct(Number(e.target.value))} /></div>
          <div><label style={lbl}>Travel %</label><input type="number" className="input input-sm" value={travelPct} onChange={e=>setTravelPct(Number(e.target.value))} /></div>
          <div><label style={lbl}>External %</label><input type="number" className="input input-sm" value={externalPct} onChange={e=>setExternalPct(Number(e.target.value))} /></div>
        </div>
      </div>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10, gap:8 }}>
        <div style={{ display:'flex', gap:5 }}>
          <button onClick={()=>setCurr('IDR')} style={curChip(curr==='IDR')}>IDR</button>
          <button onClick={()=>setCurr('USD')} style={curChip(curr==='USD')}>USD</button>
        </div>
        <button onClick={saveRealisasi} disabled={savingReal} className="btn btn-sm btn-primary">{savingReal?'...':'Simpan Realisasi'}</button>
      </div>

      <div className="card" style={{ overflow:'auto' }}>
        <table className="wp-table" style={{ minWidth:1080 }}>
          <thead><tr>
            <th>Cost Element</th><th>Plan (RKAP) {curr}</th><th>Realisasi {curr}</th><th>% Used</th><th>Available</th><th>Prognosa<br/><span style={{ fontWeight:400, fontSize:9, color:'var(--text3)' }}>(threshold×RKAP)</span></th><th>Est. Available EoY</th>
          </tr></thead>
          <tbody>
            {COST_ELEMENTS.map(ce => {
              const r = rowFor(cur, ce.key)
              const plan = planOf(r)
              const rl = realOf(ce.key)
              const used = plan>0 ? rl/plan*100 : 0
              const available = plan - rl
              const prognosa = thrFor(ce.key)/100 * plan
              const estAvail = plan - prognosa
              return (
                <tr key={ce.key}>
                  <td style={{ fontSize:11 }}><div style={{ fontWeight:600 }}>{ce.short}</div><div style={{ color:'var(--text3)', fontSize:10 }}>{ce.code}</div></td>
                  <td>{money(plan)}</td>
                  <td><MoneyInput currency={curr} style={{ width:150 }} value={rl} onChange={n=>setRealVal(ce.key,n)} /></td>
                  <td style={{ fontWeight:600, color: used>thrFor(ce.key)?'var(--red)':'var(--green)' }}>{pct(used)}</td>
                  <td style={{ color: available<0?'var(--red)':'var(--text)' }}>{money(available)}</td>
                  <td style={{ color:'var(--amber)' }}>{money(prognosa)}</td>
                  <td style={{ fontWeight:600 }}>{money(estAvail)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize:10, color:'var(--text3)', marginTop:8 }}>Plan (RKAP) {curr} diambil dari Budget tahun {year} (set di tab Yield). Realisasi diinput manual per mata uang. Prognosa = threshold × RKAP. Est. Available EoY = RKAP − Prognosa.</div>
    </div>
  )
}
function curChip(active:boolean):React.CSSProperties { return { padding:'4px 14px', borderRadius:20, fontSize:11, fontWeight:600, cursor:'pointer', border:`1px solid ${active?'var(--brand)':'var(--border)'}`, background:active?'var(--brand-soft)':'var(--bg3)', color:active?'var(--brand)':'var(--text2)' } }

const lbl: React.CSSProperties = { display:'block', fontSize:11, fontWeight:500, color:'var(--text2)', marginBottom:5 }
function subtab(active:boolean):React.CSSProperties { return { padding:'8px 16px', fontSize:12.5, fontWeight:600, cursor:'pointer', border:'none', borderBottom:`2px solid ${active?'var(--brand)':'transparent'}`, background:'transparent', color:active?'var(--brand)':'var(--text3)' } }
