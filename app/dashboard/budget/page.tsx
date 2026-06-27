'use client'
import { getConfig, invalidateConfig } from '@/lib/configCache'
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
  const [prev, setPrev] = useState<any[]>([])
  const [config, setConfig] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [c, b, pb] = await Promise.all([
      getConfig(),
      fetch(`/api/budget?year=${year}`).then(r=>r.json()),
      fetch(`/api/budget?year=${year-1}`).then(r=>r.json()),
    ])
    setConfig(c); setCur(b.data||[]); setPrev(pb.data||[]); setLoading(false)
  }, [year])
  useEffect(()=>{ load() }, [load])

  function rowFor(list:any[], key:string){ return list.find(x=>x.category===key) || {} }
  const realIDRof = (r:any)=> r.annualRealIDR || (r.monthly||[]).reduce((s:number,m:any)=>s+(m.realisasiIDR||0),0)
  const realUSDof = (r:any)=> r.annualRealUSD || (r.monthly||[]).reduce((s:number,m:any)=>s+(m.realisasiUSD||0),0)

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ padding:'12px 20px 0', borderBottom:'1px solid var(--border)', background:'var(--bg2)', flexShrink:0 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontSize:14, fontWeight:600 }}>Budget Report</div>
          <select className="input input-sm" style={{ width:100 }} value={year} onChange={e=>setYear(Number(e.target.value))}>
            {[now.getFullYear()+1, now.getFullYear(), now.getFullYear()-1, now.getFullYear()-2].map(y=><option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div style={{ display:'flex', gap:4, marginTop:10 }}>
          <button onClick={()=>setTab('yield')} style={subtab(tab==='yield')}>Yield</button>
          <button onClick={()=>setTab('realisasi')} style={subtab(tab==='realisasi')}>Realisasi</button>
        </div>
      </div>
      {loading ? <div style={{ padding:40, textAlign:'center', color:'var(--text3)' }}>Memuat...</div> :
       tab==='yield'
        ? <YieldTab year={year} cur={cur} prev={prev} rowFor={rowFor} realIDRof={realIDRof} realUSDof={realUSDof} reload={load} />
        : <RealisasiTab year={year} cur={cur} config={config} setConfig={setConfig} rowFor={rowFor} realIDRof={realIDRof} reload={load} />}
    </div>
  )
}

// =====================  YIELD  =====================
function YieldTab({ year, cur, prev, rowFor, realIDRof, realUSDof, reload }: any) {
  const [draft, setDraft] = useState<Record<string,any>>({})
  const [saving, setSaving] = useState(false)
  useEffect(()=>{
    const d:Record<string,any> = {}
    COST_ELEMENTS.forEach(ce => { const r = rowFor(cur, ce.key)
      d[ce.key] = { planIDR:r.annualBudgetIDR||0, planUSD:r.annualBudgetUSD||0, realIDR:realIDRof(r), realUSD:realUSDof(r) } })
    setDraft(d)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur])

  const set = (k:string,f:string,v:number)=>setDraft(p=>({...p,[k]:{...p[k],[f]:v}}))
  const yoy = (now:number, before:number)=> before>0 ? ((now-before)/before*100) : 0

  async function saveAll() {
    setSaving(true)
    try {
      for (const ce of COST_ELEMENTS) {
        const d = draft[ce.key]||{}
        await fetch('/api/budget', { method:'PUT', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ year, category:ce.key, budget:{ annualBudgetIDR:d.planIDR||0, annualBudgetUSD:d.planUSD||0, annualRealIDR:d.realIDR||0, annualRealUSD:d.realUSD||0, monthly:(rowFor(cur,ce.key).monthly||[]) } }) })
      }
      toast.success('Yield tersimpan'); reload()
    } finally { setSaving(false) }
  }

  return (
    <div style={{ flex:1, overflowY:'auto', padding:'16px 20px' }} className="safe-bottom page-pad">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
        <div style={{ fontSize:12, color:'var(--text3)' }}>Plan &amp; Realisasi per cost element (USD &amp; IDR). Yield = pertumbuhan year-to-year vs {year-1}.</div>
        <button onClick={saveAll} disabled={saving} className="btn btn-sm btn-primary">{saving?'...':'Simpan'}</button>
      </div>
      <div className="card" style={{ overflow:'auto' }}>
        <table className="wp-table" style={{ minWidth:1040 }}>
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
              const d = draft[ce.key]||{}; const p = rowFor(prev, ce.key)
              const yPlan = yoy(d.planIDR||0, p.annualBudgetIDR||0)
              const yReal = yoy(d.realIDR||0, realIDRof(p))
              return (
                <tr key={ce.key}>
                  <td style={{ fontSize:11 }}><div style={{ fontWeight:600 }}>{ce.short}</div><div style={{ color:'var(--text3)', fontSize:10 }}>{ce.code} · {ce.name}</div></td>
                  <td style={{ borderLeft:'1px solid var(--border)' }}><input type="number" className="input input-sm" style={{ width:110 }} value={d.planUSD||0} onChange={e=>set(ce.key,'planUSD',Number(e.target.value))} /></td>
                  <td><input type="number" className="input input-sm" style={{ width:110 }} value={d.realUSD||0} onChange={e=>set(ce.key,'realUSD',Number(e.target.value))} /></td>
                  <td style={{ borderLeft:'1px solid var(--border)' }}><input type="number" className="input input-sm" style={{ width:130 }} value={d.planIDR||0} onChange={e=>set(ce.key,'planIDR',Number(e.target.value))} /></td>
                  <td><input type="number" className="input input-sm" style={{ width:130 }} value={d.realIDR||0} onChange={e=>set(ce.key,'realIDR',Number(e.target.value))} /></td>
                  <td style={{ borderLeft:'1px solid var(--border)', color: yPlan>=0?'var(--green)':'var(--red)', fontWeight:600 }}>{yPlan>=0?'+':''}{pct(yPlan)}</td>
                  <td style={{ color: yReal>=0?'var(--green)':'var(--red)', fontWeight:600 }}>{yReal>=0?'+':''}{pct(yReal)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize:10, color:'var(--text3)', marginTop:8 }}>Yield YoY membandingkan nilai {year} terhadap {year-1}. Jika data {year-1} belum ada, yield 0%.</div>
    </div>
  )
}

// =====================  REALISASI  =====================
function RealisasiTab({ year, cur, config, setConfig, rowFor, realIDRof, reload }: any) {
  const getThr = (key:string)=> (config?.budgetCategories||[]).find((c:any)=>c.key===key)?.threshold ?? 80
  const [travelPct, setTravelPct] = useState<number>(getThr('travel'))
  const [externalPct, setExternalPct] = useState<number>(getThr('accommodation'))
  const [totalPct, setTotalPct] = useState<number>(Math.round((getThr('travel')+getThr('accommodation'))/2))
  const [realDraft, setRealDraft] = useState<Record<string,number>>({})
  const [saving, setSaving] = useState(false)

  useEffect(()=>{
    setTravelPct(getThr('travel')); setExternalPct(getThr('accommodation'))
    const d:Record<string,number> = {}; COST_ELEMENTS.forEach(ce=>{ d[ce.key]=realIDRof(rowFor(cur,ce.key)) }); setRealDraft(d)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur, config])

  // Total% diubah -> External otomatis = Total - Travel (boleh diedit lagi)
  function onTotal(v:number){ setTotalPct(v); setExternalPct(Math.max(0, v - travelPct)) }
  function onTravel(v:number){ setTravelPct(v); setExternalPct(Math.max(0, totalPct - v)) }

  const thrFor = (key:string)=> key==='travel'?travelPct: externalPct

  async function saveAll() {
    setSaving(true)
    try {
      // simpan threshold ke config
      const newCats = (config?.budgetCategories||[]).map((c:any)=> c.key==='travel'?{...c,threshold:travelPct}: c.key==='accommodation'?{...c,threshold:externalPct}:c)
      await fetch('/api/config', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ budgetCategories:newCats }) })
      setConfig({ ...config, budgetCategories:newCats }); invalidateConfig()
      // simpan realisasi manual
      for (const ce of COST_ELEMENTS) {
        const r = rowFor(cur, ce.key)
        await fetch('/api/budget', { method:'PUT', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ year, category:ce.key, budget:{ annualBudgetIDR:r.annualBudgetIDR||0, annualBudgetUSD:r.annualBudgetUSD||0, annualRealIDR:realDraft[ce.key]||0, annualRealUSD:r.annualRealUSD||0, monthly:(r.monthly||[]) } }) })
      }
      toast.success('Realisasi & threshold tersimpan'); reload()
    } finally { setSaving(false) }
  }

  return (
    <div style={{ flex:1, overflowY:'auto', padding:'16px 20px' }} className="safe-bottom page-pad">
      <div className="card" style={{ padding:'12px 16px', marginBottom:14 }}>
        <div style={{ fontSize:12, fontWeight:600, marginBottom:10 }}>Threshold Prognosa</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
          <div><label style={lbl}>Total %</label><input type="number" className="input input-sm" value={totalPct} onChange={e=>onTotal(Number(e.target.value))} /></div>
          <div><label style={lbl}>Travel %</label><input type="number" className="input input-sm" value={travelPct} onChange={e=>onTravel(Number(e.target.value))} /></div>
          <div><label style={lbl}>External % <span style={{ color:'var(--text3)', fontWeight:400 }}>(auto Total−Travel, editable)</span></label><input type="number" className="input input-sm" value={externalPct} onChange={e=>setExternalPct(Number(e.target.value))} /></div>
        </div>
      </div>

      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:10 }}>
        <button onClick={saveAll} disabled={saving} className="btn btn-sm btn-primary">{saving?'...':'Simpan'}</button>
      </div>

      <div className="card" style={{ overflow:'auto' }}>
        <table className="wp-table" style={{ minWidth:1080 }}>
          <thead><tr>
            <th>Cost Element</th><th>Plan (RKAP)</th><th>Realisasi</th><th>% Used</th><th>Available</th><th>Prognosa<br/><span style={{ fontWeight:400, fontSize:9, color:'var(--text3)' }}>(threshold×RKAP)</span></th><th>Est. Available EoY</th>
          </tr></thead>
          <tbody>
            {COST_ELEMENTS.map(ce => {
              const r = rowFor(cur, ce.key)
              const plan = r.annualBudgetIDR||0
              const real = realDraft[ce.key]||0
              const used = plan>0 ? real/plan*100 : 0
              const available = plan - real
              const prognosa = thrFor(ce.key)/100 * plan
              const estAvail = plan - prognosa
              return (
                <tr key={ce.key}>
                  <td style={{ fontSize:11 }}><div style={{ fontWeight:600 }}>{ce.short}</div><div style={{ color:'var(--text3)', fontSize:10 }}>{ce.code}</div></td>
                  <td>Rp {fmt(plan)}</td>
                  <td><input type="number" className="input input-sm" style={{ width:130 }} value={real} onChange={e=>setRealDraft(p=>({...p,[ce.key]:Number(e.target.value)}))} /></td>
                  <td style={{ fontWeight:600, color: used>thrFor(ce.key)?'var(--red)':'var(--green)' }}>{pct(used)}</td>
                  <td style={{ color: available<0?'var(--red)':'var(--text)' }}>Rp {fmt(available)}</td>
                  <td style={{ color:'var(--amber)' }}>Rp {fmt(prognosa)}</td>
                  <td style={{ fontWeight:600 }}>Rp {fmt(estAvail)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize:10, color:'var(--text3)', marginTop:8 }}>Plan (RKAP) diambil dari Budget tahun {year} (set di tab Yield). Realisasi Travel diinput manual. Prognosa = threshold × RKAP. Est. Available EoY = RKAP − Prognosa.</div>
    </div>
  )
}

const lbl: React.CSSProperties = { display:'block', fontSize:11, fontWeight:500, color:'var(--text2)', marginBottom:5 }
function subtab(active:boolean):React.CSSProperties { return { padding:'8px 16px', fontSize:12.5, fontWeight:600, cursor:'pointer', border:'none', borderBottom:`2px solid ${active?'var(--brand)':'transparent'}`, background:'transparent', color:active?'var(--brand)':'var(--text3)' } }
