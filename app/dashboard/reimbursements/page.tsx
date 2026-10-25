'use client'
import { cachedFetch } from '@/lib/fetchCache'
import { OE_CATEGORIES, oeLookup } from '@/lib/defaults'
import { useSort, sortRows, SortTh } from '@/lib/useSort'
import { EvidenceList } from '@/components/EvidenceList'
import { MoneyInput } from '@/components/MoneyInput'
import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import { useYear } from '@/lib/year'
import { ConfirmSheet, Empty, Icon, PageHeader, Pill, Seg, Sheet, Tile, type Tone } from '@/components/ui'

const fmt = (n:number) => new Intl.NumberFormat('id-ID').format(n||0)
const short = (n:number) => { const a = Math.abs(n||0); const f = (v:number, u:string) => `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(v)} ${u}`; return a >= 1e9 ? f(n/1e9,'M') : a >= 1e6 ? f(n/1e6,'jt') : a >= 1e3 ? f(n/1e3,'rb') : fmt(n) }
const dstr = (s?:string) => s ? new Date(s).toLocaleDateString('id-ID') : '—'

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
const isOwner = (r:any, user:any) => r.userName === user?.name || r.userId === user?.id || r.userId === user?.email
async function patch(id:string, body:any) {
  const r = await fetch(`/api/reimbursements/${id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) })
  if (!r.ok) throw new Error('Gagal menyimpan, coba lagi')
}
async function remove(id:string) {
  const r = await fetch(`/api/reimbursements/${id}`, { method:'DELETE' })
  if (!r.ok) throw new Error('Gagal menghapus, coba lagi')
}

// =====================  PERHATIAN  =====================
function PerhatianSheet({ onOk, onClose }: { onOk:()=>void; onClose:()=>void }) {
  return (
    <Sheet open title="Sebelum mengajukan" onClose={onClose}>
      <div className="au-row" style={{ gap: 12, alignItems: 'flex-start' }}>
        <span className="au-pti" style={{ background: 'var(--warn)' }}><Icon name="bell" size={16} stroke={2.1} /></span>
        <div className="au-col au-small au-ink2" style={{ gap: 8, lineHeight: 1.55 }}>
          <span>Jika memilih sumber <b>Cash Card</b>, pastikan:</span>
          <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <li>Judul agenda/Calmeet diisi pada field <b>Nama Calmeet</b></li>
            <li>Upload evidence agenda/Calmeet beserta bill/nota/struk</li>
          </ol>
        </div>
      </div>
      <div className="p-warn au-small" style={{ borderRadius: 14, padding: 12, lineHeight: 1.5 }}>Pengajuan reimbursement adalah <b>per transaksi / per toko</b>. Pengajuan multi-transaksi akan <b>ditolak</b>.</div>
      <button type="button" className="btn btn-primary" style={{ alignSelf: 'flex-end' }} onClick={onOk}>Saya mengerti, lanjut</button>
    </Sheet>
  )
}

// =====================  Form Pengajuan  =====================
const CC_SLOTS = [
  { key:'calmeet',     label:'Calmeet',         required:true },
  { key:'invoice',     label:'Details Invoice', required:true },
  { key:'dokumentasi', label:'Dokumentasi',     required:true },
  { key:'buktitf',     label:'Bukti TF',        required:false },
]
// Field wrapper (module-level so inputs keep focus between renders)
const F = ({ label, err, hint, children, wide }: { label:string; err?:boolean; hint?:string; children:React.ReactNode; wide?:boolean }) => (
  <label className="au-col" style={{ gap: 6, gridColumn: wide ? '1 / -1' : undefined, minWidth: 0 }} data-err={err || undefined}>
    <span className="lbl">{label}{hint && <span className="au-muted" style={{ textTransform: 'none', letterSpacing: 0 }}> · {hint}</span>}</span>{children}</label>
)
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
      } catch {
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

  // Petty Cash: satu area 'bukti' (wajib). Cash Card: Calmeet, Details Invoice, Dokumentasi (wajib) + Bukti TF (opsional).
  const isCC = form.source === 'cash_card'
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
      for (const s of CC_SLOTS) if (s.required && docsOf(s.key).length === 0) e.push(s.label)
    } else if (!form.documents || form.documents.length===0) e.push('Evidence / Bukti (minimal 1 file)')
    return e
  }

  async function save() {
    const e = validate()
    setErrors(e)
    if (e.length) { toast.error('Ada field yang belum diisi'); return }
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
      toast.success(isResubmit ? 'Revisi terkirim — menunggu verifikasi CC Holder' : (editing?'Diperbarui':'Pengajuan terkirim ke Cashier')); onSave(); onClose()
    } catch { toast.error('Gagal menyimpan, periksa koneksi') } finally { setSaving(false) }
  }

  // Setelah percobaan kirim pertama, daftar 'Belum lengkap' ikut diperbarui saat field diisi.
  useEffect(() => { if (errors.length) setErrors(validate()) }, [form]) // eslint-disable-line react-hooks/exhaustive-deps
  const missing = (f:string) => errors.includes(f)
  const resubmit = editing?.status === 'clarification'
  const docRow = (d:any, i:number, onRemove:()=>void) => (
    <div key={i} className="au-row au-docrow">
      <Icon name="file" size={14} /><span className="au-xs" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.name}>{d.name}</span>
      {d.size ? <span className="au-xs au-muted">{Math.round((d.size||0)/1024)} KB</span> : null}
      <button type="button" className="btn btn-icon btn-sm" aria-label={`Hapus ${d.name}`} onClick={onRemove}><Icon name="x" size={13} /></button>
    </div>
  )

  return (
    <Sheet open wide title={resubmit ? 'Revisi reimburse' : editing ? 'Edit reimburse' : 'Pengajuan reimbursement'} onClose={onClose} onSave={save} saveDisabled={saving || uploading} saveLabel={saving ? 'Mengirim…' : resubmit ? 'Kirim ulang' : editing ? 'Simpan' : 'Kirim'}>
      {resubmit && editing?.clarifyNote && (
        <div className="p-warn au-small" style={{ borderRadius: 14, padding: 12, lineHeight: 1.5 }}>
          <b>Catatan dari CC Holder{editing.clarifiedBy?` (${editing.clarifiedBy})`:''}:</b><br/>{editing.clarifyNote}
          <div className="au-xs" style={{ marginTop: 6 }}>Perbaiki/lengkapi evidence sesuai catatan, lalu ketuk <b>Kirim ulang</b>. Prosesnya langsung ke verifikasi (tidak lewat cashier lagi).</div>
        </div>
      )}
      {errors.length>0 && <div role="alert" className="p-bad au-small" style={{ borderRadius: 14, padding: 12 }}><b>Belum lengkap:</b> {errors.join(', ')}</div>}
      <div className="au-col" style={{ gap: 6 }}><span className="lbl">Sumber dana *</span>
        <div className="au-seg au-segf" role="group" aria-label="Sumber dana" data-err={missing('Sumber (Cash Card / Petty Cash)') || undefined}>
          {[['cash_card','Cash Card'],['petty_cash','Petty Cash']].map(([v,l]) => <button key={v} type="button" aria-pressed={form.source===v} onClick={()=>set('source',v)}>{l}</button>)}
        </div></div>
      <div className="au-grid au-fgrid">
        <F label="Bill date *" err={missing('Tgl Bukti / Bill Date')}><input type="date" className="input" value={form.billDate} onChange={e=>set('billDate',e.target.value)} /></F>
        <F label="Kategori *" err={missing('Kategori')}>
          <select className="input" value={form.category} onChange={e=>set('category',e.target.value)}>
            <option value="">Pilih kategori</option>
            {OE_CATEGORIES.map(c=><option key={c.code} value={c.code}>{c.name}</option>)}
            <option value="lainnya">Lainnya</option>
          </select></F>
        <F label="Nominal (Rp) *" err={missing('Nominal')}><MoneyInput currency="IDR" className="input" value={form.amount} onChange={n=>set('amount',n)} /></F>
        <F label="Bank *" hint="otomatis" err={missing('Bank')}><input className="input" value={form.bank} onChange={e=>set('bank',e.target.value)} placeholder="BCA, Mandiri…" /></F>
        <F label="No. rekening *" hint="dari Biodata" err={missing('No. Rekening')}><input className="input" inputMode="numeric" value={form.noRekening} onChange={e=>set('noRekening',e.target.value)} /></F>
        <F label="Toko / penjual *" err={missing('Toko/Penjual')}><input className="input" value={form.tokoPenjual} onChange={e=>set('tokoPenjual',e.target.value)} placeholder="Nama toko/penjual/penerima" /></F>
        {isCC
          ? <F wide label="Nama Calmeet *" hint="sebelumnya: Keperluan" err={missing('Nama Calmeet')}><input className="input" value={form.title} onChange={e=>set('title',e.target.value)} placeholder="Masukkan nama Calmeet" /></F>
          : <F wide label="Keperluan *" err={missing('Keperluan')}><input className="input" value={form.title} onChange={e=>set('title',e.target.value)} placeholder="Misal: Konsumsi meeting BPD Procurement" /></F>}
      </div>

      {isCC ? (
        <div className="au-col" style={{ gap: 8 }}>
          <span className="lbl">Bukti pendukung <span className="au-muted" style={{ textTransform: 'none', letterSpacing: 0 }}>· 1–3 wajib, Bukti TF opsional</span></span>
          <div className="au-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 10 }}>
            {CC_SLOTS.map((s, n) => {
              const docs = docsOf(s.key)
              const err = s.required && missing(s.label)
              return (
                <div key={s.key} className="au-col" style={{ gap: 6 }}>
                  <label className="au-drop au-dropsm" data-err={err || undefined} data-has={docs.length > 0 || undefined}>
                    <input type="file" multiple accept="image/*,application/pdf" onChange={e=>handleFileUpload(e.target.files, s.key)} aria-label={`Upload ${s.label}`} />
                    <b className="au-small">{n + 1}. {s.label}{s.required ? ' *' : ''}</b>
                    <span className="au-xs au-muted">{uploading ? 'Mengupload…' : docs.length ? `${docs.length} file` : s.required ? 'Ketuk untuk upload' : 'Opsional'}</span>
                  </label>
                  {docs.map((d:any, i:number) => docRow(d, i, () => removeDoc(idxOf(d))))}
                </div>
              )
            })}
          </div>
          {docsOf('bukti').length > 0 && <div className="au-col" style={{ gap: 6 }}>
            <span className="au-xs au-muted">Lampiran lain (diupload sebelum pindah ke Cash Card)</span>
            {docsOf('bukti').map((d:any, i:number) => docRow(d, i, () => removeDoc(idxOf(d))))}
          </div>}
        </div>
      ) : (
        <div className="au-col" style={{ gap: 8 }}>
          <span className="lbl">Bukti pendukung * <span className="au-muted" style={{ textTransform: 'none', letterSpacing: 0 }}>· bill/nota/struk + agenda</span></span>
          <label className="au-drop" data-err={missing('Evidence / Bukti (minimal 1 file)') || undefined}>
            <input type="file" multiple accept="image/*,application/pdf" onChange={e=>handleFileUpload(e.target.files,'bukti')} aria-label="Upload bukti" />
            <Icon name="file" size={22} />
            <b className="au-small">{uploading ? 'Mengupload…' : 'Ketuk atau seret file ke sini'}</b>
            <span className="au-xs au-muted">PDF/gambar · maks 15MB per file</span>
          </label>
          {form.documents.map((d:any, i:number) => docRow(d, i, () => removeDoc(i)))}
        </div>
      )}
    </Sheet>
  )
}

// =====================  status  =====================
const STATUS: Record<string,{label:string; tone:Tone}> = {
  submitted: { label:'Waiting for Payment', tone:'warn' }, approved: { label:'Waiting for Payment', tone:'warn' },
  draft: { label:'Draft', tone:'none' },
  reversal_requested: { label:'Pembatalan diminta', tone:'warn' }, reversal_approved: { label:'Pembatalan disetujui', tone:'bad' },
  done: { label:'Waiting for Verification', tone:'ok' }, paid: { label:'Waiting for Verification', tone:'ok' },
  verified: { label:'Verified', tone:'accent' }, rejected: { label:'Ditolak', tone:'bad' }, clarification: { label:'Clarification', tone:'warn' },
}
function statusBadge(s:string) { const c = STATUS[s] || { label:s, tone:'none' as Tone }; return <Pill tone={c.tone}>{c.label}</Pill> }
const srcTag = (r:any) => <span className="au-tag" style={r.isCashCard ? { background:'var(--accent-soft)', color:'var(--accent-ink)' } : undefined}>{r.isCashCard?'Cash Card':'Petty Cash'}</span>

// =====================  Detail viewer  =====================
function DetailSheet({ item, onClose, onDelete, onEdit, armDelete }: { item:any; onClose:()=>void; onDelete?:()=>Promise<void>; onEdit?:()=>void; armDelete?:boolean }) {
  const [confirmDel, setConfirmDel] = useState(!!armDelete), [busy, setBusy] = useState(false)
  const kv = (k:string, v:React.ReactNode) => <div className="au-igr"><span className="k">{k}</span><span className="v">{v}</span></div>
  return (
    <Sheet open title="Detail reimburse" onClose={onClose}>
      <div className="au-col" style={{ gap: 6 }}>
        <span className="au-row au-wrap" style={{ gap: 6 }}>{srcTag(item)}{statusBadge(item.status)}</span>
        <h3 style={{ font: '700 19px/1.3 var(--disp)', overflowWrap: 'anywhere' }}>{item.title}</h3>
        {item.description && <span className="au-small au-ink2">{item.description}</span>}
        <b style={{ font: '700 28px/1.1 var(--disp)', letterSpacing: '-.02em', fontVariantNumeric: 'tabular-nums' }}>Rp {fmt(item.amount)}</b>
      </div>
      <div className="au-ig">
        {kv('Pengaju', item.userName || '—')}
        {kv('Kategori', `${oeLookup(item.category).code} · ${oeLookup(item.category).name}`)}
        {kv('Bill date', dstr(item.billDate))}
        {kv('Toko / penjual', item.tokoPenjual || '—')}
        {kv('Bank', item.bank || '—')}
        {kv('No. rekening', <span style={{ fontFamily: 'var(--mono)' }}>{item.noRekening || '—'}</span>)}
        {item.biayaAntarBank > 0 && kv('Biaya antar bank', `Rp ${fmt(item.biayaAntarBank)}`)}
        {item.totalTransfer ? kv('Total transfer', <b>Rp {fmt(item.totalTransfer)}</b>) : null}
      </div>
      {item.rejectReason && <div className="p-bad au-small" style={{ borderRadius: 14, padding: 12 }}>Alasan ditolak: {item.rejectReason}</div>}
      {item.status==='clarification' && item.clarifyNote && <div className="p-warn au-small" style={{ borderRadius: 14, padding: 12, lineHeight: 1.5 }}><b>Perlu klarifikasi{item.clarifiedBy?` (dari ${item.clarifiedBy})`:''}:</b><br/>{item.clarifyNote}</div>}
      {item.documents?.length > 0 && <EvidenceList itemId={item._id} documents={item.documents} zipName={`evidence_${(item.title||'reimburse').replace(/\s+/g,'_')}`} />}
      {(onDelete || onEdit) && <div className="au-row au-wrap" style={{ gap: 8, justifyContent: 'space-between' }}>
        {onDelete ? (confirmDel
          ? <div className="au-row au-wrap p-bad" style={{ borderRadius: 14, padding: 10, gap: 8, flex: 1 }}><span className="au-small" style={{ flex: 1 }}>Hapus reimburse yang ditolak ini?</span><button type="button" className="btn btn-sm" onClick={() => setConfirmDel(false)}>Batal</button><button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={async () => { setBusy(true); try { await onDelete() } finally { setBusy(false) } }}>Ya, hapus</button></div>
          : <button type="button" className="btn btn-danger" onClick={() => setConfirmDel(true)}><Icon name="trash" size={15} />Hapus reimburse</button>) : <span />}
        {onEdit && <button type="button" className="btn btn-primary" onClick={onEdit}><Icon name="edit" size={15} />Revisi & kirim ulang</button>}
      </div>}
    </Sheet>
  )
}

// =====================  Transfer (Cashier)  =====================
function TransferSheet({ item, onClose, onSave }: { item:any; onClose:()=>void; onSave:()=>void }) {
  const { data:session } = useSession(); const user = session?.user as any
  const [hasBiaya, setHasBiaya] = useState(item.hasBiayaAntarBank || false)
  const [biaya, setBiaya] = useState(item.biayaAntarBank || 0)
  const [source, setSource] = useState<'cash_card'|'petty_cash'>(item.isCashCard ? 'cash_card' : 'petty_cash')
  const [processing, setProcessing] = useState(false)
  const [rejecting, setRejecting] = useState(false), [reason, setReason] = useState('')
  const total = (item.amount || 0) + (hasBiaya ? biaya : 0)

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
        body: JSON.stringify({ ...statusPayload, isCashCard:isCC, source, hasBiayaAntarBank: hasBiaya, biayaAntarBank: hasBiaya ? biaya : 0, totalTransfer: total, transferredAt: now, transferredBy: user?.name })
      })
      if (!updateRes.ok) { toast.error('Gagal update'); return }
      toast.success('Ditandai sudah ditransfer'); onSave(); onClose()
    } catch { toast.error('Gagal update') } finally { setProcessing(false) }
  }
  async function doReject() {
    setProcessing(true)
    try {
      const r = await fetch(`/api/reimbursements/${item._id}`, { method:'PATCH', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ status:'rejected', rejectReason: reason.trim(), rejectedAt: new Date().toISOString(), rejectedBy: user?.name }) })
      if (!r.ok) { toast.error('Gagal reject'); return }
      toast.success('Reimburse ditolak'); onSave(); onClose()
    } catch { toast.error('Gagal reject') } finally { setProcessing(false) }
  }

  return (
    <Sheet open title="Transfer reimburse" onClose={onClose}>
      <div className="au-box" style={{ padding: 14, gap: 4 }}>
        <span className="au-row au-between au-wrap" style={{ gap: 6 }}><b>{item.userName}</b><span className="au-xs au-muted">Submit {dstr(item.submittedAt)}</span></span>
        <span className="au-small au-ink2">{oeLookup(item.category).name} · {item.title} · {item.tokoPenjual || '—'}</span>
        <span className="au-small au-ink2">{item.bank} · <span style={{ fontFamily: 'var(--mono)' }}>{item.noRekening}</span></span>
        <span className="au-small">Nominal <b>Rp {fmt(item.amount)}</b> · Bill date {dstr(item.billDate)}</span>
      </div>
      {(item.documents||[]).length>0
        ? <EvidenceList itemId={item._id} documents={item.documents} zipName={`evidence_${(item.title||'reimburse').replace(/\s+/g,'_')}`} />
        : <div className="au-xs" style={{ color: 'var(--bad)', fontWeight: 600 }}>Belum ada evidence.</div>}
      <div className="au-col" style={{ gap: 6 }}><span className="lbl">Sumber dana</span>
        <Seg full label="Sumber dana" value={source} onChange={setSource} options={[['cash_card','Cash Card'],['petty_cash','Petty Cash']] as const} /></div>
      <div className="au-ig">
        <label className="au-igr"><span className="k">Biaya antar bank</span><input type="checkbox" className="au-sw" style={{ marginLeft: 'auto' }} checked={hasBiaya} onChange={e=>setHasBiaya(e.target.checked)} /></label>
        {hasBiaya && <div className="au-igr"><span className="k">Nominal biaya</span><MoneyInput currency="IDR" className="input input-sm" style={{ width: 150, marginLeft: 'auto' }} value={biaya} onChange={n=>setBiaya(n)} placeholder="6.500" /></div>}
      </div>
      <div className="au-total"><span className="lbl">Total transfer</span><b>Rp {fmt(total)}</b></div>
      {rejecting
        ? <div className="au-col p-bad" style={{ borderRadius: 16, padding: 12, gap: 8 }}>
            <label className="au-col" style={{ gap: 6 }}><span className="lbl" style={{ color: 'inherit' }}>Alasan reject (opsional)</span><textarea className="input" rows={2} value={reason} onChange={e => setReason(e.target.value)} /></label>
            <div className="au-row" style={{ gap: 8, justifyContent: 'flex-end' }}><button type="button" className="btn btn-sm" onClick={() => setRejecting(false)}>Batal</button><button type="button" className="btn btn-danger btn-sm" disabled={processing} onClick={doReject}>Tolak reimburse</button></div>
          </div>
        : <div className="au-row au-wrap" style={{ gap: 8, justifyContent: 'space-between' }}>
            <button type="button" className="btn btn-danger" disabled={processing} onClick={() => setRejecting(true)}>Reject</button>
            <button type="button" className="btn btn-primary" disabled={processing} onClick={doTransfer}><Icon name="check" size={15} stroke={2.4} />{processing ? 'Memproses…' : 'Tandai sudah ditransfer'}</button>
          </div>}
    </Sheet>
  )
}

// =====================  PAGE  =====================
export default function ReimbursementPage() {
  const { data:session } = useSession(); const user = session?.user as any
  const userRoles = user?.roles || (user?.role ? [user.role] : [])
  const isCashierish = userRoles.includes('admin') || userRoles.includes('manager') || userRoles.includes('finance') || userRoles.includes('cashier')
  const { year } = useYear()
  const [tab, setTab] = useState<'pengajuan'|'cashier'>('pengajuan')
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string>('')
  const [month, setMonth] = useState<number>(-1)
  const [newFlow, setNewFlow] = useState(false)

  async function load(force = false) {
    setLoading(true); setLoadError('')
    try {
      // Dipakai bersama dgn halaman Operasional -> cache singkat mencegah request berulang.
      const r = await cachedFetch('/api/reimbursements', 30_000, force)
      setItems(r?.data || [])
    } catch (e:any) {
      // Jangan tampilkan sebagai "data kosong" — data kemungkinan masih ada, hanya gagal dimuat.
      setLoadError(e?.message || 'Gagal memuat data')
      toast.error('Gagal memuat data reimbursement')
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])
  const reloadFresh = () => load(true)

  return (
    <div className="au-page">
      <div className="au-view au-anim">
        <PageHeader eyebrow={`Finance · ${month >= 0 ? MONTHS[month] + ' ' : ''}${year}`} title="Reimbursement" actions={<>
          <select className="input" aria-label="Bulan" style={{ width: 'auto', minHeight: 40 }} value={month} onChange={e=>setMonth(Number(e.target.value))}>
            <option value={-1}>Semua bulan</option>{MONTHS.map((m,i)=><option key={i} value={i}>{m}</option>)}
          </select>
          {tab === 'pengajuan' && <button type="button" className="btn btn-primary" onClick={() => setNewFlow(true)}><Icon name="plus" size={16} stroke={2.2} />Pengajuan baru</button>}
        </>} />
        {isCashierish && <div className="rise"><Seg label="Tampilan" value={tab} onChange={setTab} options={[['pengajuan','Pengajuan'],['cashier','Cashier']] as const} /></div>}
        {loadError && <div className="au-row au-wrap p-bad" role="alert" style={{ borderRadius: 14, padding: 12, gap: 10 }}>
          <span className="au-small" style={{ flex: 1 }}><b>Gagal memuat data</b> — data kamu tidak hilang, hanya belum berhasil dimuat. <span className="au-muted">{loadError}</span></span>
          <button type="button" className="btn btn-sm" onClick={reloadFresh}>Coba lagi</button></div>}
        {tab==='pengajuan'
          ? <PengajuanTab items={items} loading={loading} reload={reloadFresh} user={user} isAdminish={isCashierish} year={year} month={month} newFlow={newFlow} setNewFlow={setNewFlow} />
          : <CashierTab items={items} loading={loading} reload={reloadFresh} year={year} month={month} />}
      </div>
    </div>
  )
}

// ---------------------  TAB: Pengajuan  ---------------------
type Confirm = { kind:'reversal'|'delete'; item:any } | null
function PengajuanTab({ items, loading, reload, user, isAdminish, year, month, newFlow, setNewFlow }: { items:any[]; loading:boolean; reload:()=>void; user:any; isAdminish:boolean; year:number; month:number; newFlow:boolean; setNewFlow:(v:boolean)=>void }) {
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [viewing, setViewing] = useState<{ item:any; armDelete?:boolean } | null>(null)
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [statusTab, setStatusTab] = useState<'all'|'submitted'|'done'|'verified'|'clarification'>('all')

  const visible = useMemo(() => isAdminish ? items : items.filter(i => isOwner(i, user)), [items, isAdminish, user])
  const byPeriod = useMemo(() => visible.filter(r => {
    const d = periodDate(r); if (!d) return false
    if (d.getFullYear() !== year) return false
    if (month >= 0 && d.getMonth() !== month) return false
    return true
  }), [visible, year, month])

  const inBucket = (i:any, b:string) => b==='all' || (b==='submitted' ? ['submitted','approved','draft'].includes(i.status) : b==='done' ? (i.status==='done'||i.status==='paid') : i.status===b)
  const stats = useMemo(() => {
    const o:Record<string,{n:number; sum:number}> = {}
    for (const b of ['all','submitted','done','clarification','verified']) { const rows = byPeriod.filter(i=>inBucket(i,b)); o[b] = { n: rows.length, sum: rows.reduce((s,r)=>s+(Number(r.amount)||0),0) } }
    return o
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byPeriod])
  const filtered = useMemo(() => byPeriod.filter(i => inBucket(i, statusTab)), [byPeriod, statusTab])

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
  const sp = { sortKey:sort.sortKey, sortDir:sort.sortDir, onSort:sort.toggle }

  async function approveReversal(item:any) {
    try { await patch(item._id, { status:'reversal_approved', reversalApprovedAt: new Date().toISOString() }); toast.success('Pembatalan disetujui.'); setConfirm(null); reload() } catch (e:any) { toast.error(e.message) }
  }
  async function deleteItem(item:any) {
    try { await remove(item._id); toast.success('Reimburse dihapus'); setViewing(null); setConfirm(null); reload() } catch (e:any) { toast.error(e.message) }
  }
  async function openRevision(item:any) {
    // Daftar dimuat tanpa isi file — ambil versi lengkap dulu agar evidence lama tidak hilang saat dikirim ulang.
    const { fetchFullReimbursement } = await import('@/lib/reimbursementDetail')
    const full = await fetchFullReimbursement(item._id)
    setEditing(full || item); setViewing(null)
  }
  const TILES: [typeof statusTab, string, string, string][] = [
    ['all','Semua','wallet','var(--ink)'], ['submitted','Waiting for Payment','clock','var(--warn)'],
    ['done','Waiting for Verification','shield','var(--aqua)'], ['clarification','Klarifikasi','bell','var(--hot)'], ['verified','Verified','check','var(--accent)'],
  ]

  return (
    <>
      {newFlow && <PerhatianSheet onClose={()=>setNewFlow(false)} onOk={()=>{ setNewFlow(false); setShowForm(true) }} />}
      {(showForm||editing) && <ReimburseForm editing={editing} onClose={()=>{setShowForm(false);setEditing(null)}} onSave={reload} />}
      {viewing && <DetailSheet item={viewing.item} armDelete={viewing.armDelete} onClose={()=>setViewing(null)}
        onDelete={viewing.item.status==='rejected' ? () => deleteItem(viewing.item) : undefined}
        onEdit={viewing.item.status==='clarification' && isOwner(viewing.item, user) ? () => openRevision(viewing.item) : undefined} />}
      {confirm?.kind === 'reversal' && <ConfirmSheet title="Setujui pembatalan" confirmLabel="Setujui pembatalan" icon="check"
        text={<>Setujui pembatalan reimburse <b>“{confirm.item.title}”</b>{confirm.item.reversalReason ? <> — alasan: {confirm.item.reversalReason}</> : null}? Setelah disetujui, cashier dapat menghapusnya.</>}
        onConfirm={() => approveReversal(confirm.item)} onClose={() => setConfirm(null)} />}

      <div className="au-grid au-tiles au-rtiles">
        {TILES.filter(([k]) => k !== 'clarification' || stats.clarification.n > 0).map(([k, label, icon, color]) => (
          <Tile key={k} icon={icon} color={color} iconInk={k === 'all' ? 'var(--bg)' : '#fff'} value={loading ? '–' : stats[k].n} label={label} hint={!loading && stats[k].sum ? `Rp ${short(stats[k].sum)}` : undefined} active={statusTab === k} onClick={() => setStatusTab(k)} />
        ))}
      </div>

      {loading ? <div className="au-card">{[0,1,2].map(k => <div key={k} className="au-skel" />)}</div>
       : filtered.length === 0 ? <div className="au-card"><Empty title="Belum ada reimburse" text={`Tidak ada pengajuan ${statusTab === 'all' ? '' : 'dengan status ini '}pada periode ini.`} action={statusTab !== 'all' ? <button type="button" className="btn" onClick={() => setStatusTab('all')}>Tampilkan semua</button> : <button type="button" className="btn btn-primary" onClick={() => setNewFlow(true)}>Buat pengajuan</button>} /></div>
       : <div className="au-tblw rise">
          <table className="wp-table au-ctbl" style={{ minWidth: 980 }}>
            <thead><tr>
              <SortTh label="Keperluan" k="kategori" {...sp} />
              <SortTh label="Sumber" k="source" {...sp} />
              <SortTh label="Bill date" k="billDate" {...sp} />
              <SortTh label="Bank / Rek" k="bank" {...sp} />
              <SortTh label="Nominal" k="amount" {...sp} style={{ textAlign: 'right' }} />
              <SortTh label="Status" k="status" {...sp} />
              <SortTh label="Pengaju" k="pengaju" {...sp} />
              <th><span className="sr-only">Aksi</span></th>
            </tr></thead>
            <tbody>
              {sorted.map(r => (
                <tr key={r._id} className="au-click" onClick={()=>setViewing({ item: r })}>
                  <td className="c-main"><button type="button" className="au-rowbtn" onClick={e => { e.stopPropagation(); setViewing({ item: r }) }}>
                    <b className="au-small">{oeLookup(r.category).name}</b><span className="au-xs au-muted">{r.title}</span></button></td>
                  <td data-l="Sumber">{srcTag(r)}</td>
                  <td data-l="Bill date" className="au-small au-ink2" style={{ whiteSpace: 'nowrap' }}>{dstr(r.billDate)}</td>
                  <td data-l="Bank / Rek" className="au-small"><span>{r.bank}<br/><span className="au-xs au-muted" style={{ fontFamily: 'var(--mono)' }}>{r.noRekening}</span></span></td>
                  <td data-l="Nominal" style={{ textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>Rp {fmt(r.amount)}</td>
                  <td data-l="Status">{statusBadge(r.status)}</td>
                  <td data-l="Pengaju" className="au-small">{r.userName||'—'}</td>
                  <td className="c-act" onClick={e=>e.stopPropagation()}>
                    {r.status === 'clarification' && isOwner(r, user) ? (
                      <button type="button" onClick={()=>setEditing(r)} className="btn btn-sm"><Icon name="edit" size={14} />Revisi</button>
                    ) : r.status === 'rejected' ? (
                      <button type="button" onClick={()=>setViewing({ item: r, armDelete: true })} className="btn btn-sm btn-danger"><Icon name="trash" size={14} />Hapus</button>
                    ) : r.status === 'reversal_requested' && (isOwner(r, user) || isAdminish) ? (
                      <button type="button" onClick={()=>setConfirm({ kind:'reversal', item:r })} className="btn btn-sm btn-primary"><Icon name="check" size={14} />Setujui pembatalan</button>
                    ) : r.documents?.length > 0 ? <span className="au-xs au-muted au-row" style={{ gap: 4 }}><Icon name="file" size={13} />{r.documents.length}</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>}
    </>
  )
}

// ---------------------  TAB: Cashier  ---------------------
function CashierTab({ items, loading, reload, year, month }: { items:any[]; loading:boolean; reload:()=>void; year:number; month:number }) {
  const [transferring, setTransferring] = useState<any>(null)
  const [confirm, setConfirm] = useState<{ kind:'reverse'|'delete'; item:any } | null>(null)
  const inPeriod = (r:any) => { const d = periodDate(r); if (!d) return false; if (d.getFullYear()!==year) return false; if (month>=0 && d.getMonth()!==month) return false; return true }

  const pending = items.filter(r => ['submitted','approved','draft'].includes(r.status)).filter(inPeriod)
  const done = items.filter(r => ['done','paid','verified','reversal_requested','reversal_approved'].includes(r.status)).filter(inPeriod)

  // Pilih beberapa antrian utk hitung total (cashier sering transfer sekaligus)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showRincian, setShowRincian] = useState(false)
  const pendingKey = pending.map(r=>r._id).join(',')
  useEffect(() => {
    const ids = new Set(pending.map(r=>r._id))
    setSelected(prev => {
      const next = new Set(Array.from(prev).filter(id => ids.has(id)))
      return next.size === prev.size ? prev : next
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingKey])

  const toggleOne = (id:string) => setSelected(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
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
  const spP = { sortKey:sortP.sortKey, sortDir:sortP.sortDir, onSort:sortP.toggle }
  const spD = { sortKey:sortD.sortKey, sortDir:sortD.sortDir, onSort:sortD.toggle }

  async function delReversed(item:any) {
    try { await remove(item._id); toast.success('Dihapus. Kas diperbarui.'); setConfirm(null); reload() } catch (e:any) { toast.error(e.message) }
  }
  async function requestReversal(item:any, reason:string) {
    try { await patch(item._id, { status:'reversal_requested', reversalReason: reason, reversalRequestedAt: new Date().toISOString() }); toast.success('Permintaan pembatalan dikirim'); setConfirm(null); reload() } catch (e:any) { toast.error(e.message) }
  }
  const pendingSum = pending.reduce((s,r)=>s+(Number(r.amount)||0),0)
  const doneSum = done.reduce((s,r)=>s+(Number(r.totalTransfer||r.amount)||0),0)

  return (
    <>
      {transferring && <TransferSheet item={transferring} onClose={()=>setTransferring(null)} onSave={reload} />}
      {confirm?.kind === 'reverse' && <ConfirmSheet title="Minta pembatalan" confirmLabel="Kirim permintaan" input={{ label: 'Alasan pembatalan', multiline: true }}
        text={<>Pembatalan reimburse <b>“{confirm.item.title}”</b> perlu disetujui pengaju atau admin.</>}
        onConfirm={v => requestReversal(confirm.item, v)} onClose={() => setConfirm(null)} />}
      {confirm?.kind === 'delete' && <ConfirmSheet danger icon="trash" title="Hapus reimburse" confirmLabel="Ya, hapus"
        text={<>Hapus reimburse <b>“{confirm.item.title}”</b> yang sudah disetujui pembatalannya? Kas akan diperbarui.</>}
        onConfirm={() => delReversed(confirm.item)} onClose={() => setConfirm(null)} />}

      {showRincian && (
        <Sheet open title="Rincian transfer" onClose={()=>setShowRincian(false)}>
          <span className="au-xs au-muted">{rekap.rows.length} item dipilih · dikelompokkan per rekening</span>
          <div className="au-ig">
            {rekap.groups.map((g,i)=>(
              <div key={i} className="au-igr">
                <span className="au-col" style={{ minWidth: 0, flex: 1, gap: 1 }}><b className="au-small">{g.pengaju}</b><span className="au-xs au-muted">{g.bank} · <span style={{ fontFamily: 'var(--mono)' }}>{g.rek}</span> · {g.count} item</span></span>
                <b style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>Rp {fmt(g.subtotal)}</b>
              </div>
            ))}
          </div>
          <div className="au-total"><span className="lbl">Total · {rekap.rows.length} item</span><b>Rp {fmt(rekap.total)}</b></div>
          <details className="au-col">
            <summary className="lbl" style={{ cursor: 'pointer' }}>Item yang dipilih</summary>
            <div className="au-col" style={{ gap: 4, marginTop: 8 }}>
              {rekap.rows.map((r:any)=>(<div key={r._id} className="au-row au-between au-xs" style={{ gap: 8 }}><span className="au-ink2" style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.userName} · {oeLookup(r.category).name}</span><b style={{ flexShrink:0 }}>Rp {fmt(r.amount)}</b></div>))}
            </div>
          </details>
        </Sheet>
      )}

      {selected.size > 0 && (
        <div className="au-selbar" role="status">
          <span className="au-col" style={{ gap: 1 }}><span className="au-xs au-muted">{selected.size} item · {rekap.groups.length} rekening</span><b>Rp {fmt(rekap.total)}</b></span>
          <button type="button" onClick={()=>setShowRincian(true)} className="btn btn-sm btn-primary"><Icon name="list" size={14} />Rincian</button>
          <button type="button" onClick={()=>setSelected(new Set())} className="btn btn-sm">Batal pilih</button>
        </div>
      )}

      <div className="au-grid au-tiles" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' }}>
        <Tile icon="clock" color="var(--warn)" value={loading ? '–' : pending.length} label="Antrian transfer" hint={pendingSum ? `Rp ${short(pendingSum)}` : undefined} />
        <Tile icon="check" color="var(--aqua)" value={loading ? '–' : done.length} label="Sudah ditransfer" hint={doneSum ? `Rp ${short(doneSum)}` : undefined} />
      </div>

      <section className="au-col" style={{ gap: 10 }}>
        <span className="lbl">Antrian · {pending.length}</span>
        {loading ? <div className="au-card"><div className="au-skel" /><div className="au-skel" /></div>
         : pending.length === 0 ? <div className="au-card"><Empty title="Tidak ada antrian" text="Semua pengajuan pada periode ini sudah diproses." /></div>
         : <div className="au-tblw">
            <table className="wp-table au-ctbl" style={{ minWidth: 960 }}>
              <thead><tr>
                <th style={{ width: 44, textAlign: 'center' }}><input type="checkbox" className="au-check" checked={allChecked} ref={el=>{ if(el) el.indeterminate = someChecked }} onChange={toggleAll} aria-label="Pilih semua antrian" /></th>
                <SortTh label="Pengaju" k="pengaju" {...spP} />
                <SortTh label="Keperluan" k="kategori" {...spP} />
                <SortTh label="Bank / Rek" k="bank" {...spP} />
                <SortTh label="Nominal" k="amount" {...spP} style={{ textAlign: 'right' }} />
                <SortTh label="Sumber" k="source" {...spP} />
                <SortTh label="Submit" k="submittedAt" {...spP} />
                <th><span className="sr-only">Aksi</span></th>
              </tr></thead>
              <tbody>
                {pendingSorted.map(r => {
                  const checked = selected.has(r._id)
                  return (
                    <tr key={r._id} aria-selected={checked} className={checked ? 'is-sel' : undefined}>
                      <td className="c-chk" style={{ textAlign: 'center' }}><input type="checkbox" className="au-check" checked={checked} onChange={()=>toggleOne(r._id)} aria-label={`Pilih ${r.userName} Rp ${fmt(r.amount)}`} /></td>
                      <td className="c-main"><b className="au-small">{r.userName}</b></td>
                      <td data-l="Keperluan" className="au-small">{oeLookup(r.category).name}</td>
                      <td data-l="Bank / Rek" className="au-small"><span>{r.bank}<br/><span className="au-xs au-muted" style={{ fontFamily: 'var(--mono)' }}>{r.noRekening}</span></span></td>
                      <td data-l="Nominal" style={{ textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>Rp {fmt(r.amount)}</td>
                      <td data-l="Sumber">{srcTag(r)}</td>
                      <td data-l="Submit" className="au-small au-ink2" style={{ whiteSpace: 'nowrap' }}>{dstr(r.submittedAt)}</td>
                      <td className="c-act"><button type="button" onClick={()=>setTransferring(r)} className="btn btn-primary btn-sm">Transfer</button></td>
                    </tr>
                  )})}
              </tbody>
            </table>
          </div>}
      </section>

      <section className="au-col" style={{ gap: 10 }}>
        <span className="lbl">Sudah ditransfer · {done.length}</span>
        {!loading && done.length === 0 ? <div className="au-card"><Empty title="Belum ada riwayat transfer" /></div>
         : !loading && <div className="au-tblw">
            <table className="wp-table au-ctbl" style={{ minWidth: 900 }}>
              <thead><tr>
                <SortTh label="Pengaju" k="pengaju" {...spD} />
                <SortTh label="Keperluan" k="kategori" {...spD} />
                <SortTh label="Nominal" k="amount" {...spD} style={{ textAlign: 'right' }} />
                <SortTh label="Biaya" k="biaya" {...spD} style={{ textAlign: 'right' }} />
                <SortTh label="Total" k="total" {...spD} style={{ textAlign: 'right' }} />
                <SortTh label="Sumber" k="source" {...spD} />
                <SortTh label="Ditransfer" k="transferredAt" {...spD} />
                <th>Aksi</th>
              </tr></thead>
              <tbody>
                {doneSorted.map(r => (
                  <tr key={r._id}>
                    <td className="c-main"><b className="au-small">{r.userName}</b></td>
                    <td data-l="Keperluan" className="au-small">{oeLookup(r.category).name}</td>
                    <td data-l="Nominal" style={{ textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>Rp {fmt(r.amount)}</td>
                    <td data-l="Biaya" className="au-small" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{r.biayaAntarBank>0?`Rp ${fmt(r.biayaAntarBank)}`:'—'}</td>
                    <td data-l="Total" style={{ textAlign: 'right', fontWeight: 700, color: 'var(--accent-ink)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>Rp {fmt(r.totalTransfer||r.amount)}</td>
                    <td data-l="Sumber">{srcTag(r)}</td>
                    <td data-l="Ditransfer" className="au-small au-ink2" style={{ whiteSpace: 'nowrap' }}>{dstr(r.transferredAt)}</td>
                    <td className="c-act">
                      {r.status === 'done' || r.status === 'paid' ? (
                        <button type="button" onClick={()=>setConfirm({ kind:'reverse', item:r })} className="btn btn-sm"><Icon name="back" size={14} />Reverse</button>
                      ) : r.status === 'verified' ? <Pill tone="accent"><Icon name="lock" size={12} style={{ marginRight: 4, verticalAlign: '-1px' }} />Verified</Pill>
                      : r.status === 'reversal_requested' ? <Pill tone="warn">Menunggu persetujuan</Pill>
                      : r.status === 'reversal_approved' ? (
                        <button type="button" onClick={()=>setConfirm({ kind:'delete', item:r })} className="btn btn-sm btn-danger"><Icon name="trash" size={14} />Hapus</button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>}
      </section>
    </>
  )
}
