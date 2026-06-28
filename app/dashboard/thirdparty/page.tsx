'use client'
import { useEffect, useMemo, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'

const fmt = (n:number) => new Intl.NumberFormat('id-ID').format(n||0)
const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']

const OTHER_DEFAULTS = [
  { key:'meals',   label:'Meals' },
  { key:'suvenir', label:'Suvenir' },
  { key:'snacks',  label:'Snacks' },
  { key:'oleh2',   label:'Oleh-oleh' },
  { key:'voucher', label:'Voucher' },
]
function otherTotal(o:any){ return (Number(o.pax)||0) * (Number(o.times)||1) * (Number(o.price)||0) }
function estimasiOf(f:any){
  const mr = (Number(f.mrPax)||0)*(Number(f.mrDays)||0)*(Number(f.mrPrice)||0)
  const br = (Number(f.brRooms)||0)*(Number(f.brNights)||0)*(Number(f.brPrice)||0)
  const others = (f.others||[]).reduce((s:number,o:any)=>s+otherTotal(o),0)
  return mr+br+others
}

export default function ThirdPartyPage() {
  const [tab, setTab] = useState<'rencana'|'realisasi'>('rencana')
  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ padding:'12px 20px 0', borderBottom:'1px solid var(--border)', background:'var(--bg2)', flexShrink:0 }}>
        <div style={{ fontSize:14, fontWeight:600 }}>[3rd Party] Event</div>
        <div style={{ display:'flex', gap:4, marginTop:10 }}>
          <button onClick={()=>setTab('rencana')} style={subtab(tab==='rencana')}>Rencana</button>
          <button onClick={()=>setTab('realisasi')} style={subtab(tab==='realisasi')}>Realisasi</button>
        </div>
      </div>
      {tab==='rencana' ? <RencanaTab/> : <RealisasiTab/>}
    </div>
  )
}

// =====================  RENCANA  =====================
function RencanaTab() {
  const { data:session } = useSession(); const user = session?.user as any
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState<number>(-1)
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const qs = new URLSearchParams({ kind:'rencana', year:String(year) }); if (month>=0) qs.set('month', String(month+1))
    const r = await fetch(`/api/thirdparty?${qs}`).then(r=>r.json()); setItems(r.data||[]); setLoading(false)
  }, [year, month])
  useEffect(()=>{ load() }, [load])

  return (
    <>
      {(showForm||editing) && <RencanaForm editing={editing} user={user} onClose={()=>{setShowForm(false);setEditing(null)}} onSaved={()=>{setShowForm(false);setEditing(null);load()}} />}
      <div style={{ display:'flex', gap:10, padding:'10px 20px', background:'var(--bg2)', borderBottom:'1px solid var(--border)', flexWrap:'wrap', alignItems:'center', flexShrink:0 }}>
        <select className="input input-sm" style={{ width:130 }} value={month} onChange={e=>setMonth(Number(e.target.value))}>
          <option value={-1}>Semua Bulan</option>{MONTHS.map((m,i)=><option key={i} value={i}>{m}</option>)}
        </select>
        <select className="input input-sm" style={{ width:90 }} value={year} onChange={e=>setYear(Number(e.target.value))}>
          {[now.getFullYear()+1, now.getFullYear(), now.getFullYear()-1].map(y=><option key={y} value={y}>{y}</option>)}
        </select>
        <button onClick={()=>setShowForm(true)} className="btn btn-sm btn-primary" style={{ marginLeft:'auto' }}>+ Rencana Event</button>
      </div>
      <div style={{ flex:1, overflowY:'auto', padding:'14px 20px', display:'flex', flexDirection:'column', gap:12 }} className="safe-bottom page-pad">
        {loading ? <div style={{ textAlign:'center', padding:40, color:'var(--text3)' }}>Memuat...</div> :
         items.length===0 ? <div className="card" style={{ textAlign:'center', padding:40, color:'var(--text3)' }}><div style={{ fontSize:30, marginBottom:8 }}>🎪</div><div>Belum ada rencana event</div></div> :
         items.map(it => <RABCard key={it._id} it={it} onEdit={()=>setEditing(it)} onDelete={async()=>{ if(!confirm(`Hapus rencana "${it.judulKegiatan||it.namaEO||''}"?`))return; await fetch(`/api/thirdparty/${it._id}`,{method:'DELETE'}); toast.success('Rencana dihapus'); load() }} />)}
      </div>
    </>
  )
}

// Kartu RAB (Rencana Anggaran Biaya) — format tabel detail ke samping + subtotal & total
function RABCard({ it, onEdit, onDelete }: { it:any; onEdit:()=>void; onDelete:()=>void }) {
  const mr = (Number(it.mrPax)||0)*(Number(it.mrDays)||0)*(Number(it.mrPrice)||0)
  const br = (Number(it.brRooms)||0)*(Number(it.brNights)||0)*(Number(it.brPrice)||0)
  const others = (it.others||[]).map((o:any)=>({ ...o, jumlah: otherTotal(o) }))
  const othersTotal = others.reduce((s:number,o:any)=>s+o.jumlah,0)
  const subtotal = mr + br + othersTotal
  const fee = subtotal * 0.1
  const grand = subtotal + fee

  const Line = ({ no, uraian, vol, sat, harga, jumlah, bold }: any) => (
    <tr style={{ fontWeight: bold?700:400 }}>
      <td style={{ fontSize:11, textAlign:'center' }}>{no}</td>
      <td style={{ fontSize:11 }}>{uraian}</td>
      <td style={{ fontSize:11, textAlign:'center' }}>{vol??''}</td>
      <td style={{ fontSize:11, textAlign:'center' }}>{sat??''}</td>
      <td style={{ fontSize:11, textAlign:'right' }}>{harga!=null?`Rp ${fmt(harga)}`:''}</td>
      <td style={{ fontSize:11, textAlign:'right' }}>{jumlah!=null?`Rp ${fmt(jumlah)}`:''}</td>
    </tr>
  )

  return (
    <div className="card" style={{ padding:'14px 16px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10, marginBottom:10 }}>
        <div>
          <div style={{ fontSize:13, fontWeight:700 }}>{it.judulKegiatan||'(tanpa judul)'}</div>
          <div style={{ fontSize:11, color:'var(--text2)', marginTop:2 }}>EO: <b>{it.namaEO||'—'}</b> · {it.kota||'—'} · {it.venue||'—'}</div>
          <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>{it.tanggalKegiatan?new Date(it.tanggalKegiatan).toLocaleDateString('id-ID'):'—'} · {it.jumlahPeserta||0} peserta</div>
        </div>
        <div style={{ display:'flex', gap:6 }}>
          <button onClick={onEdit} className="btn btn-sm" style={{ fontSize:10 }}>Edit</button>
          <button onClick={onDelete} className="btn btn-sm btn-danger" style={{ fontSize:10 }}>🗑 Hapus</button>
        </div>
      </div>
      <div style={{ overflow:'auto' }}>
        <table className="wp-table" style={{ minWidth:680 }}>
          <thead><tr>
            <th style={{ width:34, textAlign:'center' }}>No</th><th>Uraian</th>
            <th style={{ textAlign:'center' }}>Volume</th><th style={{ textAlign:'center' }}>Satuan</th>
            <th style={{ textAlign:'right' }}>Harga Satuan</th><th style={{ textAlign:'right' }}>Jumlah</th>
          </tr></thead>
          <tbody>
            <Line no="1" uraian={<b>Meeting Room</b>} />
            <Line no="" uraian={`${it.mrPax||0} pax × ${it.mrDays||0} hari`} vol={(Number(it.mrPax)||0)*(Number(it.mrDays)||0)} sat="pax·hari" harga={it.mrPrice||0} jumlah={mr} />
            <Line no="2" uraian={<b>Bedroom</b>} />
            <Line no="" uraian={`${it.brRooms||0} kamar × ${it.brNights||0} malam`} vol={(Number(it.brRooms)||0)*(Number(it.brNights)||0)} sat="kamar·malam" harga={it.brPrice||0} jumlah={br} />
            <Line no="3" uraian={<b>Others</b>} />
            {others.map((o:any,i:number)=>(
              <Line key={i} no="" uraian={o.label||o.key} vol={`${o.pax||0}×${o.times||1}`} sat="pax·kali" harga={o.price||0} jumlah={o.jumlah} />
            ))}
            <tr style={{ borderTop:'2px solid var(--border)' }}><td/><td colSpan={4} style={{ textAlign:'right', fontWeight:700, fontSize:11 }}>Subtotal</td><td style={{ textAlign:'right', fontWeight:700 }}>Rp {fmt(subtotal)}</td></tr>
            <tr><td/><td colSpan={4} style={{ textAlign:'right', fontSize:11, color:'var(--amber)' }}>EO Handling &amp; Management Fee (10%)</td><td style={{ textAlign:'right', color:'var(--amber)' }}>Rp {fmt(fee)}</td></tr>
            <tr style={{ background:'var(--brand-soft)' }}><td/><td colSpan={4} style={{ textAlign:'right', fontWeight:800, fontSize:12, color:'var(--brand)' }}>TOTAL (termasuk fee)</td><td style={{ textAlign:'right', fontWeight:800, color:'var(--brand)' }}>Rp {fmt(grand)}</td></tr>
          </tbody>
        </table>
      </div>
      <div style={{ fontSize:9, color:'var(--text3)', marginTop:6 }}>Estimasi Biaya (sebelum fee): <b>Rp {fmt(subtotal)}</b> · Belum termasuk EO Handling &amp; Management Fee (10%).</div>
    </div>
  )
}

function RencanaForm({ editing, user, onClose, onSaved }: { editing?:any; user:any; onClose:()=>void; onSaved:()=>void }) {
  const now = new Date()
  const [f, setF] = useState<any>(editing ? { ...editing, others: editing.others?.length?editing.others:OTHER_DEFAULTS.map(o=>({...o,pax:0,times:1,price:0})) } : {
    namaEO:'', judulKegiatan:'', tanggalKegiatan:'', kota:'', venue:'', jumlahPeserta:0,
    mrPax:0, mrDays:0, mrPrice:0, brRooms:0, brNights:0, brPrice:0,
    others: OTHER_DEFAULTS.map(o=>({...o,pax:0,times:1,price:0})),
    year: now.getFullYear(), month: now.getMonth()+1,
  })
  const [saving, setSaving] = useState(false)
  const set = (k:string,v:any)=>setF((p:any)=>({...p,[k]:v}))
  const setOther = (i:number,k:string,v:any)=>setF((p:any)=>({...p, others: p.others.map((o:any,idx:number)=>idx===i?{...o,[k]:v}:o)}))
  const addOther = ()=>setF((p:any)=>({...p, others:[...p.others, { key:'custom', label:'', pax:0, times:1, price:0 }]}))
  const delOther = (i:number)=>setF((p:any)=>({...p, others:p.others.filter((_:any,idx:number)=>idx!==i)}))

  const mr = (Number(f.mrPax)||0)*(Number(f.mrDays)||0)*(Number(f.mrPrice)||0)
  const br = (Number(f.brRooms)||0)*(Number(f.brNights)||0)*(Number(f.brPrice)||0)
  const estimasi = estimasiOf(f)
  const withFee = estimasi*1.1

  async function save() {
    if (!f.judulKegiatan?.trim() && !f.namaEO?.trim()) { toast.error('Isi minimal Nama EO / Judul Kegiatan'); return }
    setSaving(true)
    try {
      const d = f.tanggalKegiatan ? new Date(f.tanggalKegiatan) : null
      const body = { ...f, kind:'rencana', estimasiBiaya: estimasi, createdBy: user?.name,
        year: d?d.getFullYear():f.year, month: d?d.getMonth()+1:f.month }
      const url = editing ? `/api/thirdparty/${editing._id}` : '/api/thirdparty'
      const r = await fetch(url, { method: editing?'PATCH':'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) })
      if (!r.ok) { toast.error('Gagal menyimpan'); return }
      toast.success(editing?'Diperbarui':'Rencana tersimpan'); onSaved()
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ width:680 }}>
        <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between' }}>
          <span style={{ fontSize:14, fontWeight:600 }}>{editing?'Edit Rencana':'+ Rencana Event'}</span>
          <button onClick={onClose} className="btn btn-icon">×</button>
        </div>
        <div style={{ padding:'14px 20px', maxHeight:'74vh', overflowY:'auto', display:'flex', flexDirection:'column', gap:11 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div><label style={lbl}>Nama EO</label>
              <input className="input" list="eo-list" value={f.namaEO} onChange={e=>set('namaEO',e.target.value)} placeholder="PTC / Kinanti / MTT / Others" />
              <datalist id="eo-list"><option value="PTC"/><option value="Kinanti"/><option value="MTT"/><option value="Others"/></datalist></div>
            <div><label style={lbl}>Tanggal Kegiatan</label><input type="date" className="input" value={f.tanggalKegiatan} onChange={e=>set('tanggalKegiatan',e.target.value)} /></div>
          </div>
          <div><label style={lbl}>Judul Kegiatan</label><input className="input" value={f.judulKegiatan} onChange={e=>set('judulKegiatan',e.target.value)} /></div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
            <div><label style={lbl}>Kota</label><input className="input" value={f.kota} onChange={e=>set('kota',e.target.value)} /></div>
            <div><label style={lbl}>Venue</label><input className="input" value={f.venue} onChange={e=>set('venue',e.target.value)} /></div>
            <div><label style={lbl}>Jumlah Peserta</label><input type="number" className="input" value={f.jumlahPeserta} onChange={e=>set('jumlahPeserta',Number(e.target.value))} /></div>
          </div>

          <Section title="Meeting Room" total={mr}>
            <Trio a={['Pax','mrPax']} b={['Days','mrDays']} c={['Price/pax/day','mrPrice']} f={f} set={set} />
          </Section>
          <Section title="Bedroom" total={br}>
            <Trio a={['Rooms','brRooms']} b={['Nights','brNights']} c={['Price/room/night','brPrice']} f={f} set={set} />
          </Section>

          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
              <span style={{ fontSize:12, fontWeight:600 }}>Others</span>
              <button onClick={addOther} className="btn btn-sm">+ Item</button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {f.others.map((o:any,i:number)=>(
                <div key={i} style={{ display:'grid', gridTemplateColumns:'1.3fr 70px 70px 110px 90px 28px', gap:6, alignItems:'center' }}>
                  <input className="input input-sm" placeholder="Label" value={o.label} onChange={e=>setOther(i,'label',e.target.value)} />
                  <input type="number" className="input input-sm" placeholder="Pax" value={o.pax} onChange={e=>setOther(i,'pax',Number(e.target.value))} />
                  <input type="number" className="input input-sm" placeholder="Times" value={o.times} onChange={e=>setOther(i,'times',Number(e.target.value))} />
                  <input type="number" className="input input-sm" placeholder="Price" value={o.price} onChange={e=>setOther(i,'price',Number(e.target.value))} />
                  <span style={{ fontSize:10, color:'var(--text2)', textAlign:'right' }}>Rp {fmt(otherTotal(o))}</span>
                  <button onClick={()=>delOther(i)} className="btn btn-icon btn-sm" style={{ color:'var(--red)' }}>×</button>
                </div>
              ))}
            </div>
          </div>

          <div style={{ padding:'14px 16px', background:'var(--brand-soft)', borderRadius:10, border:'1px solid var(--brand)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div><div style={{ fontSize:10, color:'var(--brand)', textTransform:'uppercase', fontWeight:600 }}>Estimasi Biaya</div>
                <div style={{ fontSize:9, color:'var(--amber)' }}>Belum termasuk EO Handling &amp; Management Fee (10%)</div></div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:22, fontWeight:800, color:'var(--brand)' }}>Rp {fmt(estimasi)}</div>
                <div style={{ fontSize:10, color:'var(--text3)' }}>Termasuk fee 10%: Rp {fmt(withFee)}</div>
              </div>
            </div>
          </div>
        </div>
        <div style={{ padding:'12px 20px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'flex-end', gap:8 }}>
          <button onClick={onClose} className="btn">Batal</button>
          <button onClick={save} disabled={saving} className="btn btn-primary">{saving?'...':'Simpan'}</button>
        </div>
      </div>
    </div>
  )
}
function Section({ title, total, children }: { title:string; total:number; children:any }) {
  return (
    <div className="card" style={{ padding:'10px 12px', background:'var(--bg3)' }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}><span style={{ fontSize:12, fontWeight:600 }}>{title}</span><span style={{ fontSize:11, color:'var(--text2)' }}>Rp {fmt(total)}</span></div>
      {children}
    </div>
  )
}
function Trio({ a, b, c, f, set }: { a:[string,string]; b:[string,string]; c:[string,string]; f:any; set:(k:string,v:any)=>void }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1.3fr', gap:8 }}>
      {[a,b,c].map(([label,key])=>(
        <div key={key}><label style={{ ...lbl, fontSize:10 }}>{label}</label><input type="number" className="input input-sm" value={f[key]} onChange={e=>set(key,Number(e.target.value))} /></div>
      ))}
    </div>
  )
}

// =====================  REALISASI  =====================
function RealisasiTab() {
  const { data:session } = useSession(); const user = session?.user as any
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState<number>(-1)
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const qs = new URLSearchParams({ kind:'realisasi', year:String(year) }); if (month>=0) qs.set('month', String(month+1))
    const r = await fetch(`/api/thirdparty?${qs}`).then(r=>r.json()); setItems(r.data||[]); setLoading(false)
  }, [year, month])
  useEffect(()=>{ load() }, [load])

  return (
    <>
      {(showForm||editing) && <RealisasiForm editing={editing} user={user} onClose={()=>{setShowForm(false);setEditing(null)}} onSaved={()=>{setShowForm(false);setEditing(null);load()}} />}
      <div style={{ display:'flex', gap:10, padding:'10px 20px', background:'var(--bg2)', borderBottom:'1px solid var(--border)', flexWrap:'wrap', alignItems:'center', flexShrink:0 }}>
        <select className="input input-sm" style={{ width:130 }} value={month} onChange={e=>setMonth(Number(e.target.value))}>
          <option value={-1}>Semua Bulan</option>{MONTHS.map((m,i)=><option key={i} value={i}>{m}</option>)}
        </select>
        <select className="input input-sm" style={{ width:90 }} value={year} onChange={e=>setYear(Number(e.target.value))}>
          {[now.getFullYear()+1, now.getFullYear(), now.getFullYear()-1].map(y=><option key={y} value={y}>{y}</option>)}
        </select>
        <button onClick={()=>setShowForm(true)} className="btn btn-sm btn-primary" style={{ marginLeft:'auto' }}>+ Realisasi</button>
      </div>
      <div style={{ flex:1, overflowY:'auto', padding:'14px 20px' }} className="safe-bottom page-pad">
        {loading ? <div style={{ textAlign:'center', padding:40, color:'var(--text3)' }}>Memuat...</div> :
         items.length===0 ? <div className="card" style={{ textAlign:'center', padding:40, color:'var(--text3)' }}><div style={{ fontSize:30, marginBottom:8 }}>📑</div><div>Belum ada realisasi</div></div> : (
          <div className="card" style={{ overflow:'auto' }}>
            <table className="wp-table" style={{ minWidth:1000 }}>
              <thead><tr><th>Nama EO</th><th>Nominal Tagihan</th><th>Nomor PO</th><th>Tgl Vendor BAST</th><th>Tgl Approve BAST</th><th>Nomor Invoice</th><th>Tgl Invoice</th><th></th></tr></thead>
              <tbody>{items.map(it=>(
                <tr key={it._id}>
                  <td style={{ fontSize:11, fontWeight:600 }}>{it.namaEO||'—'}</td>
                  <td style={{ fontWeight:600 }}>Rp {fmt(it.nominalTagihan)}</td>
                  <td style={{ fontSize:11 }}>{it.nomorPO||'—'}</td>
                  <td style={{ fontSize:11 }}>{it.tglVendorBAST?new Date(it.tglVendorBAST).toLocaleDateString('id-ID'):'—'}</td>
                  <td style={{ fontSize:11 }}>{it.tglApproveBAST?new Date(it.tglApproveBAST).toLocaleDateString('id-ID'):'—'}</td>
                  <td style={{ fontSize:11 }}>{it.nomorInvoice||'—'}</td>
                  <td style={{ fontSize:11 }}>{it.tglInvoice?new Date(it.tglInvoice).toLocaleDateString('id-ID'):'—'}</td>
                  <td style={{ display:'flex', gap:5 }}>
                    <button onClick={()=>setEditing(it)} className="btn btn-sm" style={{ fontSize:10 }}>Edit</button>
                    <button onClick={async()=>{ if(!confirm(`Hapus realisasi "${it.namaEO||''}"?`))return; await fetch(`/api/thirdparty/${it._id}`,{method:'DELETE'}); toast.success('Realisasi dihapus'); load() }} className="btn btn-sm btn-danger" style={{ fontSize:10 }}>🗑</button>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
         )}
      </div>
    </>
  )
}

function RealisasiForm({ editing, user, onClose, onSaved }: { editing?:any; user:any; onClose:()=>void; onSaved:()=>void }) {
  const now = new Date()
  const [f, setF] = useState<any>(editing ? {...editing} : { namaEO:'', nominalTagihan:0, nomorPO:'', tglVendorBAST:'', tglApproveBAST:'', nomorInvoice:'', tglInvoice:'', year:now.getFullYear(), month:now.getMonth()+1 })
  const [saving, setSaving] = useState(false)
  const set = (k:string,v:any)=>setF((p:any)=>({...p,[k]:v}))
  async function save() {
    if (!f.namaEO?.trim()) { toast.error('Isi Nama EO'); return }
    setSaving(true)
    try {
      const d = f.tglInvoice||f.tglVendorBAST ? new Date(f.tglInvoice||f.tglVendorBAST) : null
      const body = { ...f, kind:'realisasi', nominalTagihan:Number(f.nominalTagihan)||0, createdBy:user?.name, year: d?d.getFullYear():f.year, month: d?d.getMonth()+1:f.month }
      const url = editing ? `/api/thirdparty/${editing._id}` : '/api/thirdparty'
      const r = await fetch(url, { method: editing?'PATCH':'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) })
      if (!r.ok) { toast.error('Gagal menyimpan'); return }
      toast.success(editing?'Diperbarui':'Realisasi tersimpan'); onSaved()
    } finally { setSaving(false) }
  }
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ width:560 }}>
        <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between' }}>
          <span style={{ fontSize:14, fontWeight:600 }}>{editing?'Edit Realisasi':'+ Realisasi Event'}</span>
          <button onClick={onClose} className="btn btn-icon">×</button>
        </div>
        <div style={{ padding:'14px 20px', display:'flex', flexDirection:'column', gap:11 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div><label style={lbl}>Nama EO</label><input className="input" value={f.namaEO} onChange={e=>set('namaEO',e.target.value)} /></div>
            <div><label style={lbl}>Nominal Tagihan (Rp)</label><input type="number" className="input" value={f.nominalTagihan} onChange={e=>set('nominalTagihan',Number(e.target.value))} /></div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div><label style={lbl}>Nomor PO</label><input className="input" value={f.nomorPO} onChange={e=>set('nomorPO',e.target.value)} /></div>
            <div><label style={lbl}>Nomor Invoice</label><input className="input" value={f.nomorInvoice} onChange={e=>set('nomorInvoice',e.target.value)} /></div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
            <div><label style={lbl}>Tgl Vendor BAST</label><input type="date" className="input" value={f.tglVendorBAST} onChange={e=>set('tglVendorBAST',e.target.value)} /></div>
            <div><label style={lbl}>Tgl Approve BAST</label><input type="date" className="input" value={f.tglApproveBAST} onChange={e=>set('tglApproveBAST',e.target.value)} /></div>
            <div><label style={lbl}>Tgl Invoice</label><input type="date" className="input" value={f.tglInvoice} onChange={e=>set('tglInvoice',e.target.value)} /></div>
          </div>
        </div>
        <div style={{ padding:'12px 20px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'flex-end', gap:8 }}>
          <button onClick={onClose} className="btn">Batal</button>
          <button onClick={save} disabled={saving} className="btn btn-primary">{saving?'...':'Simpan'}</button>
        </div>
      </div>
    </div>
  )
}

const lbl: React.CSSProperties = { display:'block', fontSize:11, fontWeight:500, color:'var(--text2)', marginBottom:5 }
function subtab(active:boolean):React.CSSProperties { return { padding:'8px 16px', fontSize:12.5, fontWeight:600, cursor:'pointer', border:'none', borderBottom:`2px solid ${active?'var(--brand)':'transparent'}`, background:'transparent', color:active?'var(--brand)':'var(--text3)' } }
