'use client'
import { getConfig } from '@/lib/configCache'
import { OE_CATEGORIES, oeLookup } from '@/lib/defaults'
import { useSort, sortRows, SortTh } from '@/lib/useSort'
import { EvidenceList } from '@/components/EvidenceList'
import { MoneyInput } from '@/components/MoneyInput'
import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'

const fmt = (n:number) => new Intl.NumberFormat('id-ID').format(n||0)
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

  async function handleFileUpload(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    const newDocs: any[] = []
    for (const file of Array.from(files)) {
      if (file.size > 5 * 1024 * 1024) { toast.error(`${file.name}: max 5MB`); continue }
      const reader = new FileReader()
      const dataUrl: string = await new Promise(resolve => { reader.onload = e => resolve(e.target?.result as string); reader.readAsDataURL(file) })
      newDocs.push({ url: dataUrl, name: file.name, type: file.type, size: file.size })
    }
    setForm(f=>({...f, documents: [...f.documents, ...newDocs] })); setUploading(false)
    if (newDocs.length) toast.success(`${newDocs.length} file diupload`)
  }
  function removeDoc(i:number) { setForm(f=>({...f, documents: f.documents.filter((_:any,idx:number)=>idx!==i) })) }

  function validate():string[] {
    const e:string[] = []
    if (!form.title.trim()) e.push('Keperluan')
    if (!form.amount || form.amount<=0) e.push('Nominal')
    if (!form.billDate) e.push('Tgl Bukti / Bill Date')
    if (!form.category) e.push('Kategori')
    if (!form.source) e.push('Sumber (Cash Card / Petty Cash)')
    if (!form.bank.trim()) e.push('Bank')
    if (!form.noRekening.trim()) e.push('No. Rekening')
    if (!form.tokoPenjual.trim()) e.push('Toko/Penjual')
    if (!form.documents || form.documents.length===0) e.push('Evidence / Bukti (minimal 1 file)')
    return e
  }

  async function save() {
    const e = validate()
    setErrors(e)
    if (e.length) { toast.error('Ada field yang belum diisi'); return }
    setSaving(true)
    try {
      const isCC = form.source === 'cash_card'
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
      if (!r.ok) { toast.error('Gagal menyimpan'); return }
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
          {/* Baris 3: Toko/Penjual | Keperluan */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1.6fr', gap:10, alignItems:'end' }}>
            <div><label style={lbl}>Toko/Penjual *</label><input className="input" style={missing('Toko/Penjual')?errInput:undefined} value={form.tokoPenjual} onChange={e=>set('tokoPenjual',e.target.value)} placeholder="Nama toko/penjual/penerima" /></div>
            <div><label style={lbl}>Keperluan * <span style={hintS}>(judul meeting/event jika &apos;Cash Card&apos;)</span></label>
              <input className="input" style={missing('Keperluan')?errInput:undefined} value={form.title} onChange={e=>set('title',e.target.value)} placeholder="Misal: Konsumsi meeting BPD Procurement" /></div>
          </div>
          <div>
            <label style={lbl}>Bukti / Dokumen Pendukung * <span style={{ fontWeight:400, color:'var(--text3)', fontSize:9 }}>(bill/nota/struk + agenda)</span></label>
            <label style={{ display:'block', padding:'18px', borderRadius:8, border:`2px dashed ${missing('Evidence / Bukti (minimal 1 file)')?'var(--red)':'var(--border2)'}`, background:'var(--bg3)', cursor:'pointer', textAlign:'center', fontSize:11, color:'var(--text2)' }}>
              <input type="file" multiple accept="image/*,application/pdf" onChange={e=>handleFileUpload(e.target.files)} style={{ display:'none' }} />
              {uploading ? 'Mengupload...' : '📎 Klik untuk upload (multi file, max 5MB/file)'}
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
            <EvidenceList documents={item.documents} zipName={`evidence_${(item.title||'reimburse').replace(/\s+/g,'_')}`} />
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
              ? <EvidenceList documents={item.documents} zipName={`evidence_${(item.title||'reimburse').replace(/\s+/g,'_')}`} />
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

  async function load() {
    setLoading(true)
    const r = await fetch('/api/reimbursements').then(r=>r.json())
    setItems(r.data||[]); setLoading(false)
  }
  useEffect(() => { load() }, [])

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ padding:'12px 20px 0', borderBottom:'1px solid var(--border)', background:'var(--bg2)', flexShrink:0 }}>
        <div style={{ fontSize:14, fontWeight:600 }}>Reimbursement</div>
        <div style={{ display:'flex', gap:4, marginTop:10 }}>
          <button onClick={()=>setTab('pengajuan')} style={subtab(tab==='pengajuan')}>Pengajuan</button>
          {isCashierish && <button onClick={()=>setTab('cashier')} style={subtab(tab==='cashier')}>Cashier</button>}
        </div>
      </div>
      {tab==='pengajuan'
        ? <PengajuanTab items={items} loading={loading} reload={load} user={user} isAdminish={isCashierish} />
        : <CashierTab items={items} loading={loading} reload={load} />}
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
        onEdit={viewing.status==='clarification' && (viewing.userName===user?.name || viewing.userId===user?.id || viewing.userId===user?.email) ? ()=>{ setEditing(viewing); setViewing(null) } : undefined} />}

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
              <table className="wp-table" style={{ minWidth:900 }}>
                <thead><tr>
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
                  {pendingSorted.map(r => (
                    <tr key={r._id}>
                      <td style={{ fontSize:11, fontWeight:600 }}>{r.userName}</td>
                      <td style={{ fontSize:11 }}>{oeLookup(r.category).name}</td>
                      <td style={{ fontSize:11 }}>{r.bank}<br/><span style={{ color:'var(--text3)', fontSize:10 }}>{r.noRekening}</span></td>
                      <td style={{ fontWeight:700 }}>Rp {fmt(r.amount)}</td>
                      <td><span className="badge" style={{ background:r.isCashCard?'var(--brand-soft)':'var(--bg3)', color:r.isCashCard?'var(--brand)':'var(--text2)', fontSize:9 }}>{r.isCashCard?'Cash Card':'Petty Cash'}</span></td>
                      <td style={{ fontSize:10 }}>{r.submittedAt?new Date(r.submittedAt).toLocaleDateString('id-ID'):'—'}</td>
                      <td><button onClick={()=>setTransferring(r)} className="btn btn-primary btn-sm">💸 Transfer</button></td>
                    </tr>
                  ))}
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
