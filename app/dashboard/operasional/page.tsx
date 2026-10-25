'use client'
import { cachedFetch } from '@/lib/fetchCache'
import { getConfig } from '@/lib/configCache'
import { oeLookup } from '@/lib/defaults'
import { allowedMenusFor, userRolesOf } from '@/lib/perms'
import { EvidenceList } from '@/components/EvidenceList'
import { MoneyInput } from '@/components/MoneyInput'
import { useEffect, useMemo, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import { useYear } from '@/lib/year'
import { ConfirmSheet, Empty, Icon, PageHeader, Pill, Seg, Sheet, Tile, type Tone, Portal } from '@/components/ui'
import { useTabParam } from '@/lib/useTabParam'

const fmt = (n:number) => new Intl.NumberFormat('id-ID').format(n||0)
const short = (n:number) => { const a = Math.abs(n||0); const f = (v:number, u:string) => `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(v)} ${u}`; return a >= 1e9 ? f(n/1e9,'M') : a >= 1e6 ? f(n/1e6,'jt') : a >= 1e3 ? f(n/1e3,'rb') : fmt(n) }
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
  const { year } = useYear()
  const [tab, setTab] = useTabParam(['settlement','petty'] as const, 'settlement')
  const [canPetty, setCanPetty] = useState(false)
  const [month, setMonth] = useState(new Date().getMonth())
  useEffect(()=>{ let on=true; getConfig().then(c=>{ if(!on)return; const allowed=allowedMenusFor(c?.roleDefs||[], userRolesOf(user)); setCanPetty(allowed.has('pettycash')) }).catch(()=>{}); return () => { on = false } }, [user])
  // kalau lagi di tab petty tapi ga punya akses, balik ke settlement
  useEffect(()=>{ if(tab==='petty' && !canPetty) setTab('settlement') }, [tab, canPetty])
  return (
    <div className="au-page">
      <div className="au-view au-anim">
        <PageHeader eyebrow={`Finance · ${tab === 'petty' ? 's/d ' : ''}${MONTHS[month]} ${year}`} title="Operasional" actions={
          <select className="input" aria-label="Bulan" style={{ width: 'auto', minHeight: 40 }} value={month} onChange={e=>setMonth(Number(e.target.value))}>
            {MONTHS.map((m,i)=><option key={i} value={i}>{m}</option>)}
          </select>} />
        {canPetty && <div className="rise"><Seg label="Tampilan" value={tab} onChange={setTab} options={[['settlement','Settlement CC'],['petty','Petty Cash']] as const} /></div>}
        {tab==='petty' && canPetty ? <PettyCashTab month={month} year={year} /> : <SettlementTab user={user} month={month} year={year} />}
      </div>
    </div>
  )
}

// =====================  SETTLEMENT CC  =====================
type Ask = { kind:'verify'; ids:string[] } | { kind:'verifyOne'; item:any } | { kind:'source'; item:any } | { kind:'reverse'; item:any } | null
function SettlementTab({ user, month, year }: { user:any; month:number; year:number }) {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [allSources, setAllSources] = useState(false)
  const [viewing, setViewing] = useState<any>(null)
  const [zipping, setZipping] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [verifying, setVerifying] = useState(false)
  const [loadError, setLoadError] = useState<string>('')
  const [ask, setAsk] = useState<Ask>(null)

  const load = useCallback(async (force = false) => {
    setLoading(true); setLoadError('')
    try {
      // Berbagi cache dgn halaman Reimbursement (API yang sama). Setelah aksi dipanggil dgn force=true.
      const r = await cachedFetch('/api/reimbursements', 30_000, force)
      setItems(r?.data || [])
    } catch (e:any) {
      // Jangan kosongkan items saat gagal — supaya tidak terlihat seperti data hilang
      setLoadError(e?.message || 'Gagal memuat data')
      toast.error('Gagal memuat data operasional')
    } finally { setLoading(false) }
  }, [])
  const reloadFresh = useCallback(() => load(true), [load])
  useEffect(() => { load() }, [load])
  // ganti periode -> kosongkan pilihan (sama seperti sebelumnya saat ganti bulan/tahun)
  useEffect(() => { setSelected(new Set()) }, [month, year])

  // semua item periode ini (Cash Card / semua sumber) yg sudah dibayar / verified
  const periodItems = useMemo(() => items.filter(r => {
    if (!allSources && !r.isCashCard) return false
    const d = periodDate(r); if (!d || d.getMonth()!==month || d.getFullYear()!==year) return false
    return ['done','paid','verified','clarification'].includes(r.status)
  }).sort((a,b)=>(periodDate(a)?.getTime()||0)-(periodDate(b)?.getTime()||0)), [items, allSources, month, year])

  const verifiableIds = periodItems.filter(r => r.status==='done'||r.status==='paid').map(r=>r._id)
  const allVerified = periodItems.length>0 && periodItems.every(r => r.status==='verified')
  const anyVerified = periodItems.some(r => r.status==='verified')
  const exportsEnabled = anyVerified  // aktif begitu minimal 1 item sudah diverify
  // Isi export HANYA item yang sudah diverify, bukan semua periode.
  const exportItems = periodItems.filter(r => r.status === 'verified')
  const exportTotal = exportItems.reduce((s,r)=>s+(r.amount||0),0)

  function toggleSel(id:string) { setSelected(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n }) }
  function selectAll() { setSelected(new Set(verifiableIds)) }
  function clearSel() { setSelected(new Set()) }

  function askVerify() {
    const ids = Array.from(selected).filter(id => verifiableIds.includes(id))
    if (ids.length===0) { toast.error('Pilih minimal 1 item (status Waiting for Verification) untuk diverify'); return }
    setAsk({ kind:'verify', ids })
  }
  async function doVerify(ids:string[]) {
    setVerifying(true)
    try {
      const r = await fetch('/api/settlement/verify', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ ids, month: month+1, year, verifiedBy: user?.name||'-' }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { toast.error(j.error||'Gagal verify'); return }
      toast.success(`${j.data.verified} item verified · Settlement CC = Rp ${fmt(j.data.settlementTotal)}`)
      setAsk(null); clearSel(); await reloadFresh()
    } catch { toast.error('Gagal verify') } finally { setVerifying(false) }
  }
  function askVerifyOne(item:any) {
    if (!verifiableIds.includes(item._id)) { toast.error('Item ini belum bisa diverify (harus status Waiting for Verification)'); return }
    setAsk({ kind:'verifyOne', item })
  }
  async function verifyOne(item:any) {
    setVerifying(true)
    try {
      const r = await fetch('/api/settlement/verify', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ ids:[item._id], month: month+1, year, verifiedBy: user?.name||'-' }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { toast.error(j.error||'Gagal verify'); return }
      toast.success(`Verified · Settlement CC = Rp ${fmt(j.data.settlementTotal)}`)
      setAsk(null); setViewing(null); clearSel(); await reloadFresh()
    } catch { toast.error('Gagal verify') } finally { setVerifying(false) }
  }

  async function clarifyItem(item:any, note:string) {
    setVerifying(true)
    try {
      const r = await fetch('/api/reimbursements/clarify', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ id:item._id, note, clarifiedBy: user?.name||'-' }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { toast.error(j.error||'Gagal clarify'); return }
      toast.success(j.pushed ? 'Dibalikin ke member + notif terkirim' : 'Dibalikin ke member (member belum aktifkan notif)')
      setViewing(null); await reloadFresh()
    } catch { toast.error('Gagal clarify') } finally { setVerifying(false) }
  }

  // pindah sumber Petty <-> CC (propagasi ke reimburse + cashier + settlement)
  function askSource(r:any) {
    if (r.status==='verified') { toast.error('Sudah verified — reverse dulu ke Waiting for Verification sebelum ganti sumber'); return }
    setAsk({ kind:'source', item:r })
  }
  async function toggleSource(r:any) {
    const toCC = !r.isCashCard
    const payload:any = { isCashCard: toCC, source: toCC?'cash_card':'petty_cash' }
    // Pindah ke Petty Cash: item ga perlu verifikasi CC -> kalau masih Waiting for Verification, langsung verified
    if (!toCC && (r.status==='done' || r.status==='paid')) {
      payload.status = 'verified'; payload.verifiedAt = new Date().toISOString(); payload.verifiedBy = `${user?.name||'-'} (Petty Cash)`
    }
    const res = await fetch(`/api/reimbursements/${r._id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) }).catch(() => null)
    if (!res?.ok) { toast.error('Gagal mengubah sumber'); return }
    toast.success(!toCC && payload.status==='verified' ? 'Diubah ke Petty Cash & langsung selesai (verified)' : 'Sumber diperbarui')
    setAsk(null); setViewing(null); await reloadFresh()
  }
  async function reverseItem(r:any) {
    if (r.status!=='verified') return
    const res = await fetch('/api/settlement/reverse', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id: r._id }) }).catch(() => null)
    const j = res ? await res.json().catch(() => ({})) : {}
    if (!res?.ok) { toast.error(j.error||'Gagal reverse'); return }
    toast.success('Reverse berhasil — status kembali Waiting for Verification'); setAsk(null); setViewing(null); await reloadFresh()
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
      // Daftar dimuat tanpa isi file (documents.url) supaya ringan.
      // Untuk export ZIP, ambil isi file per item yang dicentang.
      const { fetchFullReimbursement } = await import('@/lib/reimbursementDetail')
      const loaded = await Promise.all(withDocs.map(async (r:any) => {
        if (Array.isArray(r.documents) && r.documents.every((d:any)=>!!d?.url)) return r
        const full = await fetchFullReimbursement(r._id)
        return full && Array.isArray(full.documents) && full.documents.length ? { ...r, documents: full.documents } : r
      }))
      const JSZip = (await import('jszip')).default; const zip = new JSZip()
      loaded.forEach((r, i) => {
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
  const waiting = verifiableIds.length
  const step = !periodItems.length ? 0 : selected.size === 0 && !anyVerified ? 1 : !anyVerified ? 2 : allVerified ? 4 : 3

  return (
    <>
      {viewing && <DetailSheet item={viewing} onClose={()=>setViewing(null)} busy={verifying}
        onToggleSource={askSource} onVerify={askVerifyOne} onClarify={clarifyItem} onReverse={(r:any)=>setAsk({ kind:'reverse', item:r })} />}
      {ask?.kind === 'verify' && <ConfirmSheet title="Verify settlement" confirmLabel={`Verify ${ask.ids.length} item`} icon="check"
        text={<>Status <b>{ask.ids.length} item</b> berubah dari Waiting for Verification menjadi <b>Verified</b>, dan Settlement Cash Card {MONTHS[month]} {year} dihitung otomatis.</>}
        onConfirm={() => doVerify(ask.ids)} onClose={() => setAsk(null)} />}
      {ask?.kind === 'verifyOne' && <ConfirmSheet title="Verify item" confirmLabel="Verify" icon="check"
        text={<>Verify <b>“{ask.item.title}”</b>? Status menjadi Verified dan Settlement CC {MONTHS[month]} {year} dihitung ulang.</>}
        onConfirm={() => verifyOne(ask.item)} onClose={() => setAsk(null)} />}
      {ask?.kind === 'source' && <ConfirmSheet title="Ubah sumber dana" confirmLabel={`Ubah ke ${ask.item.isCashCard ? 'Petty Cash' : 'Cash Card'}`}
        text={<>Ubah sumber <b>“{ask.item.title}”</b> ke <b>{ask.item.isCashCard ? 'Petty Cash' : 'Cash Card'}</b>?{ask.item.isCashCard && (ask.item.status === 'done' || ask.item.status === 'paid') ? ' Item Petty Cash tidak perlu verifikasi CC, jadi langsung berstatus Verified.' : ''}</>}
        onConfirm={() => toggleSource(ask.item)} onClose={() => setAsk(null)} />}
      {ask?.kind === 'reverse' && <ConfirmSheet danger title="Reverse verifikasi" confirmLabel="Reverse" icon="back"
        text={<>Kembalikan <b>“{ask.item.title}”</b> dari Verified ke Waiting for Verification? Settlement Cash Card bulan itu akan dihitung ulang.</>}
        onConfirm={() => reverseItem(ask.item)} onClose={() => setAsk(null)} />}

      {loadError && <div className="au-row au-wrap p-bad" role="alert" style={{ borderRadius: 14, padding: 12, gap: 10 }}>
        <span className="au-small" style={{ flex: 1 }}><b>Gagal memuat data</b> — data kamu tidak hilang, hanya belum berhasil dimuat. <span className="au-muted">{loadError}</span></span>
        <button type="button" className="btn btn-sm" onClick={reloadFresh}>Coba lagi</button></div>}

      <div className="au-grid au-tiles" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}>
        <Tile icon="card" color="var(--ink)" iconInk="var(--bg)" value={loading ? '–' : periodItems.length} label="Transaksi periode" hint={totalNominal ? `Rp ${short(totalNominal)}` : undefined} />
        <Tile icon="clock" color="var(--warn)" value={loading ? '–' : waiting} label="Menunggu verifikasi" />
        <Tile icon="check" color="var(--accent)" value={loading ? '–' : exportItems.length} label="Verified · siap export" hint={exportTotal ? `Rp ${short(exportTotal)}` : undefined} />
      </div>

      <ol className="au-flow rise" aria-label="Alur settlement">
        {['Centang item', 'Cek evidence', 'Verify', 'Export'].map((t, i) => <li key={t} data-state={step > i + 1 ? 'done' : step === i + 1 ? 'now' : undefined}><span>{step > i + 1 ? <Icon name="check" size={12} stroke={3} /> : i + 1}</span>{t}</li>)}
      </ol>

      <div className="au-row au-wrap rise" style={{ gap: 8 }}>
        <Seg label="Sumber" value={allSources ? 'all' : 'cc'} onChange={v => setAllSources(v === 'all')} options={[['cc','Cash Card'],['all','Semua sumber']] as const} />
        <span style={{ flex: 1 }} />
        <button type="button" onClick={exportXLSX} className="btn" disabled={exporting || !exportsEnabled} title={exportsEnabled ? 'Export item verified ke Excel' : 'Aktif setelah minimal 1 item diverify'}><Icon name="down" size={15} />{exporting ? 'Menyiapkan…' : 'Excel'}</button>
        <button type="button" onClick={exportPDF} className="btn" disabled={!exportsEnabled} title={exportsEnabled ? 'Export item verified ke PDF' : 'Aktif setelah minimal 1 item diverify'}><Icon name="file" size={15} />PDF</button>
      </div>

      {loading ? <div className="au-card">{[0,1,2].map(k => <div key={k} className="au-skel" />)}</div>
       : periodItems.length === 0 ? <div className="au-card"><Empty title={`Tidak ada transaksi ${MONTHS[month]} ${year}`} text={allSources ? 'Belum ada reimburse yang sudah dibayar pada periode ini.' : 'Coba tampilkan semua sumber atau pilih bulan lain.'} action={!allSources ? <button type="button" className="btn" onClick={() => setAllSources(true)}>Semua sumber</button> : undefined} /></div>
       : <div className="au-tblw rise">
          <table className="wp-table au-ctbl" style={{ minWidth: 1040 }}>
            <thead><tr>
              <th style={{ width: 44, textAlign: 'center' }}><input type="checkbox" className="au-check" aria-label="Pilih semua yang bisa diverify" checked={selected.size>0 && selected.size===verifiableIds.length} onChange={e=>e.target.checked?selectAll():clearSel()} disabled={verifiableIds.length===0} /></th>
              <th>No</th><th>Keperluan</th><th>Tanggal</th><th>Pengaju</th><th>Kategori</th><th style={{ textAlign: 'right' }}>Nominal</th><th>Sumber</th><th>Status</th><th>Evidence</th><th><span className="sr-only">Aksi</span></th>
            </tr></thead>
            <tbody>
              {periodItems.map((r,i) => {
                const lengkap = hasEvidence(r); const canVerify = r.status==='done'||r.status==='paid'; const sel = selected.has(r._id)
                return (
                  <tr key={r._id} className={`au-click${sel ? ' is-sel' : ''}`} onClick={()=>setViewing(r)}>
                    <td className="c-chk" style={{ textAlign: 'center' }} onClick={e=>e.stopPropagation()}>{canVerify ? <input type="checkbox" className="au-check" checked={sel} onChange={()=>toggleSel(r._id)} aria-label={`Pilih ${r.title}`} /> : <span title={r.status === 'verified' ? 'Verified' : 'Belum bisa diverify'} style={{ color: 'var(--accent)', display: 'inline-grid' }}><Icon name="lock" size={15} /></span>}</td>
                    <td className="au-xs au-muted" data-l="No" style={{ fontFamily: 'var(--mono)' }}>{i+1}</td>
                    <td className="c-main"><button type="button" className="au-rowbtn" onClick={e => { e.stopPropagation(); setViewing(r) }}><b className="au-small">{r.title}</b><span className="au-xs au-muted">{oeLookup(r.category).name}</span></button></td>
                    <td data-l="Tanggal" className="au-small au-ink2" style={{ whiteSpace: 'nowrap' }}>{(()=>{ const d=periodDate(r); return d?d.toLocaleDateString('id-ID'):'—' })()}</td>
                    <td data-l="Pengaju" className="au-small">{r.userName||'—'}</td>
                    <td data-l="Kategori" className="au-xs" style={{ fontFamily: 'var(--mono)' }}>{oeExcelCode(r.category)}</td>
                    <td data-l="Nominal" style={{ textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>Rp {fmt(r.amount)}</td>
                    <td data-l="Sumber" onClick={e=>e.stopPropagation()}>
                      <button type="button" onClick={()=>askSource(r)} className="au-tag au-srcbtn" disabled={r.status==='verified'} title={r.status==='verified' ? 'Reverse dulu untuk ganti sumber' : 'Ketuk untuk pindah sumber'} style={r.isCashCard ? { background:'var(--accent-soft)', color:'var(--accent-ink)' } : undefined}>{r.isCashCard?'Cash Card':'Petty Cash'}{r.status!=='verified' && <Icon name="arrow" size={11} />}</button>
                    </td>
                    <td data-l="Status">{statusBadge(r.status)}</td>
                    <td data-l="Evidence"><Pill tone={lengkap ? 'ok' : 'bad'}>{lengkap?`Lengkap · ${evidenceCount(r)}`:'Belum'}</Pill></td>
                    <td className="c-act" onClick={e=>e.stopPropagation()}><button type="button" onClick={()=>setViewing(r)} className="btn btn-sm">Lihat</button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>}

      {selected.size > 0 && !loading && (
        <Portal><div className="au-selbar" role="status">
          <span className="au-col" style={{ gap: 1 }}><span className="au-xs au-muted">{selected.size} dipilih dari {waiting} menunggu</span><b>Rp {fmt(periodItems.filter(r => selected.has(r._id)).reduce((s,r)=>s+(r.amount||0),0))}</b></span>
          {selected.size < waiting && <button type="button" onClick={selectAll} className="btn btn-sm">Pilih semua</button>}
          {selected.size > 0 && <>
            <button type="button" onClick={exportZIP} disabled={zipping} className="btn btn-sm" title="Unduh evidence item yang dicentang"><Icon name="down" size={14} />{zipping ? 'Menyiapkan…' : 'Evidence'}</button>
            <button type="button" onClick={askVerify} disabled={verifying} className="btn btn-sm btn-primary"><Icon name="check" size={14} stroke={2.4} />Verify {selected.size}</button>
          </>}
        </div></Portal>
      )}
      {allVerified && <div className="au-row p-accent au-small" style={{ borderRadius: 14, padding: 12, gap: 8 }}><Icon name="check" size={16} stroke={2.4} />Semua transaksi periode ini sudah Verified.</div>}
    </>
  )
}

// =====================  PETTY CASH  =====================
function PettyCashTab({ month, year }: { month:number; year:number }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [editing, setEditing] = useState(false)
  const [rincian, setRincian] = useState<null|'noncc'|'bankfee'|'cc'>(null)

  const load = useCallback(async () => {
    setLoading(true); setFailed(false)
    try {
      const r = await fetch(`/api/pettycash?year=${year}&month=${month+1}`)
      if (!r.ok) throw new Error()
      setData((await r.json()).data)
    } catch { setFailed(true); toast.error('Gagal memuat petty cash') } finally { setLoading(false) }
  }, [year, month])
  useEffect(() => { load() }, [load])

  const s = data?.summary || { pemasukan:0, nonCCAmount:0, bankFees:0, ccOperasional:0, pengeluaran:0, saldo:0 }
  const row = (label:string, value:number, kind?:'noncc'|'bankfee'|'cc') => (
    <button type="button" className="au-igr" onClick={kind ? () => setRincian(kind) : undefined} disabled={!kind}>
      <span className="au-small au-ink2" style={{ flex: 1, minWidth: 0 }}>{label}</span>
      <b style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>Rp {fmt(value)}</b>
      {kind && <Icon name="chev" size={15} style={{ transform: 'rotate(-90deg)', color: 'var(--muted)' }} />}
    </button>
  )

  return (
    <>
      {editing && <InflowEditor year={year} initial={data?.inflows||[]} onClose={()=>setEditing(false)} onSaved={()=>{setEditing(false);load()}} />}
      {rincian && <RincianSheet kind={rincian} detail={data?.detail} summary={s} month={month} year={year} onClose={()=>setRincian(null)} />}
      {failed && <div className="au-row au-wrap p-bad" role="alert" style={{ borderRadius: 14, padding: 12 }}><span className="au-small" style={{ flex: 1 }}>Petty cash gagal dimuat.</span><button type="button" className="btn btn-sm" onClick={load}>Coba lagi</button></div>}
      {loading ? <div className="au-card">{[0,1,2].map(k => <div key={k} className="au-skel" />)}</div> : (
        <>
          <div className="au-pcgrid">
            <section className="au-card au-saldo rise">
              <span className="lbl">Saldo petty cash · s/d {MONTHS[month]} {year}</span>
              <b>Rp {fmt(s.saldo)}</b>
              <div className="au-row au-wrap" style={{ gap: 16 }}>
                <span className="au-col" style={{ gap: 2 }}><span className="au-xs au-muted">Pemasukan kumulatif</span><span className="au-small" style={{ fontWeight: 700, color: 'var(--ok)' }}>+ Rp {fmt(s.pemasukan)}</span></span>
                <span className="au-col" style={{ gap: 2 }}><span className="au-xs au-muted">Pengeluaran kumulatif</span><span className="au-small" style={{ fontWeight: 700, color: 'var(--bad)' }}>− Rp {fmt(s.pengeluaran)}</span></span>
              </div>
              <button type="button" className="btn btn-primary" style={{ alignSelf: 'flex-start' }} onClick={()=>setEditing(true)}><Icon name="plus" size={15} stroke={2.2} />Saldo awal / pemasukan</button>
            </section>
            <section className="au-col rise" style={{ gap: 8 }}>
              <span className="lbl">Rincian pengeluaran · ketuk untuk detail</span>
              <div className="au-ig">
                {row('Reimburse non-Cash Card (nominal, done/verified)', s.nonCCAmount, 'noncc')}
                {row('Biaya antar bank (semua reimburse: CC + Petty)', s.bankFees, 'bankfee')}
                {row('Selisih biaya settlement Cash Card (pengeluaran operasional)', s.ccOperasional, 'cc')}
                <div className="au-igr" style={{ background: 'var(--sunken)' }}><b className="au-small" style={{ flex: 1 }}>Total pengeluaran</b><b style={{ fontVariantNumeric: 'tabular-nums' }}>Rp {fmt(s.pengeluaran)}</b></div>
              </div>
            </section>
          </div>
          <section className="au-col rise" style={{ gap: 8 }}>
            <span className="au-row au-between"><span className="lbl">Daftar pemasukan {year}</span><button type="button" className="btn btn-sm" onClick={()=>setEditing(true)}><Icon name="edit" size={14} />Edit</button></span>
            {(data?.inflows||[]).length===0 ? <div className="au-card"><Empty title="Belum ada pemasukan" text={`Catat saldo awal atau top up petty cash ${year}.`} /></div> : (
              <div className="au-tblw"><table className="wp-table au-ctbl"><thead><tr><th>Tanggal</th><th>Sumber</th><th>Catatan</th><th style={{ textAlign: 'right' }}>Jumlah</th></tr></thead>
                <tbody>{(data.inflows||[]).map((f:any,i:number)=>(
                  <tr key={i}><td className="c-main au-small">{f.date?new Date(f.date).toLocaleDateString('id-ID'):'—'}</td><td data-l="Sumber" className="au-small">{f.source||'—'}</td><td data-l="Catatan" className="au-small au-muted">{f.notes||''}</td><td data-l="Jumlah" style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>Rp {fmt(f.amount)}</td></tr>
                ))}</tbody>
              </table></div>
            )}
          </section>
        </>
      )}
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
    } catch { toast.error('Gagal menyimpan') } finally { setSaving(false) }
  }
  const total = rows.reduce((s,r)=>s+(Number(r.amount)||0),0)
  return (
    <Sheet open wide title={`Pemasukan petty cash ${year}`} onClose={onClose} onSave={save} saveDisabled={saving} saveLabel={saving ? 'Menyimpan…' : 'Simpan'}>
      <span className="au-xs au-muted">Baris dengan jumlah 0 tidak disimpan.</span>
      {rows.map((r,i)=>(
        <div key={i} className="au-inrow">
          <label className="au-col" style={{ gap: 4 }}><span className="lbl">Tanggal</span><input type="date" className="input" value={r.date} onChange={e=>upd(i,'date',e.target.value)} /></label>
          <label className="au-col" style={{ gap: 4 }}><span className="lbl">Sumber</span><input className="input" placeholder="Saldo Awal / Top Up" value={r.source} onChange={e=>upd(i,'source',e.target.value)} /></label>
          <label className="au-col" style={{ gap: 4 }}><span className="lbl">Catatan</span><input className="input" value={r.notes} onChange={e=>upd(i,'notes',e.target.value)} /></label>
          <label className="au-col" style={{ gap: 4 }}><span className="lbl">Jumlah</span><MoneyInput currency="IDR" className="input" placeholder="0" value={Number(r.amount)||0} onChange={n=>upd(i,'amount',n)} /></label>
          <button type="button" onClick={()=>del(i)} className="btn btn-icon btn-sm" aria-label={`Hapus baris ${i + 1}`} style={{ alignSelf: 'end', marginBottom: 6 }}><Icon name="trash" size={14} /></button>
        </div>
      ))}
      <button type="button" onClick={add} className="btn btn-sm" style={{ alignSelf:'flex-start' }}><Icon name="plus" size={14} />Baris</button>
      <div className="au-total"><span className="lbl">Total pemasukan</span><b>Rp {fmt(total)}</b></div>
    </Sheet>
  )
}

// =====================  shared  =====================
function DetailSheet({ item, onClose, onToggleSource, onVerify, onReverse, onClarify, busy }: { item:any; onClose:()=>void; onToggleSource?:(r:any)=>void; onVerify?:(r:any)=>void; onReverse?:(r:any)=>void; onClarify?:(r:any, note:string)=>void; busy?:boolean }) {
  const isVerified = item.status==='verified'
  const isClarification = item.status==='clarification'
  const [clarifyMode, setClarifyMode] = useState(false)
  const [note, setNote] = useState('')
  const kv = (k:string, v:React.ReactNode) => <div className="au-igr"><span className="k">{k}</span><span className="v">{v}</span></div>
  return (
    <Sheet open title="Detail & evidence" onClose={onClose}>
      <div className="au-col" style={{ gap: 6 }}>
        <span className="au-row au-wrap" style={{ gap: 6 }}><span className="au-tag" style={item.isCashCard ? { background:'var(--accent-soft)', color:'var(--accent-ink)' } : undefined}>{item.isCashCard?'Cash Card':'Petty Cash'}</span>{statusBadge(item.status)}</span>
        <h3 style={{ font: '700 19px/1.3 var(--disp)', overflowWrap: 'anywhere' }}>{item.title}</h3>
        {item.description && <span className="au-small au-ink2">{item.description}</span>}
        <b style={{ font: '700 28px/1.1 var(--disp)', letterSpacing: '-.02em', fontVariantNumeric: 'tabular-nums' }}>Rp {fmt(item.amount)}</b>
      </div>
      <div className="au-ig">
        {kv('Pengaju', item.userName || '—')}
        {kv('Kategori', `${oeLookup(item.category).code} · ${oeLookup(item.category).name}`)}
        {kv('Tgl bukti', (()=>{ const d=periodDate(item); return d?d.toLocaleDateString('id-ID'):'—' })())}
      </div>
      {isClarification && item.clarifyNote && <div className="p-warn au-small" style={{ borderRadius: 14, padding: 12, lineHeight: 1.5 }}><b>Sedang menunggu revisi member.</b><br/>Catatan klarifikasi kamu: “{item.clarifyNote}”</div>}
      <EvidenceList itemId={item._id} documents={item.documents||[]} zipName={`evidence_${(item.title||'reimburse').replace(/\s+/g,'_')}`} />
      {clarifyMode && <label className="au-col" style={{ gap: 6 }}><span className="lbl">Catatan untuk member</span>
        <textarea value={note} onChange={e=>setNote(e.target.value)} rows={3} className="input" autoFocus placeholder="Contoh: Invoice belum ada tanda tangan/stempel. Mohon lampirkan ulang." /></label>}
      <div className="au-row au-wrap" style={{ gap: 8, justifyContent: 'flex-end' }}>
        {isVerified ? (
          onReverse && <button type="button" onClick={()=>onReverse(item)} className="btn" title="Mundurkan status ke Waiting for Verification"><Icon name="back" size={15} />Reverse ke Waiting for Verification</button>
        ) : isClarification ? (
          <span className="au-xs au-muted">Menunggu member merevisi & mengirim ulang.</span>
        ) : clarifyMode ? (
          <>
            <button type="button" onClick={()=>{ setClarifyMode(false); setNote('') }} className="btn">Batal</button>
            <button type="button" disabled={busy} onClick={()=>{ if(!note.trim()){ toast.error('Isi catatan klarifikasi dulu'); return } onClarify?.(item, note.trim()) }} className="btn btn-primary">Kirim klarifikasi</button>
          </>
        ) : (
          <>
            {onClarify && <button type="button" onClick={()=>setClarifyMode(true)} className="btn" title="Kembalikan ke member karena evidence kurang"><Icon name="back" size={15} />Clarify</button>}
            {onToggleSource && <button type="button" onClick={()=>onToggleSource(item)} className="btn" title="Pindah sumber dana"><Icon name="arrow" size={15} />Ubah ke {item.isCashCard?'Petty Cash':'Cash Card'}</button>}
            {onVerify && <button type="button" onClick={()=>onVerify(item)} className="btn btn-primary"><Icon name="check" size={15} stroke={2.4} />Verify</button>}
          </>
        )}
      </div>
    </Sheet>
  )
}
function RincianSheet({ kind, detail, summary, month, year, onClose }:
  { kind:'noncc'|'bankfee'|'cc'; detail:any; summary:any; month:number; year:number; onClose:()=>void }) {
  const d = detail || {}
  const title = kind==='noncc' ? 'Reimburse non-Cash Card' : kind==='bankfee' ? 'Biaya antar bank' : 'Selisih biaya settlement Cash Card'
  const total = kind==='noncc' ? summary.nonCCAmount : kind==='bankfee' ? summary.bankFees : summary.ccOperasional
  const fmtDate = (x:any)=> x ? new Date(x).toLocaleDateString('id-ID') : '—'
  const none = <tr><td colSpan={5}><Empty title="Tidak ada data" /></td></tr>
  return (
    <Sheet open wide title={title} onClose={onClose}>
      <span className="au-xs au-muted">Rincian s/d {MONTHS[month]} {year}</span>
      {kind==='cc' && <span className="au-xs au-muted">Per bulan: |Pengembalian − (Top Up − Settlement)|. Identik dengan kolom Pengeluaran Operasional di menu Cash Card.</span>}
      <div className="au-tblw">
        {kind==='noncc' && (
          <table className="wp-table au-ctbl"><thead><tr><th>Keperluan</th><th>Tanggal</th><th>Pengaju</th><th>Kategori</th><th style={{ textAlign:'right' }}>Nominal</th></tr></thead>
            <tbody>{(d.nonCCItems||[]).length===0 ? none : (d.nonCCItems||[]).map((it:any,i:number)=>(
              <tr key={i}><td className="c-main au-small" style={{ fontWeight: 600 }}>{it.title}</td><td data-l="Tanggal" className="au-small">{fmtDate(it.date)}</td><td data-l="Pengaju" className="au-small">{it.userName}</td><td data-l="Kategori" className="au-small">{oeLookup(it.category).name}</td><td data-l="Nominal" style={{ textAlign:'right', fontWeight:700 }}>Rp {fmt(it.amount)}</td></tr>))}</tbody></table>
        )}
        {kind==='bankfee' && (
          <table className="wp-table au-ctbl"><thead><tr><th>Keperluan</th><th>Tanggal</th><th>Pengaju</th><th>Sumber</th><th style={{ textAlign:'right' }}>Biaya</th></tr></thead>
            <tbody>{(d.bankFeeItems||[]).length===0 ? none : (d.bankFeeItems||[]).map((it:any,i:number)=>(
              <tr key={i}><td className="c-main au-small" style={{ fontWeight: 600 }}>{it.title}</td><td data-l="Tanggal" className="au-small">{fmtDate(it.date)}</td><td data-l="Pengaju" className="au-small">{it.userName}</td><td data-l="Sumber" className="au-small">{it.isCashCard?'Cash Card':'Petty Cash'}</td><td data-l="Biaya" style={{ textAlign:'right', fontWeight:700 }}>Rp {fmt(it.fee)}</td></tr>))}</tbody></table>
        )}
        {kind==='cc' && (
          <table className="wp-table au-ctbl"><thead><tr><th>Bulan</th><th style={{ textAlign:'right' }}>Top up</th><th style={{ textAlign:'right' }}>Settlement</th><th style={{ textAlign:'right' }}>Pengembalian</th><th style={{ textAlign:'right' }}>Operasional</th></tr></thead>
            <tbody>{(d.ccItems||[]).length===0 ? none : (d.ccItems||[]).map((it:any,i:number)=>(
              <tr key={i}><td className="c-main au-small" style={{ fontWeight:700 }}>{MONTHS[it.month-1]}</td><td data-l="Top up" style={{ textAlign:'right' }}>Rp {fmt(it.topUp)}</td><td data-l="Settlement" style={{ textAlign:'right' }}>Rp {fmt(it.settlement)}</td><td data-l="Pengembalian" style={{ textAlign:'right' }}>Rp {fmt(it.refund)}</td><td data-l="Operasional" style={{ textAlign:'right', fontWeight:700, color:'var(--bad)' }}>Rp {fmt(it.operasional)}</td></tr>))}</tbody></table>
        )}
      </div>
      <div className="au-total"><span className="lbl">Total</span><b>Rp {fmt(total)}</b></div>
    </Sheet>
  )
}

function boxBorder() { const s = { style:'thin' as const, color:{argb:'FFBFBFBF'} }; return { top:s, bottom:s, left:s, right:s } }
const STATUS: Record<string,{label:string; tone:Tone}> = {
  submitted:{ label:'Waiting for Payment', tone:'warn' }, approved:{ label:'Waiting for Payment', tone:'warn' },
  done:{ label:'Waiting for Verification', tone:'ok' }, paid:{ label:'Waiting for Verification', tone:'ok' },
  verified:{ label:'Verified', tone:'accent' }, rejected:{ label:'Ditolak', tone:'bad' }, clarification:{ label:'Clarification', tone:'warn' },
}
function statusBadge(s:string) { const c = STATUS[s] || { label:s, tone:'none' as Tone }; return <Pill tone={c.tone}>{c.label}</Pill> }
