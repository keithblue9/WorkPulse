'use client'
import { cachedFetch } from '@/lib/fetchCache'
import { getConfig } from '@/lib/configCache'
import { OE_CATEGORIES, oeLookup } from '@/lib/defaults'
import { useSort, sortRows, SortTh } from '@/lib/useSort'
import { EvidenceList } from '@/components/EvidenceList'
import { MoneyInput } from '@/components/MoneyInput'
import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'

const fmt = (n:number) => new Intl.NumberFormat('id-ID').format(n||0)

// Kompres gambar besar jadi JPEG ~1600px lebar biar payload evidence ga kena limit body Vercel
async function compressImage(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const maxW = 1600
      const scale = img.width > maxW ? maxW / img.width : 1
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) { resolve(dataUrl); return }
      ctx.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/jpeg', 0.72))
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}
const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']

function periodDate(r:any):Date|null {
  const raw = r.billDate || r.submittedAt || r.createdAt
  if (!raw) return null
  const d = new Date(raw)
  return isNaN(d.getTime()) ? null : d
}

// =====================  PERHATIAN popup  =====================
function PerhatianPopup({ onOk, onClose }: { onOk:()=>void; onClose:()=>void }) {
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ width:480 }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:20 }}>⚠️</span>
          <span style={{ fontSize:15, fontWeight:700, color:'var(--amber)' }}>PERHATIAN!</span>
        </div>
        <div style={{ padding:'16px 20px', fontSize:12.5, lineHeight:1.7, color:'var(--text2)' }}>
          <div style={{ marginBottom:10 }}>Jika memilih Reimbursement <b>&apos;Cash Card&apos;</b>, pastikan:</div>
          <ol style={{ margin:'0 0 12px 18px', padding:0, display:'flex', flexDirection:'column', gap:5 }}>
            <li>Mengisi Judul Agenda/Calmet pada field <b>&apos;Keperluan&apos;</b></li>
            <li><i>Upload evidence</i> Agenda/Calmet beserta bill/nota/struk</li>
          </ol>
          <div style={{ padding:'10px 12px', background:'var(--amberbg)', borderRadius:8, color:'var(--text)' }}>
            Pengajuan Reimbursement adalah <b>per transaksi / per toko</b>. Pengajuan multi-transaksi akan <b>direject</b>.
          </div>
        </div>
        <div style={{ padding:'12px 20px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'flex-end' }}>
          <button onClick={onOk} className="btn btn-primary">Ok, saya mengerti!</button>
        </div>
      </div>
    </div>
  )
}

// =====================  Form Pengajuan  =====================
function ReimburseForm({ editing, onClose, onSave }: { editing?:any; onClose:()=>void; onSave:()=>void }) {
  const { data:session } = useSession(); const user = session?.user as any
  const [form, setForm] = useState({
    title: editing?.title || '',
    description: editing?.description || '',
    tokoPenjual: editing?.tokoPenjual || '',
    amount: editing?.amount || 0,
    category: editing?.category || '',
    source: editing?.source || (editing?.isCashCard ? 'cash_card' : ''),
    bank: editing?.bank || '',
    noRekening: editing?.noRekening || '',
    billDate: editing?.billDate || '',
    documents: editing?.documents || [],
  })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const set = (k:string,v:any) => setForm(f=>({...f,[k]:v}))

  useEffect(() => {
    if (editing) return
    let cancelled = false
    fetch('/api/profile').then(r=>r.json()).then(pr => {
      if (cancelled) return
      const p = pr?.data
      if (p) setForm(f => ({ ...f, bank: f.bank || p.bank || '', noRekening: f.noRekening || p.noRekening || '' }))
    }).catch(()=>{})
    return () => { cancelled = true }
  }, [editing])

  async function handleFileUpload(files: FileList | null, slot: string = 'bukti') {
    if (!files || files.length === 0) return
    setUploading(true)
    const newDocs: any[] = []
    for (const file of Array.from(files)) {
      if (file.size > 15 * 1024 * 1024) { toast.error(`${file.name}: maks 15MB`); continue }
      // 1) Coba upload ke Vercel Blob (file besar, ga inline di DB). 2) Fallback base64 kalau Blob belum dikonfigurasi.
      let uploaded: any = null
      try {
        let toUpload: Blob = file
        // kompres gambar besar dulu biar hemat storage & cepat
        if (file.type.startsWith('image/') && file.size > 800 * 1024) {
          try {
            const dataUrl: string = await new Promise(res => { const r=new FileReader(); r.onload=e=>res(e.target?.result as string); r.readAsDataURL(file) })
            const compressed = await compressImage(dataUrl)
            const blob = await (await fetch(compressed)).blob()
            if (blob.size < file.size) toUpload = blob
          } catch {}
        }
        const { upload } = await import('@vercel/blob/client')
        const result = await upload(`reimburse/${Date.now()}-${file.name}`, toUpload, {
          access: 'public', handleUploadUrl: '/api/blob/upload', contentType: file.type,
        })
        uploaded = { url: result.url, name: file.name, type: file.type, size: file.size, blob: true, slot }
      } catch (err) {
        // Fallback: base64 inline (untuk file kecil / kalau Blob token belum ada)
        try {
          const reader = new FileReader()
          let dataUrl: string = await new Promise(resolve => { reader.onload = e => resolve(e.target?.result as string); reader.readAsDataURL(file) })
          if (file.type.startsWith('image/') && file.size > 800 * 1024) { try { dataUrl = await compressImage(dataUrl) } catch {} }
          if (dataUrl.length > 4_000_000) { toast.error(`${file.name} terlalu besar & Blob storage belum aktif. Perkecil file dulu.`); continue }
          uploaded = { url: dataUrl, name: file.name, type: file.type, size: file.size, slot }
        } catch { toast.error(`Gagal upload ${file.name}`); continue }
      }
      if (uploaded) newDocs.push(uploaded)
    }
    setForm(f=>({...f, documents: [...f.documents, ...newDocs] })); setUploading(false)
    if (newDocs.length) toast.success(`${newDocs.length} file diupload`)
  }
  function removeDoc(i:number) { setForm(f=>({...f, documents: f.documents.filter((_:any,idx:number)=>idx!==i) })) }

  // ── Bukti per kategori ──
  // Petty Cash: satu area 'bukti' (wajib) — tidak berubah dari sebelumnya.
  // Cash Card : Calmeet, Details Invoice, Dokumentasi (wajib) + Bukti TF (opsional).
  const isCC = form.source === 'cash_card'
  const CC_SLOTS = [
    { key:'calmeet',     label:'1) Calmeet',        required:true },
    { key:'invoice',     label:'2) Details Invoice', required:true },
    { key:'dokumentasi', label:'3) Dokumentasi',    required:true },
    { key:'buktitf',     label:'4) Bukti TF',       required:false },
  ]
  // Dokumen lama tanpa slot dianggap 'bukti' supaya data lama tetap terbaca
  const docsOf = (slot:string) => (form.documents||[]).filter((d:any)=> (d?.slot || 'bukti') === slot)
  const idxOf = (d:any) => (form.documents||[]).indexOf(d)

  function validate():string[] {
    const e:string[] = []
    if (!form.title.trim()) e.push(isCC ? 'Nama Calmeet' : 'Keperluan')
    if (!form.amount || form.amount<=0) e.push('Nominal')
    if (!form.billDate) e.push('Tgl Bukti / Bill Date')
    if (!form.category) e.push('Kategori')
    if (!form.source) e.push('Sumber (Cash Card / Petty Cash)')
    if (!form.bank.trim()) e.push('Bank')
    if (!form.noRekening.trim()) e.push('No. Rekening')
    if (!form.tokoPenjual.trim()) e.push('Toko/Penjual')
    if (isCC) {
      // Bukti TF sengaja tidak divalidasi (opsional)
      for (const s of CC_SLOTS) {
        if (s.required && docsOf(s.key).length === 0) e.push(s.label.replace(/^\d\)\s*/,''))
      }
    } else {
      if (!form.documents || form.documents.length===0) e.push('Evidence / Bukti (minimal 1 file)')
    }
    return e
  }

  async function save() {
    const e = validate()
    setErrors(e)
    if (e.length) { toast.error('Ada field yang belum diisi'); return }
    // Cek hanya bukti yang masih inline base64 (blob URL kecil, aman). Vercel batasi body ~4.5MB.
    const totalBytes = (form.documents||[]).filter((d:any)=>!d.blob && d.url?.startsWith('data:')).reduce((s:number,d:any)=>s+(d.url?.length||0), 0)
    if (totalBytes > 4_000_000) {
      toast.error(`Total bukti inline ${(totalBytes/1_048_576).toFixed(1)}MB terlalu besar. Perkecil file atau pastikan Blob storage aktif.`)
      return
    }
    setSaving(true)
    try {
      const url = editing ? `/api/reimbursements/${editing._id}` : '/api/reimbursements'
      const isResubmit = editing?.status === 'clarification'
      const body: any = {
        ...form, isCashCard: isCC,
        userId: user?.id||user?.email, userName: user?.name,
        // Revisi dari status Clarification -> langsung Waiting for Verification (done), tanpa lewat cashier lagi (sudah dibayar)
        status: isResubmit ? 'done' : (editing ? editing.status : 'submitted'),
        submittedAt: editing?.submittedAt || new Date().toISOString(),
        ...(isResubmit ? { resubmittedAt: new Date().toISOString() } : {}),
      }
      const r = await fetch(url, { method: editing?'PATCH':'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) })
      if (!r.ok) {
        let msg = 'Gagal menyimpan'
        if (r.status === 413) msg = 'File bukti terlalu besar. Kompres/perkecil PDF (maks ±3MB) lalu coba lagi.'
        else { try { const j = await r.json(); if (j?.error) msg = `Gagal: ${j.error}` } catch {} }
        toast.error(msg); return
      }
      if (!editing) {
        try {
          const cfg = await getConfig()
          if (cfg?.fonnte?.cashierUserId) {
            const usersR = await fetch('/api/users').then(r=>r.json())
            const cashier = (usersR.data||[]).find((u:any)=>u._id===cfg.fonnte.cashierUserId || u.roles?.includes('cashier'))
            if (cashier?.phone) {
              const tpl = cfg.fonnte.messageToCashier || ''
              const msg = tpl.replace(/{memberName}/g, user?.name||'-').replace(/{purpose}/g, form.title)
                            .replace(/{amount}/g, 'Rp ' + fmt(form.amount)).replace(/{category}/g, oeLookup(form.category).name)
                            .replace(/{bank}/g, form.bank).replace(/{noRekening}/g, form.noRekening)
              await fetch('/api/fonnte', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ target: cashier.phone, message: msg }) })
            }
          }
        } catch { /* non-blocking */ }
      }
      toast.success(isResubmit ? 'Revisi terkirim — menunggu verifikasi CC Holder' : (editing?'Diperbarui':'Pengajuan terkirim ke Cashier')); onSave(); onClose()
    } finally { setSaving(false) }
  }

  const missing = (f:string) => errors.includes(f)

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ width:560 }}>
        <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between' }}>
          <span style={{ fontSize:14, fontWeight:600 }}>{editing?.status==='clarification' ? '🔄 Revisi Reimburse (Klarifikasi)' : editing?'Edit Reimburse':'+ Pengajuan Reimbursement'}</span>
          <button onClick={onClose} className="btn btn-icon">×</button>
        </div>
        <div style={{ padding:'14px 20px', overflowY:'auto', maxHeight:'72vh', display:'flex', flexDirection:'column', gap:11 }}>
          {editing?.status==='clarification' && editing?.clarifyNote && (
            <div style={{ padding:'10px 12px', background:'#fff3e0', border:'1px solid #f0c07a', borderRadius:8, fontSize:12, color:'#8a5300' }}>
              <b>Catatan dari CC Holder{editing.clarifiedBy?` (${editing.clarifiedBy})`:''}:</b><br/>{editing.clarifyNote}
              <div style={{ marginTop:6, fontSize:11, color:'#a06a1e' }}>Perbaiki/lengkapi evidence sesuai catatan di atas, lalu klik <b>Kirim Ulang</b>. Prosesnya langsung ke verifikasi (tidak lewat cashier lagi).</div>
            </div>
          )}
          {errors.length>0 && (
            <div style={{ padding:'10px 12px', background:'var(--redbg)', border:'1px solid var(--red)', borderRadius:8, fontSize:12, color:'var(--red)' }}>
              <b>Belum lengkap:</b> {errors.join(', ')}
            </div>
          )}
          {/* Baris 1: CC/Petty | Bill Date | Kategori */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1.4fr', gap:10, alignItems:'end' }}>
            <div><label style={lbl}>CC/Petty *</label>
              <select className="input" style={missing('Sumber (Cash Card / Petty Cash)')?errInput:undefined} value={form.source} onChange={e=>set('source',e.target.value)}>
                <option value="">— Pilih —</option>
                <option value="cash_card">Cash Card</option>
                <option value="petty_cash">Petty Cash</option>
              </select></div>
            <div><label style={lbl}>Bill Date *</label><input type="date" className="input" style={missing('Tgl Bukti / Bill Date')?errInput:undefined} value={form.billDate} onChange={e=>set('billDate',e.target.value)} /></div>
            <div><label style={lbl}>Kategori *</label>
              <select className="input" style={missing('Kategori')?errInput:undefined} value={form.category} onChange={e=>set('category',e.target.value)}>
                <option value="">— Pilih kategori —</option>
                {OE_CATEGORIES.map(c=><option key={c.code} value={c.code}>{c.name}</option>)}
                <option value="lainnya">Lainnya</option>
              </select></div>
          </div>
          {/* Baris 2: Bank | No. Rekening | Nominal */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, alignItems:'end' }}>
            <div><label style={lbl}>Bank * <span style={hintS}>(auto)</span></label><input className="input" style={missing('Bank')?errInput:undefined} value={form.bank} onChange={e=>set('bank',e.target.value)} placeholder="BCA, Mandiri..." /></div>
            <div><label style={lbl}>No. Rekening * <span style={hintS}>(auto)</span></label><input className="input" style={missing('No. Rekening')?errInput:undefined} value={form.noRekening} onChange={e=>set('noRekening',e.target.value)} placeholder="dari Biodata" /></div>
            <div><label style={lbl}>Nominal (Rp) *</label><MoneyInput currency="IDR" className="input" style={missing('Nominal')?errInput:undefined} value={form.amount} onChange={n=>set('amount',n)} /></div>
          </div>
          {/* Baris 3: Toko/Penjual | Keperluan (Cash Card -> Nama Calmeet) */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1.6fr', gap:10, alignItems:'end' }}>
            <div><label style={lbl}>Toko/Penjual *</label><input className="input" style={missing('Toko/Penjual')?errInput:undefined} value={form.tokoPenjual} onChange={e=>set('tokoPenjual',e.target.value)} placeholder="Nama toko/penjual/penerima" /></div>
            {isCC ? (
              <div><label style={lbl}>Nama Calmeet * <span style={hintS}>(sebelumnya: Keperluan)</span></label>
                <input className="input" style={missing('Nama Calmeet')?errInput:undefined} value={form.title} onChange={e=>set('title',e.target.value)} placeholder="Masukkan nama Calmeet" /></div>
            ) : (
              <div><label style={lbl}>Keperluan *</label>
                <input className="input" style={missing('Keperluan')?errInput:undefined} value={form.title} onChange={e=>set('title',e.target.value)} placeholder="Misal: Konsumsi meeting BPD Procurement" /></div>
            )}
          </div>

          {isCC ? (
            /* CASH CARD: 4 kotak bukti terpisah (1-3 wajib, Bukti TF opsional) */
            <div>
              <label style={lbl}>Bukti / Dokumen Pendukung <span style={{ fontWeight:400, color:'var(--text3)', fontSize:9 }}>(wajib 1, 2, 3 · Bukti TF opsional)</span></label>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:8 }}>
                {CC_SLOTS.map(s => {
                  const docs = docsOf(s.key)
                  const err = s.required && missing(s.label.replace(/^\d\)\s*/,''))
                  return (
                    <div key={s.key}>
                      <div style={{ fontSize:10.5, fontWeight:600, marginBottom:4, color: err ? 'var(--red)' : 'var(--text2)' }}>
                        {s.label} {s.required ? <span style={{ color:'var(--red)' }}>*</span> : <span style={{ fontWeight:400, color:'var(--text3)' }}>(Opsional)</span>}
                      </div>
                      <label style={{ display:'block', padding:'14px 8px', borderRadius:8, border:`2px dashed ${err?'var(--red)':(docs.length?'var(--brand)':'var(--border2)')}`, background: docs.length?'var(--brand-soft)':'var(--bg3)', cursor:'pointer', textAlign:'center', fontSize:10.5, color: docs.length?'var(--brand)':'var(--text2)' }}>
                        <input type="file" multiple accept="image/*,application/pdf" onChange={e=>handleFileUpload(e.target.files, s.key)} style={{ display:'none' }} />
                        {uploading ? 'Mengupload...' : (docs.length ? `✓ ${docs.length} file` : '📎 Klik untuk upload')}
                        <div style={{ fontSize:9, color:'var(--text3)', marginTop:3 }}>(PDF/gambar · maks 15MB/file)</div>
                      </label>
                      {docs.length > 0 && (
                        <div style={{ marginTop:5, display:'flex', flexDirection:'column', gap:3 }}>
                          {docs.map((d:any, i:number) => (
                            <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:4, padding:'4px 7px', background:'var(--bg3)', borderRadius:5 }}>
                              <span style={{ fontSize:9.5, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={d.name}>📄 {d.name}</span>
                              <button onClick={()=>removeDoc(idxOf(d))} className="btn btn-icon btn-sm" style={{ color:'var(--red)', fontSize:11, flexShrink:0 }}>×</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              {/* Lampiran yang diupload sebelum ganti sumber — ditampilkan agar tidak ada file tersembunyi */}
              {docsOf('bukti').length > 0 && (
                <div style={{ marginTop:8 }}>
                  <div style={{ fontSize:10.5, fontWeight:600, color:'var(--text2)', marginBottom:4 }}>Lampiran lain <span style={{ fontWeight:400, color:'var(--text3)' }}>(diupload sebelum pindah ke Cash Card)</span></div>
                  <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                    {docsOf('bukti').map((d:any, i:number) => (
                      <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'5px 9px', background:'var(--bg3)', borderRadius:6 }}>
                        <span style={{ fontSize:10.5 }}>📄 {d.name}</span>
                        <button onClick={()=>removeDoc(idxOf(d))} className="btn btn-icon btn-sm" style={{ color:'var(--red)' }}>×</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* PETTY CASH: satu area bukti seperti sebelumnya */
            <div>
              <label style={lbl}>Bukti / Dokumen Pendukung * <span style={{ fontWeight:400, color:'var(--text3)', fontSize:9 }}>(bill/nota/struk + agenda)</span></label>
              <label style={{ display:'block', padding:'18px', borderRadius:8, border:`2px dashed ${missing('Evidence / Bukti (minimal 1 file)')?'var(--red)':'var(--border2)'}`, background:'var(--bg3)', cursor:'pointer', textAlign:'center', fontSize:11, color:'var(--text2)' }}>
                <input type="file" multiple accept="image/*,application/pdf" onChange={e=>handleFileUpload(e.target.files,'bukti')} style={{ display:'none' }} />
                {uploading ? 'Mengupload...' : '📎 Klik untuk upload (PDF/gambar · maks 15MB/file)'}
              </label>
              {form.documents.length > 0 && (
                <div style={{ marginTop:6, display:'flex', flexDirection:'column', gap:4 }}>
                  {form.documents.map((d:any, i:number) => (
                    <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 10px', background:'var(--bg3)', borderRadius:6 }}>
                      <span style={{ fontSize:11 }}>📄 {d.name} <span style={{ color:'var(--text3)' }}>({Math.round((d.size||0)/1024)}KB)</span></span>
                      <button onClick={()=>removeDoc(i)} className="btn btn-icon btn-sm" style={{ color:'var(--red)' }}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div style={{ padding:'12px 20px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'flex-end', gap:8 }}>
          <button onClick={onClose} className="btn">Batal</button>
          <button onClick={save} disabled={saving} className="btn btn-primary">{saving?'...':(editing?.status==='clarification'?'🔄 Kirim Ulang':'Submit')}</button>
        </div>
      </div>
    </div>
  )
}

// =====================  Detail viewer  =====================
function DetailModal({ item, onClose, onDelete, onEdit }: { item:any; onClose:()=>void; onDelete?:()=>void; onEdit?:()=>void }) {
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ width:520 }}>
        <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between' }}>
          <span style={{ fontSize:14, fontWeight:600 }}>Detail Reimburse</span>
          <button onClick={onClose} className="btn btn-icon">×</button>
        </div>
        <div style={{ padding:'14px 20px', display:'flex', flexDirection:'column', gap:10, fontSize:12 }}>
          <div><b>{item.title}</b></div>
          {item.description && <div style={{ color:'var(--text2)' }}>{item.description}</div>}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, fontSize:11 }}>
            <div><span style={{ color:'var(--text3)' }}>Pengaju:</span> {item.userName}</div>
            <div><span style={{ color:'var(--text3)' }}>Nominal:</span> Rp {fmt(item.amount)}</div>
            <div><span style={{ color:'var(--text3)' }}>Kategori:</span> {oeLookup(item.category).code} · {oeLookup(item.category).name}</div>
            <div><span style={{ color:'var(--text3)' }}>Bill Date:</span> {item.billDate ? new Date(item.billDate).toLocaleDateString('id-ID') : '—'}</div>
            <div><span style={{ color:'var(--text3)' }}>Toko/Penjual:</span> {item.tokoPenjual||'—'}</div>
            <div><span style={{ color:'var(--text3)' }}>Keperluan:</span> {item.title}</div>
            <div><span style={{ color:'var(--text3)' }}>Bank:</span> {item.bank}</div>
            <div><span style={{ color:'var(--text3)' }}>No. Rek:</span> {item.noRekening}</div>
            <div><span style={{ color:'var(--text3)' }}>Sumber:</span> {item.isCashCard?'Cash Card':'Petty Cash'}</div>
            <div><span style={{ color:'var(--text3)' }}>Status:</span> {statusBadge(item.status)}</div>
            {item.biayaAntarBank > 0 && <div><span style={{ color:'var(--text3)' }}>Biaya antar bank:</span> Rp {fmt(item.biayaAntarBank)}</div>}
            {item.totalTransfer && <div><span style={{ color:'var(--text3)' }}>Total transfer:</span> Rp {fmt(item.totalTransfer)}</div>}
          </div>
          {item.rejectReason && <div style={{ fontSize:11, color:'var(--red)' }}>Alasan ditolak: {item.rejectReason}</div>}
          {item.status==='clarification' && item.clarifyNote && (
            <div style={{ fontSize:11, background:'#fff3e0', border:'1px solid #f0c07a', borderRadius:8, padding:'8px 10px', color:'#8a5300' }}>
              <b>Perlu klarifikasi{item.clarifiedBy?` (dari ${item.clarifiedBy})`:''}:</b><br/>{item.clarifyNote}
            </div>
          )}
          {item.documents?.length > 0 && (
            <EvidenceList itemId={item._id} documents={item.documents} zipName={`evidence_${(item.title||'reimburse').replace(/\s+/g,'_')}`} />
          )}
        </div>
        {(onDelete || onEdit) && (
          <div style={{ padding:'12px 20px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'space-between' }}>
            {onDelete ? <button onClick={onDelete} className="btn btn-sm btn-danger">🗑 Hapus Reimburse</button> : <span />}
            {onEdit ? <button onClick={onEdit} className="btn btn-sm btn-primary" style={{ background:'#b45309' }}>🔄 Revisi & Kirim Ulang</button> : <button onClick={onClose} className="btn btn-sm">Tutup</button>}
          </div>
        )}
      </div>
    </div>
  )
}

// =====================  Transfer modal (Cashier)  =====================
function TransferModal({ item, onClose, onSave }: { item:any; onClose:()=>void; onSave:()=>void }) {
  const { data:session } = useSession(); const user = session?.user as any
  const [hasBiaya, setHasBiaya] = useState(item.hasBiayaAntarBank || false)
  const [biaya, setBiaya] = useState(item.biayaAntarBank || 0)
  const [source, setSource] = useState<'cash_card'|'petty_cash'>(item.isCashCard ? 'cash_card' : 'petty_cash')
  const [processing, setProcessing] = useState(false)
  const total = (item.amount || 0) + (hasBiaya ? biaya : 0)
  const billStr = item.billDate ? new Date(item.billDate).toLocaleDateString('id-ID') : '—'
  const submitStr = item.submittedAt ? new Date(item.submittedAt).toLocaleDateString('id-ID') : '—'

  async function doTransfer() {
    setProcessing(true)
    try {
      const isCC = source === 'cash_card'
      // Petty Cash: setelah ditransfer cashier langsung SELESAI (verified), ga lewat settlement CC.
      // Cash Card: masuk 'done' (Waiting for Verification) utk diverifikasi CC saat settlement.
      const now = new Date().toISOString()
      const statusPayload: any = isCC
        ? { status:'done' }
        : { status:'verified', verifiedAt: now, verifiedBy: `${user?.name||'Cashier'} (Petty Cash)` }
      const updateRes = await fetch(`/api/reimbursements/${item._id}`, {
        method:'PATCH', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ ...statusPayload, isCashCard:isCC, source, hasBiayaAntarBank: hasBiaya, biayaAntarBank: hasBiaya ? biaya : 0, totalTransfer: total, transferredAt: now, transferredBy: user?.name, whatsappSent: true })
      })
      if (!updateRes.ok) { toast.error('Gagal update'); return }
      try {
        const cfg = await getConfig()
        const usersR = await fetch('/api/users').then(r=>r.json())
        const member = (usersR.data||[]).find((u:any)=>u.name===item.userName || u.email===item.userId)
        if (member?.phone) {
          const tpl = cfg?.fonnte?.messageToMember || ''
          const msg = tpl.replace(/{memberName}/g, item.userName||'-').replace(/{purpose}/g, item.title)
                        .replace(/{amount}/g, 'Rp ' + fmt(total)).replace(/{category}/g, oeLookup(item.category).name)
                        .replace(/{bank}/g, item.bank).replace(/{noRekening}/g, item.noRekening)
          await fetch('/api/fonnte', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ target: member.phone, message: msg }) })
        }
      } catch { /* non-blocking */ }
      toast.success('Transferred & notified via WhatsApp'); onSave(); onClose()
    } finally { setProcessing(false) }
  }

  async function doReject() {
    const reason = prompt('Alasan reject reimburse ini? (opsional)')
    if (reason === null) return
    setProcessing(true)
    try {
      const r = await fetch(`/api/reimbursements/${item._id}`, { method:'PATCH', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ status:'rejected', rejectReason: reason||'', rejectedAt: new Date().toISOString(), rejectedBy: user?.name }) })
      if (!r.ok) { toast.error('Gagal reject'); return }
      toast.success('Reimburse ditolak'); onSave(); onClose()
    } finally { setProcessing(false) }
  }

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ width:520 }}>
        <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between' }}>
          <span style={{ fontSize:14, fontWeight:600 }}>Transfer Reimburse</span>
          <button onClick={onClose} className="btn btn-icon">×</button>
        </div>
        <div style={{ padding:'14px 20px', display:'flex', flexDirection:'column', gap:11 }}>
          {/* Header: {Nama} | {Kategori} | {CC/Petty}        {Submit Date} */}
          <div className="card" style={{ padding:'10px 12px', background:'var(--bg3)', fontSize:12 }}>
            <div style={{ display:'flex', justifyContent:'space-between' }}>
              <div><b>{item.userName}</b> · {oeLookup(item.category).name} · <span style={{ color:'var(--brand)' }}>{source==='cash_card'?'Cash Card':'Petty Cash'}</span></div>
              <div style={{ color:'var(--text3)', fontSize:10 }}>Submit: {submitStr}</div>
            </div>
            <div style={{ color:'var(--text2)', fontSize:11, marginTop:4 }}>Bank: {item.bank} · No. Rek: {item.noRekening}</div>
            <div style={{ color:'var(--text2)', fontSize:11 }}>Keperluan: {item.title} · Toko: {item.tokoPenjual||'—'}</div>
            <div style={{ color:'var(--text2)', fontSize:11 }}>Nominal: <b>Rp {fmt(item.amount)}</b></div>
          </div>

          {/* Evidence + Bill date */}
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'var(--text3)', marginBottom:4 }}><span>Bill Date: {billStr}</span></div>
            {(item.documents||[]).length>0
              ? <EvidenceList itemId={item._id} documents={item.documents} zipName={`evidence_${(item.title||'reimburse').replace(/\s+/g,'_')}`} />
              : <div style={{ fontSize:11, color:'var(--red)' }}>Belum ada evidence.</div>}
          </div>

          <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, cursor:'pointer' }}>
            <input type="checkbox" checked={hasBiaya} onChange={e=>setHasBiaya(e.target.checked)} /> Biaya Antar Bank
            {hasBiaya && <MoneyInput currency="IDR" className="input input-sm" style={{ width:150, marginLeft:'auto' }} value={biaya} onChange={n=>setBiaya(n)} placeholder="6.500" />}
          </label>

          <div style={{ padding:'14px 16px', background:'var(--brand-soft)', borderRadius:10, border:'1px solid var(--brand)' }}>
            <div style={{ fontSize:10, color:'var(--brand)', textTransform:'uppercase', fontWeight:600, letterSpacing:'0.06em' }}>Total Transfer</div>
            <div style={{ fontSize:22, fontWeight:800, color:'var(--brand)' }}>Rp {fmt(total)}</div>
          </div>

          {/* Sumber: Cash Card / Petty Cash (cashier bisa ganti saat transfer) */}
          <div style={{ display:'flex', gap:16, fontSize:12 }}>
            <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer' }}>
              <input type="radio" name="src" checked={source==='cash_card'} onChange={()=>setSource('cash_card')} /> Cash Card
            </label>
            <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer' }}>
              <input type="radio" name="src" checked={source==='petty_cash'} onChange={()=>setSource('petty_cash')} /> Petty Cash
            </label>
          </div>
        </div>
        <div style={{ padding:'12px 20px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'space-between', gap:8 }}>
          <button onClick={doReject} disabled={processing} className="btn btn-danger">Reject</button>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={onClose} className="btn">Batal</button>
            <button onClick={doTransfer} disabled={processing} className="btn btn-primary">{processing?'...':'💸 Submit Transfer'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// =====================  PAGE  =====================
export default function ReimbursementPage() {
  const { data:session } = useSession(); const user = session?.user as any
  const userRoles = user?.roles || (user?.role ? [user.role] : [])
  const isCashierish = userRoles.includes('admin') || userRoles.includes('manager') || userRoles.includes('finance') || userRoles.includes('cashier')

  const [tab, setTab] = useState<'pengajuan'|'cashier'>('pengajuan')
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string>('')

  async function load(force = false) {
    setLoading(true); setLoadError('')
    try {
      // Dipakai bersama dgn halaman Operasional -> cache singkat mencegah
      // request berulang tiap pindah tab / buka-tutup halaman.
      const r = await cachedFetch('/api/reimbursements', 30_000, force)
      setItems(r?.data || [])
    } catch (e:any) {
      // Penting: jangan tampilkan sebagai "data kosong" — data kemungkinan masih ada,
      // hanya gagal dimuat. Kalau di-set [] user mengira datanya hilang.
      setLoadError(e?.message || 'Gagal memuat data')
      toast.error('Gagal memuat data reimbursement')
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])
  // Setelah ada perubahan (submit/verify/hapus) -> ambil data terbaru
  const reloadFresh = () => load(true)

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ padding:'12px 20px 0', borderBottom:'1px solid var(--border)', background:'var(--bg2)', flexShrink:0 }}>
        <div style={{ fontSize:14, fontWeight:600 }}>Reimbursement</div>
        {loadError && (
          <div style={{ margin:'10px 0 0', padding:'10px 14px', borderRadius:8, background:'#dc262614', border:'1px solid var(--red)', display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
            <span style={{ fontSize:12, color:'var(--red)', fontWeight:600 }}>⚠️ Gagal memuat data — data kamu tidak hilang, hanya belum berhasil dimuat.</span>
            <span style={{ fontSize:11, color:'var(--text3)' }}>{loadError}</span>
            <button onClick={reloadFresh} className="btn btn-sm" style={{ marginLeft:"auto" }}>🔄 Coba lagi</button>
          </div>
        )}
        <div style={{ display:'flex', gap:4, marginTop:10 }}>
          <button onClick={()=>setTab('pengajuan')} style={subtab(tab==='pengajuan')}>Pengajuan</button>
          {isCashierish && <button onClick={()=>setTab('cashier')} style={subtab(tab==='cashier')}>Cashier</button>}
        </div>
      </div>
      {tab==='pengajuan'
        ? <PengajuanTab items={items} loading={loading} reload={reloadFresh} user={user} isAdminish={isCashierish} />
        : <CashierTab items={items} loading={loading} reload={reloadFresh} />}
    </div>
  )
}

// ---------------------  TAB: Pengajuan  ---------------------
function PengajuanTab({ items, loading, reload, user, isAdminish }: { items:any[]; loading:boolean; reload:()=>void; user:any; isAdminish:boolean }) {
  const [showPerhatian, setShowPerhatian] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [viewing, setViewing] = useState<any>(null)
  const [statusTab, setStatusTab] = useState<'all'|'submitted'|'done'|'verified'|'clarification'>('all')
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState<number>(-1)

  const visible = isAdminish ? items : items.filter(i => i.userName === user?.name || i.userId === user?.id || i.userId === user?.email)

  const yearOptions = useMemo(() => {
    const ys = new Set<number>([now.getFullYear(), now.getFullYear()-1, now.getFullYear()+1])
    visible.forEach(r => { const d = periodDate(r); if (d) ys.add(d.getFullYear()) })
    return Array.from(ys).sort((a,b)=>b-a)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  const byPeriod = useMemo(() => visible.filter(r => {
    const d = periodDate(r); if (!d) return false
    if (d.getFullYear() !== year) return false
    if (month >= 0 && d.getMonth() !== month) return false
    return true
  }), [visible, year, month])

  const stats = useMemo(() => ({
    all: byPeriod.length,
    submitted: byPeriod.filter(i=>['submitted','approved','draft'].includes(i.status)).length,
    done: byPeriod.filter(i=>i.status==='done'||i.status==='paid').length,
    verified: byPeriod.filter(i=>i.status==='verified').length,
    clarification: byPeriod.filter(i=>i.status==='clarification').length,
  }), [byPeriod])

  const filtered = useMemo(() => byPeriod.filter(i => {
    if (statusTab==='all') return true
    if (statusTab==='submitted') return ['submitted','approved','draft'].includes(i.status)
    if (statusTab==='done') return i.status==='done'||i.status==='paid'
    if (statusTab==='clarification') return i.status==='clarification'
    return i.status==='verified'
  }), [byPeriod, statusTab])

  const sort = useSort('billDate','desc')
  const sorted = useMemo(()=>sortRows(filtered, sort.sortKey, sort.sortDir, {
    source:    (r:any)=>r.isCashCard?'Cash Card':'Petty Cash',
    billDate:  (r:any)=>periodDate(r)?.getTime() ?? 0,
    kategori:  (r:any)=>oeLookup(r.category).name,
    bank:      (r:any)=>r.bank||'',
    amount:    (r:any)=>r.amount||0,
    status:    (r:any)=>r.status||'',
    pengaju:   (r:any)=>r.userName||'',
  }), [filtered, sort.sortKey, sort.sortDir])

  async function approveReversal(item:any, e:any) {
    e.stopPropagation()
    if (!confirm(`Setujui pembatalan reimburse "${item.title}"?`)) return
    await fetch(`/api/reimbursements/${item._id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ status:'reversal_approved', reversalApprovedAt: new Date().toISOString() }) })
    toast.success('Pembatalan disetujui.'); reload()
  }
  async function deleteItem(item:any, e?:any) {
    e?.stopPropagation?.()
    if (!confirm(`Hapus reimburse "${item.title}" yang ditolak?`)) return
    await fetch(`/api/reimbursements/${item._id}`, { method:'DELETE' })
    toast.success('Reimburse dihapus'); setViewing(null); reload()
  }

  return (
    <>
      {showPerhatian && <PerhatianPopup onClose={()=>setShowPerhatian(false)} onOk={()=>{ setShowPerhatian(false); setShowForm(true) }} />}
      {(showForm||editing) && <ReimburseForm editing={editing} onClose={()=>{setShowForm(false);setEditing(null)}} onSave={reload} />}
      {viewing && <DetailModal item={viewing} onClose={()=>setViewing(null)}
        onDelete={viewing.status==='rejected'?()=>deleteItem(viewing):undefined}
        onEdit={viewing.status==='clarification' && (viewing.userName===user?.name || viewing.userId===user?.id || viewing.userId===user?.email) ? async ()=>{
          // Daftar dimuat tanpa isi file — ambil versi lengkap dulu agar evidence lama
          // tidak hilang saat pengajuan dikirim ulang.
          const { fetchFullReimbursement } = await import('@/lib/reimbursementDetail')
          const full = await fetchFullReimbursement(viewing._id)
          setEditing(full || viewing); setViewing(null)
        } : undefined} />}

      <div style={{ display:'flex', gap:8, padding:'10px 20px', background:'var(--bg2)', borderBottom:'1px solid var(--border)', flexShrink:0, alignItems:'center', flexWrap:'wrap' }}>
        <button onClick={()=>setStatusTab('all')} style={chip(statusTab==='all')}>Semua ({stats.all})</button>
        <button onClick={()=>setStatusTab('submitted')} style={chip(statusTab==='submitted','var(--amber)')}>Waiting for Payment ({stats.submitted})</button>
        <button onClick={()=>setStatusTab('done')} style={chip(statusTab==='done','var(--green)')}>Waiting for Verification ({stats.done})</button>
        {stats.clarification>0 && <button onClick={()=>setStatusTab('clarification')} style={chip(statusTab==='clarification','#b45309')}>🔄 Klarifikasi ({stats.clarification})</button>}
        <button onClick={()=>setStatusTab('verified')} style={chip(statusTab==='verified','var(--brand)')}>Verified ({stats.verified})</button>
        <div style={{ marginLeft:'auto', display:'flex', gap:6, alignItems:'center' }}>
          <select className="input input-sm" style={{ width:120 }} value={month} onChange={e=>setMonth(Number(e.target.value))}>
            <option value={-1}>Semua Bulan</option>
            {MONTHS.map((m,i)=><option key={i} value={i}>{m}</option>)}
          </select>
          <select className="input input-sm" style={{ width:90 }} value={year} onChange={e=>setYear(Number(e.target.value))}>
            {yearOptions.map(y=><option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={()=>setShowPerhatian(true)} className="btn btn-primary btn-sm">+ Pengajuan Baru</button>
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'14px 20px' }} className="safe-bottom page-pad">
        {loading ? <div style={{ textAlign:'center', padding:40, color:'var(--text3)' }}>Memuat...</div> :
         filtered.length === 0 ? (
          <div className="card" style={{ textAlign:'center', padding:40, color:'var(--text3)' }}><div style={{ fontSize:30, marginBottom:8 }}>💸</div><div>Belum ada reimburse pada periode ini</div></div>
         ) : (
          <div className="card" style={{ overflow:'auto' }}>
            <table className="wp-table" style={{ minWidth:980 }}>
              <thead><tr>
                {(()=>{ const sp={ sortKey:sort.sortKey, sortDir:sort.sortDir, onSort:sort.toggle }; return <>
                  <SortTh label="CC/Petty" k="source" {...sp} />
                  <SortTh label="Bill Date" k="billDate" {...sp} />
                  <SortTh label="Keperluan" k="kategori" {...sp} />
                  <SortTh label="Bank / Rek" k="bank" {...sp} />
                  <SortTh label="Nominal" k="amount" {...sp} />
                  <SortTh label="Status" k="status" {...sp} />
                  <SortTh label="Pengaju" k="pengaju" {...sp} />
                  <th></th>
                </> })()}
              </tr></thead>
              <tbody>
                {sorted.map(r => (
                  <tr key={r._id} style={{ cursor:'pointer' }} onClick={()=>setViewing(r)}>
                    <td><span className="badge" style={{ background:r.isCashCard?'var(--brand-soft)':'var(--bg3)', color:r.isCashCard?'var(--brand)':'var(--text2)', fontSize:9 }}>{r.isCashCard?'Cash Card':'Petty Cash'}</span></td>
                    <td style={{ fontSize:11, color:'var(--text2)' }}>{r.billDate ? new Date(r.billDate).toLocaleDateString('id-ID') : '—'}</td>
                    <td style={{ fontSize:11 }}>{oeLookup(r.category).name}</td>
                    <td style={{ fontSize:11 }}>{r.bank}<br/><span style={{ color:'var(--text3)', fontSize:10 }}>{r.noRekening}</span></td>
                    <td style={{ fontWeight:600 }}>Rp {fmt(r.amount)}</td>
                    <td>{statusBadge(r.status)}</td>
                    <td style={{ fontSize:11 }}>{r.userName||'—'}</td>
                    <td onClick={e=>e.stopPropagation()}>
                      {r.status === 'clarification' && (r.userName === user?.name || r.userId === user?.id || r.userId === user?.email) ? (
                        <button onClick={(e)=>{ e.stopPropagation(); setEditing(r) }} className="btn btn-sm" style={{ fontSize:10, color:'#b45309', borderColor:'#f0c07a' }}>🔄 Revisi</button>
                      ) : r.status === 'rejected' ? (
                        <button onClick={(e)=>deleteItem(r,e)} className="btn btn-sm btn-danger" style={{ fontSize:10 }}>🗑 Hapus</button>
                      ) : r.status === 'reversal_requested' && (r.userName === user?.name || r.userId === user?.id || r.userId === user?.email || isAdminish) ? (
                        <button onClick={(e)=>approveReversal(r,e)} className="btn btn-sm btn-primary" style={{ fontSize:10 }}>✓ Setujui Pembatalan</button>
                      ) : r.documents?.length > 0 ? <span style={{ fontSize:10, color:'var(--text3)' }}>📎 {r.documents.length}</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
         )}
      </div>
    </>
  )
}

// ---------------------  TAB: Cashier  ---------------------
function CashierTab({ items, loading, reload }: { items:any[]; loading:boolean; reload:()=>void }) {
  const [transferring, setTransferring] = useState<any>(null)
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState<number>(-1)

  const inPeriod = (r:any) => { const d = periodDate(r); if (!d) return false; if (d.getFullYear()!==year) return false; if (month>=0 && d.getMonth()!==month) return false; return true }

  const yearOptions = useMemo(() => {
    const ys = new Set<number>([now.getFullYear(), now.getFullYear()-1, now.getFullYear()+1])
    items.forEach(r => { const d = periodDate(r); if (d) ys.add(d.getFullYear()) })
    return Array.from(ys).sort((a,b)=>b-a)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])

  const pending = items.filter(r => ['submitted','approved','draft'].includes(r.status)).filter(inPeriod)
  const done = items.filter(r => ['done','paid','verified','reversal_requested','reversal_approved'].includes(r.status)).filter(inPeriod)

  // ── Pilih beberapa antrian utk hitung total (cashier sering transfer sekaligus) ──
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showRincian, setShowRincian] = useState(false)
  const pendingKey = pending.map(r=>r._id).join(',')
  // Buang pilihan yg sudah tidak ada di antrian (mis. ganti filter / sudah ditransfer)
  useEffect(() => {
    const ids = new Set(pending.map(r=>r._id))
    setSelected(prev => {
      const next = new Set(Array.from(prev).filter(id => ids.has(id)))
      return next.size === prev.size ? prev : next
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingKey])

  const toggleOne = (id:string) => setSelected(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
  })
  const allChecked = pending.length > 0 && pending.every(r => selected.has(r._id))
  const someChecked = selected.size > 0 && !allChecked
  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(pending.map(r=>r._id)))

  // Rekap: total keseluruhan + rincian per pengaju & rekening (1 transfer = 1 rekening)
  const rekap = useMemo(() => {
    const rows = pending.filter(r => selected.has(r._id))
    const total = rows.reduce((s,r)=> s + (Number(r.amount)||0), 0)
    const map = new Map<string, { pengaju:string; bank:string; rek:string; count:number; subtotal:number }>()
    for (const r of rows) {
      const key = `${r.userName||'-'}|${r.bank||'-'}|${r.noRekening||'-'}`
      const g = map.get(key) || { pengaju:r.userName||'—', bank:r.bank||'—', rek:r.noRekening||'—', count:0, subtotal:0 }
      g.count++; g.subtotal += Number(r.amount)||0
      map.set(key, g)
    }
    const groups = Array.from(map.values()).sort((a,b)=> b.subtotal - a.subtotal)
    return { rows, total, groups }
  }, [pending, selected])

  const sortP = useSort('submittedAt','desc')
  const pendingSorted = useMemo(()=>sortRows(pending, sortP.sortKey, sortP.sortDir, {
    pengaju:(r:any)=>r.userName||'', kategori:(r:any)=>oeLookup(r.category).name, bank:(r:any)=>r.bank||'',
    amount:(r:any)=>r.amount||0, source:(r:any)=>r.isCashCard?'Cash Card':'Petty Cash', submittedAt:(r:any)=>new Date(r.submittedAt||0).getTime(),
  }), [pending, sortP.sortKey, sortP.sortDir])

  const sortD = useSort('transferredAt','desc')
  const doneSorted = useMemo(()=>sortRows(done, sortD.sortKey, sortD.sortDir, {
    pengaju:(r:any)=>r.userName||'', kategori:(r:any)=>oeLookup(r.category).name, amount:(r:any)=>r.amount||0,
    biaya:(r:any)=>r.biayaAntarBank||0, total:(r:any)=>r.totalTransfer||r.amount||0, source:(r:any)=>r.isCashCard?'Cash Card':'Petty Cash',
    transferredAt:(r:any)=>new Date(r.transferredAt||0).getTime(),
  }), [done, sortD.sortKey, sortD.sortDir])

  async function delReversed(item:any) {
    if (!confirm(`Hapus reimburse "${item.title}" yang sudah disetujui pembatalannya?`)) return
    await fetch(`/api/reimbursements/${item._id}`, { method:'DELETE' }); toast.success('Dihapus. Kas diperbarui.'); reload()
  }
  async function requestReversal(item:any) {
    const reason = prompt('Alasan pembatalan reimburse ini?')
    if (reason === null) return
    await fetch(`/api/reimbursements/${item._id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ status:'reversal_requested', reversalReason: reason, reversalRequestedAt: new Date().toISOString() }) })
    toast.success('Permintaan pembatalan dikirim'); reload()
  }

  return (
    <>
      {transferring && <TransferModal item={transferring} onClose={()=>setTransferring(null)} onSave={reload} />}

      {/* Popup rincian total yang dicentang */}
      {showRincian && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setShowRincian(false)}>
          <div className="modal" style={{ width:600, maxWidth:'100%' }}>
            <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontSize:14, fontWeight:700 }}>Rincian Transfer</div>
                <div style={{ fontSize:11, color:'var(--text3)' }}>{rekap.rows.length} item dipilih · dikelompokkan per rekening</div>
              </div>
              <button onClick={()=>setShowRincian(false)} className="btn btn-icon">×</button>
            </div>
            <div style={{ maxHeight:'62vh', overflowY:'auto' }}>
              <table className="wp-table" style={{ width:'100%' }}>
                <thead><tr>
                  <th style={{ width:30, textAlign:'center' }}>No</th>
                  <th>Pengaju</th>
                  <th>Bank / Rek</th>
                  <th style={{ textAlign:'center', width:60 }}>Item</th>
                  <th style={{ textAlign:'right', width:130 }}>Subtotal</th>
                </tr></thead>
                <tbody>
                  {rekap.groups.map((g,i)=>(
                    <tr key={i}>
                      <td style={{ textAlign:'center', fontSize:11, color:'var(--text3)' }}>{i+1}</td>
                      <td style={{ fontSize:12, fontWeight:600 }}>{g.pengaju}</td>
                      <td style={{ fontSize:11 }}>{g.bank}<br/><span style={{ color:'var(--text3)', fontSize:10 }}>{g.rek}</span></td>
                      <td style={{ textAlign:'center', fontSize:11 }}>{g.count}</td>
                      <td style={{ textAlign:'right', fontSize:12.5, fontWeight:700 }}>Rp {fmt(g.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr style={{ background:'var(--brand-soft)' }}>
                  <td/><td colSpan={2} style={{ fontSize:12.5, fontWeight:800, color:'var(--brand)' }}>TOTAL</td>
                  <td style={{ textAlign:'center', fontSize:11, fontWeight:700 }}>{rekap.rows.length}</td>
                  <td style={{ textAlign:'right', fontSize:14, fontWeight:800, color:'var(--brand)' }}>Rp {fmt(rekap.total)}</td>
                </tr></tfoot>
              </table>
              {/* Daftar item yang dicentang */}
              <div style={{ padding:'10px 16px', borderTop:'1px solid var(--border)' }}>
                <div style={{ fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', marginBottom:6 }}>Item yang dipilih</div>
                <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                  {rekap.rows.map((r:any)=>(
                    <div key={r._id} style={{ display:'flex', justifyContent:'space-between', gap:8, fontSize:11 }}>
                      <span style={{ color:'var(--text2)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.userName} · {oeLookup(r.category).name}</span>
                      <b style={{ flexShrink:0 }}>Rp {fmt(r.amount)}</b>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ padding:'12px 20px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'flex-end' }}>
              <button onClick={()=>setShowRincian(false)} className="btn">Tutup</button>
            </div>
          </div>
        </div>
      )}

      {/* Bar total melayang saat ada yang dicentang */}
      {selected.size > 0 && (
        <div style={{ position:'fixed', bottom:18, left:'50%', transform:'translateX(-50%)', zIndex:180, background:'var(--bg)', border:'1px solid var(--brand)', borderRadius:12, boxShadow:'0 10px 34px rgba(0,0,0,0.20)', padding:'10px 14px', display:'flex', alignItems:'center', gap:14, flexWrap:'wrap', maxWidth:'calc(100vw - 24px)' }}>
          <div style={{ display:'flex', flexDirection:'column' }}>
            <span style={{ fontSize:10, color:'var(--text3)' }}>{selected.size} item · {rekap.groups.length} rekening</span>
            <span style={{ fontSize:17, fontWeight:800, color:'var(--brand)' }}>Rp {fmt(rekap.total)}</span>
          </div>
          <button onClick={()=>setShowRincian(true)} className="btn btn-sm btn-primary">📋 Rincian</button>
          <button onClick={()=>setSelected(new Set())} className="btn btn-sm">Batal pilih</button>
        </div>
      )}
      <div style={{ display:'flex', gap:8, padding:'10px 20px', background:'var(--bg2)', borderBottom:'1px solid var(--border)', flexShrink:0, alignItems:'center' }}>
        <span style={{ fontSize:11, color:'var(--text3)' }}>Filter (Bill Date):</span>
        <select className="input input-sm" style={{ width:120 }} value={month} onChange={e=>setMonth(Number(e.target.value))}>
          <option value={-1}>Semua Bulan</option>
          {MONTHS.map((m,i)=><option key={i} value={i}>{m}</option>)}
        </select>
        <select className="input input-sm" style={{ width:90 }} value={year} onChange={e=>setYear(Number(e.target.value))}>
          {yearOptions.map(y=><option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'14px 20px', display:'flex', flexDirection:'column', gap:14 }} className="safe-bottom page-pad">
        <div>
          <div style={{ fontSize:13, fontWeight:600, marginBottom:8 }}>📥 Antrian ({pending.length})</div>
          {loading ? <div style={{ color:'var(--text3)', fontSize:12 }}>Memuat...</div> :
           pending.length === 0 ? <div className="card" style={{ padding:20, textAlign:'center', color:'var(--text3)', fontSize:12 }}>Tidak ada antrian</div> : (
            <div className="card" style={{ overflow:'auto' }}>
              <table className="wp-table" style={{ minWidth:960 }}>
                <thead><tr>
                  <th style={{ width:34, textAlign:'center' }}>
                    <input type="checkbox" checked={allChecked} ref={el=>{ if(el) el.indeterminate = someChecked }} onChange={toggleAll} title="Pilih semua" style={{ cursor:'pointer' }} />
                  </th>
                  {(()=>{ const sp={ sortKey:sortP.sortKey, sortDir:sortP.sortDir, onSort:sortP.toggle }; return <>
                    <SortTh label="Pengaju" k="pengaju" {...sp} />
                    <SortTh label="Keperluan" k="kategori" {...sp} />
                    <SortTh label="Bank / Rek" k="bank" {...sp} />
                    <SortTh label="Nominal" k="amount" {...sp} />
                    <SortTh label="Sumber" k="source" {...sp} />
                    <SortTh label="Submit" k="submittedAt" {...sp} />
                    <th></th>
                  </> })()}
                </tr></thead>
                <tbody>
                  {pendingSorted.map(r => {
                    const checked = selected.has(r._id)
                    return (
                    <tr key={r._id} style={{ background: checked ? 'var(--brand-soft)' : undefined }}>
                      <td style={{ textAlign:'center' }}>
                        <input type="checkbox" checked={checked} onChange={()=>toggleOne(r._id)} style={{ cursor:'pointer' }} />
                      </td>
                      <td style={{ fontSize:11, fontWeight:600 }}>{r.userName}</td>
                      <td style={{ fontSize:11 }}>{oeLookup(r.category).name}</td>
                      <td style={{ fontSize:11 }}>{r.bank}<br/><span style={{ color:'var(--text3)', fontSize:10 }}>{r.noRekening}</span></td>
                      <td style={{ fontWeight:700 }}>Rp {fmt(r.amount)}</td>
                      <td><span className="badge" style={{ background:r.isCashCard?'var(--brand-soft)':'var(--bg3)', color:r.isCashCard?'var(--brand)':'var(--text2)', fontSize:9 }}>{r.isCashCard?'Cash Card':'Petty Cash'}</span></td>
                      <td style={{ fontSize:10 }}>{r.submittedAt?new Date(r.submittedAt).toLocaleDateString('id-ID'):'—'}</td>
                      <td><button onClick={()=>setTransferring(r)} className="btn btn-primary btn-sm">💸 Transfer</button></td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
           )}
        </div>

        <div>
          <div style={{ fontSize:13, fontWeight:600, marginBottom:8 }}>✅ Sudah Ditransfer ({done.length})</div>
          {done.length === 0 ? <div className="card" style={{ padding:20, textAlign:'center', color:'var(--text3)', fontSize:12 }}>Belum ada riwayat transfer</div> : (
            <div className="card" style={{ overflow:'auto' }}>
              <table className="wp-table" style={{ minWidth:900 }}>
                <thead><tr>
                  {(()=>{ const sp={ sortKey:sortD.sortKey, sortDir:sortD.sortDir, onSort:sortD.toggle }; return <>
                    <SortTh label="Pengaju" k="pengaju" {...sp} />
                    <SortTh label="Keperluan" k="kategori" {...sp} />
                    <SortTh label="Nominal" k="amount" {...sp} />
                    <SortTh label="Biaya" k="biaya" {...sp} />
                    <SortTh label="Total" k="total" {...sp} />
                    <SortTh label="Sumber" k="source" {...sp} />
                    <SortTh label="Transferred" k="transferredAt" {...sp} />
                    <th>Aksi</th>
                  </> })()}
                </tr></thead>
                <tbody>
                  {doneSorted.map(r => (
                    <tr key={r._id}>
                      <td style={{ fontSize:11 }}>{r.userName}</td>
                      <td style={{ fontSize:11 }}>{oeLookup(r.category).name}</td>
                      <td>Rp {fmt(r.amount)}</td>
                      <td style={{ fontSize:10 }}>{r.biayaAntarBank>0?`Rp ${fmt(r.biayaAntarBank)}`:'—'}</td>
                      <td style={{ fontWeight:700, color:'var(--brand)' }}>Rp {fmt(r.totalTransfer||r.amount)}</td>
                      <td><span className="badge" style={{ background:r.isCashCard?'var(--brand-soft)':'var(--bg3)', color:r.isCashCard?'var(--brand)':'var(--text2)', fontSize:9 }}>{r.isCashCard?'Cash Card':'Petty Cash'}</span></td>
                      <td style={{ fontSize:10 }}>{r.transferredAt?new Date(r.transferredAt).toLocaleDateString('id-ID'):'—'}</td>
                      <td>
                        {r.status === 'done' || r.status === 'paid' ? (
                          <button onClick={()=>requestReversal(r)} className="btn btn-sm" style={{ fontSize:10 }}>↩️ Reverse</button>
                        ) : r.status === 'verified' ? (
                          <span className="badge" style={{ background:'var(--brand-soft)', color:'var(--brand)', fontSize:9 }}>🔒 Verified</span>
                        ) : r.status === 'reversal_requested' ? (
                          <span className="badge" style={{ background:'var(--amberbg)', color:'var(--amber)', fontSize:9 }}>⏳ Menunggu persetujuan</span>
                        ) : r.status === 'reversal_approved' ? (
                          <button onClick={()=>delReversed(r)} className="btn btn-sm btn-danger" style={{ fontSize:10 }}>🗑 Hapus</button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// =====================  shared bits  =====================
function statusBadge(s:string) {
  const cfg: Record<string,{label:string;color:string;bg:string}> = {
    submitted: { label:'Waiting for Payment', color:'var(--amber)', bg:'var(--amberbg)' },
    approved: { label:'Waiting for Payment', color:'var(--amber)', bg:'var(--amberbg)' },
    draft: { label:'Draft', color:'var(--text3)', bg:'var(--bg3)' },
    reversal_requested: { label:'Pembatalan Diminta', color:'var(--amber)', bg:'var(--amberbg)' },
    reversal_approved: { label:'Pembatalan Disetujui', color:'var(--red)', bg:'var(--redbg)' },
    done: { label:'Waiting for Verification', color:'var(--green)', bg:'var(--greenbg)' },
    paid: { label:'Waiting for Verification', color:'var(--green)', bg:'var(--greenbg)' },
    verified: { label:'Verified', color:'var(--brand)', bg:'var(--brand-soft)' },
    rejected: { label:'Ditolak', color:'var(--red)', bg:'var(--redbg)' },
    clarification: { label:'Clarification', color:'#b45309', bg:'#fff3e0' },
  }
  const c = cfg[s] || { label:s, color:'var(--text3)', bg:'var(--bg3)' }
  return <span className="badge" style={{ background:c.bg, color:c.color, fontSize:9 }}>{c.label}</span>
}
function chip(active:boolean, color:string='var(--brand)'):React.CSSProperties { return { padding:'4px 11px', borderRadius:20, fontSize:11, fontWeight:600, cursor:'pointer', border:`1px solid ${active?color:'var(--border)'}`, background:active?color+'1a':'var(--bg3)', color:active?color:'var(--text2)' } }
function subtab(active:boolean):React.CSSProperties { return { padding:'8px 16px', fontSize:12.5, fontWeight:600, cursor:'pointer', border:'none', borderBottom:`2px solid ${active?'var(--brand)':'transparent'}`, background:'transparent', color:active?'var(--brand)':'var(--text3)' } }
const lbl: React.CSSProperties = { display:'block', fontSize:11, fontWeight:500, color:'var(--text2)', marginBottom:5, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }
const hintS: React.CSSProperties = { fontWeight:400, color:'var(--text3)', fontSize:9 }
const errInput: React.CSSProperties = { borderColor:'var(--red)' }
