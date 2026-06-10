'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'

const BANKS = ['Mandiri','BNI','BRI','BSI','BCA','CIMB','BTN','Permata','Danamon','OCBC','Lainnya']
const CATS: Record<string,string> = { transport:'🚗 Transport', meal:'🍽 Konsumsi', accommodation:'🏨 Akomodasi', office:'🏢 Perlengkapan Kantor', other:'📋 Lainnya' }
const STATUS_CFG: Record<string,{label:string;color:string;bg:string}> = {
  pending:  { label:'Menunggu',  color:'var(--amber)', bg:'var(--amberbg)' },
  approved: { label:'Disetujui', color:'var(--blue)',  bg:'var(--bluebg)' },
  rejected: { label:'Ditolak',   color:'var(--red)',   bg:'var(--redbg)' },
  paid:     { label:'Dibayar',   color:'var(--green)', bg:'var(--greenbg)' },
}

function formatRp(n: number) { return new Intl.NumberFormat('id-ID', { style:'currency', currency:'IDR', minimumFractionDigits:0 }).format(n) }

function SubmitForm({ onClose, onSave }: { onClose:()=>void; onSave:()=>void }) {
  const { data:session } = useSession(); const user = session?.user as any
  const [form, setForm] = useState({ billDate:'', purpose:'', category:'other', bankName:'Mandiri', accountNumber:'', accountName:'', amount:'', notes:'' })
  const [file, setFile] = useState<File|null>(null)
  const [saving, setSaving] = useState(false)
  const set = (k:string,v:any) => setForm(f=>({...f,[k]:v}))

  async function save() {
    if (!form.billDate||!form.purpose||!form.bankName||!form.accountNumber||!form.amount) { toast.error('Lengkapi semua field wajib'); return }
    setSaving(true)
    try {
      await fetch('/api/reimbursements', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({
        ...form, amount: Number(form.amount.replace(/\D/g,'')),
        userId: user?.id||user?.email, userName: user?.name,
        receiptName: file?.name || null,
      })})
      toast.success('Pengajuan reimburse terkirim!'); onSave(); onClose()
    } catch { toast.error('Gagal') } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ width:580 }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontSize:14, fontWeight:600, color:'var(--text)' }}>💰 Ajukan Reimbursement</span>
          <button onClick={onClose} className="btn btn-icon">×</button>
        </div>
        <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:12, overflowY:'auto', maxHeight:'72vh' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div><label style={lbl}>Tanggal Bill <span style={{color:'var(--red)'}}>*</span></label><input type="date" className="input" value={form.billDate} onChange={e=>set('billDate',e.target.value)} /></div>
            <div><label style={lbl}>Kategori</label>
              <select className="input" value={form.category} onChange={e=>set('category',e.target.value)}>
                {Object.entries(CATS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
              </select></div>
          </div>
          <div><label style={lbl}>Keperluan <span style={{color:'var(--red)'}}>*</span></label><input className="input" value={form.purpose} onChange={e=>set('purpose',e.target.value)} placeholder="Jelaskan keperluan reimburse..." /></div>
          <div style={{ background:'var(--bg3)', borderRadius:8, padding:12 }}>
            <div style={{ fontSize:12, fontWeight:600, color:'var(--text)', marginBottom:10 }}>🏦 Info Rekening Penerima</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <div><label style={lbl}>Bank <span style={{color:'var(--red)'}}>*</span></label>
                <select className="input" value={form.bankName} onChange={e=>set('bankName',e.target.value)}>
                  {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                </select></div>
              <div><label style={lbl}>No. Rekening <span style={{color:'var(--red)'}}>*</span></label><input className="input" value={form.accountNumber} onChange={e=>set('accountNumber',e.target.value)} placeholder="1234567890" /></div>
            </div>
            <div style={{ marginTop:10 }}><label style={lbl}>Nama Pemilik Rekening</label><input className="input" value={form.accountName} onChange={e=>set('accountName',e.target.value)} placeholder="Sesuai buku tabungan" /></div>
          </div>
          <div><label style={lbl}>Nominal (Rp) <span style={{color:'var(--red)'}}>*</span></label>
            <input className="input" value={form.amount} onChange={e=>set('amount',e.target.value)} placeholder="0"
              style={{ fontSize:16, fontWeight:600, color:'var(--blue)' }} />
            {form.amount && <div style={{ fontSize:11, color:'var(--text3)', marginTop:4 }}>{formatRp(Number(form.amount.replace(/\D/g,'')))}</div>}
          </div>
          <div><label style={lbl}>Bukti Bill / Struk</label>
            <div style={{ border:'1px dashed var(--border2)', borderRadius:8, padding:16, textAlign:'center', cursor:'pointer' }} onClick={() => document.getElementById('file-input')?.click()}>
              <input id="file-input" type="file" accept="image/*,.pdf" style={{ display:'none' }} onChange={e => setFile(e.target.files?.[0]||null)} />
              {file ? <div style={{ color:'var(--green)', fontSize:12 }}>✓ {file.name}</div> : <div style={{ color:'var(--text3)', fontSize:12 }}>📎 Klik untuk upload foto/PDF struk</div>}
            </div></div>
          <div><label style={lbl}>Catatan (opsional)</label><textarea className="input" value={form.notes} onChange={e=>set('notes',e.target.value)} rows={2} placeholder="Catatan tambahan jika ada..." /></div>
        </div>
        <div style={{ padding:'12px 20px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'flex-end', gap:8 }}>
          <button onClick={onClose} className="btn">Batal</button>
          <button onClick={save} disabled={saving} className="btn btn-primary">{saving ? 'Mengirim...' : '📤 Kirim Pengajuan'}</button>
        </div>
      </div>
    </div>
  )
}

function ReviewModal({ item, onClose, onSave }: { item:any; onClose:()=>void; onSave:()=>void }) {
  const { data:session } = useSession(); const user = session?.user as any
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)

  async function update(status: string) {
    setLoading(true)
    await fetch(`/api/reimbursements/${item._id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ status, reviewedBy: user?.name, reviewedAt: new Date().toISOString().split('T')[0], reviewNote: note }) })
    toast.success(`Status diperbarui: ${status}`)
    setLoading(false); onSave(); onClose()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ width:480 }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between' }}>
          <span style={{ fontSize:14, fontWeight:600 }}>Review Reimbursement</span>
          <button onClick={onClose} className="btn btn-icon">×</button>
        </div>
        <div style={{ padding:'16px 20px' }}>
          <div style={{ background:'var(--bg3)', borderRadius:8, padding:14, marginBottom:12 }}>
            <div style={{ fontSize:13, fontWeight:600, color:'var(--text)', marginBottom:8 }}>{item.purpose}</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, fontSize:12, color:'var(--text2)' }}>
              <div>👤 {item.userName}</div><div>📅 {item.billDate}</div>
              <div>🏦 {item.bankName} · {item.accountNumber}</div><div>📁 {CATS[item.category]}</div>
            </div>
            <div style={{ marginTop:10, padding:'8px 12px', background:'var(--bluebg)', borderRadius:6, fontSize:16, fontWeight:700, color:'var(--blue)', textAlign:'center' }}>{formatRp(item.amount)}</div>
          </div>
          {item.receiptName && <div style={{ fontSize:12, color:'var(--text3)', marginBottom:12 }}>📎 Bukti: {item.receiptName}</div>}
          <div><label style={lbl}>Catatan (opsional)</label><textarea className="input" value={note} onChange={e=>setNote(e.target.value)} rows={2} placeholder="Catatan untuk pengaju..." /></div>
        </div>
        <div style={{ padding:'12px 20px', borderTop:'1px solid var(--border)', display:'flex', gap:8 }}>
          <button onClick={() => update('rejected')} disabled={loading} className="btn btn-danger" style={{ flex:1 }}>✗ Tolak</button>
          <button onClick={() => update('approved')} disabled={loading} className="btn" style={{ flex:1, background:'var(--bluebg)', color:'var(--blue)', borderColor:'var(--blue)' }}>✓ Setujui</button>
          {item.status === 'approved' && <button onClick={() => update('paid')} disabled={loading} className="btn" style={{ flex:1, background:'var(--greenbg)', color:'var(--green)', borderColor:'var(--green)' }}>💸 Tandai Dibayar</button>}
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
  const [reviewing, setReviewing] = useState<any>(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [activeTab, setActiveTab] = useState<'mine'|'all'|'finance'>('mine')

  const isAdmin = ['admin','manager'].includes(user?.role)
  const isFinance = user?.role === 'finance' || isAdmin

  async function load() {
    const params = new URLSearchParams()
    if (filterStatus) params.set('status', filterStatus)
    if (activeTab === 'mine') params.set('userId', user?.id || user?.email || '')
    const d = await fetch(`/api/reimbursements?${params}`).then(r=>r.json())
    setItems(d.data || []); setLoading(false)
  }
  useEffect(() => { if (user) load() }, [filterStatus, activeTab, user])

  const totalPending = items.filter(i=>i.status==='pending').reduce((s,i)=>s+i.amount,0)
  const totalApproved = items.filter(i=>i.status==='approved').reduce((s,i)=>s+i.amount,0)
  const totalPaid = items.filter(i=>i.status==='paid').reduce((s,i)=>s+i.amount,0)

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {showForm && <SubmitForm onClose={()=>setShowForm(false)} onSave={load} />}
      {reviewing && <ReviewModal item={reviewing} onClose={()=>setReviewing(null)} onSave={load} />}

      <div style={{ padding:'12px 20px', borderBottom:'1px solid var(--border)', background:'var(--bg2)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div><div style={{ fontSize:14, fontWeight:600 }}>Reimbursement</div><div style={{ fontSize:11, color:'var(--text3)' }}>Pengajuan & pengelolaan reimburse tim</div></div>
        <button className="btn btn-primary btn-sm" onClick={()=>setShowForm(true)}>+ Ajukan Reimburse</button>
      </div>

      {/* Summary cards */}
      {isFinance && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, padding:'12px 20px', background:'var(--bg2)', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
          {[
            { label:'Menunggu Review', value:totalPending, color:'var(--amber)', count:items.filter(i=>i.status==='pending').length },
            { label:'Disetujui (Belum Dibayar)', value:totalApproved, color:'var(--blue)', count:items.filter(i=>i.status==='approved').length },
            { label:'Total Dibayar', value:totalPaid, color:'var(--green)', count:items.filter(i=>i.status==='paid').length },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding:'10px 14px' }}>
              <div style={{ fontSize:10, color:'var(--text3)', marginBottom:4 }}>{s.label}</div>
              <div style={{ fontSize:16, fontWeight:700, color:s.color }}>{formatRp(s.value)}</div>
              <div style={{ fontSize:11, color:'var(--text3)'}}>{s.count} item</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs + filter */}
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 20px', background:'var(--bg2)', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
        <div style={{ display:'flex', gap:0, background:'var(--bg3)', borderRadius:8, padding:3 }}>
          {[['mine','Pengajuan Saya'],['all','Semua']].map(([v,l]) => (
            <button key={v} onClick={()=>setActiveTab(v as any)} style={{ padding:'4px 14px', borderRadius:6, fontSize:12, fontWeight:500, cursor:'pointer', border:'none', background:activeTab===v?'var(--bg2)':'transparent', color:activeTab===v?'var(--text)':'var(--text3)', transition:'all 0.15s' }}>{l}</button>
          ))}
        </div>
        <select className="input" style={{ width:160 }} value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
          <option value="">Semua Status</option>
          {Object.entries(STATUS_CFG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
        </select>
        <div style={{ flex:1 }} />
        <span style={{ fontSize:12, color:'var(--text3)' }}>{items.length} item</span>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'16px 20px' }}>
        {loading ? <div style={{ textAlign:'center', padding:40, color:'var(--text3)' }}>Memuat...</div> : (
          items.length === 0 ? (
            <div style={{ textAlign:'center', padding:60, color:'var(--text3)' }}>
              <div style={{ fontSize:32, marginBottom:12 }}>💸</div>
              <div>Belum ada pengajuan reimbursement</div>
            </div>
          ) : (
            <div className="card" style={{ overflow:'hidden' }}>
              <table className="wp-table" style={{ width:'100%' }}>
                <thead><tr>
                  <th>Pengaju</th><th>Keperluan</th><th>Kategori</th><th>Tanggal Bill</th>
                  <th style={{ textAlign:'right' }}>Nominal</th><th>Bank / Rekening</th><th>Status</th><th>Aksi</th>
                </tr></thead>
                <tbody>
                  {items.map(item => {
                    const scfg = STATUS_CFG[item.status]
                    return (
                      <tr key={item._id}>
                        <td><div style={{ fontWeight:500, color:'var(--text)' }}>{item.userName}</div></td>
                        <td><div style={{ maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.purpose}</div>
                          {item.notes && <div style={{ fontSize:10, color:'var(--text3)' }}>{item.notes}</div>}</td>
                        <td>{CATS[item.category]?.split(' ')[0]} {CATS[item.category]?.split(' ').slice(1).join(' ')}</td>
                        <td>{item.billDate}</td>
                        <td style={{ textAlign:'right', fontWeight:700, color:'var(--blue)' }}>{formatRp(item.amount)}</td>
                        <td><div style={{ fontSize:12 }}>{item.bankName}</div><div style={{ fontSize:10, color:'var(--text3)' }}>{item.accountNumber}</div>{item.accountName && <div style={{ fontSize:10, color:'var(--text3)' }}>{item.accountName}</div>}</td>
                        <td><span style={{ padding:'2px 9px', borderRadius:20, fontSize:11, fontWeight:600, background:scfg.bg, color:scfg.color }}>{scfg.label}</span>
                          {item.reviewNote && <div style={{ fontSize:10, color:'var(--text3)', marginTop:3 }}>"{item.reviewNote}"</div>}</td>
                        <td>
                          {isFinance && item.status === 'pending' && <button className="btn btn-sm" onClick={()=>setReviewing(item)}>Review</button>}
                          {isFinance && item.status === 'approved' && <button className="btn btn-sm" style={{ color:'var(--green)', borderColor:'var(--green)' }} onClick={()=>setReviewing(item)}>Bayar</button>}
                          {item.receiptName && <div style={{ fontSize:10, color:'var(--text3)', marginTop:4 }}>📎 {item.receiptName}</div>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  )
}
const lbl: React.CSSProperties = { display:'block', fontSize:11, fontWeight:500, color:'var(--text2)', marginBottom:5 }
