'use client'
import { getConfig, invalidateConfig } from '@/lib/configCache'
import { MoneyInput } from '@/components/MoneyInput'
import { fmtMoney } from '@/lib/money'
import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'
import { useYear } from '@/lib/year'
import { Empty, Icon, PageHeader, Seg } from '@/components/ui'
import { useTabParam } from '@/lib/useTabParam'

const fmt = (n:number) => new Intl.NumberFormat('id-ID').format(Math.round(n||0))
const pct = (n:number) => (isFinite(n)?n:0).toFixed(1) + '%'

// Cost elements (slide 9/10)
const COST_ELEMENTS = [
  { key:'travel',        code:'6001008100', name:'EMPLOYEE TRAVEL',           short:'Travel Expense' },
  { key:'accommodation', code:'6001016170', name:'GROUP/EXTERN ACCOMODATION', short:'External Accommodation' },
]

export default function BudgetReportPage() {
  const [tab, setTab] = useTabParam(['yield','realisasi'] as const, 'yield')
  const { year } = useYear()
  const [cur, setCur] = useState<any[]>([])
  const [config, setConfig] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [c, b] = await Promise.all([
        getConfig(),
        fetch(`/api/budget?year=${year}`).then(r=>{ if (!r.ok) throw new Error(); return r.json() }),
      ])
      setConfig(c); setCur(b.data||[])
    } catch { toast.error('Gagal memuat budget') } finally { setLoading(false) }
  }, [year])
  useEffect(()=>{ load() }, [load])

  function rowFor(list:any[], key:string){ return list.find(x=>x.category===key) || {} }
  const realIDRof = (r:any)=> r.annualRealIDR || (r.monthly||[]).reduce((s:number,m:any)=>s+(m.realisasiIDR||0),0)

  return (
    <div className="au-page">
      <div className="au-view au-anim">
        <PageHeader eyebrow={tab === 'yield' ? 'Finance · multi-tahun' : `Finance · ${year}`} title="Budget Report" />
        <div className="rise"><Seg label="Tampilan" value={tab} onChange={setTab} options={[['yield','Yield'],['realisasi','Prognosa']] as const} /></div>
        {tab==='yield'
          ? <YieldTab />
          : (loading ? <div className="au-card">{[0,1,2].map(k => <div key={k} className="au-skel" />)}</div>
              : <RealisasiTab year={year} cur={cur} config={config} setConfig={setConfig} rowFor={rowFor} realIDRof={realIDRof} reload={load} />)}
      </div>
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
    let results: { y:number; data:any[] }[] = []
    try { results = await Promise.all(yrs.map(y => fetch(`/api/budget?year=${y}`).then(r=>{ if (!r.ok) throw new Error(); return r.json() }).then(j=>({ y, data:j.data||[] })))) }
    catch { toast.error('Gagal memuat yield'); setLoading(false); return }
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
          const r = await fetch('/api/budget', { method:'PUT', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ year:y, category:ce.key, budget:{ annualBudgetIDR:d.planIDR||0, annualBudgetUSD:d.planUSD||0, annualRealIDR:d.realIDR||0, annualRealUSD:d.realUSD||0, monthly:d.monthly||[] } }) })
          if (!r.ok) throw new Error(`Gagal menyimpan ${ce.short} ${y}`)
        }
      }
      toast.success('Yield tersimpan'); load()
    } catch (e:any) { toast.error(e?.message || 'Gagal menyimpan') } finally { setSaving(false) }
  }

  const [exporting, setExporting] = useState(false)
  async function exportXLSX() {
    setExporting(true)
    try {
      const _xl:any = await import('exceljs'); const ExcelJS = _xl.default || _xl
      const wb = new ExcelJS.Workbook()
      wb.creator = 'WINS'; wb.created = new Date()
      const ws = wb.addWorksheet('Budget Yield', { views:[{ showGridLines:false }] })
      ws.columns = [{ width:32 },{ width:15 },{ width:15 },{ width:19 },{ width:19 },{ width:11 },{ width:11 },{ width:11 },{ width:11 },{ width:11 },{ width:11 }]
      const box = () => ({ top:{style:'thin' as const, color:{argb:'FFD0D5DD'}}, left:{style:'thin' as const, color:{argb:'FFD0D5DD'}}, bottom:{style:'thin' as const, color:{argb:'FFD0D5DD'}}, right:{style:'thin' as const, color:{argb:'FFD0D5DD'}} })
      const USDF = '"$"#,##0.00'; const IDRF = '"Rp"#,##0'; const PCTF = '0.0"%"'; const YOYF = '+0.0"%";-0.0"%";0"%"'
      const LAST = 'K'

      ws.mergeCells(`A1:${LAST}1`); const t1 = ws.getCell('A1'); t1.value = 'BUDGET REPORT — YIELD'; t1.font = { bold:true, size:15, color:{argb:'FF1A3D7C'} }; t1.alignment = { horizontal:'center' }
      ws.mergeCells(`A2:${LAST}2`); const t2 = ws.getCell('A2'); t2.value = 'Fungsi BPD Procurement Pertamina — Plan vs Realisasi per Cost Element (USD & IDR)'; t2.font = { size:10, color:{argb:'FF667085'} }; t2.alignment = { horizontal:'center' }
      ws.mergeCells(`A3:${LAST}3`); const t3 = ws.getCell('A3'); t3.value = `Diekspor: ${new Date().toLocaleString('id-ID')}`; t3.font = { size:9, italic:true, color:{argb:'FF98A2B3'} }; t3.alignment = { horizontal:'center' }

      let row = 5
      years.forEach(y => {
        const d = byYear[y] || {}; const prevD = byYear[y-1]
        ws.mergeCells(`A${row}:${LAST}${row}`); const yc = ws.getCell(`A${row}`); yc.value = `Tahun ${y}`; yc.font = { bold:true, size:12 }; row++

        // group header (row r) + sub header (row r+1)
        const gh = ws.getRow(row)
        ws.mergeCells(`A${row}:A${row+1}`); gh.getCell(1).value = 'Cost Element'
        ws.mergeCells(`B${row}:C${row}`); gh.getCell(2).value = 'USD'
        ws.mergeCells(`D${row}:E${row}`); gh.getCell(4).value = 'IDR'
        ws.mergeCells(`F${row}:G${row}`); gh.getCell(6).value = '% Realisasi (Real÷Plan)'
        ws.mergeCells(`H${row}:I${row}`); gh.getCell(8).value = 'Yield YoY — Plan'
        ws.mergeCells(`J${row}:K${row}`); gh.getCell(10).value = 'Yield YoY — Realisasi'
        for (let c=1;c<=11;c++){ const cell=gh.getCell(c); cell.font={bold:true,color:{argb:'FFFFFFFF'}}; cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF4F8EF7'}}; cell.alignment={horizontal:'center',vertical:'middle'}; cell.border=box() }
        row++
        const sh = ws.getRow(row)
        const subs = ['', 'Plan','Realisasi','Plan','Realisasi','USD','IDR','IDR','USD','IDR','USD']
        subs.forEach((s,i)=>{ const cell=sh.getCell(i+1); cell.value=s; cell.font={bold:true,size:9,color:{argb:'FF475467'}}; cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFEFF4FF'}}; cell.alignment={horizontal:'center'}; cell.border=box() })
        row++

        const startData = row
        COST_ELEMENTS.forEach(ce => {
          const v = d[ce.key]||{}; const pv = prevD?.[ce.key]
          const pctU = (v.planUSD||0)>0 ? (v.realUSD||0)/(v.planUSD||0)*100 : 0
          const pctI = (v.planIDR||0)>0 ? (v.realIDR||0)/(v.planIDR||0)*100 : 0
          const yPI = pv ? yoy(v.planIDR||0, pv.planIDR||0) : null
          const yPU = pv ? yoy(v.planUSD||0, pv.planUSD||0) : null
          const yRI = pv ? yoy(v.realIDR||0, pv.realIDR||0) : null
          const yRU = pv ? yoy(v.realUSD||0, pv.realUSD||0) : null
          const rr = ws.getRow(row)
          rr.getCell(1).value = `${ce.short} (${ce.code})`
          rr.getCell(2).value = v.planUSD||0; rr.getCell(2).numFmt = USDF
          rr.getCell(3).value = v.realUSD||0; rr.getCell(3).numFmt = USDF
          rr.getCell(4).value = v.planIDR||0; rr.getCell(4).numFmt = IDRF
          rr.getCell(5).value = v.realIDR||0; rr.getCell(5).numFmt = IDRF
          rr.getCell(6).value = pctU; rr.getCell(6).numFmt = PCTF
          rr.getCell(7).value = pctI; rr.getCell(7).numFmt = PCTF
          const yc2 = (col:number, val:number|null) => { const cell=rr.getCell(col); if(val===null){cell.value='—'}else{cell.value=val;cell.numFmt=YOYF;cell.font={color:{argb: val>=0?'FF1A8754':'FFD13438'}}} }
          yc2(8, yPI); yc2(9, yPU); yc2(10, yRI); yc2(11, yRU)
          for (let c=1;c<=11;c++){ rr.getCell(c).border=box(); if(c>=2&&c<=5) rr.getCell(c).alignment={horizontal:'right'}; if(c>=6) rr.getCell(c).alignment={horizontal:'center'} }
          row++
        })
        // TOTAL
        const tr = ws.getRow(row)
        tr.getCell(1).value = 'TOTAL'
        tr.getCell(2).value = { formula:`SUM(B${startData}:B${row-1})` } as any; tr.getCell(2).numFmt = USDF
        tr.getCell(3).value = { formula:`SUM(C${startData}:C${row-1})` } as any; tr.getCell(3).numFmt = USDF
        tr.getCell(4).value = { formula:`SUM(D${startData}:D${row-1})` } as any; tr.getCell(4).numFmt = IDRF
        tr.getCell(5).value = { formula:`SUM(E${startData}:E${row-1})` } as any; tr.getCell(5).numFmt = IDRF
        tr.getCell(6).value = { formula:`IF(B${row}=0,0,C${row}/B${row}*100)` } as any; tr.getCell(6).numFmt = PCTF
        tr.getCell(7).value = { formula:`IF(D${row}=0,0,E${row}/D${row}*100)` } as any; tr.getCell(7).numFmt = PCTF
        const sy=(k:string)=>COST_ELEMENTS.reduce((a,ce)=>a+((d[ce.key]||{})[k]||0),0)
        const py=(k:string)=>prevD?COST_ELEMENTS.reduce((a,ce)=>a+((prevD[ce.key]||{})[k]||0),0):0
        const tYoy = (col:number, cur:number, prev:number) => { const cell=tr.getCell(col); if(!prevD){cell.value='—'}else{const val=yoy(cur,prev);cell.value=val;cell.numFmt=YOYF} }
        tYoy(8, sy('planIDR'), py('planIDR')); tYoy(9, sy('planUSD'), py('planUSD'))
        tYoy(10, sy('realIDR'), py('realIDR')); tYoy(11, sy('realUSD'), py('realUSD'))
        for (let c=1;c<=11;c++){ const cell=tr.getCell(c); cell.font={bold:true}; cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF2F4F7'}}; cell.border=box(); if(c>=2&&c<=5) cell.alignment={horizontal:'right'}; if(c>=6) cell.alignment={horizontal:'center'} }
        row += 2
      })

      const buf = await wb.xlsx.writeBuffer()
      const blob = new Blob([buf], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `Budget_Yield_BPD_Procurement_${new Date().toISOString().slice(0,10)}.xlsx`; a.click(); URL.revokeObjectURL(url)
      toast.success('Excel Yield diunduh')
    } catch (e:any) { toast.error('Gagal export: '+(e?.message||'')) } finally { setExporting(false) }
  }

  return (
    <>
      <div className="au-row au-wrap rise" style={{ gap: 8 }}>
        <span className="au-small au-ink2" style={{ flex: 1, minWidth: 220 }}>Plan &amp; realisasi per cost element (USD &amp; IDR) dari tahun ke tahun. Yield YoY = pertumbuhan vs tahun sebelumnya.</span>
        <button type="button" onClick={addYear} className="btn"><Icon name="plus" size={15} />Tahun</button>
        <button type="button" onClick={exportXLSX} disabled={exporting||loading} className="btn"><Icon name="down" size={15} />{exporting?'Menyiapkan…':'Excel'}</button>
        <button type="button" onClick={saveAll} disabled={saving} className="btn btn-primary">{saving?'Menyimpan…':'Simpan'}</button>
      </div>

      {loading ? <div className="au-card">{[0,1,2].map(k => <div key={k} className="au-skel" />)}</div> :
       years.map(y => {
        const d = byYear[y] || emptyCE(); const prevD = byYear[y-1]
        return (
          <section key={y} className="au-col rise" style={{ gap: 8 }}>
            <span className="lbl">Tahun {y}</span>
            <div className="au-tblw">
              <table className="wp-table au-btbl" style={{ minWidth:1360 }}>
                <thead>
                  <tr>
                    <th rowSpan={2}>Cost Element</th>
                    <th colSpan={2} style={{ textAlign:'center', borderLeft:'1px solid var(--line)' }}>USD</th>
                    <th colSpan={2} style={{ textAlign:'center', borderLeft:'1px solid var(--line)' }}>IDR</th>
                    <th colSpan={2} style={{ textAlign:'center', borderLeft:'1px solid var(--line)' }}>% Realisasi<br/><span style={{ fontWeight:400, fontSize:9, color:'var(--muted)' }}>(Real ÷ Plan)</span></th>
                    <th colSpan={2} style={{ textAlign:'center', borderLeft:'1px solid var(--line)' }}>Yield YoY (%)</th>
                  </tr>
                  <tr>
                    <th style={{ borderLeft:'1px solid var(--line)', textAlign:'right' }}>Plan<div style={subF}>(a)</div></th><th style={{ textAlign:'right' }}>Realisasi<div style={subF}>(b)</div></th>
                    <th style={{ borderLeft:'1px solid var(--line)', textAlign:'right' }}>Plan<div style={subF}>(c)</div></th><th style={{ textAlign:'right' }}>Realisasi<div style={subF}>(d)</div></th>
                    <th style={{ borderLeft:'1px solid var(--line)', textAlign:'center' }}>USD<div style={subF}>(e)=(b)/(a)</div></th><th style={{ textAlign:'center' }}>IDR<div style={subF}>(f)=(d)/(c)</div></th>
                    <th style={{ borderLeft:'1px solid var(--line)', textAlign:'center' }}>Plan<div style={subF}>(g)</div></th><th style={{ textAlign:'center' }}>Realisasi<div style={subF}>(h)</div></th>
                  </tr>
                </thead>
                <tbody>
                  {COST_ELEMENTS.map(ce => {
                    const v = d[ce.key]||{}; const pv = prevD?.[ce.key]
                    const yPlanIDR = pv ? yoy(v.planIDR||0, pv.planIDR||0) : null
                    const yRealIDR = pv ? yoy(v.realIDR||0, pv.realIDR||0) : null
                    const yPlanUSD = pv ? yoy(v.planUSD||0, pv.planUSD||0) : null
                    const yRealUSD = pv ? yoy(v.realUSD||0, pv.realUSD||0) : null
                    const realPctUSD = (v.planUSD||0)>0 ? (v.realUSD||0)/(v.planUSD||0)*100 : 0
                    const realPctIDR = (v.planIDR||0)>0 ? (v.realIDR||0)/(v.planIDR||0)*100 : 0
                    const yoyCell = (idr:number|null, usd:number|null) => idr===null ? <span style={{ color:'var(--muted)' }}>—</span> : (
                      <div style={{ lineHeight:1.25 }}>
                        <div style={{ color: idr>=0?'var(--ok)':'var(--bad)', fontWeight:600 }}>IDR {idr>=0?'+':''}{pct(idr)}</div>
                        <div style={{ color: (usd??0)>=0?'var(--ok)':'var(--bad)', fontSize:10, opacity:0.85 }}>USD {(usd??0)>=0?'+':''}{pct(usd??0)}</div>
                      </div>
                    )
                    return (
                      <tr key={ce.key}>
                        <td style={{ fontSize:11 }}><div style={{ fontWeight:600 }}>{ce.short}</div><div style={{ color:'var(--muted)', fontSize:10 }}>{ce.code} · {ce.name}</div></td>
                        <td style={{ borderLeft:'1px solid var(--line)', textAlign:'right' }}><MoneyInput ariaLabel={`Plan USD ${ce.short} ${y}`} currency="USD" className="input input-sm" style={{ width:120, textAlign:'right' }} value={v.planUSD||0} onChange={n=>setVal(y,ce.key,'planUSD',n)} /></td>
                        <td style={{ textAlign:'right' }}><MoneyInput ariaLabel={`Realisasi USD ${ce.short} ${y}`} currency="USD" className="input input-sm" style={{ width:120, textAlign:'right' }} value={v.realUSD||0} onChange={n=>setVal(y,ce.key,'realUSD',n)} /></td>
                        <td style={{ borderLeft:'1px solid var(--line)', textAlign:'right' }}><MoneyInput ariaLabel={`Plan IDR ${ce.short} ${y}`} currency="IDR" className="input input-sm" style={{ width:150, textAlign:'right' }} value={v.planIDR||0} onChange={n=>setVal(y,ce.key,'planIDR',n)} /></td>
                        <td style={{ textAlign:'right' }}><MoneyInput ariaLabel={`Realisasi IDR ${ce.short} ${y}`} currency="IDR" className="input input-sm" style={{ width:150, textAlign:'right' }} value={v.realIDR||0} onChange={n=>setVal(y,ce.key,'realIDR',n)} /></td>
                        <td style={{ borderLeft:'1px solid var(--line)', textAlign:'center', fontWeight:600, color: realPctUSD>=100?'var(--ok)':'var(--ink)' }}>{pct(realPctUSD)}</td>
                        <td style={{ textAlign:'center', fontWeight:600, color: realPctIDR>=100?'var(--ok)':'var(--ink)' }}>{pct(realPctIDR)}</td>
                        <td style={{ borderLeft:'1px solid var(--line)', textAlign:'center' }}>{yoyCell(yPlanIDR, yPlanUSD)}</td>
                        <td style={{ textAlign:'center' }}>{yoyCell(yRealIDR, yRealUSD)}</td>
                      </tr>
                    )
                  })}
                  {(()=>{
                    const sum = (k:string)=> COST_ELEMENTS.reduce((a,ce)=> a + ((d[ce.key]||{})[k]||0), 0)
                    const psum = (k:string)=> COST_ELEMENTS.reduce((a,ce)=> a + ((prevD?.[ce.key]||{})[k]||0), 0)
                    const tPlanUSD=sum('planUSD'), tRealUSD=sum('realUSD'), tPlanIDR=sum('planIDR'), tRealIDR=sum('realIDR')
                    const tRealPctUSD = tPlanUSD>0 ? tRealUSD/tPlanUSD*100 : 0
                    const tRealPctIDR = tPlanIDR>0 ? tRealIDR/tPlanIDR*100 : 0
                    const tyPlanIDR = prevD ? yoy(tPlanIDR, psum('planIDR')) : null
                    const tyRealIDR = prevD ? yoy(tRealIDR, psum('realIDR')) : null
                    const tyPlanUSD = prevD ? yoy(tPlanUSD, psum('planUSD')) : null
                    const tyRealUSD = prevD ? yoy(tRealUSD, psum('realUSD')) : null
                    const tYoyCell = (idr:number|null, usd:number|null) => idr===null ? <span style={{ color:'var(--muted)' }}>—</span> : (
                      <div style={{ lineHeight:1.25 }}>
                        <div style={{ color: idr>=0?'var(--ok)':'var(--bad)' }}>IDR {idr>=0?'+':''}{pct(idr)}</div>
                        <div style={{ color: (usd??0)>=0?'var(--ok)':'var(--bad)', fontSize:10, opacity:0.85 }}>USD {(usd??0)>=0?'+':''}{pct(usd??0)}</div>
                      </div>
                    )
                    return (
                      <tr className="au-totrow">
                        <td>TOTAL</td>
                        <td style={{ borderLeft:'1px solid var(--line)', textAlign:'right' }}>{fmtMoney(tPlanUSD,'USD')}</td>
                        <td style={{ textAlign:'right' }}>{fmtMoney(tRealUSD,'USD')}</td>
                        <td style={{ borderLeft:'1px solid var(--line)', textAlign:'right' }}>{fmtMoney(tPlanIDR,'IDR')}</td>
                        <td style={{ textAlign:'right' }}>{fmtMoney(tRealIDR,'IDR')}</td>
                        <td style={{ borderLeft:'1px solid var(--line)', textAlign:'center', color: tRealPctUSD>=100?'var(--ok)':'var(--ink)' }}>{pct(tRealPctUSD)}</td>
                        <td style={{ textAlign:'center', color: tRealPctIDR>=100?'var(--ok)':'var(--ink)' }}>{pct(tRealPctIDR)}</td>
                        <td style={{ borderLeft:'1px solid var(--line)', textAlign:'center' }}>{tYoyCell(tyPlanIDR, tyPlanUSD)}</td>
                        <td style={{ textAlign:'center' }}>{tYoyCell(tyRealIDR, tyRealUSD)}</td>
                      </tr>
                    )
                  })()}
                </tbody>
              </table>
            </div>
          </section>
        )
      })}
      <span className="au-xs au-muted">Yield YoY membandingkan tiap tahun dengan tahun sebelumnya. Tahun paling awal (2024) tidak punya pembanding (—). Ketuk &quot;Tahun&quot; untuk menambah tahun.</span>
    </>
  )
}

// =====================  REALISASI  =====================
function RealisasiTab({ year, cur, config, setConfig, rowFor }: any) {
  const getThr = (key:string)=> (config?.budgetCategories||[]).find((c:any)=>c.key===key)?.threshold ?? 80
  const [curr, setCurr] = useState<'IDR'|'USD'>('IDR')
  const [travelPct, setTravelPct] = useState<number>(getThr('travel'))
  const [externalPct, setExternalPct] = useState<number>(getThr('accommodation'))
  const [totalPct, setTotalPct] = useState<number>(config?.budgetThresholdTotal ?? 80)
  const [savingThr, setSavingThr] = useState(false)
  const initedRef = useRef(false)

  // Init threshold SEKALI saja saat config pertama tersedia. Setelah itu jangan auto-reset
  // (biar nilai yg user ketik/simpan ga ketiban config stale).
  useEffect(()=>{
    if (initedRef.current || !config) return
    initedRef.current = true
    setTravelPct(getThr('travel')); setExternalPct(getThr('accommodation')); setTotalPct(config?.budgetThresholdTotal ?? 80)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config])

  const thrFor = (key:string)=> key==='travel'?travelPct: externalPct
  const money = (n:number)=> fmtMoney(n, curr)
  const planOf = (r:any)=> curr==='IDR' ? (r.annualBudgetIDR||0) : (r.annualBudgetUSD||0)
  const realOf = (r:any)=> curr==='IDR' ? (r.annualRealIDR||0) : (r.annualRealUSD||0)

  async function saveThreshold() {
    setSavingThr(true)
    try {
      // Pastikan entry travel & accommodation SELALU ada (kalau DB-nya ga punya key-nya, threshold ga akan kesimpan)
      const base = (config?.budgetCategories||[]) as any[]
      const findOr = (key:string, label:string) => base.find(c=>c.key===key) || { key, label, annualBudget:0, annualBudgetUSD:0, pic:'' }
      const others = base.filter(c=>c.key!=='travel' && c.key!=='accommodation')
      const newCats = [
        { ...findOr('travel','Dinas & Travel'), threshold: travelPct },
        { ...findOr('accommodation','External Accommodation'), threshold: externalPct },
        ...others,
      ]
      const r = await fetch('/api/config', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ budgetCategories:newCats, budgetThresholdTotal: totalPct }) })
      if (!r.ok) { toast.error('Gagal menyimpan threshold'); return }
      invalidateConfig()
      const fresh = await getConfig(true)
      setConfig(fresh)
      // jangan reset input dari config — pertahankan nilai yg barusan disimpan
      toast.success('Threshold tersimpan')
    } catch { toast.error('Gagal menyimpan threshold') } finally { setSavingThr(false) }
  }

  // Hitung total per kolom
  const rows = COST_ELEMENTS.map(ce => {
    const r = rowFor(cur, ce.key); const plan = planOf(r); const rl = realOf(r)
    return { ce, plan, rl, used: plan>0?rl/plan*100:0, available: plan-rl, prognosa: thrFor(ce.key)/100*plan, estAvail: plan - thrFor(ce.key)/100*plan }
  })
  const tot = rows.reduce((a,r)=>({ plan:a.plan+r.plan, rl:a.rl+r.rl, available:a.available+r.available, prognosa:a.prognosa+r.prognosa, estAvail:a.estAvail+r.estAvail }), { plan:0, rl:0, available:0, prognosa:0, estAvail:0 })
  const totUsed = tot.plan>0 ? tot.rl/tot.plan*100 : 0

  return (
    <>
      <div className="au-row au-wrap rise" style={{ gap: 8 }}>
        <Seg label="Mata uang" value={curr} onChange={setCurr} options={['IDR','USD'] as const} />
      </div>
      {tot.plan === 0 ? <div className="au-card"><Empty title={`Belum ada plan ${year}`} text="Isi Plan (RKAP) dan realisasi di tab Yield." /></div> : (
        <div className="au-grid au-bgauges">
          {[...rows.map(r => ({ key: r.ce.key, label: r.ce.short, code: r.ce.code, plan: r.plan, rl: r.rl, used: r.used, thr: thrFor(r.ce.key) })), { key: 'total', label: 'Total', code: 'Semua cost element', plan: tot.plan, rl: tot.rl, used: totUsed, thr: totalPct }].map(g => (
            <section key={g.key} className={`au-card au-gauge rise${g.key === 'total' ? ' tot' : ''}`}>
              <span className="au-row au-between" style={{ gap: 8 }}><span className="au-col" style={{ minWidth: 0 }}><b className="au-small">{g.label}</b><span className="au-xs au-muted">{g.code}</span></span>
                <b className="pct" style={{ color: g.used > g.thr ? 'var(--bad)' : 'var(--ok)' }}>{pct(g.used)}</b></span>
              <span className="au-track" role="img" aria-label={`Terpakai ${pct(g.used)}, threshold ${g.thr}%`}><i className="a" style={{ width: `${Math.min(100, g.used)}%`, background: g.used > g.thr ? 'var(--bad)' : undefined }} /><i className="tick" style={{ left: `calc(${Math.min(100, g.thr)}% - 1px)` }} /></span>
              <span className="au-row au-between au-xs au-muted" style={{ gap: 8 }}><span>Real {money(g.rl)}</span><span>Plan {money(g.plan)}</span></span>
            </section>
          ))}
        </div>
      )}
      <section className="au-card rise" style={{ gap: 12 }}>
        <span className="au-row au-between au-wrap" style={{ gap: 8 }}><span className="lbl">Threshold prognosa</span>
          <button type="button" onClick={saveThreshold} disabled={savingThr} className="btn btn-sm btn-primary">{savingThr?'Menyimpan…':'Simpan threshold'}</button></span>
        <div className="au-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10 }}>
          <label className="au-col" style={{ gap: 6 }}><span className="lbl">Total %</span><input type="number" inputMode="decimal" className="input" value={totalPct} onChange={e=>setTotalPct(Number(e.target.value))} /></label>
          <label className="au-col" style={{ gap: 6 }}><span className="lbl">Travel %</span><input type="number" inputMode="decimal" className="input" value={travelPct} onChange={e=>setTravelPct(Number(e.target.value))} /></label>
          <label className="au-col" style={{ gap: 6 }}><span className="lbl">External %</span><input type="number" inputMode="decimal" className="input" value={externalPct} onChange={e=>setExternalPct(Number(e.target.value))} /></label>
        </div>
      </section>

      <div className="au-tblw rise">
        <table className="wp-table au-ctbl au-btbl" style={{ minWidth:1040 }}>
          <thead><tr>
            <th>Cost Element</th>
            <th style={{ textAlign:'right' }}>Plan (RKAP) {curr}<div style={subF}>(a)</div></th>
            <th style={{ textAlign:'right' }}>Realisasi {curr}<div style={subF}>(b)</div></th>
            <th style={{ textAlign:'center' }}>% Used<div style={subF}>(c)=(b)/(a)</div></th>
            <th style={{ textAlign:'right' }}>Available<div style={subF}>(d)=(a)-(b)</div></th>
            <th style={{ textAlign:'right' }}>Prognosa<div style={subF}>(e)=thr×(a)</div></th>
            <th style={{ textAlign:'right' }}>Est. Available EoY<div style={subF}>(f)=(a)-(e)</div></th>
          </tr></thead>
          <tbody>
            {rows.map(({ce,plan,rl,used,available,prognosa,estAvail}) => (
              <tr key={ce.key}>
                <td className="c-main au-small"><b>{ce.short}</b><span className="au-xs au-muted" style={{ marginLeft: 6 }}>{ce.code}</span></td>
                <td data-l="Plan (a)" style={{ textAlign:'right' }}>{money(plan)}</td>
                <td data-l="Realisasi (b)" style={{ textAlign:'right', fontWeight:600 }}>{money(rl)}</td>
                <td data-l="% Used (c)" style={{ textAlign:'center', fontWeight:600, color: used>thrFor(ce.key)?'var(--bad)':'var(--ok)' }}>{pct(used)}</td>
                <td data-l="Available (d)" style={{ textAlign:'right', color: available<0?'var(--bad)':'var(--ink)' }}>{money(available)}</td>
                <td data-l="Prognosa (e)" style={{ textAlign:'right', color:'var(--warn)' }}>{money(prognosa)}</td>
                <td data-l="Est. EoY (f)" style={{ textAlign:'right', fontWeight:600 }}>{money(estAvail)}</td>
              </tr>
            ))}
            <tr className="au-totrow">
              <td className="c-main" style={{ fontWeight:800 }}>TOTAL</td>
              <td data-l="Plan (a)" style={{ textAlign:'right', fontWeight:800 }}>{money(tot.plan)}</td>
              <td data-l="Realisasi (b)" style={{ textAlign:'right', fontWeight:800 }}>{money(tot.rl)}</td>
              <td data-l="% Used (c)" style={{ textAlign:'center', fontWeight:800, color: totUsed>totalPct?'var(--bad)':'var(--ok)' }}>{pct(totUsed)}</td>
              <td data-l="Available (d)" style={{ textAlign:'right', fontWeight:800, color: tot.available<0?'var(--bad)':'var(--ink)' }}>{money(tot.available)}</td>
              <td data-l="Prognosa (e)" style={{ textAlign:'right', fontWeight:800, color:'var(--warn)' }}>{money(tot.prognosa)}</td>
              <td data-l="Est. EoY (f)" style={{ textAlign:'right', fontWeight:800 }}>{money(tot.estAvail)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <span className="au-xs au-muted">Plan (RKAP) &amp; realisasi {curr} <b>otomatis dari tab Yield</b> tahun {year} (tidak diinput ulang). % Used = Realisasi ÷ Plan. Prognosa = threshold × RKAP. Est. Available EoY = RKAP − Prognosa.</span>
    </>
  )
}

const subF: React.CSSProperties = { fontWeight:400, fontSize:9, color:'var(--muted)', marginTop:2, textTransform:'none', letterSpacing:0 }
