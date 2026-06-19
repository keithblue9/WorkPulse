'use client'
import { getConfig } from '@/lib/configCache'
import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'

const fmt = (n:number) => new Intl.NumberFormat('id-ID').format(n||0)
const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']

// The date a reimburse "belongs to" for settlement grouping:
// prefer the bill/nota date, fall back to submit date, then created date.
function periodDate(r:any):Date|null {
  const raw = r.billDate || r.submittedAt || r.createdAt
  if (!raw) return null
  const d = new Date(raw)
  return isNaN(d.getTime()) ? null : d
}
function hasEvidence(r:any):boolean { return Array.isArray(r.documents) && r.documents.length > 0 }
function evidenceCount(r:any):number { return Array.isArray(r.documents) ? r.documents.length : 0 }
function safeName(s:string):string { return String(s||'').replace(/[\\/:*?"<>|]+/g,'_').replace(/\s+/g,'_').slice(0,50) || 'item' }

function downloadBlob(blob:Blob, filename:string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click()
  document.body.removeChild(a)
  setTimeout(()=>URL.revokeObjectURL(url), 2000)
}

// data URL -> { base64, mime } for JSZip
function parseDataUrl(dataUrl:string):{ base64:string; mime:string } | null {
  const m = /^data:([^;]+);base64,([\s\S]*)$/.exec(dataUrl||'')
  if (!m) return null
  return { mime: m[1], base64: m[2] }
}
function extForMime(mime:string, fallbackName:string):string {
  const fromName = (fallbackName.match(/\.[a-z0-9]+$/i)||[''])[0]
  if (fromName) return ''
  if (mime?.includes('pdf')) return '.pdf'
  if (mime?.includes('png')) return '.png'
  if (mime?.includes('jpeg')||mime?.includes('jpg')) return '.jpg'
  return ''
}

export default function SettlementCCPage() {
  const { data:session } = useSession(); const user = session?.user as any
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [allowed, setAllowed] = useState<boolean|null>(null)
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth())          // 0-11
  const [year, setYear] = useState(now.getFullYear())
  const [allSources, setAllSources] = useState(false)         // false = Cash Card only (default), true = semua
  const [statusTab, setStatusTab] = useState<'done'|'all'|'pending'>('done')
  const [viewing, setViewing] = useState<any>(null)
  const [zipping, setZipping] = useState(false)

  // Access guard: allow if any of the user's roles grants the 'settlementcc' menu,
  // mirroring the menu-permission model. Hard fallback to admin/ccholder.
  useEffect(() => {
    const userRoles:string[] = user?.roles?.length ? user.roles : (user?.role ? [user.role] : [])
    getConfig().then((cfg:any) => {
      const defs = cfg?.roleDefs || []
      let ok = false
      for (const role of userRoles) {
        const def = defs.find((d:any)=>d.key===role)
        if (def?.allowedMenus?.includes('settlementcc')) ok = true
      }
      if (!ok) ok = userRoles.includes('admin') || userRoles.includes('ccholder')
      setAllowed(ok)
    }).catch(() => {
      setAllowed(user?.roles?.includes('admin') || user?.roles?.includes('ccholder'))
    })
  }, [user])

  async function load() {
    setLoading(true)
    try {
      const r = await fetch('/api/reimbursements').then(r=>r.json())
      setItems(r.data || [])
    } catch { toast.error('Gagal memuat data') }
    finally { setLoading(false) }
  }
  useEffect(() => { if (allowed) load() }, [allowed])

  const yearOptions = useMemo(() => {
    const ys = new Set<number>([now.getFullYear(), now.getFullYear()-1, now.getFullYear()+1])
    items.forEach(r => { const d = periodDate(r); if (d) ys.add(d.getFullYear()) })
    return Array.from(ys).sort((a,b)=>b-a)
  }, [items])

  // Apply source + period + status filters
  const filtered = useMemo(() => {
    return items.filter(r => {
      if (!allSources && !r.isCashCard) return false
      const d = periodDate(r)
      if (!d || d.getMonth() !== month || d.getFullYear() !== year) return false
      if (statusTab === 'done') return r.status === 'done' || r.status === 'paid'
      if (statusTab === 'pending') return ['submitted','approved','draft'].includes(r.status)
      return true
    }).sort((a,b) => {
      const da = periodDate(a)?.getTime()||0, db = periodDate(b)?.getTime()||0
      return da - db
    })
  }, [items, allSources, month, year, statusTab])

  const summary = useMemo(() => {
    const totalNominal = filtered.reduce((s,r)=>s+(r.amount||0),0)
    const lengkap = filtered.filter(hasEvidence).length
    return { count: filtered.length, totalNominal, lengkap, belum: filtered.length - lengkap }
  }, [filtered])

  function exportCSV() {
    if (filtered.length === 0) { toast.error('Tidak ada data untuk diexport'); return }
    const head = ['No','Tanggal','Pengaju','Keperluan','Nominal','Bank','No Rekening','Sumber','Status','Jumlah Evidence','Status Evidence']
    const rows = filtered.map((r,i) => {
      const d = periodDate(r)
      return [
        i+1,
        d ? d.toLocaleDateString('id-ID') : '-',
        r.userName || '-',
        r.title || '-',
        r.amount || 0,
        r.bank || '-',
        r.noRekening || '-',
        r.isCashCard ? 'Cash Card' : 'Petty Cash',
        r.status || '-',
        evidenceCount(r),
        hasEvidence(r) ? 'Lengkap' : 'Belum',
      ]
    })
    const esc = (v:any) => { const s = String(v ?? ''); return /[",\n;]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s }
    const csv = [head, ...rows].map(row => row.map(esc).join(';')).join('\r\n')
    const blob = new Blob(['\ufeff'+csv], { type:'text/csv;charset=utf-8;' })
    downloadBlob(blob, `Ringkasan_SettlementCC_${MONTHS[month]}_${year}.csv`)
    toast.success('Ringkasan CSV diunduh')
  }

  async function exportZIP() {
    const withDocs = filtered.filter(hasEvidence)
    if (withDocs.length === 0) { toast.error('Tidak ada evidence untuk di-ZIP'); return }
    setZipping(true)
    try {
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()
      withDocs.forEach((r, i) => {
        const folderName = `${String(i+1).padStart(3,'0')}_${safeName(r.title)}`
        const folder = zip.folder(folderName)
        if (!folder) return
        r.documents.forEach((doc:any, di:number) => {
          const parsed = parseDataUrl(doc.url)
          const base = safeName(doc.name || `evidence_${di+1}`)
          if (parsed) {
            const ext = extForMime(parsed.mime, base)
            folder.file(base + ext, parsed.base64, { base64:true })
          } else if (doc.url) {
            // non-data URL (legacy): store a small pointer file instead of fetching cross-origin
            folder.file(base + '.url.txt', doc.url)
          }
        })
      })
      // include the summary CSV inside the zip too
      const head = ['No','Tanggal','Pengaju','Keperluan','Nominal','Sumber','Status','Jumlah Evidence']
      const lines = filtered.map((r,i) => {
        const d = periodDate(r)
        return [i+1, d?d.toLocaleDateString('id-ID'):'-', r.userName||'-', (r.title||'-').replace(/;/g,','), r.amount||0, r.isCashCard?'Cash Card':'Petty Cash', r.status||'-', evidenceCount(r)].join(';')
      })
      zip.file('00_Ringkasan.csv', ['\ufeff'+head.join(';'), ...lines].join('\r\n'))

      const blob = await zip.generateAsync({ type:'blob' })
      const src = allSources ? 'Semua' : 'CashCard'
      downloadBlob(blob, `SettlementCC_${src}_${MONTHS[month]}_${year}.zip`)
      toast.success(`ZIP siap (${withDocs.length} transaksi)`)
    } catch (e:any) {
      toast.error('Gagal membuat ZIP')
    } finally { setZipping(false) }
  }

  if (allowed === null) return <div style={{ padding:40, textAlign:'center', color:'var(--text3)' }}>Memuat...</div>
  if (allowed === false) return (
    <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:40 }}>
      <div className="card" style={{ textAlign:'center', padding:'40px 50px', maxWidth:420 }}>
        <div style={{ fontSize:34, marginBottom:10 }}>🔒</div>
        <div style={{ fontSize:15, fontWeight:600, marginBottom:6 }}>Akses Ditolak</div>
        <div style={{ fontSize:12, color:'var(--text3)' }}>Menu Settlement CC khusus untuk role CC Holder. Hubungi admin untuk diberi akses lewat Configuration.</div>
      </div>
    </div>
  )

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {/* Detail modal */}
      {viewing && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setViewing(null)}>
          <div className="modal" style={{ width:520 }}>
            <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between' }}>
              <span style={{ fontSize:14, fontWeight:600 }}>Detail & Evidence</span>
              <button onClick={()=>setViewing(null)} className="btn btn-icon">×</button>
            </div>
            <div style={{ padding:'14px 20px', display:'flex', flexDirection:'column', gap:10, fontSize:12, maxHeight:'72vh', overflowY:'auto' }}>
              <div><b>{viewing.title}</b></div>
              {viewing.description && <div style={{ color:'var(--text2)' }}>{viewing.description}</div>}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, fontSize:11 }}>
                <div><span style={{ color:'var(--text3)' }}>Pengaju:</span> {viewing.userName||'—'}</div>
                <div><span style={{ color:'var(--text3)' }}>Nominal:</span> Rp {fmt(viewing.amount)}</div>
                <div><span style={{ color:'var(--text3)' }}>Tgl Bukti:</span> {(()=>{ const d=periodDate(viewing); return d?d.toLocaleDateString('id-ID'):'—' })()}</div>
                <div><span style={{ color:'var(--text3)' }}>Sumber:</span> {viewing.isCashCard?'Cash Card':'Petty Cash'}</div>
                <div><span style={{ color:'var(--text3)' }}>Bank:</span> {viewing.bank||'—'}</div>
                <div><span style={{ color:'var(--text3)' }}>No. Rek:</span> {viewing.noRekening||'—'}</div>
              </div>
              <div>
                <div style={{ fontSize:11, color:'var(--text3)', marginBottom:5 }}>Evidence ({evidenceCount(viewing)} file):</div>
                {hasEvidence(viewing) ? (
                  <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                    {viewing.documents.map((d:any, i:number) => (
                      <a key={i} href={d.url} download={d.name} className="btn btn-sm" style={{ justifyContent:'flex-start', textDecoration:'none' }}>📄 {d.name||`evidence_${i+1}`}</a>
                    ))}
                  </div>
                ) : <div style={{ fontSize:11, color:'var(--red)' }}>Belum ada evidence diupload.</div>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ padding:'12px 20px', borderBottom:'1px solid var(--border)', background:'var(--bg2)', display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12, flexWrap:'wrap', flexShrink:0 }}>
        <div>
          <div style={{ fontSize:14, fontWeight:600 }}>Settlement CC — Report</div>
          <div style={{ fontSize:11, color:'var(--text3)' }}>Tarik & download evidence reimbursement untuk upload bukti settlement ke Jojonomic</div>
        </div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          <button onClick={exportCSV} className="btn btn-sm" disabled={loading||filtered.length===0}>📊 Export Ringkasan (CSV)</button>
          <button onClick={exportZIP} className="btn btn-sm btn-primary" disabled={loading||zipping||summary.lengkap===0}>{zipping?'Mengompres...':'🗜 Download Semua Evidence (ZIP)'}</button>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display:'flex', gap:10, padding:'10px 20px', background:'var(--bg2)', borderBottom:'1px solid var(--border)', flexWrap:'wrap', alignItems:'center', flexShrink:0 }}>
        <select className="input input-sm" style={{ width:130 }} value={month} onChange={e=>setMonth(Number(e.target.value))}>
          {MONTHS.map((m,i)=><option key={i} value={i}>{m}</option>)}
        </select>
        <select className="input input-sm" style={{ width:90 }} value={year} onChange={e=>setYear(Number(e.target.value))}>
          {yearOptions.map(y=><option key={y} value={y}>{y}</option>)}
        </select>
        <div style={{ display:'flex', gap:5, marginLeft:6 }}>
          <button onClick={()=>setAllSources(false)} style={chip(!allSources)}>Cash Card</button>
          <button onClick={()=>setAllSources(true)} style={chip(allSources)}>Semua Sumber</button>
        </div>
        <div style={{ width:1, height:20, background:'var(--border)' }} />
        <div style={{ display:'flex', gap:5 }}>
          <button onClick={()=>setStatusTab('done')} style={chip(statusTab==='done','var(--green)')}>Done</button>
          <button onClick={()=>setStatusTab('pending')} style={chip(statusTab==='pending','var(--amber)')}>Menunggu</button>
          <button onClick={()=>setStatusTab('all')} style={chip(statusTab==='all')}>Semua Status</button>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:10, padding:'12px 20px', flexShrink:0 }}>
        <SummaryCard label="Total Transaksi" value={String(summary.count)} />
        <SummaryCard label="Total Nominal" value={`Rp ${fmt(summary.totalNominal)}`} />
        <SummaryCard label="Evidence Lengkap" value={String(summary.lengkap)} color="var(--green)" />
        <SummaryCard label="Evidence Belum Lengkap" value={String(summary.belum)} color={summary.belum>0?'var(--red)':'var(--text3)'} />
      </div>

      {/* Table */}
      <div style={{ flex:1, overflowY:'auto', padding:'0 20px 14px' }} className="safe-bottom page-pad">
        {loading ? <div style={{ textAlign:'center', padding:40, color:'var(--text3)' }}>Memuat...</div> :
         filtered.length === 0 ? (
          <div className="card" style={{ textAlign:'center', padding:40, color:'var(--text3)' }}>
            <div style={{ fontSize:30, marginBottom:8 }}>🧾</div>
            <div>Tidak ada transaksi pada {MONTHS[month]} {year}</div>
            <div style={{ fontSize:11, marginTop:4 }}>Coba ganti periode, sumber, atau status di atas.</div>
          </div>
         ) : (
          <div className="card" style={{ overflow:'auto' }}>
            <table className="wp-table" style={{ minWidth:920 }}>
              <thead><tr><th>No</th><th>Tanggal</th><th>Pengaju</th><th>Keperluan</th><th>Nominal</th><th>Bank / Rek</th><th>Sumber</th><th>Status</th><th>Evidence</th><th></th></tr></thead>
              <tbody>
                {filtered.map((r,i) => {
                  const d = periodDate(r)
                  const lengkap = hasEvidence(r)
                  return (
                    <tr key={r._id} style={{ cursor:'pointer' }} onClick={()=>setViewing(r)}>
                      <td style={{ fontSize:11, color:'var(--text3)' }}>{i+1}</td>
                      <td style={{ fontSize:11, color:'var(--text2)' }}>{d?d.toLocaleDateString('id-ID'):'—'}</td>
                      <td style={{ fontSize:11 }}>{r.userName||'—'}</td>
                      <td style={{ fontSize:11 }}>
                        <div style={{ fontWeight:600 }}>{r.title}</div>
                        {r.description && <div style={{ color:'var(--text3)', fontSize:10 }}>{r.description.substring(0,50)}</div>}
                      </td>
                      <td style={{ fontWeight:600 }}>Rp {fmt(r.amount)}</td>
                      <td style={{ fontSize:11 }}>{r.bank||'—'}<br/><span style={{ color:'var(--text3)', fontSize:10 }}>{r.noRekening||''}</span></td>
                      <td><span className="badge" style={{ background:r.isCashCard?'var(--brand-soft)':'var(--bg3)', color:r.isCashCard?'var(--brand)':'var(--text2)', fontSize:9 }}>{r.isCashCard?'Cash Card':'Petty Cash'}</span></td>
                      <td>{statusBadge(r.status)}</td>
                      <td>
                        <span className="badge" style={{ background:lengkap?'var(--greenbg)':'var(--redbg)', color:lengkap?'var(--green)':'var(--red)', fontSize:9 }}>
                          {lengkap ? `Lengkap · ${evidenceCount(r)}` : 'Belum'}
                        </span>
                      </td>
                      <td onClick={e=>e.stopPropagation()}>
                        <button onClick={()=>setViewing(r)} className="btn btn-sm" style={{ fontSize:10 }}>Lihat</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
         )}
      </div>
    </div>
  )
}

function SummaryCard({ label, value, color }: { label:string; value:string; color?:string }) {
  return (
    <div className="card" style={{ padding:'12px 14px' }}>
      <div style={{ fontSize:10, color:'var(--text3)', marginBottom:4, textTransform:'uppercase', letterSpacing:0.3 }}>{label}</div>
      <div style={{ fontSize:18, fontWeight:700, color:color||'var(--text)' }}>{value}</div>
    </div>
  )
}

function statusBadge(s:string) {
  const cfg: Record<string,{label:string;color:string;bg:string}> = {
    submitted: { label:'Menunggu', color:'var(--amber)', bg:'var(--amberbg)' },
    approved: { label:'Menunggu', color:'var(--amber)', bg:'var(--amberbg)' },
    draft: { label:'Draft', color:'var(--text3)', bg:'var(--bg3)' },
    reversal_requested: { label:'Pembatalan', color:'var(--amber)', bg:'var(--amberbg)' },
    reversal_approved: { label:'Dibatalkan', color:'var(--red)', bg:'var(--redbg)' },
    done: { label:'Done', color:'var(--green)', bg:'var(--greenbg)' },
    paid: { label:'Done', color:'var(--green)', bg:'var(--greenbg)' },
    rejected: { label:'Ditolak', color:'var(--red)', bg:'var(--redbg)' },
  }
  const c = cfg[s] || { label:s, color:'var(--text3)', bg:'var(--bg3)' }
  return <span className="badge" style={{ background:c.bg, color:c.color, fontSize:9 }}>{c.label}</span>
}

function chip(active:boolean, color:string='var(--brand)'):React.CSSProperties {
  return { padding:'4px 11px', borderRadius:20, fontSize:11, fontWeight:600, cursor:'pointer', border:`1px solid ${active?color:'var(--border)'}`, background:active?color+'1a':'var(--bg3)', color:active?color:'var(--text2)' }
}
