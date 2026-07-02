'use client'
import { getConfig } from '@/lib/configCache'
import { oeLookup } from '@/lib/defaults'
import { allowedMenusFor, userRolesOf } from '@/lib/perms'
import { EvidenceList } from '@/components/EvidenceList'
import { MoneyInput } from '@/components/MoneyInput'
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
  const [canPetty, setCanPetty] = useState(false)
  useEffect(()=>{ let on=true; getConfig().then(c=>{ if(!on)return; const allowed=allowedMenusFor(c?.roleDefs||[], userRolesOf(user)); setCanPetty(allowed.has('pettycash')) }).catch(()=>{}) }, [user])
  // kalau lagi di tab petty tapi ga punya akses, balik ke settlement
  useEffect(()=>{ if(tab==='petty' && !canPetty) setTab('settlement') }, [tab, canPetty])
  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ padding:'12px 20px 0', borderBottom:'1px solid var(--border)', background:'var(--bg2)', flexShrink:0 }}>
        <div style={{ fontSize:14, fontWeight:600 }}>Operasional</div>
        <div style={{ display:'flex', gap:4, marginTop:10 }}>
          <button onClick={()=>setTab('settlement')} style={subtab(tab==='settlement')}>Settlement CC</button>
          {canPetty && <button onClick={()=>setTab('petty')} style={subtab(tab==='petty')}>Petty Cash</button>}
        </div>
      </div>
      {tab==='petty' && canPetty ? <PettyCashTab /> : <SettlementTab user={user} />}
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
    return ['done','paid','verified','clarification'].includes(r.status)
  }).sort((a,b)=>(periodDate(a)?.getTime()||0)-(periodDate(b)?.getTime()||0)), [items, allSources, month, year])

  const verifiableIds = periodItems.filter(r => r.status==='done'||r.status==='paid').map(r=>r._id)
  const allVerified = periodItems.length>0 && periodItems.every(r => r.status==='verified')
  const anyVerified = periodItems.some(r => r.status==='verified')
  const exportsEnabled = anyVerified  // aktif begitu minimal 1 item sudah diverify (slide 4)
  // Isi export HANYA item yang sudah diverify (yang dicentang lalu di-Verify), bukan semua periode.
  const exportItems = periodItems.filter(r => r.status === 'verified')
  const exportTotal = exportItems.reduce((s,r)=>s+(r.amount||0),0)

  function toggleSel(id:string) { setSelected(s => { const n = new Set(s); n.has(id)?n.delete(id):n.add(id); return n }) }
  function selectAll() { setSelected(new Set(verifiableIds)) }
  function clearSel() { setSelected(new Set()) }

  async function doVerify() {
    const ids = Array.from(selected).filter(id => verifiableIds.includes(id))
    if (ids.length===0) { toast.error('Pilih minimal 1 item (status Waiting for Verification) untuk diverify'); return }
    if (!confirm(`Verify ${ids.length} item? Status berubah Waiting for Verification → Verified dan Settlement Cash Card bulan ${MONTHS[month]} ${year} akan dihitung otomatis.`)) return
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

  async function verifyOne(item:any) {
    if (!verifiableIds.includes(item._id)) { toast.error('Item ini belum bisa diverify (harus status Waiting for Verification)'); return }
    if (!confirm(`Verify item "${item.title}"? Status Waiting for Verification → Verified & Settlement CC ${MONTHS[month]} ${year} dihitung ulang.`)) return
    setVerifying(true)
    try {
      const r = await fetch('/api/settlement/verify', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ ids:[item._id], month: month+1, year, verifiedBy: user?.name||'-' }) })
      const j = await r.json()
      if (!r.ok) { toast.error(j.error||'Gagal verify'); return }
      toast.success(`Verified · Settlement CC = Rp ${fmt(j.data.settlementTotal)}`)
      setViewing(null); clearSel(); await load()
    } finally { setVerifying(false) }
  }

  async function clarifyItem(item:any, note:string) {
    setVerifying(true)
    try {
      const r = await fetch('/api/reimbursements/clarify', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ id:item._id, note, clarifiedBy: user?.name||'-' }) })
      const j = await r.json()
      if (!r.ok) { toast.error(j.error||'Gagal clarify'); return }
      toast.success(j.pushed ? 'Dibalikin ke member + notif terkirim' : 'Dibalikin ke member (member belum aktifkan notif)')
      setViewing(null); await load()
    } finally { setVerifying(false) }
  }

  // pindah sumber Petty <-> CC (propagasi ke reimburse + cashier + settlement)
  async function toggleSource(r:any, e?:any) {
    e?.stopPropagation?.()
    if (r.status==='verified') { toast.error('Sudah verified — reverse dulu ke Waiting for Verification sebelum ganti sumber'); return }
    const toCC = !r.isCashCard
    if (!confirm(`Ubah sumber "${r.title}" ke ${toCC?'Cash Card':'Petty Cash'}?`)) return
    await fetch(`/api/reimbursements/${r._id}`, { method:'PATCH', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ isCashCard: toCC, source: toCC?'cash_card':'petty_cash' }) })
    toast.success('Sumber diperbarui'); await load()
  }

  async function reverseItem(r:any) {
    if (r.status!=='verified') return
    if (!confirm(`Reverse "${r.title}" dari Verified kembali ke Waiting for Verification? Settlement Cash Card bulan itu akan dihitung ulang.`)) return
    const res = await fetch('/api/settlement/reverse', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id: r._id }) })
    const j = await res.json()
    if (!res.ok) { toast.error(j.error||'Gagal reverse'); return }
    toast.success('Reverse berhasil — status kembali Waiting for Verification'); setViewing(null); await load()
  }

  async function exportXLSX() {
    if (!exportsEnabled) { toast.error('Export aktif setelah minimal 1 item diverify dulu'); return }
    setExporting(true)
    try {
      const _xlmod:any = await import('exceljs'); const ExcelJS = _xlmod.default || _xlmod
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
      exportItems.forEach((r,i) => {
        const d = periodDate(r)
        const rr = ws.getRow(row)
        rr.getCell(1).value = i+1
        rr.getCell(2).value = oeExcelCode(r.category)
        rr.getCell(3).value = oeLookup(r.category).name
        rr.getCell(4).value = r.tokoPenjual || r.description || '-'
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
    if (!exportsEnabled) { toast.error('Export aktif setelah minimal 1 item diverify dulu'); return }
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
      exportItems.forEach((r,i) => {
        if (y > 185) { doc.addPage(); y = 16 }
        const d = periodDate(r)
        const cells = [ String(i+1), oeExcelCode(r.category), (oeLookup(r.category).name||'').slice(0,42), (r.tokoPenjual||r.description||'-').slice(0,34),
          d?d.toLocaleDateString('id-ID'):'-', fmt(r.amount), '6001016170', (r.title||'-').slice(0,58) ]
        cx = x0
        cols.forEach((c,ci) => { doc.rect(cx, y, c.w, lineH); doc.text(String(cells[ci]), cx+1.5, y+4); cx += c.w })
        y += lineH
      })
      // total
      if (y > 185) { doc.addPage(); y = 16 }
      const totalW = cols.slice(0,5).reduce((s,c)=>s+c.w,0)
      doc.setFont('helvetica','bold'); doc.rect(x0, y, totalW, lineH); doc.text('Total', x0+totalW-12, y+4)
      doc.rect(x0+totalW, y, cols[5].w, lineH); doc.text(fmt(exportTotal), x0+totalW+1.5, y+4)
      doc.save(`Rincian_Settlement_${MONTHS[month]}_${year}.pdf`)
      toast.success('PDF settlement diunduh')
    } catch (e:any) { toast.error('Gagal export PDF: '+(e?.message||'')) }
  }

  async function exportZIP() {
    const selItems = periodItems.filter(r => selected.has(r._id))
    if (selItems.length === 0) { toast.error('Centang dulu item yang mau diunduh evidence-nya'); return }
    const withDocs = selItems.filter(hasEvidence)
    if (withDocs.length === 0) { toast.error('Item yang dicentang belum ada evidence'); return }
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
      {viewing && <DetailModal item={viewing} onClose={()=>setViewing(null)}
        onToggleSource={async (r:any)=>{ await toggleSource(r); setViewing(null) }}
        onVerify={verifyOne}
        onClarify={clarifyItem}
        onReverse={reverseItem} />}

      <div style={{ padding:'10px 20px', borderBottom:'1px solid var(--border)', background:'var(--bg2)', display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12, flexWrap:'wrap', flexShrink:0 }}>
        <div style={{ fontSize:11, color:'var(--text3)', maxWidth:520 }}>Alur: <b>centang</b> item Waiting for Verification → <b>Evidence</b> (unduh lampiran yg dicentang, cek manual) → <b>Verify</b> (status jadi Verified) → baru <b>Export Excel/PDF</b> aktif.</div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          <button onClick={exportXLSX} className="btn btn-sm btn-primary" disabled={exporting} style={{ opacity: exportsEnabled?1:0.55 }}>{exporting?'...':'📗 Export Excel'}</button>
          <button onClick={exportPDF} className="btn btn-sm" style={{ opacity: exportsEnabled?1:0.55 }}>📄 Export PDF</button>
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
                <button onClick={exportZIP} disabled={zipping} className="btn btn-sm" title="Unduh evidence item yang dicentang">{zipping?'...':`🗜 Evidence (${selected.size})`}</button>
                <button onClick={doVerify} disabled={verifying||selected.size===0} className="btn btn-sm btn-primary">{verifying?'...':`✓ Verify (${selected.size})`}</button>
              </>}
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'14px 20px' }} className="safe-bottom page-pad">
        <div style={{ fontSize:11, color:'var(--text3)', marginBottom:8 }}>{periodItems.length} transaksi · Total Rp {fmt(totalNominal)} · <span style={{ color:'var(--brand)' }}>Export: {exportItems.length} item verified (Rp {fmt(exportTotal)})</span></div>
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
  const [rincian, setRincian] = useState<null|'noncc'|'bankfee'|'cc'>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try { const r = await fetch(`/api/pettycash?year=${year}&month=${month+1}`).then(r=>r.json()); setData(r.data) }
    catch { toast.error('Gagal memuat petty cash') } finally { setLoading(false) }
  }, [year, month])
  useEffect(() => { load() }, [load])

  const s = data?.summary || { pemasukan:0, nonCCAmount:0, bankFees:0, ccOperasional:0, pengeluaran:0, saldo:0 }

  return (
    <>
      {editing && <InflowEditor year={year} initial={data?.inflows||[]} onClose={()=>setEditing(false)} onSaved={()=>{setEditing(false);load()}} />}
      {rincian && <RincianModal kind={rincian} detail={data?.detail} summary={s} month={month} year={year} onClose={()=>setRincian(null)} />}
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
              <div style={{ fontSize:12, fontWeight:600, marginBottom:10 }}>Rincian Pengeluaran s/d {MONTHS[month]} {year} <span style={{ fontWeight:400, color:'var(--text3)', fontSize:10 }}>· klik baris untuk lihat rincian</span></div>
              <Row label="Reimburse non-Cash Card (nominal, done/verified)" value={s.nonCCAmount} onClick={()=>setRincian('noncc')} />
              <Row label="Biaya antar bank (semua reimburse: CC + Petty)" value={s.bankFees} onClick={()=>setRincian('bankfee')} />
              <Row label="Selisih Biaya Settlement Cash Card (total Pengeluaran Operasional)" value={s.ccOperasional} onClick={()=>setRincian('cc')} />
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
              <MoneyInput currency="IDR" className="input input-sm" placeholder="Jumlah" value={Number(r.amount)||0} onChange={n=>upd(i,'amount',n)} />
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
function DetailModal({ item, onClose, onToggleSource, onVerify, onReverse, onClarify }: { item:any; onClose:()=>void; onToggleSource?:(r:any)=>void; onVerify?:(r:any)=>void; onReverse?:(r:any)=>void; onClarify?:(r:any, note:string)=>void }) {
  const isVerified = item.status==='verified'
  const isClarification = item.status==='clarification'
  const [clarifyMode, setClarifyMode] = useState(false)
  const [note, setNote] = useState('')
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
          {isClarification && item.clarifyNote && (
            <div style={{ fontSize:11, background:'#fff3e0', border:'1px solid #f0c07a', borderRadius:8, padding:'8px 10px', color:'#8a5300' }}>
              <b>Sedang menunggu revisi member.</b><br/>Catatan klarifikasi kamu: “{item.clarifyNote}”
            </div>
          )}
          <div>
            <EvidenceList documents={item.documents||[]} zipName={`evidence_${(item.title||'reimburse').replace(/\s+/g,'_')}`} />
          </div>
          {clarifyMode && (
            <div>
              <label style={{ fontSize:11, color:'var(--text3)', display:'block', marginBottom:4 }}>Catatan untuk member (info evidence yang kurang / perlu diperbaiki)</label>
              <textarea value={note} onChange={e=>setNote(e.target.value)} rows={3} className="input" autoFocus
                placeholder="Contoh: Invoice belum ada tanda tangan/stempel. Mohon lampirkan ulang."
                style={{ width:'100%', fontSize:12, resize:'vertical', fontFamily:'inherit' }} />
            </div>
          )}
        </div>
        <div style={{ padding:'12px 20px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'flex-end', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          {isVerified ? (
            onReverse && <button onClick={()=>onReverse(item)} className="btn btn-sm" style={{ color:'var(--amber)' }} title="Mundurkan status ke Waiting for Verification">↩️ Reverse ke Waiting for Verification</button>
          ) : isClarification ? (
            <span style={{ fontSize:11, color:'var(--text3)' }}>Menunggu member merevisi & mengirim ulang.</span>
          ) : clarifyMode ? (
            <>
              <button onClick={()=>{ setClarifyMode(false); setNote('') }} className="btn btn-sm">Batal</button>
              <button onClick={()=>{ if(!note.trim()){ toast.error('Isi catatan klarifikasi dulu'); return } onClarify && onClarify(item, note.trim()) }} className="btn btn-sm btn-primary" title="Balikin ke member dengan catatan">↩️ Submit Klarifikasi</button>
            </>
          ) : (
            <>
              {onClarify && <button onClick={()=>setClarifyMode(true)} className="btn btn-sm" style={{ color:'#b45309' }} title="Balikin ke member karena evidence kurang">🔄 Clarify</button>}
              {onToggleSource && <button onClick={()=>onToggleSource(item)} className="btn btn-sm" title="Pindah sumber dana">⇄ Ubah ke {item.isCashCard?'Petty Cash':'Cash Card'}</button>}
              {onVerify && <button onClick={()=>onVerify(item)} className="btn btn-sm btn-primary" title="Verify item ini">✓ Verify</button>}
            </>
          )}
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
function Row({ label, value, bold, onClick }: { label:string; value:number; bold?:boolean; onClick?:()=>void }) {
  return (
    <div onClick={onClick} style={{ display:'flex', justifyContent:'space-between', fontSize:12, padding:'5px 0', fontWeight:bold?700:400, cursor:onClick?'pointer':'default', borderRadius:6 }}
      onMouseEnter={e=>{ if(onClick) (e.currentTarget as HTMLElement).style.background='var(--bg3)' }}
      onMouseLeave={e=>{ (e.currentTarget as HTMLElement).style.background='transparent' }}>
      <span style={{ color:bold?'var(--text)':'var(--text2)' }}>{onClick && <span style={{ color:'var(--brand)', marginRight:4 }}>🔍</span>}{label}</span>
      <span>Rp {fmt(value)}</span>
    </div>
  )
}
function RincianModal({ kind, detail, summary, month, year, onClose }:
  { kind:'noncc'|'bankfee'|'cc'; detail:any; summary:any; month:number; year:number; onClose:()=>void }) {
  const d = detail || {}
  const title = kind==='noncc' ? 'Reimburse non-Cash Card' : kind==='bankfee' ? 'Biaya Antar Bank' : 'Selisih Biaya Settlement Cash Card'
  const total = kind==='noncc' ? summary.nonCCAmount : kind==='bankfee' ? summary.bankFees : summary.ccOperasional
  const fmtDate = (x:any)=> x ? new Date(x).toLocaleDateString('id-ID') : '—'

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ width:640, maxHeight:'82vh', display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontSize:14, fontWeight:600 }}>{title}</div>
            <div style={{ fontSize:10, color:'var(--text3)' }}>Rincian s/d {MONTHS[month]} {year}</div>
          </div>
          <button onClick={onClose} className="btn btn-icon">×</button>
        </div>
        <div style={{ flex:1, overflow:'auto', padding:'8px 20px' }}>
          {kind==='noncc' && (
            <table className="wp-table" style={{ width:'100%' }}>
              <thead><tr><th>Tanggal</th><th>Pengaju</th><th>Keperluan</th><th>Kategori</th><th style={{ textAlign:'right' }}>Nominal</th></tr></thead>
              <tbody>
                {(d.nonCCItems||[]).length===0 ? <tr><td colSpan={5} style={{ textAlign:'center', color:'var(--text3)', padding:20 }}>Tidak ada data</td></tr> :
                 (d.nonCCItems||[]).map((it:any,i:number)=>(
                  <tr key={i}><td style={{ fontSize:11 }}>{fmtDate(it.date)}</td><td style={{ fontSize:11 }}>{it.userName}</td><td style={{ fontSize:11 }}>{it.title}</td><td style={{ fontSize:11 }}>{oeLookup(it.category).name}</td><td style={{ textAlign:'right', fontWeight:600 }}>Rp {fmt(it.amount)}</td></tr>
                ))}
              </tbody>
            </table>
          )}
          {kind==='bankfee' && (
            <table className="wp-table" style={{ width:'100%' }}>
              <thead><tr><th>Tanggal</th><th>Pengaju</th><th>Keperluan</th><th>Sumber</th><th style={{ textAlign:'right' }}>Biaya</th></tr></thead>
              <tbody>
                {(d.bankFeeItems||[]).length===0 ? <tr><td colSpan={5} style={{ textAlign:'center', color:'var(--text3)', padding:20 }}>Tidak ada data</td></tr> :
                 (d.bankFeeItems||[]).map((it:any,i:number)=>(
                  <tr key={i}><td style={{ fontSize:11 }}>{fmtDate(it.date)}</td><td style={{ fontSize:11 }}>{it.userName}</td><td style={{ fontSize:11 }}>{it.title}</td><td style={{ fontSize:11 }}>{it.isCashCard?'Cash Card':'Petty Cash'}</td><td style={{ textAlign:'right', fontWeight:600 }}>Rp {fmt(it.fee)}</td></tr>
                ))}
              </tbody>
            </table>
          )}
          {kind==='cc' && (
            <>
              <div style={{ fontSize:10, color:'var(--text3)', margin:'6px 0 10px' }}>Per bulan: |Pengembalian − (Top Up − Settlement)|. Identik dengan kolom Pengeluaran Operasional di menu Cash Card.</div>
              <table className="wp-table" style={{ width:'100%' }}>
                <thead><tr><th>Bulan</th><th style={{ textAlign:'right' }}>Top Up</th><th style={{ textAlign:'right' }}>Settlement</th><th style={{ textAlign:'right' }}>Pengembalian</th><th style={{ textAlign:'right' }}>Operasional</th></tr></thead>
                <tbody>
                  {(d.ccItems||[]).length===0 ? <tr><td colSpan={5} style={{ textAlign:'center', color:'var(--text3)', padding:20 }}>Tidak ada data</td></tr> :
                   (d.ccItems||[]).map((it:any,i:number)=>(
                    <tr key={i}><td style={{ fontSize:11, fontWeight:600 }}>{MONTHS[it.month-1]}</td><td style={{ textAlign:'right' }}>Rp {fmt(it.topUp)}</td><td style={{ textAlign:'right' }}>Rp {fmt(it.settlement)}</td><td style={{ textAlign:'right' }}>Rp {fmt(it.refund)}</td><td style={{ textAlign:'right', fontWeight:600, color:'var(--red)' }}>Rp {fmt(it.operasional)}</td></tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
        <div style={{ padding:'12px 20px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontSize:12, fontWeight:700 }}>Total</span>
          <span style={{ fontSize:14, fontWeight:800, color:'var(--brand)' }}>Rp {fmt(total)}</span>
        </div>
      </div>
    </div>
  )
}

function boxBorder() { const s = { style:'thin' as const, color:{argb:'FFBFBFBF'} }; return { top:s, bottom:s, left:s, right:s } }
function statusBadge(s:string) {
  const cfg: Record<string,{label:string;color:string;bg:string}> = {
    submitted:{ label:'Waiting for Payment', color:'var(--amber)', bg:'var(--amberbg)' }, approved:{ label:'Waiting for Payment', color:'var(--amber)', bg:'var(--amberbg)' },
    done:{ label:'Waiting for Verification', color:'var(--green)', bg:'var(--greenbg)' }, paid:{ label:'Waiting for Verification', color:'var(--green)', bg:'var(--greenbg)' },
    verified:{ label:'Verified', color:'var(--brand)', bg:'var(--brand-soft)' }, rejected:{ label:'Ditolak', color:'var(--red)', bg:'var(--redbg)' },
    clarification:{ label:'Clarification', color:'#b45309', bg:'#fff3e0' },
  }
  const c = cfg[s] || { label:s, color:'var(--text3)', bg:'var(--bg3)' }
  return <span className="badge" style={{ background:c.bg, color:c.color, fontSize:9 }}>{c.label}</span>
}
function chip(active:boolean, color:string='var(--brand)'):React.CSSProperties { return { padding:'4px 11px', borderRadius:20, fontSize:11, fontWeight:600, cursor:'pointer', border:`1px solid ${active?color:'var(--border)'}`, background:active?color+'1a':'var(--bg3)', color:active?color:'var(--text2)' } }
function subtab(active:boolean):React.CSSProperties { return { padding:'8px 16px', fontSize:12.5, fontWeight:600, cursor:'pointer', border:'none', borderBottom:`2px solid ${active?'var(--brand)':'transparent'}`, background:'transparent', color:active?'var(--brand)':'var(--text3)' } }
