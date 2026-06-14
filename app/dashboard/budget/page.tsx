'use client'
import { getConfig } from '@/lib/configCache'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']
const fmt = (n:number) => new Intl.NumberFormat('id-ID').format(n||0)

export default function BudgetPage() {
  const [config, setConfig] = useState<any>(null)
  const [budgets, setBudgets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCat, setActiveCat] = useState<string>('')
  const [year, setYear] = useState(new Date().getFullYear())
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    const [c, b] = await Promise.all([getConfig().then((data:any)=>({ data })), fetch(`/api/budget?year=${year}`).then(r=>r.json())])
    setConfig(c.data); setBudgets(b.data||[])
    const cats = c.data?.budgetCategories?.filter((x:any)=>x.key!=='cash_card' && x.key!=='petty_cash') || []
    if (cats.length > 0 && !activeCat) setActiveCat(cats[0].key)
    setLoading(false)
  }
  useEffect(() => { load() }, [year])

  async function setThreshold(catKey:string, val:number) {
    if (!config) return
    const newCats = (config.budgetCategories||[]).map((c:any) => c.key===catKey ? { ...c, threshold: val } : c)
    setConfig({ ...config, budgetCategories: newCats })
    try {
      await fetch('/api/config', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ budgetCategories: newCats }) })
      invalidateConfig()
    } catch {}
  }

  const visibleCats = (config?.budgetCategories || []).filter((c:any) => c.key !== 'cash_card' && c.key !== 'petty_cash')
  const currentBudget = budgets.find(b => b.category === activeCat) || {
    year, category: activeCat,
    annualBudgetIDR: visibleCats.find((c:any)=>c.key===activeCat)?.annualBudget || 0,
    annualBudgetUSD: visibleCats.find((c:any)=>c.key===activeCat)?.annualBudgetUSD || 0,
    monthly: [],
  }

  function getMonth(m:number) { return currentBudget.monthly?.find((x:any)=>x.month===m) || { month:m, realisasiIDR:0, realisasiUSD:0, notes:'' } }
  function setMonth(m:number, field:string, value:any) {
    const monthly = [...(currentBudget.monthly || [])]
    const idx = monthly.findIndex((x:any)=>x.month===m)
    if (idx >= 0) monthly[idx] = { ...monthly[idx], [field]: value }
    else monthly.push({ month:m, realisasiIDR:0, realisasiUSD:0, notes:'', [field]: value })
    setBudgets(prev => {
      const newB = [...prev]
      const bIdx = newB.findIndex(b => b.category === activeCat && b.year === year)
      if (bIdx >= 0) newB[bIdx] = { ...newB[bIdx], monthly }
      else newB.push({ ...currentBudget, monthly })
      return newB
    })
  }

  function setAnnual(field:string, value:number) {
    setBudgets(prev => {
      const newB = [...prev]
      const bIdx = newB.findIndex(b => b.category === activeCat && b.year === year)
      if (bIdx >= 0) newB[bIdx] = { ...newB[bIdx], [field]: value }
      else newB.push({ ...currentBudget, [field]: value })
      return newB
    })
  }

  async function save() {
    setSaving(true)
    try {
      const r = await fetch('/api/budget', { method:'PUT', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ year, category: activeCat, budget: currentBudget }) })
      if (!r.ok) { toast.error('Gagal'); return }
      toast.success('Anggaran tersimpan'); load()
    } finally { setSaving(false) }
  }

  // Cumulative percentage calculation
  function cumulativeIDR(uptoMonth:number) {
    let total = 0
    for (let m=1; m<=uptoMonth; m++) total += getMonth(m).realisasiIDR || 0
    return total
  }
  function cumulativeUSD(uptoMonth:number) {
    let total = 0
    for (let m=1; m<=uptoMonth; m++) total += getMonth(m).realisasiUSD || 0
    return total
  }
  function progressPct(uptoMonth:number) {
    const cumIDR = cumulativeIDR(uptoMonth)
    const cumUSD = cumulativeUSD(uptoMonth)
    const annualIDR = currentBudget.annualBudgetIDR || 0
    const annualUSD = currentBudget.annualBudgetUSD || 0
    // Compute weighted % across both currencies (or just IDR if no USD plan)
    if (annualIDR > 0 && annualUSD > 0) {
      // Use IDR-equivalent total assuming 1 USD ≈ Rp 15500 (just for progress calc)
      const totalCum = cumIDR + cumUSD * 15500
      const totalAnnual = annualIDR + annualUSD * 15500
      return totalAnnual > 0 ? (totalCum / totalAnnual) * 100 : 0
    }
    if (annualIDR > 0) return (cumIDR / annualIDR) * 100
    if (annualUSD > 0) return (cumUSD / annualUSD) * 100
    return 0
  }

  const activeCfg = visibleCats.find((c:any) => c.key === activeCat)

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ padding:'12px 20px', borderBottom:'1px solid var(--border)', background:'var(--bg2)', display:'flex', justifyContent:'space-between', flexShrink:0 }}>
        <div>
          <div style={{ fontSize:14, fontWeight:600 }}>Anggaran</div>
          <div style={{ fontSize:11, color:'var(--text3)' }}>Budget tracking (IDR & USD) · cumulative progress · Tahun {year}</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <select className="input" style={{ width:100 }} value={year} onChange={e=>setYear(Number(e.target.value))}>
            {[year-2, year-1, year, year+1].map(y=><option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={save} disabled={saving} className="btn btn-primary btn-sm">{saving?'...':'💾 Simpan'}</button>
        </div>
      </div>

      <div style={{ display:'flex', gap:5, padding:'10px 20px', background:'var(--bg2)', borderBottom:'1px solid var(--border)', flexShrink:0, flexWrap:'wrap' }}>
        {visibleCats.map((c:any) => (
          <button key={c.key} onClick={()=>setActiveCat(c.key)} style={chip(activeCat===c.key)}>{c.label}</button>
        ))}
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'14px 20px' }} className="safe-bottom page-pad">
        {loading ? <div style={{ textAlign:'center', padding:40, color:'var(--text3)' }}>Memuat...</div> : (
          <>
            {/* Annual plan + summary metrics */}
            <div className="card" style={{ padding:14, marginBottom:12 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:10 }}>
                <div style={{ fontSize:11, fontWeight:600, color:'var(--text3)', textTransform:'uppercase' }}>{activeCfg?.label} — Annual Plan</div>
                <div style={{ fontSize:10, color:'var(--text3)', display:'flex', alignItems:'center', gap:6 }}>
                  Threshold alert:
                  <input type="number" min={1} max={100} value={activeCfg?.threshold || 80}
                    onChange={e=>setThreshold(activeCat, parseInt(e.target.value)||80)}
                    style={{ width:56, padding:'3px 6px', fontSize:11, borderRadius:5, border:'1px solid var(--border2)', background:'var(--bg3)', color:'var(--text)' }} />
                  <span>%</span>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
                <div>
                  <label style={lbl}>Anggaran Tahunan IDR</label>
                  <input type="number" className="input" value={currentBudget.annualBudgetIDR||0} onChange={e=>setAnnual('annualBudgetIDR', Number(e.target.value))} />
                </div>
                <div>
                  <label style={lbl}>Anggaran Tahunan USD</label>
                  <input type="number" className="input" value={currentBudget.annualBudgetUSD||0} onChange={e=>setAnnual('annualBudgetUSD', Number(e.target.value))} />
                </div>
              </div>
              {/* Summary metric cards */}
              {(() => {
                const thisYear = new Date().getFullYear() === year
                const currentMonth = new Date().getMonth() + 1 // 1-12
                const monthsElapsed = thisYear ? currentMonth : 12
                const cumIDR_now = cumulativeIDR(monthsElapsed)
                const cumUSD_now = cumulativeUSD(monthsElapsed)
                const cumIDR_eoy = cumulativeIDR(12)
                const cumUSD_eoy = cumulativeUSD(12)
                const planIDR = currentBudget.annualBudgetIDR || 0
                const planUSD = currentBudget.annualBudgetUSD || 0
                const usedIDR_now = cumIDR_now
                const usedUSD_now = cumUSD_now
                const sisaIDR = planIDR - cumIDR_eoy
                const sisaUSD = planUSD - cumUSD_eoy
                const avgIDRperMonth = monthsElapsed > 0 ? cumIDR_now / monthsElapsed : 0
                const avgUSDperMonth = monthsElapsed > 0 ? cumUSD_now / monthsElapsed : 0
                const prognosaIDR = avgIDRperMonth * 12
                const prognosaUSD = avgUSDperMonth * 12
                const pctUsed = progressPct(monthsElapsed)
                const pctEOY = progressPct(12)
                const threshold = activeCfg?.threshold || 80
                return (
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(170px, 1fr))', gap:8 }}>
                    <div className="card" style={{ padding:'10px 12px', background:'var(--bg3)' }}>
                      <div style={{ fontSize:9, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.04em', fontWeight:600 }}>Plan Total</div>
                      <div style={{ fontSize:13, fontWeight:700 }}>Rp {fmt(planIDR)}</div>
                      <div style={{ fontSize:10, color:'var(--text3)' }}>$ {fmt(planUSD)}</div>
                    </div>
                    <div className="card" style={{ padding:'10px 12px', background:'var(--bg3)' }}>
                      <div style={{ fontSize:9, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.04em', fontWeight:600 }}>Realisasi s/d {thisYear?['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'][currentMonth-1]:'Des'}</div>
                      <div style={{ fontSize:13, fontWeight:700, color:'var(--brand)' }}>Rp {fmt(usedIDR_now)}</div>
                      <div style={{ fontSize:10, color:'var(--text3)' }}>$ {fmt(usedUSD_now)} · <b style={{ color: pctUsed>=threshold?'var(--red)':pctUsed>=50?'var(--amber)':'var(--green)' }}>{pctUsed.toFixed(1)}%</b></div>
                    </div>
                    <div className="card" style={{ padding:'10px 12px', background:'var(--bg3)' }}>
                      <div style={{ fontSize:9, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.04em', fontWeight:600 }}>Sisa Tersedia (EOY)</div>
                      <div style={{ fontSize:13, fontWeight:700, color: sisaIDR<0?'var(--red)':'var(--green)' }}>Rp {fmt(sisaIDR)}</div>
                      <div style={{ fontSize:10, color:'var(--text3)' }}>$ {fmt(sisaUSD)}</div>
                    </div>
                    <div className="card" style={{ padding:'10px 12px', background:'var(--bg3)' }}>
                      <div style={{ fontSize:9, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.04em', fontWeight:600 }}>Prognosa s/d Akhir Tahun</div>
                      <div style={{ fontSize:13, fontWeight:700, color: prognosaIDR>planIDR?'var(--red)':'var(--text)' }}>Rp {fmt(Math.round(prognosaIDR))}</div>
                      <div style={{ fontSize:10, color:'var(--text3)' }}>$ {fmt(Math.round(prognosaUSD))} · proyeksi based on avg</div>
                    </div>
                    {pctEOY >= threshold && (
                      <div className="card" style={{ padding:'10px 12px', background:'var(--redbg)', border:'1px solid var(--red)' }}>
                        <div style={{ fontSize:9, color:'var(--red)', textTransform:'uppercase', letterSpacing:'0.04em', fontWeight:600 }}>⚠️ Alert</div>
                        <div style={{ fontSize:11, color:'var(--red)', fontWeight:600 }}>Cumulative EOY {pctEOY.toFixed(0)}% melewati threshold {threshold}%</div>
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>

            {/* Monthly realization table */}
            <div className="card" style={{ overflow:'auto' }}>
              <table className="wp-table">
                <thead>
                  <tr>
                    <th>Bulan</th>
                    <th>Realisasi (IDR)</th>
                    <th>Realisasi (USD)</th>
                    <th>Progress Kumulatif</th>
                    <th>Catatan</th>
                  </tr>
                </thead>
                <tbody>
                  {MONTHS.map((mname, i) => {
                    const m = i + 1
                    const data = getMonth(m)
                    const pct = progressPct(m)
                    return (
                      <tr key={m}>
                        <td style={{ fontWeight:600 }}>{mname}</td>
                        <td><input type="number" className="input input-sm" style={{ width:130 }} value={data.realisasiIDR||0} onChange={e=>setMonth(m, 'realisasiIDR', Number(e.target.value))} /></td>
                        <td><input type="number" className="input input-sm" style={{ width:100 }} value={data.realisasiUSD||0} onChange={e=>setMonth(m, 'realisasiUSD', Number(e.target.value))} /></td>
                        <td style={{ minWidth:120 }}>
                          <div style={{ fontSize:11, fontWeight:700, color: pct >= (activeCfg?.threshold||80) ? 'var(--red)' : pct >= 50 ? 'var(--amber)' : 'var(--green)' }}>
                            {pct.toFixed(1)}%
                          </div>
                          <div style={{ fontSize:9, color:'var(--text3)' }}>Cumulative Jan-{mname}</div>
                        </td>
                        <td><input className="input input-sm" style={{ minWidth:160 }} value={data.notes||''} onChange={e=>setMonth(m, 'notes', e.target.value)} /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
function chip(active:boolean):React.CSSProperties { return { padding:'4px 11px', borderRadius:20, fontSize:11, fontWeight:600, cursor:'pointer', border:`1px solid ${active?'var(--brand)':'var(--border)'}`, background:active?'var(--brand-soft)':'var(--bg3)', color:active?'var(--brand)':'var(--text2)' } }
const lbl: React.CSSProperties = { display:'block', fontSize:11, fontWeight:500, color:'var(--text2)', marginBottom:5 }
