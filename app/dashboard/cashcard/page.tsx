'use client'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useSession } from 'next-auth/react'

const MONTHS = ['','Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']
const fmt = (n:number) => new Intl.NumberFormat('id-ID').format(n||0)

function CashCardForm({ editing, onClose, onSave }: { editing?:any; onClose:()=>void; onSave:()=>void }) {
  const { data:session } = useSession(); const user = session?.user as any
  const [form, setForm] = useState({
    year: editing?.year || new Date().getFullYear(),
    month: editing?.month || (new Date().getMonth()+1),
    date: editing?.date || new Date().toISOString().slice(0,10),
    prNo: editing?.prNo || '',
    topUpAmount: editing?.topUpAmount || 0,
    jojonomicId: editing?.jojonomicId || '',
    poNo: editing?.poNo || '',
    settlementAmount: editing?.settlementAmount || 0,
    refundAmount: editing?.refundAmount || 0,
    notes: editing?.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k:string,v:any) => setForm(f=>({...f,[k]:v}))

  async function save() {
    setSaving(true)
    try {
      const url = editing ? `/api/cashcard/${editing._id}` : '/api/cashcard'
      const r = await fetch(url, { method: editing?'PATCH':'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ ...form, createdBy: user?.name }) })
      if (!r.ok) { toast.error('Gagal'); return }
      toast.success(editing?'Diperbarui':'Cash Card ditambah'); onSave(); onClose()
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ width:520 }}>
        <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between' }}>
          <span style={{ fontSize:14, fontWeight:600 }}>{editing?'Edit Cash Card':'+ Tambah Cash Card'}</span>
          <button onClick={onClose} className="btn btn-icon">×</button>
        </div>
        <div style={{ padding:'14px 20px', display:'flex', flexDirection:'column', gap:10 }}>
          <div style={{ fontSize:11, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.06em' }}>📅 Periode</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
            <div><label style={lbl}>Tahun</label><input type="number" className="input" value={form.year} onChange={e=>set('year',Number(e.target.value))} /></div>
            <div><label style={lbl}>Bulan</label>
              <select className="input" value={form.month} onChange={e=>set('month',Number(e.target.value))}>
                {MONTHS.slice(1).map((m,i)=><option key={m} value={i+1}>{m}</option>)}
              </select></div>
            <div><label style={lbl}>Tanggal</label><input type="date" className="input" value={form.date} onChange={e=>set('date',e.target.value)} /></div>
          </div>
          <div style={{ fontSize:11, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.06em', marginTop:6 }}>💳 Top Up</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div><label style={lbl}>PR No.</label><input className="input" value={form.prNo} onChange={e=>set('prNo',e.target.value)} /></div>
            <div><label style={lbl}>Nominal (Rp)</label><input type="number" className="input" value={form.topUpAmount} onChange={e=>set('topUpAmount',Number(e.target.value))} /></div>
          </div>
          <div style={{ fontSize:11, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.06em', marginTop:6 }}>📋 Settlement</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
            <div><label style={lbl}>Ref ID Jojonomic</label><input className="input" value={form.jojonomicId} onChange={e=>set('jojonomicId',e.target.value)} /></div>
            <div><label style={lbl}>PO No.</label><input className="input" value={form.poNo} onChange={e=>set('poNo',e.target.value)} /></div>
            <div><label style={lbl}>Nominal (Rp)</label><input type="number" className="input" value={form.settlementAmount} onChange={e=>set('settlementAmount',Number(e.target.value))} /></div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:10, alignItems:'end' }}>
            <div><label style={lbl}>Pengembalian Dana (Rp)</label><input type="number" className="input" value={form.refundAmount} onChange={e=>set('refundAmount',Number(e.target.value))} placeholder="Sisa yang dikembalikan ke kantor" /></div>
            <button type="button" className="btn btn-sm" onClick={()=>set('refundAmount', Math.max(0,(form.topUpAmount||0)-(form.settlementAmount||0)))}>= Sisa (Top Up − Settlement)</button>
          </div>
          <div><label style={lbl}>Catatan</label><input className="input" value={form.notes} onChange={e=>set('notes',e.target.value)} /></div>
          {form.topUpAmount > 0 && (
            <div style={{ padding:'10px 12px', background:'var(--bg3)', borderRadius:8, fontSize:12 }}>
              <b>%:</b> {((form.settlementAmount/form.topUpAmount)*100).toFixed(1)}% · <b>Sisa:</b> Rp {fmt(form.topUpAmount - form.settlementAmount)} · <b>Pengembalian:</b> Rp {fmt(form.refundAmount||0)}
            </div>
          )}
        </div>
        <div style={{ padding:'12px 20px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'flex-end', gap:8 }}>
          <button onClick={onClose} className="btn">Batal</button>
          <button onClick={save} disabled={saving} className="btn btn-primary">{saving?'...':'Simpan'}</button>
        </div>
      </div>
    </div>
  )
}

export default function CashCardPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [year, setYear] = useState(new Date().getFullYear())

  async function load() {
    setLoading(true)
    const r = await fetch(`/api/cashcard?year=${year}`).then(r=>r.json())
    setItems(r.data||[]); setLoading(false)
  }
  useEffect(() => { load() }, [year])

  async function del(id:string) {
    if (!confirm('Hapus row?')) return
    await fetch(`/api/cashcard/${id}`, { method:'DELETE' })
    toast.success('Dihapus'); load()
  }

  const totalTopUp = items.reduce((s,i)=>s+(i.topUpAmount||0),0)
  const totalSettlement = items.reduce((s,i)=>s+(i.settlementAmount||0),0)

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {(showForm||editing) && <CashCardForm editing={editing} onClose={()=>{setShowForm(false);setEditing(null)}} onSave={load} />}

      <div style={{ padding:'12px 20px', borderBottom:'1px solid var(--border)', background:'var(--bg2)', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
        <div>
          <div style={{ fontSize:14, fontWeight:600 }}>Cash Card</div>
          <div style={{ fontSize:11, color:'var(--text3)' }}>Tracking Top Up & Settlement · Tahun {year}</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <select className="input" style={{ width:100 }} value={year} onChange={e=>setYear(Number(e.target.value))}>
            {[year-2, year-1, year, year+1].map(y=><option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={()=>setShowForm(true)} className="btn btn-primary btn-sm">+ Tambah</button>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:10, padding:'12px 20px', background:'var(--bg2)', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
        <div className="card" style={{ padding:'10px 14px' }}>
          <div style={{ fontSize:10, color:'var(--text3)' }}>Total Top Up</div>
          <div style={{ fontSize:18, fontWeight:700, color:'var(--brand)' }}>Rp {fmt(totalTopUp)}</div>
        </div>
        <div className="card" style={{ padding:'10px 14px' }}>
          <div style={{ fontSize:10, color:'var(--text3)' }}>Total Settlement</div>
          <div style={{ fontSize:18, fontWeight:700, color:'var(--amber)' }}>Rp {fmt(totalSettlement)}</div>
        </div>
        <div className="card" style={{ padding:'10px 14px' }}>
          <div style={{ fontSize:10, color:'var(--text3)' }}>Sisa</div>
          <div style={{ fontSize:18, fontWeight:700, color:'var(--green)' }}>Rp {fmt(totalTopUp - totalSettlement)}</div>
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'14px 20px' }} className="safe-bottom page-pad">
        <div className="card" style={{ overflow:'auto' }}>
          <table className="wp-table" style={{ minWidth:1000 }}>
            <thead>
              <tr>
                <th>Tahun</th><th>Bulan</th>
                <th>PR No.</th><th>Top Up (Rp)</th>
                <th>Ref ID Jojonomic</th><th>PO No.</th><th>Settlement (Rp)</th>
                <th>%</th><th style={{ textAlign:'right' }}>PENGEMBALIAN DANA</th><th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={10} style={{ textAlign:'center', padding:20, color:'var(--text3)' }}>Memuat...</td></tr> :
               items.length === 0 ? <tr><td colSpan={10} style={{ textAlign:'center', padding:30, color:'var(--text3)' }}>Belum ada data</td></tr> :
               items.map(i => {
                 const pct = i.topUpAmount > 0 ? ((i.settlementAmount/i.topUpAmount)*100) : 0
                 return (
                   <tr key={i._id}>
                     <td>{i.year}</td><td>{MONTHS[i.month]}</td>
                     <td>{i.prNo||'—'}</td><td style={{ textAlign:'right', fontWeight:600 }}>{fmt(i.topUpAmount)}</td>
                     <td>{i.jojonomicId||'—'}</td><td>{i.poNo||'—'}</td><td style={{ textAlign:'right', fontWeight:600 }}>{fmt(i.settlementAmount)}</td>
                     <td style={{ fontWeight:600, color: pct>=100?'var(--green)':pct>0?'var(--brand)':'var(--text3)' }}>{pct.toFixed(1)}%</td>
                     <td style={{ textAlign:'right', fontWeight:600, color:'var(--green)' }}>{fmt(i.refundAmount ?? Math.max(0,(i.topUpAmount||0)-(i.settlementAmount||0)))}</td>
                     <td style={{ display:'flex', gap:4 }}>
                       <button onClick={()=>setEditing(i)} className="btn btn-icon btn-sm">✏️</button>
                       <button onClick={()=>del(i._id)} className="btn btn-icon btn-sm" style={{ color:'var(--red)' }}>🗑</button>
                     </td>
                   </tr>
                 )
               })
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
const lbl: React.CSSProperties = { display:'block', fontSize:11, fontWeight:500, color:'var(--text2)', marginBottom:5 }
