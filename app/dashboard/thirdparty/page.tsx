'use client'
import { useEffect, useMemo, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import { MoneyInput } from '@/components/MoneyInput'

const fmt = (n:number) => new Intl.NumberFormat('id-ID').format(n||0)
const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']
const FEE_RATE = 0.1          // EO Handling & Management Fee
const MAX_OPTIONS = 6

const OTHER_DEFAULTS = [
  { key:'meals',   label:'Meals' },
  { key:'suvenir', label:'Suvenir' },
  { key:'snacks',  label:'Snacks' },
  { key:'oleh2',   label:'Oleh-oleh' },
  { key:'voucher', label:'Voucher' },
]
function otherTotal(o:any){ return (Number(o?.pax)||0) * (Number(o?.times)||1) * (Number(o?.price)||0) }
// Estimasi 1 OPSI (sebelum fee)
function estimasiOf(o:any){
  const mr = (Number(o?.mrPax)||0)*(Number(o?.mrDays)||0)*(Number(o?.mrPrice)||0)
  const br = (Number(o?.brRooms)||0)*(Number(o?.brNights)||0)*(Number(o?.brPrice)||0)
  const others = (o?.others||[]).reduce((s:number,x:any)=>s+otherTotal(x),0)
  return mr+br+others
}
function blankOption(label:string){
  return { label, namaEO:'', kontakEO:'', kota:'', venue:'', catatan:'',
    mrPax:0, mrDays:0, mrPrice:0, brRooms:0, brNights:0, brPrice:0,
    others: OTHER_DEFAULTS.map(o=>({ ...o, pax:0, times:1, price:0 })) }
}
// Normalisasi: dokumen lama (1 opsi, field flat) -> array options. Aman utk data lama.
function optionsOf(it:any): any[] {
  if (Array.isArray(it?.options) && it.options.length) {
    return it.options.map((o:any,i:number)=>({ ...blankOption(`Opsi ${i+1}`), ...o, label: o?.label || `Opsi ${i+1}` }))
  }
  return [{
    ...blankOption('Opsi 1'),
    namaEO: it?.namaEO||'', kontakEO: it?.kontakEO||'', kota: it?.kota||'', venue: it?.venue||'', catatan: it?.catatan||'',
    mrPax: it?.mrPax||0, mrDays: it?.mrDays||0, mrPrice: it?.mrPrice||0,
    brRooms: it?.brRooms||0, brNights: it?.brNights||0, brPrice: it?.brPrice||0,
    others: (it?.others?.length ? it.others : []),
  }]
}
const clampNum = (v:any) => Math.max(0, Number(v)||0)
const fmtTgl = (d:string)=> d ? new Date(d).toLocaleDateString('id-ID',{ day:'numeric', month:'short', year:'numeric' }) : '—'

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

// Kartu Rencana — perbandingan antar OPSI (tabel ke samping) + detail RAB per opsi
function RABCard({ it, onEdit, onDelete }: { it:any; onEdit:()=>void; onDelete:()=>void }) {
  const opts = useMemo(()=>optionsOf(it), [it])
  const multi = opts.length > 1
  const [openDetail, setOpenDetail] = useState<number|null>(multi ? null : 0)
  const recIdx = Math.min(Math.max(Number(it.recommendedIndex)||0, 0), opts.length-1)

  // Hitung biaya tiap opsi
  const calc = useMemo(()=>opts.map((o:any)=>{
    const mr = (Number(o.mrPax)||0)*(Number(o.mrDays)||0)*(Number(o.mrPrice)||0)
    const br = (Number(o.brRooms)||0)*(Number(o.brNights)||0)*(Number(o.brPrice)||0)
    const oth = (o.others||[]).reduce((s:number,x:any)=>s+otherTotal(x),0)
    const sub = mr+br+oth
    return { mr, br, oth, sub, fee: sub*FEE_RATE, total: sub*(1+FEE_RATE) }
  }), [opts])

  // Opsi termurah (hanya kalau >1 opsi & ada yg terisi)
  const cheapestIdx = useMemo(()=>{
    if (!multi) return -1
    let bi = -1, bv = Infinity
    calc.forEach((c,i)=>{ if (c.total > 0 && c.total < bv) { bv = c.total; bi = i } })
    return bi
  }, [calc, multi])

  // Baris "Others" = gabungan label unik dari semua opsi (biar sejajar saat dibandingkan)
  const otherRows = useMemo(()=>{
    const map = new Map<string,string>()
    for (const o of opts) for (const x of (o.others||[])) {
      const disp = String(x?.label || x?.key || '').trim()
      if (!disp) continue
      const k = disp.toLowerCase()
      if (!map.has(k)) map.set(k, disp)
    }
    return Array.from(map.entries())
  }, [opts])
  const otherValOf = (o:any, key:string) => (o.others||[]).filter((x:any)=>String(x?.label||x?.key||'').trim().toLowerCase()===key).reduce((s:number,x:any)=>s+otherTotal(x),0)

  const s = it.tanggalMulai || it.tanggalKegiatan
  const e = it.tanggalSelesai || it.tanggalKegiatan
  const range = s && e && s!==e ? `${fmtTgl(s)} – ${fmtTgl(e)}` : fmtTgl(s)

  const cellNum:React.CSSProperties = { fontSize:11, textAlign:'right', whiteSpace:'nowrap' }
  const headOpt = (i:number):React.CSSProperties => ({
    textAlign:'right', minWidth:120,
    background: i===recIdx ? 'var(--brand-soft)' : undefined,
    color: i===recIdx ? 'var(--brand)' : undefined,
  })

  return (
    <div className="card" style={{ padding:'14px 16px' }}>
      {/* Header agenda */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10, marginBottom:10 }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:7, flexWrap:'wrap' }}>
            <span style={{ fontSize:13, fontWeight:700 }}>{it.judulKegiatan||'(tanpa judul)'}</span>
            <span className="badge" style={{ fontSize:9, background:'var(--bg3)', color:'var(--text2)', fontWeight:700 }}>{opts.length} opsi</span>
          </div>
          <div style={{ fontSize:11, color:'var(--text3)', marginTop:3 }}>📅 {range}{it.durasiHari?` (${it.durasiHari} hari)`:''} · 👥 {it.jumlahPeserta||0} peserta</div>
          {it.picInternal && <div style={{ fontSize:10.5, color:'var(--text3)', marginTop:2 }}>PIC: {it.picInternal}</div>}
        </div>
        <div style={{ display:'flex', gap:6 }}>
          <button onClick={onEdit} className="btn btn-sm" style={{ fontSize:10 }}>Edit</button>
          <button onClick={onDelete} className="btn btn-sm btn-danger" style={{ fontSize:10 }}>🗑 Hapus</button>
        </div>
      </div>

      {/* Tabel perbandingan antar opsi */}
      <div style={{ overflowX:'auto' }}>
        <table className="wp-table" style={{ minWidth: 320 + opts.length*130 }}>
          <thead>
            <tr>
              <th style={{ minWidth:150 }}>Uraian</th>
              {opts.map((o:any,i:number)=>(
                <th key={i} style={headOpt(i)}>
                  {o.label||`Opsi ${i+1}`}{i===recIdx && <span title="Rekomendasi tim"> ⭐</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ fontSize:11, color:'var(--text3)' }}>Venue</td>
              {opts.map((o:any,i:number)=><td key={i} style={{ fontSize:11, textAlign:'right', fontWeight:600 }}>{o.venue||'—'}</td>)}
            </tr>
            <tr>
              <td style={{ fontSize:11, color:'var(--text3)' }}>Kota</td>
              {opts.map((o:any,i:number)=><td key={i} style={{ fontSize:11, textAlign:'right' }}>{o.kota||'—'}</td>)}
            </tr>
            <tr>
              <td style={{ fontSize:11, color:'var(--text3)' }}>EO</td>
              {opts.map((o:any,i:number)=><td key={i} style={{ fontSize:11, textAlign:'right' }}>{o.namaEO||'—'}</td>)}
            </tr>
            <tr>
              <td style={{ fontSize:11, fontWeight:600 }}>Meeting Room</td>
              {opts.map((_o:any,i:number)=><td key={i} style={cellNum}>Rp {fmt(calc[i].mr)}</td>)}
            </tr>
            <tr>
              <td style={{ fontSize:11, fontWeight:600 }}>Bedroom</td>
              {opts.map((_o:any,i:number)=><td key={i} style={cellNum}>Rp {fmt(calc[i].br)}</td>)}
            </tr>
            {otherRows.map(([key, disp])=>(
              <tr key={key}>
                <td style={{ fontSize:11, color:'var(--text2)', paddingLeft:14 }}>↳ {disp}</td>
                {opts.map((o:any,i:number)=>{ const v = otherValOf(o,key); return <td key={i} style={{ ...cellNum, color: v?'var(--text)':'var(--text3)' }}>{v?`Rp ${fmt(v)}`:'—'}</td> })}
              </tr>
            ))}
            <tr style={{ borderTop:'2px solid var(--border)' }}>
              <td style={{ fontSize:11, fontWeight:700 }}>Subtotal</td>
              {opts.map((_o:any,i:number)=><td key={i} style={{ ...cellNum, fontWeight:700 }}>Rp {fmt(calc[i].sub)}</td>)}
            </tr>
            <tr>
              <td style={{ fontSize:11, color:'var(--amber)' }}>EO Handling &amp; Mgmt Fee (10%)</td>
              {opts.map((_o:any,i:number)=><td key={i} style={{ ...cellNum, color:'var(--amber)' }}>Rp {fmt(calc[i].fee)}</td>)}
            </tr>
            <tr style={{ background:'var(--brand-soft)' }}>
              <td style={{ fontSize:12, fontWeight:800, color:'var(--brand)' }}>TOTAL</td>
              {opts.map((_o:any,i:number)=>(
                <td key={i} style={{ ...cellNum, fontWeight:800, color: i===cheapestIdx ? 'var(--green)' : 'var(--brand)' }}>
                  Rp {fmt(calc[i].total)}
                  {i===cheapestIdx && <div style={{ fontSize:8.5, fontWeight:700, color:'var(--green)' }}>TERMURAH</div>}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Catatan per opsi (kalau ada) */}
      {opts.some((o:any)=>o.catatan?.trim()) && (
        <div style={{ marginTop:10, display:'flex', flexDirection:'column', gap:4 }}>
          {opts.map((o:any,i:number)=> o.catatan?.trim() ? (
            <div key={i} style={{ fontSize:10.5, color:'var(--text2)' }}><b>{o.label||`Opsi ${i+1}`}:</b> {o.catatan}</div>
          ) : null)}
        </div>
      )}

      {/* Detail RAB per opsi (collapsible) */}
      <div style={{ marginTop:10, display:'flex', gap:6, flexWrap:'wrap' }}>
        {opts.map((o:any,i:number)=>(
          <button key={i} onClick={()=>setOpenDetail(openDetail===i?null:i)} className="btn btn-sm" style={{ fontSize:10 }}>
            {openDetail===i?'▾':'▸'} Detail {o.label||`Opsi ${i+1}`}
          </button>
        ))}
      </div>
      {openDetail!==null && opts[openDetail] && (
        <div style={{ marginTop:8, overflowX:'auto' }}>
          <OptionDetailTable o={opts[openDetail]} c={calc[openDetail]} />
        </div>
      )}
    </div>
  )
}

// Detail RAB 1 opsi (format klasik: No / Uraian / Volume / Satuan / Harga / Jumlah)
function OptionDetailTable({ o, c }: { o:any; c:any }) {
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
  const others = (o.others||[]).map((x:any)=>({ ...x, jumlah: otherTotal(x) }))
  return (
    <table className="wp-table" style={{ minWidth:680 }}>
      <thead><tr>
        <th style={{ width:34, textAlign:'center' }}>No</th><th>Uraian</th>
        <th style={{ textAlign:'center' }}>Volume</th><th style={{ textAlign:'center' }}>Satuan</th>
        <th style={{ textAlign:'right' }}>Harga Satuan</th><th style={{ textAlign:'right' }}>Jumlah</th>
      </tr></thead>
      <tbody>
        <Line no="1" uraian={<b>Meeting Room</b>} />
        <Line no="" uraian={`${o.mrPax||0} pax × ${o.mrDays||0} hari`} vol={(Number(o.mrPax)||0)*(Number(o.mrDays)||0)} sat="pax·hari" harga={o.mrPrice||0} jumlah={c.mr} />
        <Line no="2" uraian={<b>Bedroom</b>} />
        <Line no="" uraian={`${o.brRooms||0} kamar × ${o.brNights||0} malam`} vol={(Number(o.brRooms)||0)*(Number(o.brNights)||0)} sat="kamar·malam" harga={o.brPrice||0} jumlah={c.br} />
        <Line no="3" uraian={<b>Others</b>} />
        {others.length===0 && <Line no="" uraian={<span style={{ color:'var(--text3)' }}>— tidak ada item —</span>} />}
        {others.map((x:any,i:number)=>(
          <Line key={i} no="" uraian={x.label||x.key} vol={`${x.pax||0}×${x.times||1}`} sat="pax·kali" harga={x.price||0} jumlah={x.jumlah} />
        ))}
        <tr style={{ borderTop:'2px solid var(--border)' }}><td/><td colSpan={4} style={{ textAlign:'right', fontWeight:700, fontSize:11 }}>Subtotal</td><td style={{ textAlign:'right', fontWeight:700 }}>Rp {fmt(c.sub)}</td></tr>
        <tr><td/><td colSpan={4} style={{ textAlign:'right', fontSize:11, color:'var(--amber)' }}>EO Handling &amp; Management Fee (10%)</td><td style={{ textAlign:'right', color:'var(--amber)' }}>Rp {fmt(c.fee)}</td></tr>
        <tr style={{ background:'var(--brand-soft)' }}><td/><td colSpan={4} style={{ textAlign:'right', fontWeight:800, fontSize:12, color:'var(--brand)' }}>TOTAL (termasuk fee)</td><td style={{ textAlign:'right', fontWeight:800, color:'var(--brand)' }}>Rp {fmt(c.total)}</td></tr>
      </tbody>
    </table>
  )
}

function RencanaForm({ editing, user, onClose, onSaved }: { editing?:any; user:any; onClose:()=>void; onSaved:()=>void }) {
  const now = new Date()
  const [f, setF] = useState<any>(() => {
    if (editing) return {
      ...editing,
      tanggalMulai: editing.tanggalMulai||editing.tanggalKegiatan||'',
      tanggalSelesai: editing.tanggalSelesai||editing.tanggalKegiatan||'',
      jumlahPeserta: editing.jumlahPeserta||0,
      picInternal: editing.picInternal||'',
      options: optionsOf(editing),
      recommendedIndex: Math.max(0, Number(editing.recommendedIndex)||0),
    }
    return {
      judulKegiatan:'', tanggalMulai:'', tanggalSelesai:'', jumlahPeserta:0, picInternal:'',
      options: [blankOption('Opsi 1')], recommendedIndex: 0,
      year: now.getFullYear(), month: now.getMonth()+1,
    }
  })
  const [active, setActive] = useState(0)
  const [saving, setSaving] = useState(false)

  const set = (k:string,v:any)=>setF((p:any)=>({...p,[k]:v}))
  const opt = f.options[active] || f.options[0]
  const setOpt = (k:string,v:any)=>setF((p:any)=>({ ...p, options: p.options.map((o:any,i:number)=> i===active?{...o,[k]:v}:o) }))
  const setOptOther = (oi:number,k:string,v:any)=>setF((p:any)=>({ ...p, options: p.options.map((o:any,i:number)=> i===active?{ ...o, others:(o.others||[]).map((x:any,j:number)=> j===oi?{...x,[k]:v}:x) }:o) }))
  const addOther = ()=>setF((p:any)=>({ ...p, options: p.options.map((o:any,i:number)=> i===active?{ ...o, others:[...(o.others||[]), { key:'custom', label:'', pax:0, times:1, price:0 }] }:o) }))
  const delOther = (oi:number)=>setF((p:any)=>({ ...p, options: p.options.map((o:any,i:number)=> i===active?{ ...o, others:(o.others||[]).filter((_:any,j:number)=>j!==oi) }:o) }))

  function addOpt() {
    if (f.options.length >= MAX_OPTIONS) { toast.error(`Maksimal ${MAX_OPTIONS} opsi`); return }
    const next = f.options.length
    setF((p:any)=>({ ...p, options:[...p.options, blankOption(`Opsi ${p.options.length+1}`)] }))
    setActive(next)
  }
  function dupOpt() {
    if (f.options.length >= MAX_OPTIONS) { toast.error(`Maksimal ${MAX_OPTIONS} opsi`); return }
    const src = f.options[active]
    const copy = { ...JSON.parse(JSON.stringify(src)), label:`Opsi ${f.options.length+1}` }
    const next = f.options.length
    setF((p:any)=>({ ...p, options:[...p.options, copy] }))
    setActive(next)
    toast.success('Opsi diduplikat')
  }
  function delOpt(i:number) {
    if (f.options.length <= 1) { toast.error('Minimal harus ada 1 opsi'); return }
    if (!confirm(`Hapus ${f.options[i]?.label||`Opsi ${i+1}`}?`)) return
    setF((p:any)=>{
      const opts = p.options.filter((_:any,j:number)=>j!==i)
      let rec = Number(p.recommendedIndex)||0
      if (rec === i) rec = 0
      else if (rec > i) rec = rec - 1
      return { ...p, options: opts, recommendedIndex: Math.min(Math.max(rec,0), opts.length-1) }
    })
    setActive(a => Math.max(0, Math.min(a > i ? a-1 : a, f.options.length-2)))
  }

  const mr = (Number(opt?.mrPax)||0)*(Number(opt?.mrDays)||0)*(Number(opt?.mrPrice)||0)
  const br = (Number(opt?.brRooms)||0)*(Number(opt?.brNights)||0)*(Number(opt?.brPrice)||0)
  const estimasi = estimasiOf(opt)
  const withFee = estimasi*(1+FEE_RATE)

  // Jumlah hari dari rentang tanggal (inklusif)
  const durasiHari = useMemo(() => {
    if (!f.tanggalMulai || !f.tanggalSelesai) return 0
    const a = new Date(f.tanggalMulai), b = new Date(f.tanggalSelesai)
    if (isNaN(a.getTime()) || isNaN(b.getTime()) || b < a) return 0
    return Math.round((b.getTime() - a.getTime()) / 86400000) + 1
  }, [f.tanggalMulai, f.tanggalSelesai])

  async function save() {
    const opts = (f.options||[]).map((o:any,i:number)=>({
      ...o,
      label: String(o.label||'').trim() || `Opsi ${i+1}`,
      estimasiBiaya: estimasiOf(o),
    }))
    if (!opts.length) { toast.error('Minimal harus ada 1 opsi'); return }
    if (!f.judulKegiatan?.trim() && !opts.some((o:any)=>o.namaEO?.trim())) { toast.error('Isi minimal Judul Kegiatan / Nama EO'); return }
    if (f.tanggalMulai && f.tanggalSelesai && new Date(f.tanggalSelesai) < new Date(f.tanggalMulai)) { toast.error('Tanggal selesai tidak boleh sebelum tanggal mulai'); return }
    const rec = Math.min(Math.max(Number(f.recommendedIndex)||0, 0), opts.length-1)
    const main = opts[rec]
    setSaving(true)
    try {
      const d = f.tanggalMulai ? new Date(f.tanggalMulai) : null
      const body = {
        ...f,
        kind:'rencana',
        options: opts,
        recommendedIndex: rec,
        // sinkron field lama dari opsi rekomendasi (kompat: laporan/list lama tetap jalan)
        namaEO: main.namaEO||'', kontakEO: main.kontakEO||'', kota: main.kota||'', venue: main.venue||'', catatan: main.catatan||'',
        mrPax: main.mrPax||0, mrDays: main.mrDays||0, mrPrice: main.mrPrice||0,
        brRooms: main.brRooms||0, brNights: main.brNights||0, brPrice: main.brPrice||0,
        others: main.others||[],
        estimasiBiaya: estimasiOf(main),
        durasiHari, createdBy: user?.name,
        tanggalKegiatan: f.tanggalMulai,
        year: d?d.getFullYear():f.year, month: d?d.getMonth()+1:f.month,
      }
      const url = editing ? `/api/thirdparty/${editing._id}` : '/api/thirdparty'
      const r = await fetch(url, { method: editing?'PATCH':'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) })
      if (!r.ok) { toast.error('Gagal menyimpan'); return }
      toast.success(editing?'Diperbarui':'Rencana tersimpan'); onSaved()
    } catch { toast.error('Gagal menyimpan') } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ width:760, maxWidth:'100%' }}>
        <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between' }}>
          <span style={{ fontSize:14, fontWeight:600 }}>{editing?'Edit Rencana':'+ Rencana Event'}</span>
          <button onClick={onClose} className="btn btn-icon">×</button>
        </div>
        <div style={{ padding:'14px 20px', maxHeight:'74vh', overflowY:'auto', display:'flex', flexDirection:'column', gap:11 }}>
          {/* ── Info agenda (berlaku utk semua opsi) ── */}
          <div><label style={lbl}>Judul Kegiatan</label><input className="input" value={f.judulKegiatan||''} onChange={e=>set('judulKegiatan',e.target.value)} /></div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr auto', gap:10, alignItems:'end' }}>
            <div><label style={lbl}>Tanggal Mulai</label><input type="date" className="input" value={f.tanggalMulai||''} onChange={e=>{ set('tanggalMulai',e.target.value); if(!f.tanggalSelesai||new Date(f.tanggalSelesai)<new Date(e.target.value)) set('tanggalSelesai',e.target.value) }} /></div>
            <div><label style={lbl}>Tanggal Selesai</label><input type="date" className="input" min={f.tanggalMulai||undefined} value={f.tanggalSelesai||''} onChange={e=>set('tanggalSelesai',e.target.value)} /></div>
            <div style={{ paddingBottom:9, fontSize:11.5, color:'var(--text2)', whiteSpace:'nowrap' }}>{durasiHari>0 ? <><b style={{ color:'var(--brand)' }}>{durasiHari}</b> hari</> : '—'}</div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div><label style={lbl}>Jumlah Peserta</label><input type="number" min={0} className="input" value={f.jumlahPeserta||0} onChange={e=>set('jumlahPeserta',clampNum(e.target.value))} /></div>
            <div><label style={lbl}>PIC Internal (opsional)</label><input className="input" value={f.picInternal||''} onChange={e=>set('picInternal',e.target.value)} placeholder="Penanggung jawab dari tim" /></div>
          </div>

          {/* ── Tab opsi ── */}
          <div style={{ borderTop:'1px solid var(--border)', paddingTop:11 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:7, flexWrap:'wrap', gap:6 }}>
              <span style={{ fontSize:12, fontWeight:700 }}>Opsi Usulan <span style={{ fontSize:10, fontWeight:400, color:'var(--text3)' }}>· tiap opsi bisa beda venue, item &amp; biaya</span></span>
              <div style={{ display:'flex', gap:6 }}>
                <button onClick={dupOpt} className="btn btn-sm" style={{ fontSize:10.5 }}>⧉ Duplikat opsi ini</button>
                <button onClick={addOpt} className="btn btn-sm btn-primary" style={{ fontSize:10.5 }}>+ Opsi</button>
              </div>
            </div>
            <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:10 }}>
              {f.options.map((o:any,i:number)=>(
                <button key={i} onClick={()=>setActive(i)} style={optTab(active===i)}>
                  {o.label||`Opsi ${i+1}`}{i===f.recommendedIndex && ' ⭐'}
                  <span style={{ fontSize:9, opacity:0.75, marginLeft:5 }}>Rp {fmt(estimasiOf(o)*(1+FEE_RATE))}</span>
                </button>
              ))}
            </div>

            {opt && (
              <div style={{ display:'flex', flexDirection:'column', gap:11, border:'1px solid var(--border)', borderRadius:10, padding:12, background:'var(--bg2)' }}>
                <div style={{ display:'grid', gridTemplateColumns:'1.2fr auto auto', gap:10, alignItems:'end' }}>
                  <div><label style={lbl}>Nama Opsi</label><input className="input input-sm" value={opt.label||''} onChange={e=>setOpt('label',e.target.value)} placeholder={`Opsi ${active+1}`} /></div>
                  <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, cursor:'pointer', paddingBottom:8, whiteSpace:'nowrap' }}>
                    <input type="radio" name="recOpt" checked={f.recommendedIndex===active} onChange={()=>set('recommendedIndex',active)} />
                    ⭐ Rekomendasi tim
                  </label>
                  <button onClick={()=>delOpt(active)} className="btn btn-sm btn-danger" style={{ fontSize:10, marginBottom:6 }} disabled={f.options.length<=1}>🗑 Hapus opsi</button>
                </div>

                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <div><label style={lbl}>Nama EO</label>
                    <input className="input input-sm" list="eo-list" value={opt.namaEO||''} onChange={e=>setOpt('namaEO',e.target.value)} placeholder="PTC / Kinanti / MTT / Others" />
                    <datalist id="eo-list"><option value="PTC"/><option value="Kinanti"/><option value="MTT"/><option value="Others"/></datalist></div>
                  <div><label style={lbl}>Kontak EO (opsional)</label><input className="input input-sm" value={opt.kontakEO||''} onChange={e=>setOpt('kontakEO',e.target.value)} placeholder="Nama PIC / No. HP EO" /></div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <div><label style={lbl}>Kota</label><input className="input input-sm" value={opt.kota||''} onChange={e=>setOpt('kota',e.target.value)} /></div>
                  <div><label style={lbl}>Venue</label><input className="input input-sm" value={opt.venue||''} onChange={e=>setOpt('venue',e.target.value)} /></div>
                </div>

                <Section title="Meeting Room" total={mr}>
                  <Trio a={['Pax','mrPax']} b={['Days','mrDays']} c={['Price/pax/day','mrPrice']} obj={opt} setK={setOpt} />
                </Section>
                <Section title="Bedroom" total={br}>
                  <Trio a={['Rooms','brRooms']} b={['Nights','brNights']} c={['Price/room/night','brPrice']} obj={opt} setK={setOpt} />
                </Section>

                <div>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                    <span style={{ fontSize:12, fontWeight:600 }}>Others</span>
                    <button onClick={addOther} className="btn btn-sm">+ Item</button>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {(opt.others||[]).length===0 && <div style={{ fontSize:10.5, color:'var(--text3)' }}>Belum ada item. Klik <b>+ Item</b> untuk menambah.</div>}
                    {(opt.others||[]).map((o:any,i:number)=>(
                      <div key={i} style={{ display:'grid', gridTemplateColumns:'1.3fr 70px 70px 110px 90px 28px', gap:6, alignItems:'center' }}>
                        <input className="input input-sm" placeholder="Label" value={o.label||''} onChange={e=>setOptOther(i,'label',e.target.value)} />
                        <input type="number" min={0} className="input input-sm" placeholder="Pax" value={o.pax||0} onChange={e=>setOptOther(i,'pax',clampNum(e.target.value))} />
                        <input type="number" min={0} className="input input-sm" placeholder="Times" value={o.times||0} onChange={e=>setOptOther(i,'times',clampNum(e.target.value))} />
                        <MoneyInput currency="IDR" className="input input-sm" placeholder="Price" value={o.price||0} onChange={n=>setOptOther(i,'price',clampNum(n))} />
                        <span style={{ fontSize:10, color:'var(--text2)', textAlign:'right' }}>Rp {fmt(otherTotal(o))}</span>
                        <button onClick={()=>delOther(i)} className="btn btn-icon btn-sm" style={{ color:'var(--red)' }}>×</button>
                      </div>
                    ))}
                  </div>
                </div>

                <div><label style={lbl}>Catatan Opsi (opsional)</label><textarea className="input input-sm" rows={2} value={opt.catatan||''} onChange={e=>setOpt('catatan',e.target.value)} placeholder="Kelebihan/kekurangan opsi ini, rundown, dsb." style={{ resize:'vertical' }} /></div>

                <div style={{ padding:'12px 14px', background:'var(--brand-soft)', borderRadius:10, border:'1px solid var(--brand)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                    <div><div style={{ fontSize:10, color:'var(--brand)', textTransform:'uppercase', fontWeight:600 }}>Estimasi {opt.label||`Opsi ${active+1}`}</div>
                      <div style={{ fontSize:9, color:'var(--amber)' }}>Belum termasuk EO Handling &amp; Management Fee (10%)</div></div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:20, fontWeight:800, color:'var(--brand)' }}>Rp {fmt(estimasi)}</div>
                      <div style={{ fontSize:10, color:'var(--text3)' }}>Termasuk fee 10%: Rp {fmt(withFee)}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Ringkasan perbandingan cepat */}
            {f.options.length > 1 && (
              <div style={{ marginTop:10, padding:'10px 12px', border:'1px dashed var(--border)', borderRadius:10 }}>
                <div style={{ fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', marginBottom:6 }}>Perbandingan (termasuk fee)</div>
                <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                  {f.options.map((o:any,i:number)=>{
                    const t = estimasiOf(o)*(1+FEE_RATE)
                    const totals = f.options.map((x:any)=>estimasiOf(x)*(1+FEE_RATE)).filter((v:number)=>v>0)
                    const min = totals.length?Math.min(...totals):0
                    return (
                      <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:11 }}>
                        <span style={{ color:'var(--text2)' }}>{o.label||`Opsi ${i+1}`}{i===f.recommendedIndex && ' ⭐'} {o.venue?`· ${o.venue}`:''}</span>
                        <b style={{ color: t>0 && t===min ? 'var(--green)' : 'var(--text)' }}>Rp {fmt(t)}{t>0 && t===min ? ' · termurah' : ''}</b>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
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
function Trio({ a, b, c, obj, setK }: { a:[string,string]; b:[string,string]; c:[string,string]; obj:any; setK:(k:string,v:any)=>void }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1.3fr', gap:8 }}>
      {[a,b].map(([label,key])=>(
        <div key={key}><label style={{ ...lbl, fontSize:10 }}>{label}</label><input type="number" min={0} className="input input-sm" value={obj?.[key]||0} onChange={e=>setK(key,clampNum(e.target.value))} /></div>
      ))}
      <div><label style={{ ...lbl, fontSize:10 }}>{c[0]}</label><MoneyInput currency="IDR" className="input input-sm" value={obj?.[c[1]]||0} onChange={n=>setK(c[1],clampNum(n))} /></div>
    </div>
  )
}
function optTab(active:boolean):React.CSSProperties {
  return { padding:'5px 11px', fontSize:11, fontWeight:600, cursor:'pointer', borderRadius:8,
    border:`1px solid ${active?'var(--brand)':'var(--border)'}`,
    background: active?'var(--brand-soft)':'var(--bg3)', color: active?'var(--brand)':'var(--text2)' }
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
            <div><label style={lbl}>Nominal Tagihan (Rp)</label><MoneyInput currency="IDR" className="input" value={f.nominalTagihan||0} onChange={n=>set('nominalTagihan',n)} /></div>
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
