'use client'
import { getConfig } from '@/lib/configCache'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'

const fmt = (n:number) => new Intl.NumberFormat('id-ID').format(n||0)

function TransferModal({ item, onClose, onSave }: { item:any; onClose:()=>void; onSave:()=>void }) {
  const { data:session } = useSession(); const user = session?.user as any
  const [hasBiaya, setHasBiaya] = useState(item.hasBiayaAntarBank || false)
  const [biaya, setBiaya] = useState(item.biayaAntarBank || 0)
  const [processing, setProcessing] = useState(false)
  const total = (item.amount || 0) + (hasBiaya ? biaya : 0)

  async function doTransfer() {
    setProcessing(true)
    try {
      // 1) Update reimbursement
      const updateRes = await fetch(`/api/reimbursements/${item._id}`, {
        method:'PATCH', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          status:'done',
          hasBiayaAntarBank: hasBiaya,
          biayaAntarBank: hasBiaya ? biaya : 0,
          totalTransfer: total,
          transferredAt: new Date().toISOString(),
          transferredBy: user?.name,
          whatsappSent: true,
        })
      })
      if (!updateRes.ok) { toast.error('Gagal update'); return }

      // 2) Send WA to member
      try {
        const cfgR = await getConfig().then((data:any)=>({ data }))
        const cfg = cfgR.data
        const usersR = await fetch('/api/users').then(r=>r.json())
        const member = (usersR.data||[]).find((u:any)=>u.name===item.userName || u.email===item.userId)
        if (member?.phone) {
          const tpl = cfg?.fonnte?.messageToMember || ''
          const msg = tpl.replace(/{memberName}/g, item.userName||'-')
                        .replace(/{purpose}/g, item.title)
                        .replace(/{amount}/g, 'Rp ' + fmt(total))
                        .replace(/{category}/g, item.category)
                        .replace(/{bank}/g, item.bank)
                        .replace(/{noRekening}/g, item.noRekening)
          await fetch('/api/fonnte', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ target: member.phone, message: msg }) })
        }
      } catch { /* non-blocking */ }

      toast.success('Transferred & notified via WhatsApp'); onSave(); onClose()
    } finally { setProcessing(false) }
  }

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ width:480 }}>
        <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between' }}>
          <span style={{ fontSize:14, fontWeight:600 }}>Transfer Reimburse</span>
          <button onClick={onClose} className="btn btn-icon">×</button>
        </div>
        <div style={{ padding:'14px 20px', display:'flex', flexDirection:'column', gap:11 }}>
          <div className="card" style={{ padding:'10px 12px', background:'var(--bg3)', fontSize:12 }}>
            <div style={{ marginBottom:5 }}><b>{item.userName}</b> · {item.title}</div>
            <div style={{ color:'var(--text2)', fontSize:11 }}>Bank: {item.bank} · No. Rek: {item.noRekening}</div>
            <div style={{ color:'var(--text2)', fontSize:11 }}>Nominal: Rp {fmt(item.amount)}</div>
          </div>

          <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, cursor:'pointer' }}>
            <input type="checkbox" checked={hasBiaya} onChange={e=>setHasBiaya(e.target.checked)} />
            Ada biaya antar bank
          </label>

          {hasBiaya && (
            <div>
              <label style={lbl}>Biaya Antar Bank (Rp)</label>
              <input type="number" className="input" value={biaya} onChange={e=>setBiaya(Number(e.target.value))} placeholder="6500" />
            </div>
          )}

          <div style={{ padding:'14px 16px', background:'var(--brand-soft)', borderRadius:10, border:'1px solid var(--brand)' }}>
            <div style={{ fontSize:10, color:'var(--brand)', textTransform:'uppercase', fontWeight:600, letterSpacing:'0.06em' }}>Total Transfer</div>
            <div style={{ fontSize:22, fontWeight:800, color:'var(--brand)' }}>Rp {fmt(total)}</div>
          </div>
        </div>
        <div style={{ padding:'12px 20px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'flex-end', gap:8 }}>
          <button onClick={onClose} className="btn">Batal</button>
          <button onClick={doTransfer} disabled={processing} className="btn btn-primary">{processing?'Transferring...':'💸 Transfer & Notify'}</button>
        </div>
      </div>
    </div>
  )
}

function TopUpModal({ onClose, onSave, year, currentCashier }: { onClose:()=>void; onSave:()=>void; year:number; currentCashier:any }) {
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0,10), amount:0, source:'Bank Transfer', notes:'' })
  const set = (k:string,v:any) => setForm(f=>({...f,[k]:v}))
  async function save() {
    const newList = [...(currentCashier?.manualTopUps || []), form]
    await fetch('/api/cashier', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ year, manualTopUps: newList }) })
    toast.success('Top Up tercatat'); onSave(); onClose()
  }
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ width:420 }}>
        <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between' }}>
          <span style={{ fontSize:14, fontWeight:600 }}>+ Top Up Manual (non-Cash Card)</span>
          <button onClick={onClose} className="btn btn-icon">×</button>
        </div>
        <div style={{ padding:'14px 20px', display:'flex', flexDirection:'column', gap:11 }}>
          <div><label style={lbl}>Tanggal</label><input type="date" className="input" value={form.date} onChange={e=>set('date',e.target.value)} /></div>
          <div><label style={lbl}>Nominal (Rp)</label><input type="number" className="input" value={form.amount} onChange={e=>set('amount',Number(e.target.value))} /></div>
          <div><label style={lbl}>Sumber</label><input className="input" value={form.source} onChange={e=>set('source',e.target.value)} placeholder="Bank Transfer, dll" /></div>
          <div><label style={lbl}>Catatan</label><input className="input" value={form.notes} onChange={e=>set('notes',e.target.value)} /></div>
        </div>
        <div style={{ padding:'12px 20px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'flex-end', gap:8 }}>
          <button onClick={onClose} className="btn">Batal</button>
          <button onClick={save} className="btn btn-primary">Simpan</button>
        </div>
      </div>
    </div>
  )
}

function SaldoAwalModal({ value, year, onClose, onSave, currentCashier }: { value:number; year:number; onClose:()=>void; onSave:()=>void; currentCashier:any }) {
  const [v, setV] = useState(value)
  async function save() {
    await fetch('/api/cashier', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ year, saldoAwal: v, manualTopUps: currentCashier?.manualTopUps || [] }) })
    toast.success('Saldo Awal diperbarui'); onSave(); onClose()
  }
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ width:380 }}>
        <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between' }}>
          <span style={{ fontSize:14, fontWeight:600 }}>Set Saldo Awal Tahun {year}</span>
          <button onClick={onClose} className="btn btn-icon">×</button>
        </div>
        <div style={{ padding:'14px 20px' }}>
          <label style={lbl}>Saldo Awal (Rp)</label>
          <input type="number" className="input" value={v} onChange={e=>setV(Number(e.target.value))} />
        </div>
        <div style={{ padding:'12px 20px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'flex-end', gap:8 }}>
          <button onClick={onClose} className="btn">Batal</button>
          <button onClick={save} className="btn btn-primary">Simpan</button>
        </div>
      </div>
    </div>
  )
}

export default function CashierPage() {
  const [reimburses, setReimburses] = useState<any[]>([])
  const [cashier, setCashier] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [transferring, setTransferring] = useState<any>(null)
  const [showTopUp, setShowTopUp] = useState(false)
  const [showSaldoAwal, setShowSaldoAwal] = useState(false)
  const [year] = useState(new Date().getFullYear())

  async function load() {
    setLoading(true)
    const [r, c] = await Promise.all([fetch('/api/reimbursements').then(r=>r.json()), fetch(`/api/cashier?year=${year}`).then(r=>r.json())])
    setReimburses(r.data||[]); setCashier(c.data); setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function delReversed(item:any) {
    if (!confirm(`Hapus reimburse "${item.title}" yang sudah disetujui pembatalannya? Dana akan dikembalikan ke kas.`)) return
    try {
      await fetch(`/api/reimbursements/${item._id}`, { method:'DELETE' })
      toast.success('Reimburse dibatalkan & dihapus. Kas diperbarui.')
      load()
    } catch { toast.error('Gagal menghapus') }
  }

  async function requestReversal(item:any) {
    const reason = prompt('Alasan pembatalan reimburse ini? (akan dikirim ke pengaju untuk disetujui)')
    if (reason === null) return
    try {
      await fetch(`/api/reimbursements/${item._id}`, {
        method:'PATCH', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ status:'reversal_requested', reversalReason: reason, reversalRequestedAt: new Date().toISOString() })
      })
      toast.success('Permintaan pembatalan dikirim ke pengaju untuk disetujui')
      load()
    } catch { toast.error('Gagal mengirim permintaan pembatalan') }
  }

  const pending = reimburses.filter(r => r.status === 'submitted' || r.status === 'approved' || r.status === 'draft')
  const done = reimburses.filter(r => r.status === 'done' || r.status === 'paid' || r.status === 'reversal_requested' || r.status === 'reversal_approved')
  const summary = cashier?.summary || { saldoAwal:0, kasMasuk:0, kasKeluarCashCard:0, cashCardPengembalian:0, kasKeluarOperasional:0, saldoKas:0 }

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {transferring && <TransferModal item={transferring} onClose={()=>setTransferring(null)} onSave={load} />}
      {showTopUp && <TopUpModal onClose={()=>setShowTopUp(false)} onSave={load} year={year} currentCashier={cashier} />}
      {showSaldoAwal && <SaldoAwalModal value={summary.saldoAwal} year={year} onClose={()=>setShowSaldoAwal(false)} onSave={load} currentCashier={cashier} />}

      <div style={{ padding:'12px 20px', borderBottom:'1px solid var(--border)', background:'var(--bg2)', display:'flex', justifyContent:'space-between', flexShrink:0 }}>
        <div>
          <div style={{ fontSize:14, fontWeight:600 }}>Cashier</div>
          <div style={{ fontSize:11, color:'var(--text3)' }}>Manage reimburse & track kas operasional · Tahun {year}</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={()=>setShowSaldoAwal(true)} className="btn btn-sm">⚙ Saldo Awal</button>
          <button onClick={()=>setShowTopUp(true)} className="btn btn-primary btn-sm">+ Top Up Manual</button>
        </div>
      </div>

      {/* Balance summary cards */}
      <div className="stat-grid" style={{ display:'grid', gridTemplateColumns:'repeat(6, 1fr)', gap:8, padding:'12px 20px', background:'var(--bg2)', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
        <div className="card" style={{ padding:'10px 12px' }}>
          <div style={{ fontSize:9, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Saldo Awal</div>
          <div style={{ fontSize:14, fontWeight:700 }}>Rp {fmt(summary.saldoAwal)}</div>
        </div>
        <div className="card" style={{ padding:'10px 12px' }}>
          <div style={{ fontSize:9, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Kas Masuk</div>
          <div style={{ fontSize:14, fontWeight:700, color:'var(--green)' }}>+ Rp {fmt(summary.kasMasuk)}</div>
          <div style={{ fontSize:9, color:'var(--text3)' }}>Cash Card Top Up + Manual</div>
        </div>
        <div className="card" style={{ padding:'10px 12px' }}>
          <div style={{ fontSize:9, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Keluar — Cash Card</div>
          <div style={{ fontSize:14, fontWeight:700, color:'var(--amber)' }}>− Rp {fmt(summary.kasKeluarCashCard)}</div>
          <div style={{ fontSize:9, color:'var(--text3)' }}>Settlement</div>
        </div>
        <div className="card" style={{ padding:'10px 12px' }}>
          <div style={{ fontSize:9, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Keluar — Operasional</div>
          <div style={{ fontSize:14, fontWeight:700, color:'var(--red)' }}>− Rp {fmt(summary.kasKeluarOperasional)}</div>
          <div style={{ fontSize:9, color:'var(--text3)' }}>Reimburse petty cash</div>
        </div>
        <div className="card" style={{ padding:'10px 12px' }}>
          <div style={{ fontSize:9, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Keluar — Pengembalian</div>
          <div style={{ fontSize:14, fontWeight:700, color:'var(--amber)' }}>− Rp {fmt(summary.cashCardPengembalian||0)}</div>
          <div style={{ fontSize:9, color:'var(--text3)' }}>Cash card balik ke kantor</div>
        </div>
        <div className="card" style={{ padding:'10px 12px', background:'var(--brand-soft)', border:'1px solid var(--brand)' }}>
          <div style={{ fontSize:9, color:'var(--brand)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Saldo Kas</div>
          <div style={{ fontSize:14, fontWeight:800, color:'var(--brand)' }}>Rp {fmt(summary.saldoKas)}</div>
          <div style={{ fontSize:9, color:'var(--brand)' }}>Uang di tangan sekarang</div>
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'14px 20px', display:'flex', flexDirection:'column', gap:14 }} className="safe-bottom page-pad">
        {/* Pending */}
        <div>
          <div style={{ fontSize:13, fontWeight:600, marginBottom:8 }}>📥 Antrian ({pending.length})</div>
          {loading ? <div style={{ color:'var(--text3)', fontSize:12 }}>Memuat...</div> :
           pending.length === 0 ? (
             <div className="card" style={{ padding:20, textAlign:'center', color:'var(--text3)', fontSize:12 }}>Tidak ada antrian</div>
           ) : (
            <div className="card" style={{ overflow:'auto' }}>
              <table className="wp-table" style={{ minWidth:900 }}>
                <thead><tr><th>Pengaju</th><th>Keperluan</th><th>Bank / Rek</th><th>Sumber</th><th>Nominal</th><th>Submit</th><th></th></tr></thead>
                <tbody>
                  {pending.map(r => (
                    <tr key={r._id}>
                      <td style={{ fontSize:11, fontWeight:600 }}>{r.userName}</td>
                      <td style={{ fontSize:11 }}>{r.title}</td>
                      <td style={{ fontSize:11 }}>{r.bank}<br/><span style={{ color:'var(--text3)', fontSize:10 }}>{r.noRekening}</span></td>
                      <td><span className="badge" style={{ background:r.isCashCard?'var(--brand-soft)':'var(--bg3)', color:r.isCashCard?'var(--brand)':'var(--text2)', fontSize:9 }}>{r.isCashCard?'Cash Card':'Petty Cash'}</span></td>
                      <td style={{ fontWeight:700 }}>Rp {fmt(r.amount)}</td>
                      <td style={{ fontSize:10 }}>{r.submittedAt?new Date(r.submittedAt).toLocaleDateString('id-ID'):'—'}</td>
                      <td><button onClick={()=>setTransferring(r)} className="btn btn-primary btn-sm">💸 Transfer</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
           )}
        </div>

        {/* Done history */}
        <div>
          <div style={{ fontSize:13, fontWeight:600, marginBottom:8 }}>✅ Done ({done.length})</div>
          {done.length === 0 ? (
            <div className="card" style={{ padding:20, textAlign:'center', color:'var(--text3)', fontSize:12 }}>Belum ada riwayat transfer</div>
          ) : (
            <div className="card" style={{ overflow:'auto' }}>
              <table className="wp-table" style={{ minWidth:900 }}>
                <thead><tr><th>Pengaju</th><th>Keperluan</th><th>Nominal</th><th>Biaya</th><th>Total</th><th>Sumber</th><th>Transferred</th><th>Aksi</th></tr></thead>
                <tbody>
                  {done.map(r => (
                    <tr key={r._id}>
                      <td style={{ fontSize:11 }}>{r.userName}</td>
                      <td style={{ fontSize:11 }}>{r.title}</td>
                      <td>Rp {fmt(r.amount)}</td>
                      <td style={{ fontSize:10 }}>{r.biayaAntarBank>0?`Rp ${fmt(r.biayaAntarBank)}`:'—'}</td>
                      <td style={{ fontWeight:700, color:'var(--brand)' }}>Rp {fmt(r.totalTransfer||r.amount)}</td>
                      <td><span className="badge" style={{ background:r.isCashCard?'var(--brand-soft)':'var(--bg3)', color:r.isCashCard?'var(--brand)':'var(--text2)', fontSize:9 }}>{r.isCashCard?'Cash Card':'Petty Cash'}</span></td>
                      <td style={{ fontSize:10 }}>{r.transferredAt?new Date(r.transferredAt).toLocaleDateString('id-ID'):'—'}</td>
                      <td>
                        {r.status === 'done' || r.status === 'paid' ? (
                          <button onClick={()=>requestReversal(r)} className="btn btn-sm" style={{ fontSize:10 }}>↩️ Reverse</button>
                        ) : r.status === 'reversal_requested' ? (
                          <span className="badge" style={{ background:'var(--amberbg)', color:'var(--amber)', fontSize:9 }}>⏳ Menunggu persetujuan pengaju</span>
                        ) : r.status === 'reversal_approved' ? (
                          <button onClick={()=>delReversed(r)} className="btn btn-sm btn-danger" style={{ fontSize:10 }}>🗑 Hapus (disetujui)</button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Manual top-ups history */}
        {cashier?.manualTopUps?.length > 0 && (
          <div>
            <div style={{ fontSize:13, fontWeight:600, marginBottom:8 }}>📝 Manual Top Up History</div>
            <div className="card" style={{ overflow:'auto' }}>
              <table className="wp-table">
                <thead><tr><th>Tanggal</th><th>Sumber</th><th>Nominal</th><th>Catatan</th></tr></thead>
                <tbody>
                  {cashier.manualTopUps.map((t:any, i:number) => (
                    <tr key={i}><td style={{ fontSize:11 }}>{t.date}</td><td style={{ fontSize:11 }}>{t.source}</td><td style={{ fontWeight:600 }}>+ Rp {fmt(t.amount)}</td><td style={{ fontSize:11 }}>{t.notes||'—'}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
const lbl: React.CSSProperties = { display:'block', fontSize:11, fontWeight:500, color:'var(--text2)', marginBottom:5 }
