'use client'
import { getConfig } from '@/lib/configCache'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'

const fmt = (n:number) => new Intl.NumberFormat('id-ID').format(n||0)

function ReimburseForm({ editing, onClose, onSave }: { editing?:any; onClose:()=>void; onSave:()=>void }) {
  const { data:session } = useSession(); const user = session?.user as any
  const [form, setForm] = useState({
    title: editing?.title || '',
    description: editing?.description || '',
    amount: editing?.amount || 0,
    category: editing?.category || 'general',
    isCashCard: editing?.isCashCard || false,
    bank: editing?.bank || '',
    noRekening: editing?.noRekening || '',
    documents: editing?.documents || [],
  })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const set = (k:string,v:any) => setForm(f=>({...f,[k]:v}))

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
    toast.success(`${newDocs.length} file diupload`)
  }

  function removeDoc(i:number) { setForm(f=>({...f, documents: f.documents.filter((_:any,idx:number)=>idx!==i) })) }

  async function save() {
    if (!form.title || !form.amount) { toast.error('Title & nominal wajib'); return }
    if (!form.bank || !form.noRekening) { toast.error('Bank & no rekening wajib (untuk transfer)'); return }
    setSaving(true)
    try {
      const url = editing ? `/api/reimbursements/${editing._id}` : '/api/reimbursements'
      const body: any = {
        ...form,
        userId: user?.id||user?.email, userName: user?.name,
        source: form.isCashCard ? 'cash_card' : 'petty_cash',
        status: 'submitted',
        submittedAt: new Date().toISOString(),
      }
      const r = await fetch(url, { method: editing?'PATCH':'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) })
      if (!r.ok) { toast.error('Gagal'); return }

      // Auto WA to cashier on new submit
      if (!editing) {
        try {
          const cfgR = await getConfig().then((data:any)=>({ data }))
          const cfg = cfgR.data
          if (cfg?.fonnte?.cashierUserId) {
            const usersR = await fetch('/api/users').then(r=>r.json())
            const cashier = (usersR.data||[]).find((u:any)=>u._id===cfg.fonnte.cashierUserId || u.roles?.includes('cashier'))
            if (cashier?.phone) {
              const tpl = cfg.fonnte.messageToCashier || ''
              const msg = tpl.replace(/{memberName}/g, user?.name||'-')
                            .replace(/{purpose}/g, form.title)
                            .replace(/{amount}/g, 'Rp ' + fmt(form.amount))
                            .replace(/{category}/g, form.category)
                            .replace(/{bank}/g, form.bank)
                            .replace(/{noRekening}/g, form.noRekening)
              await fetch('/api/fonnte', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ target: cashier.phone, message: msg }) })
            }
          }
        } catch { /* non-blocking */ }
      }

      toast.success(editing?'Diperbarui':'Pengajuan terkirim ke Cashier'); onSave(); onClose()
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ width:560 }}>
        <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between' }}>
          <span style={{ fontSize:14, fontWeight:600 }}>{editing?'Edit Reimburse':'+ Pengajuan Reimburse'}</span>
          <button onClick={onClose} className="btn btn-icon">×</button>
        </div>
        <div style={{ padding:'14px 20px', overflowY:'auto', maxHeight:'72vh', display:'flex', flexDirection:'column', gap:11 }}>
          <div><label style={lbl}>Keperluan *</label><input className="input" value={form.title} onChange={e=>set('title',e.target.value)} placeholder="Misal: Beli ATK kantor" /></div>
          <div><label style={lbl}>Keterangan</label><textarea className="input" rows={2} value={form.description} onChange={e=>set('description',e.target.value)} /></div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div><label style={lbl}>Nominal (Rp) *</label><input type="number" className="input" value={form.amount} onChange={e=>set('amount',Number(e.target.value))} /></div>
            <div><label style={lbl}>Kategori</label>
              <select className="input" value={form.category} onChange={e=>set('category',e.target.value)}>
                <option value="petty_cash">Petty Cash / Operasional</option>
                <option value="travel">Travel</option>
                <option value="general">General</option>
              </select></div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div><label style={lbl}>Bank *</label><input className="input" value={form.bank} onChange={e=>set('bank',e.target.value)} placeholder="BCA, Mandiri, BRI..." /></div>
            <div><label style={lbl}>No. Rekening *</label><input className="input" value={form.noRekening} onChange={e=>set('noRekening',e.target.value)} /></div>
          </div>
          <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, cursor:'pointer' }}>
            <input type="checkbox" checked={form.isCashCard} onChange={e=>set('isCashCard',e.target.checked)} />
            Dibayar pakai Cash Card (sumber dari Cash Card)
          </label>

          <div>
            <label style={lbl}>Bukti / Dokumen Pendukung</label>
            <label style={{ display:'block', padding:'18px', borderRadius:8, border:'2px dashed var(--border2)', background:'var(--bg3)', cursor:'pointer', textAlign:'center', fontSize:11, color:'var(--text2)' }}>
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
          <button onClick={save} disabled={saving} className="btn btn-primary">{saving?'...':'Submit'}</button>
        </div>
      </div>
    </div>
  )
}

export default function ReimbursementsPage() {
  const { data:session } = useSession(); const user = session?.user as any
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [tab, setTab] = useState<'all'|'submitted'|'done'>('all')
  const [viewing, setViewing] = useState<any>(null)

  async function load() {
    setLoading(true)
    const r = await fetch('/api/reimbursements').then(r=>r.json())
    setItems(r.data||[]); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const userRoles = user?.roles || (user?.role ? [user.role] : [])
  const isAdminish = userRoles.includes('admin') || userRoles.includes('manager') || userRoles.includes('finance') || userRoles.includes('cashier')

  const visible = isAdminish ? items : items.filter(i => i.userName === user?.name || i.userId === user?.id || i.userId === user?.email)
  const filtered = tab === 'all' ? visible : visible.filter(i => tab === 'submitted' ? (i.status === 'submitted' || i.status === 'approved' || i.status === 'draft') : i.status === 'done')
  const stats = { submitted: visible.filter(i=>i.status==='submitted').length, done: visible.filter(i=>i.status==='done').length }

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {(showForm||editing) && <ReimburseForm editing={editing} onClose={()=>{setShowForm(false);setEditing(null)}} onSave={load} />}

      {viewing && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setViewing(null)}>
          <div className="modal" style={{ width:520 }}>
            <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between' }}>
              <span style={{ fontSize:14, fontWeight:600 }}>Detail Reimburse</span>
              <button onClick={()=>setViewing(null)} className="btn btn-icon">×</button>
            </div>
            <div style={{ padding:'14px 20px', display:'flex', flexDirection:'column', gap:10, fontSize:12 }}>
              <div><b>{viewing.title}</b></div>
              <div style={{ color:'var(--text2)' }}>{viewing.description}</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, fontSize:11 }}>
                <div><span style={{ color:'var(--text3)' }}>Pengaju:</span> {viewing.userName}</div>
                <div><span style={{ color:'var(--text3)' }}>Nominal:</span> Rp {fmt(viewing.amount)}</div>
                <div><span style={{ color:'var(--text3)' }}>Bank:</span> {viewing.bank}</div>
                <div><span style={{ color:'var(--text3)' }}>No. Rek:</span> {viewing.noRekening}</div>
                <div><span style={{ color:'var(--text3)' }}>Sumber:</span> {viewing.isCashCard?'Cash Card':'Petty Cash'}</div>
                <div><span style={{ color:'var(--text3)' }}>Status:</span> {viewing.status}</div>
                {viewing.biayaAntarBank > 0 && <div><span style={{ color:'var(--text3)' }}>Biaya antar bank:</span> Rp {fmt(viewing.biayaAntarBank)}</div>}
                {viewing.totalTransfer && <div><span style={{ color:'var(--text3)' }}>Total transfer:</span> Rp {fmt(viewing.totalTransfer)}</div>}
              </div>
              {viewing.documents?.length > 0 && (
                <div>
                  <div style={{ fontSize:11, color:'var(--text3)', marginBottom:5 }}>Dokumen:</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                    {viewing.documents.map((d:any, i:number) => (
                      <a key={i} href={d.url} download={d.name} className="btn btn-sm" style={{ justifyContent:'flex-start', textDecoration:'none' }}>📄 {d.name}</a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div style={{ padding:'12px 20px', borderBottom:'1px solid var(--border)', background:'var(--bg2)', display:'flex', justifyContent:'space-between', flexShrink:0 }}>
        <div>
          <div style={{ fontSize:14, fontWeight:600 }}>Reimbursement</div>
          <div style={{ fontSize:11, color:'var(--text3)' }}>{isAdminish ? `Admin view · ${visible.length} pengajuan` : `Pengajuan saya · ${visible.length} reimburse`}</div>
        </div>
        <button onClick={()=>setShowForm(true)} className="btn btn-primary btn-sm">+ Pengajuan Baru</button>
      </div>

      <div style={{ display:'flex', gap:5, padding:'10px 20px', background:'var(--bg2)', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
        <button onClick={()=>setTab('all')} style={chip(tab==='all')}>Semua ({visible.length})</button>
        <button onClick={()=>setTab('submitted')} style={chip(tab==='submitted', 'var(--amber)')}>Menunggu ({stats.submitted})</button>
        <button onClick={()=>setTab('done')} style={chip(tab==='done', 'var(--green)')}>Done ({stats.done})</button>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'14px 20px' }} className="safe-bottom page-pad">
        {loading ? <div style={{ textAlign:'center', padding:40, color:'var(--text3)' }}>Memuat...</div> :
         filtered.length === 0 ? (
          <div className="card" style={{ textAlign:'center', padding:40, color:'var(--text3)' }}><div style={{ fontSize:30, marginBottom:8 }}>💸</div><div>Belum ada reimburse</div></div>
         ) : (
          <div className="card" style={{ overflow:'auto' }}>
            <table className="wp-table" style={{ minWidth:900 }}>
              <thead><tr><th>Pengaju</th><th>Keperluan</th><th>Nominal</th><th>Bank / Rek</th><th>Sumber</th><th>Status</th><th>Tgl Submit</th><th></th></tr></thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r._id} style={{ cursor:'pointer' }} onClick={()=>setViewing(r)}>
                    <td style={{ fontSize:11 }}>{r.userName||'—'}</td>
                    <td style={{ fontSize:11 }}>
                      <div style={{ fontWeight:600 }}>{r.title}</div>
                      {r.description && <div style={{ color:'var(--text3)', fontSize:10 }}>{r.description.substring(0,60)}</div>}
                    </td>
                    <td style={{ fontWeight:600 }}>Rp {fmt(r.amount)}</td>
                    <td style={{ fontSize:11 }}>{r.bank}<br/><span style={{ color:'var(--text3)', fontSize:10 }}>{r.noRekening}</span></td>
                    <td><span className="badge" style={{ background:r.isCashCard?'var(--brand-soft)':'var(--bg3)', color:r.isCashCard?'var(--brand)':'var(--text2)', fontSize:9 }}>{r.isCashCard?'Cash Card':'Petty Cash'}</span></td>
                    <td>{statusBadge(r.status)}</td>
                    <td style={{ fontSize:10 }}>{r.submittedAt?new Date(r.submittedAt).toLocaleDateString('id-ID'):'—'}</td>
                    <td>{r.documents?.length > 0 && <span style={{ fontSize:10, color:'var(--text3)' }}>📎 {r.documents.length}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
         )}
      </div>
    </div>
  )
}
function statusBadge(s:string) {
  const cfg: Record<string,{label:string;color:string;bg:string}> = {
    submitted: { label:'Menunggu', color:'var(--amber)', bg:'var(--amberbg)' },
    approved: { label:'Menunggu', color:'var(--amber)', bg:'var(--amberbg)' },
    done: { label:'Done', color:'var(--green)', bg:'var(--greenbg)' },
    paid: { label:'Done', color:'var(--green)', bg:'var(--greenbg)' },
    rejected: { label:'Ditolak', color:'var(--red)', bg:'var(--redbg)' },
  }
  const c = cfg[s] || { label:s, color:'var(--text3)', bg:'var(--bg3)' }
  return <span className="badge" style={{ background:c.bg, color:c.color, fontSize:9 }}>{c.label}</span>
}
function chip(active:boolean, color:string='var(--brand)'):React.CSSProperties { return { padding:'4px 11px', borderRadius:20, fontSize:11, fontWeight:600, cursor:'pointer', border:`1px solid ${active?color:'var(--border)'}`, background:active?color+'1a':'var(--bg3)', color:active?color:'var(--text2)' } }
const lbl: React.CSSProperties = { display:'block', fontSize:11, fontWeight:500, color:'var(--text2)', marginBottom:5 }
