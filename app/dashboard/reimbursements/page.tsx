'use client'
import { useEffect, useState, useRef } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'

const CATS: Record<string,string> = { transport:'🚗 Transport', meal:'🍽 Konsumsi', accommodation:'🏨 Akomodasi', office:'🏢 Perlengkapan Kantor', other:'📋 Lainnya' }
const STATUS_CFG: Record<string,{label:string;color:string;bg:string}> = {
  submitted:{ label:'Menunggu',  color:'var(--amber)', bg:'var(--amberbg)' },
  approved: { label:'Disetujui', color:'var(--brand)', bg:'var(--brand-soft)' },
  rejected: { label:'Ditolak',   color:'var(--red)',   bg:'var(--redbg)' },
  paid:     { label:'Dibayar',   color:'var(--green)', bg:'var(--greenbg)' },
}
function formatRp(n:number) { return new Intl.NumberFormat('id-ID', { style:'currency', currency:'IDR', minimumFractionDigits:0 }).format(n) }

function SubmitForm({ onClose, onSave, profile }: { onClose:()=>void; onSave:()=>void; profile:any }) {
  const { data:session } = useSession(); const user = session?.user as any
  // Saved rekenings: from current user profile + custom additions
  const savedRek: {bank:string;noRekening:string}[] = []
  if (profile?.bank && profile?.noRekening) savedRek.push({ bank: profile.bank, noRekening: profile.noRekening })
  const [rekOption, setRekOption] = useState<'saved'|'manual'>(savedRek.length?'saved':'manual')
  const [selectedRek, setSelectedRek] = useState(savedRek[0]||{bank:'',noRekening:''})
  const [manualRek, setManualRek] = useState({ bank:'', noRekening:'' })

  const [form, setForm] = useState({
    billDate:'', purpose:'', category:'other', amount:'', notes:'',
    isCashCard: false,
  })
  const [files, setFiles] = useState<{ url:string; name:string; type:string; size:number }[]>([])
  const [saving, setSaving] = useState(false)
  const [showInfo, setShowInfo] = useState(false)
  const set = (k:string,v:any) => setForm(f=>({...f,[k]:v}))

  function handleFiles(filesList: FileList|null) {
    if (!filesList) return
    Array.from(filesList).forEach(f => {
      if (f.size > 5*1024*1024) { toast.error(`${f.name}: max 5MB`); return }
      const reader = new FileReader()
      reader.onload = () => {
        setFiles(prev => [...prev, { url: reader.result as string, name: f.name, type: f.type, size: f.size }])
      }
      reader.readAsDataURL(f)
    })
  }

  async function save() {
    if (!form.billDate||!form.purpose||!form.amount) { toast.error('Lengkapi field wajib'); return }
    const finalRek = rekOption==='saved' ? selectedRek : manualRek
    if (!finalRek.bank || !finalRek.noRekening) { toast.error('Info rekening wajib'); return }
    if (files.length === 0) { toast.error('Upload minimal 1 dokumen'); return }
    setSaving(true)
    try {
      const r = await fetch('/api/reimbursements', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({
        title: form.purpose,
        description: form.notes,
        amount: Number(form.amount.replace(/\D/g,'')),
        category: form.category,
        bank: finalRek.bank,
        noRekening: finalRek.noRekening,
        isCashCard: form.isCashCard,
        source: form.isCashCard ? 'cash_card' : 'petty_cash',
        documents: files,
        userId: user?.id||user?.email, userName: user?.name,
        status:'submitted', submittedAt: new Date().toISOString(),
      })})
      if (!r.ok) { const e = await r.json(); toast.error('Gagal: ' + (e.error||r.statusText)); return }
      toast.success('Pengajuan terkirim!'); onSave(); onClose()
    } catch (e:any) { toast.error('Gagal: '+e.message) } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ width:580 }}>
        <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between' }}>
          <span style={{ fontSize:14, fontWeight:600 }}>💰 Ajukan Reimbursement</span>
          <button onClick={onClose} className="btn btn-icon">×</button>
        </div>
        <div style={{ padding:'14px 20px', overflowY:'auto', maxHeight:'72vh', display:'flex', flexDirection:'column', gap:12 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div><label style={lbl}>Tanggal Bill *</label><input type="date" className="input" value={form.billDate} onChange={e=>set('billDate',e.target.value)} /></div>
            <div><label style={lbl}>Kategori</label>
              <select className="input" value={form.category} onChange={e=>set('category',e.target.value)}>
                {Object.entries(CATS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
              </select></div>
          </div>
          <div><label style={lbl}>Keperluan *</label><input className="input" value={form.purpose} onChange={e=>set('purpose',e.target.value)} placeholder="Jelaskan keperluan reimburse..." /></div>

          {/* Bank: dropdown saved or manual */}
          <div style={{ background:'var(--bg3)', borderRadius:8, padding:12 }}>
            <div style={{ fontSize:12, fontWeight:600, marginBottom:8 }}>🏦 Info Rekening Penerima</div>
            {savedRek.length > 0 && (
              <div style={{ display:'flex', gap:8, marginBottom:8 }}>
                <button onClick={()=>setRekOption('saved')} className="btn btn-sm" style={{ background: rekOption==='saved'?'var(--brand-soft)':'var(--bg2)', color: rekOption==='saved'?'var(--brand)':'var(--text2)' }}>📒 Dari Biodata</button>
                <button onClick={()=>setRekOption('manual')} className="btn btn-sm" style={{ background: rekOption==='manual'?'var(--brand-soft)':'var(--bg2)', color: rekOption==='manual'?'var(--brand)':'var(--text2)' }}>+ Tambah Baru</button>
              </div>
            )}
            {rekOption === 'saved' ? (
              <div style={{ background:'var(--bg2)', padding:'9px 12px', borderRadius:7, fontSize:12 }}>
                <div style={{ fontWeight:600 }}>{selectedRek.bank}</div>
                <div style={{ color:'var(--text3)', fontSize:11 }}>{selectedRek.noRekening}</div>
                <div style={{ fontSize:10, color:'var(--text3)', marginTop:4 }}>a.n. {profile?.name}</div>
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div><label style={lbl}>Bank</label><input className="input" value={manualRek.bank} onChange={e=>setManualRek({...manualRek,bank:e.target.value})} placeholder="BCA, Mandiri, ..." /></div>
                <div><label style={lbl}>No Rekening</label><input className="input" value={manualRek.noRekening} onChange={e=>setManualRek({...manualRek,noRekening:e.target.value})} placeholder="1234567890" /></div>
              </div>
            )}
          </div>

          <div><label style={lbl}>Nominal (Rp) *</label>
            <input className="input" value={form.amount} onChange={e=>set('amount',e.target.value)} placeholder="0" style={{ fontSize:16, fontWeight:600, color:'var(--brand)' }} />
            {form.amount && <div style={{ fontSize:11, color:'var(--text3)', marginTop:4 }}>{formatRp(Number(form.amount.replace(/\D/g,'')))}</div>}
          </div>

          {/* CASH CARD vs PETTY CASH */}
          <div style={{ background:'var(--bg3)', borderRadius:8, padding:12 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
              <span style={{ fontSize:12, fontWeight:600 }}>Apakah reimbursement termasuk kedalam dana Cash Card?</span>
              <button onClick={()=>setShowInfo(s=>!s)} type="button" style={{ width:18, height:18, borderRadius:'50%', border:'1px solid var(--border2)', background:'transparent', cursor:'pointer', fontSize:10, color:'var(--text3)', display:'flex', alignItems:'center', justifyContent:'center' }} title="Info">i</button>
            </div>
            {showInfo && (
              <div style={{ background:'var(--bg2)', borderRadius:6, padding:'8px 10px', fontSize:11, color:'var(--text2)', marginBottom:8, lineHeight:1.5, border:'1px solid var(--border2)' }}>
                💡 Syarat masuk Cash Card: evidence berupa <b>callmeet</b>, <b>dokumentasi kegiatan</b>, dan <b>bill invoice</b>.
              </div>
            )}
            <div style={{ display:'flex', gap:10 }}>
              <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:12, padding:'6px 12px', borderRadius:6, background: form.isCashCard?'var(--brand-soft)':'var(--bg2)', border:`1px solid ${form.isCashCard?'var(--brand)':'var(--border2)'}` }}>
                <input type="radio" checked={form.isCashCard===true} onChange={()=>set('isCashCard',true)} />
                <span style={{ color: form.isCashCard?'var(--brand)':'var(--text2)' }}>Yes → Cash Card</span>
              </label>
              <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:12, padding:'6px 12px', borderRadius:6, background: !form.isCashCard?'var(--brand-soft)':'var(--bg2)', border:`1px solid ${!form.isCashCard?'var(--brand)':'var(--border2)'}` }}>
                <input type="radio" checked={form.isCashCard===false} onChange={()=>set('isCashCard',false)} />
                <span style={{ color: !form.isCashCard?'var(--brand)':'var(--text2)' }}>No → Petty Cash</span>
              </label>
            </div>
          </div>

          {/* MULTI-DOC UPLOAD */}
          <div>
            <label style={lbl}>Dokumen Evidence (bisa lebih dari 1) *</label>
            <div style={{ border:'1px dashed var(--border2)', borderRadius:8, padding:14, textAlign:'center', cursor:'pointer' }} onClick={()=>document.getElementById('multi-file')?.click()}>
              <input id="multi-file" type="file" accept="image/*,.pdf" multiple style={{ display:'none' }} onChange={e=>handleFiles(e.target.files)} />
              <div style={{ color:'var(--text3)', fontSize:12 }}>📎 Klik untuk upload (max 5MB per file)</div>
            </div>
            {files.length > 0 && (
              <div style={{ marginTop:8, display:'flex', flexDirection:'column', gap:5 }}>
                {files.map((f,i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 10px', background:'var(--bg3)', borderRadius:6, fontSize:11 }}>
                    <span style={{ color:'var(--green)' }}>✓</span>
                    <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.name}</span>
                    <span style={{ color:'var(--text3)', fontSize:10 }}>{Math.round(f.size/1024)}KB</span>
                    <button onClick={()=>setFiles(files.filter((_,idx)=>idx!==i))} className="btn btn-icon btn-sm" style={{ fontSize:12, color:'var(--red)' }}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div><label style={lbl}>Catatan</label><textarea className="input" value={form.notes} onChange={e=>set('notes',e.target.value)} rows={2} placeholder="Catatan tambahan..." /></div>
        </div>
        <div style={{ padding:'12px 20px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'flex-end', gap:8 }}>
          <button onClick={onClose} className="btn">Batal</button>
          <button onClick={save} disabled={saving} className="btn btn-primary">{saving?'Mengirim...':'📤 Kirim Pengajuan'}</button>
        </div>
      </div>
    </div>
  )
}

export default function ReimbursementsPage() {
  const { data:session } = useSession(); const user = session?.user as any
  const [items, setItems] = useState<any[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filterStatus, setFilterStatus] = useState('all')
  const [selectedForBulk, setSelectedForBulk] = useState<Set<string>>(new Set())

  async function load() {
    setLoading(true)
    const [r, p] = await Promise.all([
      fetch('/api/reimbursements').then(r=>r.json()),
      fetch('/api/profile').then(r=>r.json()).catch(()=>({data:null})),
    ])
    setItems(r.data||[]); setProfile(p.data); setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function updateStatus(id:string, status:string, reason?:string) {
    await fetch(`/api/reimbursements/${id}`, { method:'PATCH', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ status, ...(reason?{rejectReason:reason}:{}), ...(status==='approved'?{approvedBy:user?.name, approvedAt:new Date().toISOString()}:{}) }) })
    toast.success('Status diperbarui'); load()
  }

  function downloadDoc(url:string, name:string) {
    const a = document.createElement('a'); a.href = url; a.download = name; a.click()
  }
  function bulkDownload() {
    const toDownload = items.filter(i => selectedForBulk.has(i._id))
    let count = 0
    toDownload.forEach(item => {
      ;(item.documents||[]).forEach((doc:any, i:number) => {
        setTimeout(() => {
          downloadDoc(doc.url, `${item.userName}_${item.title}_${doc.name}`)
        }, count*200)
        count++
      })
    })
    toast.success(`Downloading ${count} files...`)
  }

  const isAdmin = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'finance'
  const filtered = filterStatus==='all' ? items : items.filter(i => i.status === filterStatus)

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {showForm && <SubmitForm onClose={()=>setShowForm(false)} onSave={load} profile={profile} />}

      <div style={{ padding:'12px 20px', borderBottom:'1px solid var(--border)', background:'var(--bg2)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div>
          <div style={{ fontSize:14, fontWeight:600 }}>Reimbursement</div>
          <div style={{ fontSize:11, color:'var(--text3)' }}>{items.length} pengajuan · {items.filter(i=>i.status==='submitted').length} menunggu</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {isAdmin && selectedForBulk.size > 0 && (
            <button onClick={bulkDownload} className="btn btn-sm">📥 Download {selectedForBulk.size} item</button>
          )}
          <button onClick={()=>setShowForm(true)} className="btn btn-primary btn-sm">+ Ajukan</button>
        </div>
      </div>

      <div style={{ display:'flex', gap:5, padding:'8px 20px', background:'var(--bg2)', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
        {[['all','Semua'],['submitted','Menunggu'],['approved','Disetujui'],['rejected','Ditolak'],['paid','Dibayar']].map(([v,l]) => (
          <button key={v as string} onClick={()=>setFilterStatus(v as string)} style={{ padding:'4px 12px', borderRadius:20, fontSize:11, fontWeight:600, cursor:'pointer', border:`1px solid ${filterStatus===v?'var(--brand)':'var(--border)'}`, background:filterStatus===v?'var(--brand-soft)':'var(--bg3)', color:filterStatus===v?'var(--brand)':'var(--text2)' }}>{l}</button>
        ))}
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'14px 20px' }} className="safe-bottom">
        {loading ? <div style={{ textAlign:'center', padding:40, color:'var(--text3)' }}>Memuat...</div> : (
          filtered.length === 0 ? (
            <div className="card" style={{ textAlign:'center', padding:40, color:'var(--text3)' }}>
              <div style={{ fontSize:32, marginBottom:8 }}>💰</div>
              <div>Belum ada pengajuan</div>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {filtered.map(item => {
                const scfg = STATUS_CFG[item.status]
                const isSelected = selectedForBulk.has(item._id)
                return (
                  <div key={item._id} className="card" style={{ padding:'12px 14px' }}>
                    <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                      {isAdmin && (
                        <input type="checkbox" checked={isSelected} onChange={()=>{
                          setSelectedForBulk(prev => {
                            const s = new Set(prev); s.has(item._id)?s.delete(item._id):s.add(item._id); return s
                          })
                        }} style={{ marginTop:3 }} />
                      )}
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                          <span style={{ fontSize:13, fontWeight:600 }}>{item.title}</span>
                          <span className="badge" style={{ background:scfg.bg, color:scfg.color, fontSize:10 }}>{scfg.label}</span>
                          <span style={{ fontSize:10, padding:'1px 7px', borderRadius:20, background: item.isCashCard?'var(--brand-soft)':'var(--amberbg)', color:item.isCashCard?'var(--brand)':'var(--amber)', fontWeight:600 }}>
                            {item.isCashCard ? '💳 Cash Card' : '💵 Petty Cash'}
                          </span>
                        </div>
                        <div style={{ fontSize:11, color:'var(--text3)', marginBottom:4 }}>{item.userName} · {item.bank} {item.noRekening}</div>
                        <div style={{ fontSize:15, fontWeight:700, color:'var(--brand)' }}>{formatRp(item.amount)}</div>
                        {item.documents?.length > 0 && (
                          <div style={{ display:'flex', gap:5, marginTop:6, flexWrap:'wrap' }}>
                            {item.documents.map((d:any,i:number) => (
                              <button key={i} onClick={()=>downloadDoc(d.url, d.name)} className="btn btn-sm" style={{ fontSize:10 }}>📎 {d.name}</button>
                            ))}
                          </div>
                        )}
                        {item.rejectReason && <div style={{ marginTop:6, fontSize:11, color:'var(--red)' }}>Alasan ditolak: {item.rejectReason}</div>}
                      </div>
                      {isAdmin && item.status === 'submitted' && (
                        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                          <button onClick={()=>updateStatus(item._id,'approved')} className="btn btn-sm btn-primary" style={{ fontSize:10 }}>✓ Setujui</button>
                          <button onClick={()=>{const r=prompt('Alasan ditolak:');if(r)updateStatus(item._id,'rejected',r)}} className="btn btn-sm btn-danger" style={{ fontSize:10 }}>× Tolak</button>
                        </div>
                      )}
                      {isAdmin && item.status === 'approved' && (
                        <button onClick={()=>updateStatus(item._id,'paid')} className="btn btn-sm" style={{ background:'var(--greenbg)', color:'var(--green)', borderColor:'var(--green)' }}>💸 Tandai Dibayar</button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        )}
      </div>
    </div>
  )
}
const lbl: React.CSSProperties = { display:'block', fontSize:11, fontWeight:500, color:'var(--text2)', marginBottom:5 }
