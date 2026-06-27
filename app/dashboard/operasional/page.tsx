'use client'
import { getConfig } from '@/lib/configCache'
import { oeLookup } from '@/lib/defaults'
import { useEffect, useMemo, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'

const fmt = (n:number) => new Intl.NumberFormat('id-ID').format(n||0)
const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']

function periodDate(r:any):Date|null {
  const raw = r.billDate || r.submittedAt || r.createdAt
  if (!raw) return null
  const d = new Date(raw); return isNaN(d.getTime()) ? null : d
}
function hasEvidence(r:any):boolean { return Array.isArray(r.documents) && r.documents.length > 0 }
function evidenceCount(r:any):number { return Array.isArray(r.documents) ? r.documents.length : 0 }
function safeName(s:string):string { return String(s||'').replace(/[\\/:*?"<>|]+/g,'_').replace(/\s+/g,'_').slice(0,50) || 'item' }
function downloadBlob(blob:Blob, filename:string) {
  const url = URL.createObjectURL(blob); const a = document.createElement('a')
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a)
  setTimeout(()=>URL.revokeObjectURL(url), 2000)
}
function parseDataUrl(dataUrl:string):{ base64:string; mime:string } | null {
  const m = /^data:([^;]+);base64,([\s\S]*)$/.exec(dataUrl||''); if (!m) return null
  return { mime: m[1], base64: m[2] }
}
function extForMime(mime:string, fallbackName:string):string {
  if ((fallbackName.match(/\.[a-z0-9]+$/i)||[''])[0]) return ''
  if (mime?.includes('pdf')) return '.pdf'; if (mime?.includes('png')) return '.png'
  if (mime?.includes('jpeg')||mime?.includes('jpg')) return '.jpg'; return ''
}
// OE-07 -> OE7, OE-01 -> OE1, NOE-07 -> NOE7  (format Excel template)
function oeExcelCode(code:string):string {
  if (!code) return '-'
  const m = /^([A-Za-z]+)-?0*(\d+)$/.exec(code)
  return m ? `${m[1]}${Number(m[2])}` : code
}

export default function OperasionalPage() {
  const { data:session } = useSession(); const user = session?.user as any
  const [tab, setTab] = useState<'settlement'|'petty'>('settlement')
  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ padding:'12px 20px 0', borderBottom:'1px solid var(--border)', background:'var(--bg2)', flexShrink:0 }}>
        <div style={{ fontSize:14, fontWeight:600 }}>Operasional</div>
        <div style={{ display:'flex', gap:4, marginTop:10 }}>
          <button onClick={()=>setTab('settlement')} style={subtab(tab==='settlement')}>Settlement CC</button>
          <button onClick={()=>setTab('petty')} style={subtab(tab==='petty')}>Petty Cash</button>
        </div>
      </div>
      {tab==='settlement' ? <SettlementTab user={user} /> : <PettyCashTab />}
    </div>
  )
}

// =====================  SETTLEMENT CC  =====================
function SettlementTab({ user }: { user:any }) {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())
  const [allSources, setAllSources] = useState(false)
  const [viewing, setViewing] = useState<any>(null)
  const [zipping, setZipping] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [verifying, setVerifying] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { const r = await fetch('/api/reimbursements').then(r=>r.json()); setItems(r.data || []) }
    catch { toast.error('Gagal memuat data') } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const yearOptions = useMemo(() => {
    const ys = new Set<number>([now.getFullYear(), now.getFullYear()-1, now.getFullYear()+1])
    items.forEach(r => { const d = periodDate(r); if (d) ys.add(d.getFullYear()) })
    return Array.from(ys).sort((a,b)=>b-a)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])

  // semua item periode ini (Cash Card / semua sumber) yg sudah dibayar / verified
  const periodItems = useMemo(() => items.filter(r => {
    if (!allSources && !r.isCashCard) return false
    const d = periodDate(r); if (!d || d.getMonth()!==month || d.getFullYear()!==year) return false
    return ['done','paid','verified'].includes(r.status)
  }).sort((a,b)=>(periodDate(a)?.getTime()||0)-(periodDate(b)?.getTime()||0)), [items, allSources, month, year])

  const verifiableIds = periodItems.filter(r => r.status==='done'||r.status==='paid').map(r=>r._id)
  const allVerified = periodItems.length>0 && periodItems.every(r => r.status==='verified')
  const exportsEnabled = allVerified  // disabled sampai CC Holder verify (slide 4)

  function toggleSel(id:string) { setSelected(s => { const n = new Set(s); n.has(id)?n.delete(id):n.add(id); return n }) }
  function selectAll() { setSelected(new Set(verifiableIds)) }
  function clearSel() { setSelected(new Set()) }

  async function doVerify() {
    const ids = Array.from(selected).filter(id => verifiableIds.includes(id))
    if (ids.length===0) { toast.error('Pilih minimal 1 item (status Done) untuk diverify'); return }
    if (!confirm(`Verify ${ids.length} item? Status berubah Done → Verified dan Settlement Cash Card bulan ${MONTHS[month]} ${year} akan dihitung otomatis.`)) return
    setVerifying(true)
    try {
      const r = await fetch('/api/settlement/verify', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ ids, month: month+1, year, verifiedBy: user?.name||'-' }) })
      const j = await r.json()
      if (!r.ok) { toast.error(j.error||'Gagal verify'); return }
      toast.success(`${j.data.verified} item verified · Settlement CC = Rp ${fmt(j.data.settlementTotal)}`)
      clearSel(); await load()
    } finally { setVerifying(false) }
  }

  // pindah sumber Petty <-> CC (propagasi ke reimburse + cashier + settlement)
  async function toggleSource(r:any, e:any) {
    e.stopPropagation()
    if (r.status==='verified') { toast.error('Sudah verified, tidak bisa diubah'); return }
    const toCC = !r.isCashCard
    if (!confirm(`Ubah sumber "${r.title}" ke ${toCC?'Cash Card':'Petty Cash'}?`)) return
    await fetch(`/api/reimbursements/${r._id}`, { method:'PATCH', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ isCashCard: toCC, source: toCC?'cash_card':'petty_cash' }) })
    toast.success('Sumber diperbarui'); await load()
  }

  async function exportXLSX() {
    if (!exportsEnabled) return
    setExporting(true)
    try {
      const ExcelJS = (await import('exceljs')).default
      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet('Rekapan Excel')
      ws.columns = [{width:6.5},{width:9.3},{width:72},{width:31},{width:29.5},{width:20},{width:17.8},{width:86.5}]
      const periodeStr = `${MONTHS[month].toUpperCase()} ${year}`

      // Ambil data Cash Card bulan ini utk header (Ref id, Total Penarikan, Periode)
      let cc:any = null
      try { const ccr = await fetch('/api/cashcard').then(r=>r.json()); cc = (ccr.data||[]).find((x:any)=>x.year===year && x.month===(month+1)) } catch {}

      // Nama di header = user dengan role 'manager' (mis. Erly). Fallback ke user yg export.
      let managerName = user?.name || '-'
      try {
        const ur = await fetch('/api/users').then(r=>r.json())
        const mgr = (ur.data||[]).find((u:any)=> (u.roles||[]).includes('manager') || u.role==='manager')
        if (mgr?.name) managerName = mgr.name
      } catch {}

      const title = (t:string)=>({ font:{ bold:true }, alignment:{ horizontal:'center' as const } })
      ws.mergeCells('A1:H1'); ws.getCell('A1').value = 'RINCIAN KUITANSI/NOTA SETTLEMENT CASH CARD'; Object.assign(ws.getCell('A1'), title(''))
      ws.mergeCells('A2:H2'); ws.getCell('A2').value = `REALISASI BIAYA OPERATIONAL FUNGSI BPD PROCUREMENT PERIODE ${periodeStr}`; Object.assign(ws.getCell('A2'), title(''))
      ws.mergeCells('A3:H3'); ws.getCell('A3').value = 'Lokasi : Gedung Sopo Del Office Tower A Lt. 52'; ws.getCell('A3').alignment = { horizontal:'center' }
      ws.getCell('A5').value = 'Nama'; ws.getCell('B5').value = `: ${managerName}`
      ws.getCell('A6').value = 'Ref id'; ws.getCell('B6').value = cc?.jojonomicId || ''
      ws.getCell('A8').value = 'Total Penarikan cash card :'; ws.getCell('D8').value = cc?.topUpAmount || 0
      ws.getCell('E8').value = 'Periode Pengambilan Cash Card '; ws.getCell('F8').value = `${MONTHS[month]} ${year}`
      ws.getCell('A10').value = 'Notes :'
      ws.getCell('B10').value = 'Dokumen agar discan dengan resolusi yang jelas'
      ws.getCell('B11').value = 'Scan dokumen nota dan kuitansi disusun sesuai dengan urutan rekap penggunaan'
      ws.getCell('B12').value = 'Penggunaan Cash Card sesuai dengan Pedoman Penerapan SSC'

      const headers = ['NO','Kategori','Keterangan Transaksi \n(per nota/struk/kuitansi)','Nama Toko/Penjual/Penerima','Tanggal','Jumlah','GL  Number','Keterangan']
      const hr = ws.getRow(14)
      headers.forEach((h,i)=>{ const c = hr.getCell(i+1); c.value = h; c.font = { bold:true }; c.alignment = { horizontal:'center', vertical:'middle', wrapText:true }; c.border = boxBorder() })
      hr.height = 30
      ws.getCell('A16').value = 'Klasifikasi/Jenis Kegiatan'; ws.mergeCells('A16:E16'); ws.getCell('A16').font = { italic:true }

      let row = 17
      periodItems.forEach((r,i) => {
        const d = periodDate(r)
        const rr = ws.getRow(row)
        rr.getCell(1).value = i+1
        rr.getCell(2).value = oeExcelCode(r.category)
        rr.getCell(3).value = oeLookup(r.category).name
        rr.getCell(4).value = r.description || r.bank || '-'
        rr.getCell(5).value = d ? new Date(d.getFullYear(), d.getMonth(), d.getDate()) : ''
        rr.getCell(5).numFmt = 'dd/mm/yyyy'
        rr.getCell(6).value = r.amount || 0; rr.getCell(6).numFmt = '#,##0'
        rr.getCell(7).value = 6001016170
        rr.getCell(8).value = r.title || '-'
        for (let c=1;c<=8;c++) rr.getCell(c).border = boxBorder()
        row++
      })
      const totalRow = ws.getRow(row)
      ws.mergeCells(`A${row}:E${row}`); totalRow.getCell(1).value = 'Total'; totalRow.getCell(1).font = { bold:true }; totalRow.getCell(1).alignment = { horizontal:'right' }
      totalRow.getCell(6).value = { formula:`SUM(F17:F${row-1})` } as any; totalRow.getCell(6).numFmt = '#,##0'; totalRow.getCell(6).font = { bold:true }
      for (let c=1;c<=8;c++) totalRow.getCell(c).border = boxBorder()

      // Legend
      let lg = row + 2
      ws.getCell(`B${lg}`).value = 'Keterangan Kategori:'; ws.getCell(`B${lg}`).font = { bold:true }
      const legend = [
        'NOE7 = Non Core Activity (BAPOR, Komunitas, Etc)',
        'OE7 = Meal, Drink, dan Snack',
        'OE8 = Relationship internal/external (karangan buka dukacita, ucapan selamat)',
        'OE1 = Transportasi',
      ]
      legend.forEach((t,i)=>{ ws.getCell(`B${lg+1+i}`).value = t })

      const buf = await wb.xlsx.writeBuffer()
      downloadBlob(new Blob([buf], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `Rincian_Settlement_${MONTHS[month]}_${year}_BPD_Procurement.xlsx`)
      toast.success('Excel settlement diunduh')
    } catch (e:any) { toast.error('Gagal export Excel: '+(e?.message||'')) } finally { setExporting(false) }
  }

  async function exportPDF() {
    if (!exportsEnabled) return
    try {
      const mod:any = await import('jspdf'); const JsPDF = mod.jsPDF || mod.default
      const doc = new JsPDF({ orientation:'landscape', unit:'mm', format:'a4' })
      const pageW = doc.internal.pageSize.getWidth()
      doc.setFontSize(12); doc.setFont('helvetica','bold')
      doc.text('RINCIAN KUITANSI/NOTA SETTLEMENT CASH CARD', pageW/2, 12, { align:'center' })
      doc.setFontSize(8); doc.setFont('helvetica','normal')
      doc.text(`REALISASI BIAYA OPERATIONAL FUNGSI BPD PROCUREMENT PERIODE ${MONTHS[month].toUpperCase()} ${year}`, pageW/2, 18, { align:'center' })
      let managerName = user?.name || '-'
      try { const ur = await fetch('/api/users').then(r=>r.json()); const mgr=(ur.data||[]).find((u:any)=>(u.roles||[]).includes('manager')||u.role==='manager'); if (mgr?.name) managerName = mgr.name } catch {}
      doc.text(`Nama: ${managerName}`, 12, 26)

      const cols = [
        { h:'NO', w:10 }, { h:'Kat', w:14 }, { h:'Keterangan Transaksi', w:55 }, { h:'Nama Toko/Penerima', w:45 },
        { h:'Tanggal', w:22 }, { h:'Jumlah', w:26 }, { h:'GL Number', w:26 }, { h:'Keterangan', w:75 },
      ]
      let x0 = 12, y = 32
      doc.setFillColor(37,99,235); doc.setTextColor(255,255,255); doc.setFontSize(7); doc.setFont('helvetica','bold')
      let cx = x0
      cols.forEach(c => { doc.rect(cx, y, c.w, 7, 'F'); doc.text(c.h, cx+1.5, y+4.7); cx += c.w })
      y += 7
      doc.setTextColor(20,20,20); doc.setFont('helvetica','normal')
      const lineH = 6
      periodItems.forEach((r,i) => {
        if (y > 185) { doc.addPage(); y = 16 }
        const d = periodDate(r)
        const cells = [ String(i+1), oeExcelCode(r.category), (oeLookup(r.category).name||'').slice(0,42), (r.description||'-').slice(0,34),
          d?d.toLocaleDateString('id-ID'):'-', fmt(r.amount), '6001016170', (r.title||'-').slice(0,58) ]
        cx = x0
        cols.forEach((c,ci) => { doc.rect(cx, y, c.w, lineH); doc.text(String(cells[ci]), cx+1.5, y+4); cx += c.w })
        y += lineH
      })
      // total
      if (y > 185) { doc.addPage(); y = 16 }
      const totalW = cols.slice(0,5).reduce((s,c)=>s+c.w,0)
      doc.setFont('helvetica','bold'); doc.rect(x0, y, totalW, lineH); doc.text('Total', x0+totalW-12, y+4)
      doc.rect(x0+totalW, y, cols[5].w, lineH); doc.text(fmt(totalNominal), x0+totalW+1.5, y+4)
      doc.save(`Rincian_Settlement_${MONTHS[month]}_${year}.pdf`)
      toast.success('PDF settlement diunduh')
    } catch (e:any) { toast.error('Gagal export PDF: '+(e?.message||'')) }
  }

  async function exportZIP() {
    if (!exportsEnabled) return
    const withDocs = periodItems.filter(hasEvidence)
    if (withDocs.length === 0) { toast.error('Tidak ada evidence untuk di-ZIP'); return }
    setZipping(true)
    try {
      const JSZip = (await import('jszip')).default; const zip = new JSZip()
      withDocs.forEach((r, i) => {
        const folder = zip.folder(`${String(i+1).padStart(3,'0')}_${safeName(r.title)}`); if (!folder) return
        r.documents.forEach((doc:any, di:number) => {
          const parsed = parseDataUrl(doc.url); const base = safeName(doc.name || `evidence_${di+1}`)
          if (parsed) folder.file(base + extForMime(parsed.mime, base), parsed.base64, { base64:true })
          else if (doc.url) folder.file(base + '.url.txt', doc.url)
        })
      })
      const blob = await zip.generateAsync({ type:'blob' })
      downloadBlob(blob, `Evidence_Settlement_${MONTHS[month]}_${year}.zip`)
      toast.success(`ZIP siap (${withDocs.length} transaksi)`)
    } catch { toast.error('Gagal membuat ZIP') } finally { setZipping(false) }
  }

  const totalNominal = periodItems.reduce((s,r)=>s+(r.amount||0),0)

  return (
    <>
      {viewing && <DetailModal item={viewing} onClose={()=>setViewing(null)} />}

      <div style={{ padding:'10px 20px', borderBottom:'1px solid var(--border)', background:'var(--bg2)', display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12, flexWrap:'wrap', flexShrink:0 }}>
        <div style={{ fontSize:11, color:'var(--text3)', maxWidth:420 }}>Pilih item (status Done) lalu <b>Verify</b> untuk mengunci & menghitung Settlement Cash Card. Export aktif setelah semua item periode ini verified.</div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          <button onClick={exportXLSX} className="btn btn-sm btn-primary" disabled={!exportsEnabled||exporting}>{exporting?'...':'📗 Export Excel'}</button>
          <button onClick={exportPDF} className="btn btn-sm" disabled={!exportsEnabled}>📄 Export PDF</button>
          <button onClick={exportZIP} className="btn btn-sm" disabled={!exportsEnabled||zipping}>{zipping?'...':'🗜 Evidence (ZIP)'}</button>
        </div>
      </div>

      <div style={{ display:'flex', gap:10, padding:'10px 20px', background:'var(--bg2)', borderBottom:'1px solid var(--border)', flexWrap:'wrap', alignItems:'center', flexShrink:0 }}>
        <select className="input input-sm" style={{ width:130 }} value={month} onChange={e=>{setMonth(Number(e.target.value));clearSel()}}>
          {MONTHS.map((m,i)=><option key={i} value={i}>{m}</option>)}
        </select>
        <select className="input input-sm" style={{ width:90 }} value={year} onChange={e=>{setYear(Number(e.target.value));clearSel()}}>
          {yearOptions.map(y=><option key={y} value={y}>{y}</option>)}
        </select>
        <div style={{ display:'flex', gap:5, marginLeft:6 }}>
          <button onClick={()=>setAllSources(false)} style={chip(!allSources)}>Cash Card</button>
          <button onClick={()=>setAllSources(true)} style={chip(allSources)}>Semua Sumber</button>
        </div>
        <div style={{ marginLeft:'auto', display:'flex', gap:6, alignItems:'center' }}>
          {allVerified
            ? <span className="badge" style={{ background:'var(--brand-soft)', color:'var(--brand)', fontSize:10 }}>✓ Semua Verified</span>
            : <>
                <button onClick={selectAll} className="btn btn-sm">Select All ({verifiableIds.length})</button>
                <button onClick={doVerify} disabled={verifying||selected.size===0} className="btn btn-sm btn-primary">{verifying?'...':`✓ Verify (${selected.size})`}</button>
              </>}
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'14px 20px' }} className="safe-bottom page-pad">
        <div style={{ fontSize:11, color:'var(--text3)', marginBottom:8 }}>{periodItems.length} transaksi · Total Rp {fmt(totalNominal)}</div>
        {loading ? <div style={{ textAlign:'center', padding:40, color:'var(--text3)' }}>Memuat...</div> :
         periodItems.length === 0 ? (
          <div className="card" style={{ textAlign:'center', padding:40, color:'var(--text3)' }}><div style={{ fontSize:30, marginBottom:8 }}>🧾</div><div>Tidak ada transaksi pada {MONTHS[month]} {year}</div></div>
         ) : (
          <div className="card" style={{ overflow:'auto' }}>
            <table className="wp-table" style={{ minWidth:1040 }}>
              <thead><tr>
                <th style={{ width:34 }}><input type="checkbox" checked={selected.size>0 && selected.size===verifiableIds.length} onChange={e=>e.target.checked?selectAll():clearSel()} disabled={verifiableIds.length===0} /></th>
                <th>No</th><th>Tanggal</th><th>Pengaju</th><th>Keperluan</th><th>Kategori</th><th>Nominal</th><th>Sumber</th><th>Status</th><th>Evidence</th><th></th>
              </tr></thead>
              <tbody>
                {periodItems.map((r,i) => {
                  const lengkap = hasEvidence(r); const canVerify = r.status==='done'||r.status==='paid'
                  return (
                    <tr key={r._id} style={{ cursor:'pointer' }} onClick={()=>setViewing(r)}>
                      <td onClick={e=>e.stopPropagation()}>{canVerify ? <input type="checkbox" checked={selected.has(r._id)} onChange={()=>toggleSel(r._id)} /> : <span style={{ color:'var(--brand)', fontSize:11 }}>🔒</span>}</td>
                      <td style={{ fontSize:11, color:'var(--text3)' }}>{i+1}</td>
                      <td style={{ fontSize:11, color:'var(--text2)' }}>{(()=>{ const d=periodDate(r); return d?d.toLocaleDateString('id-ID'):'—' })()}</td>
                      <td style={{ fontSize:11 }}>{r.userName||'—'}</td>
                      <td style={{ fontSize:11, fontWeight:600 }}>{r.title}</td>
                      <td style={{ fontSize:10 }}>{oeExcelCode(r.category)}</td>
                      <td style={{ fontWeight:600 }}>Rp {fmt(r.amount)}</td>
                      <td onClick={e=>e.stopPropagation()}>
                        <button onClick={(e)=>toggleSource(r,e)} className="badge" title="Klik untuk pindah sumber" style={{ cursor:r.status==='verified'?'default':'pointer', border:'none', background:r.isCashCard?'var(--brand-soft)':'var(--bg3)', color:r.isCashCard?'var(--brand)':'var(--text2)', fontSize:9 }}>{r.isCashCard?'Cash Card':'Petty Cash'} {r.status!=='verified' && '⇄'}</button>
                      </td>
                      <td>{statusBadge(r.status)}</td>
                      <td><span className="badge" style={{ background:lengkap?'var(--greenbg)':'var(--redbg)', color:lengkap?'var(--green)':'var(--red)', fontSize:9 }}>{lengkap?`Lengkap · ${evidenceCount(r)}`:'Belum'}</span></td>
                      <td onClick={e=>e.stopPropagation()}><button onClick={()=>setViewing(r)} className="btn btn-sm" style={{ fontSize:10 }}>Lihat</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
         )}
      </div>
    </>
  )
}

// =====================  PETTY CASH  =====================
function PettyCashTab() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth())  // 0-11
  const [year, setYear] = useState(now.getFullYear())
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { const r = await fetch(`/api/pettycash?year=${year}&month=${month+1}`).then(r=>r.json()); setData(r.data) }
    catch { toast.error('Gagal memuat petty cash') } finally { setLoading(false) }
  }, [year, month])
  useEffect(() => { load() }, [load])

  const s = data?.summary || { pemasukan:0, nonCCAmount:0, bankFees:0, ccSelisih:0, pengeluaran:0, saldo:0 }

  return (
    <>
      {editing && <InflowEditor year={year} initial={data?.inflows||[]} onClose={()=>setEditing(false)} onSaved={()=>{setEditing(false);load()}} />}
      <div style={{ display:'flex', gap:10, padding:'10px 20px', background:'var(--bg2)', borderBottom:'1px solid var(--border)', flexWrap:'wrap', alignItems:'center', flexShrink:0 }}>
        <span style={{ fontSize:11, color:'var(--text3)' }}>Saldo kumulatif s/d:</span>
        <select className="input input-sm" style={{ width:130 }} value={month} onChange={e=>setMonth(Number(e.target.value))}>
          {MONTHS.map((m,i)=><option key={i} value={i}>{m}</option>)}
        </select>
        <select className="input input-sm" style={{ width:90 }} value={year} onChange={e=>setYear(Number(e.target.value))}>
          {[now.getFullYear(), now.getFullYear()-1, now.getFullYear()+1].sort((a,b)=>b-a).map(y=><option key={y} value={y}>{y}</option>)}
        </select>
        <button onClick={()=>setEditing(true)} className="btn btn-sm btn-primary" style={{ marginLeft:'auto' }}>+ Saldo Awal / Pemasukan</button>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'16px 20px' }} className="safe-bottom page-pad">
        {loading ? <div style={{ textAlign:'center', padding:40, color:'var(--text3)' }}>Memuat...</div> : (
          <>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px,1fr))', gap:12, marginBottom:16 }}>
              <BigCard label="Pemasukan (kumulatif)" value={`Rp ${fmt(s.pemasukan)}`} color="var(--green)" />
              <BigCard label="Pengeluaran (kumulatif)" value={`Rp ${fmt(s.pengeluaran)}`} color="var(--red)" />
              <BigCard label="Saldo Petty Cash" value={`Rp ${fmt(s.saldo)}`} color="var(--brand)" big />
            </div>
            <div className="card" style={{ padding:'14px 16px', marginBottom:16 }}>
              <div style={{ fontSize:12, fontWeight:600, marginBottom:10 }}>Rincian Pengeluaran s/d {MONTHS[month]} {year}</div>
              <Row label="Reimburse non-Cash Card (nominal, done/verified)" value={s.nonCCAmount} />
              <Row label="Biaya antar bank (semua reimburse: CC + Petty)" value={s.bankFees} />
              <Row label="Selisih Cash Card |Pengembalian − (Top Up − Settlement)|" value={s.ccSelisih} />
              <div style={{ borderTop:'1px solid var(--border)', marginTop:8, paddingTop:8 }}><Row label="Total Pengeluaran" value={s.pengeluaran} bold /></div>
            </div>
            <div className="card" style={{ padding:'14px 16px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                <div style={{ fontSize:12, fontWeight:600 }}>Daftar Pemasukan {year}</div>
                <button onClick={()=>setEditing(true)} className="btn btn-sm">Edit</button>
              </div>
              {(data?.inflows||[]).length===0 ? <div style={{ fontSize:12, color:'var(--text3)' }}>Belum ada pemasukan dicatat.</div> : (
                <table className="wp-table"><thead><tr><th>Tanggal</th><th>Sumber</th><th>Catatan</th><th>Jumlah</th></tr></thead>
                  <tbody>{(data.inflows||[]).map((f:any,i:number)=>(
                    <tr key={i}><td style={{ fontSize:11 }}>{f.date?new Date(f.date).toLocaleDateString('id-ID'):'—'}</td><td style={{ fontSize:11 }}>{f.source||'—'}</td><td style={{ fontSize:11, color:'var(--text3)' }}>{f.notes||''}</td><td style={{ fontWeight:600 }}>Rp {fmt(f.amount)}</td></tr>
                  ))}</tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}

function InflowEditor({ year, initial, onClose, onSaved }: { year:number; initial:any[]; onClose:()=>void; onSaved:()=>void }) {
  const [rows, setRows] = useState<any[]>(initial.length?initial.map(r=>({...r})):[{ date:'', amount:0, source:'Saldo Awal', notes:'' }])
  const [saving, setSaving] = useState(false)
  const upd = (i:number,k:string,v:any)=>setRows(rs=>rs.map((r,idx)=>idx===i?{...r,[k]:v}:r))
  const add = ()=>setRows(rs=>[...rs,{ date:'', amount:0, source:'', notes:'' }])
  const del = (i:number)=>setRows(rs=>rs.filter((_,idx)=>idx!==i))
  async function save() {
    setSaving(true)
    try {
      const clean = rows.filter(r=>Number(r.amount)>0).map(r=>({ date:r.date, amount:Number(r.amount), source:r.source||'', notes:r.notes||'' }))
      const r = await fetch('/api/pettycash', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ year, inflows: clean }) })
      if (!r.ok) { toast.error('Gagal menyimpan'); return }
      toast.success('Pemasukan disimpan'); onSaved()
    } finally { setSaving(false) }
  }
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ width:640 }}>
        <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between' }}>
          <span style={{ fontSize:14, fontWeight:600 }}>Pemasukan / Saldo Awal Petty Cash {year}</span>
          <button onClick={onClose} className="btn btn-icon">×</button>
        </div>
        <div style={{ padding:'14px 20px', maxHeight:'70vh', overflowY:'auto', display:'flex', flexDirection:'column', gap:8 }}>
          {rows.map((r,i)=>(
            <div key={i} style={{ display:'grid', gridTemplateColumns:'130px 1fr 1fr 130px 32px', gap:8, alignItems:'center' }}>
              <input type="date" className="input input-sm" value={r.date} onChange={e=>upd(i,'date',e.target.value)} />
              <input className="input input-sm" placeholder="Sumber (Saldo Awal/Top Up)" value={r.source} onChange={e=>upd(i,'source',e.target.value)} />
              <input className="input input-sm" placeholder="Catatan" value={r.notes} onChange={e=>upd(i,'notes',e.target.value)} />
              <input type="number" className="input input-sm" placeholder="Jumlah" value={r.amount} onChange={e=>upd(i,'amount',e.target.value)} />
              <button onClick={()=>del(i)} className="btn btn-icon btn-sm" style={{ color:'var(--red)' }}>×</button>
            </div>
          ))}
          <button onClick={add} className="btn btn-sm" style={{ alignSelf:'flex-start' }}>+ Baris</button>
        </div>
        <div style={{ padding:'12px 20px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'flex-end', gap:8 }}>
          <button onClick={onClose} className="btn">Batal</button>
          <button onClick={save} disabled={saving} className="btn btn-primary">{saving?'...':'Simpan'}</button>
        </div>
      </div>
    </div>
  )
}

// =====================  shared  =====================
function DetailModal({ item, onClose }: { item:any; onClose:()=>void }) {
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ width:520 }}>
        <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between' }}>
          <span style={{ fontSize:14, fontWeight:600 }}>Detail & Evidence</span>
          <button onClick={onClose} className="btn btn-icon">×</button>
        </div>
        <div style={{ padding:'14px 20px', display:'flex', flexDirection:'column', gap:10, fontSize:12, maxHeight:'72vh', overflowY:'auto' }}>
          <div><b>{item.title}</b></div>
          {item.description && <div style={{ color:'var(--text2)' }}>{item.description}</div>}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, fontSize:11 }}>
            <div><span style={{ color:'var(--text3)' }}>Pengaju:</span> {item.userName||'—'}</div>
            <div><span style={{ color:'var(--text3)' }}>Nominal:</span> Rp {fmt(item.amount)}</div>
            <div><span style={{ color:'var(--text3)' }}>Kategori:</span> {oeLookup(item.category).code} · {oeLookup(item.category).name}</div>
            <div><span style={{ color:'var(--text3)' }}>Tgl Bukti:</span> {(()=>{ const d=periodDate(item); return d?d.toLocaleDateString('id-ID'):'—' })()}</div>
            <div><span style={{ color:'var(--text3)' }}>Sumber:</span> {item.isCashCard?'Cash Card':'Petty Cash'}</div>
            <div><span style={{ color:'var(--text3)' }}>Status:</span> {statusBadge(item.status)}</div>
          </div>
          <div>
            <div style={{ fontSize:11, color:'var(--text3)', marginBottom:5 }}>Evidence ({evidenceCount(item)} file):</div>
            {hasEvidence(item) ? (
              <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                {item.documents.map((d:any, i:number) => <a key={i} href={d.url} download={d.name} className="btn btn-sm" style={{ justifyContent:'flex-start', textDecoration:'none' }}>📄 {d.name||`evidence_${i+1}`}</a>)}
              </div>
            ) : <div style={{ fontSize:11, color:'var(--red)' }}>Belum ada evidence diupload.</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
function BigCard({ label, value, color, big }: { label:string; value:string; color?:string; big?:boolean }) {
  return (
    <div className="card" style={{ padding:'14px 16px', background:big?'var(--brand-soft)':undefined, border:big?'1px solid var(--brand)':undefined }}>
      <div style={{ fontSize:10, color: big?'var(--brand)':'var(--text3)', textTransform:'uppercase', letterSpacing:0.3, marginBottom:4 }}>{label}</div>
      <div style={{ fontSize: big?24:18, fontWeight: big?800:700, color: color||'var(--text)' }}>{value}</div>
    </div>
  )
}
function Row({ label, value, bold }: { label:string; value:number; bold?:boolean }) {
  return <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, padding:'3px 0', fontWeight:bold?700:400 }}><span style={{ color:bold?'var(--text)':'var(--text2)' }}>{label}</span><span>Rp {fmt(value)}</span></div>
}
function boxBorder() { const s = { style:'thin' as const, color:{argb:'FFBFBFBF'} }; return { top:s, bottom:s, left:s, right:s } }
function statusBadge(s:string) {
  const cfg: Record<string,{label:string;color:string;bg:string}> = {
    submitted:{ label:'Menunggu', color:'var(--amber)', bg:'var(--amberbg)' }, approved:{ label:'Menunggu', color:'var(--amber)', bg:'var(--amberbg)' },
    done:{ label:'Done', color:'var(--green)', bg:'var(--greenbg)' }, paid:{ label:'Done', color:'var(--green)', bg:'var(--greenbg)' },
    verified:{ label:'Verified', color:'var(--brand)', bg:'var(--brand-soft)' }, rejected:{ label:'Ditolak', color:'var(--red)', bg:'var(--redbg)' },
  }
  const c = cfg[s] || { label:s, color:'var(--text3)', bg:'var(--bg3)' }
  return <span className="badge" style={{ background:c.bg, color:c.color, fontSize:9 }}>{c.label}</span>
}
function chip(active:boolean, color:string='var(--brand)'):React.CSSProperties { return { padding:'4px 11px', borderRadius:20, fontSize:11, fontWeight:600, cursor:'pointer', border:`1px solid ${active?color:'var(--border)'}`, background:active?color+'1a':'var(--bg3)', color:active?color:'var(--text2)' } }
function subtab(active:boolean):React.CSSProperties { return { padding:'8px 16px', fontSize:12.5, fontWeight:600, cursor:'pointer', border:'none', borderBottom:`2px solid ${active?'var(--brand)':'transparent'}`, background:'transparent', color:active?'var(--brand)':'var(--text3)' } }
