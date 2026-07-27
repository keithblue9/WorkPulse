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
// Total orang peserta: jumlahkan field jumlah; kalau data lama (pakai nama, tanpa jumlah) hitung per baris
function pesertaTotal(list:any[]){
  if (!Array.isArray(list)) return 0
  return list.reduce((s,p)=> s + (Number(p?.jumlah) || (p?.nama ? 1 : 0)), 0)
}
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
    others: OTHER_DEFAULTS.map(o=>({ ...o, pax:0, times:1, price:0, detail:'', link:'' })),
    participants: [] }
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
  const [tab, setTab] = useState<'rencana'|'realisasi'|'suvenir'>('rencana')
  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ padding:'12px 20px 0', borderBottom:'1px solid var(--border)', background:'var(--bg2)', flexShrink:0 }}>
        <div style={{ fontSize:14, fontWeight:600 }}>[3rd Party] Event</div>
        <div style={{ display:'flex', gap:4, marginTop:10 }}>
          <button onClick={()=>setTab('rencana')} style={subtab(tab==='rencana')}>Rencana</button>
          <button onClick={()=>setTab('realisasi')} style={subtab(tab==='realisasi')}>Realisasi</button>
          <button onClick={()=>setTab('suvenir')} style={subtab(tab==='suvenir')}>🎁 Suvenir</button>
        </div>
      </div>
      {tab==='rencana' ? <RencanaTab/> : tab==='realisasi' ? <RealisasiTab/> : <SuvenirTab/>}
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
  const [detailItem, setDetailItem] = useState<{title:string; items:any[]}|null>(null)
  const [pesertaItem, setPesertaItem] = useState<{title:string; list:any[]}|null>(null)
  const [expanded, setExpanded] = useState(false)   // default ringkas; klik utk lihat rincian
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
      {/* Header agenda — klik utk buka/tutup rincian */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10, marginBottom:expanded?10:0 }}>
        <div onClick={()=>setExpanded(v=>!v)} style={{ cursor:'pointer', flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:7, flexWrap:'wrap' }}>
            <span style={{ fontSize:11, color:'var(--text3)' }}>{expanded?'▾':'▸'}</span>
            <span style={{ fontSize:13, fontWeight:700 }}>{it.judulKegiatan||'(tanpa judul)'}</span>
            <span className="badge" style={{ fontSize:9, background:'var(--bg3)', color:'var(--text2)', fontWeight:700 }}>{opts.length} opsi</span>
          </div>
          <div style={{ fontSize:11, color:'var(--text3)', marginTop:3, paddingLeft:18 }}>📅 {range}{it.durasiHari?` (${it.durasiHari} hari)`:''} · 👥 {it.jumlahPeserta||0} peserta</div>
          {it.picInternal && <div style={{ fontSize:10.5, color:'var(--text3)', marginTop:2, paddingLeft:18 }}>PIC: {it.picInternal}</div>}
        </div>
        <div style={{ display:'flex', gap:6 }}>
          <button onClick={onEdit} className="btn btn-sm" style={{ fontSize:10 }}>Edit</button>
          <button onClick={onDelete} className="btn btn-sm btn-danger" style={{ fontSize:10 }}>🗑 Hapus</button>
        </div>
      </div>

      {/* Ringkasan opsi (selalu tampil) — total tiap opsi berdampingan */}
      {!expanded && (
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:8, paddingLeft:18 }}>
          {opts.map((o:any,i:number)=>(
            <div key={i} onClick={()=>setExpanded(true)} style={{ cursor:'pointer', border:`1px solid ${i===recIdx?'var(--brand)':'var(--border)'}`, background:i===recIdx?'var(--brand-soft)':'var(--bg2)', borderRadius:8, padding:'6px 11px', minWidth:130 }}>
              <div style={{ fontSize:10, color:'var(--text3)', display:'flex', alignItems:'center', gap:4 }}>
                {o.label||`Opsi ${i+1}`}{i===recIdx && <span title="Rekomendasi tim">⭐</span>}
                {i===cheapestIdx && <span style={{ fontSize:8, fontWeight:700, color:'var(--green)' }}>· TERMURAH</span>}
              </div>
              <div style={{ fontSize:10, color:'var(--text3)', margin:'1px 0' }}>{o.venue||o.kota||'—'}</div>
              <div style={{ fontSize:13, fontWeight:800, color:i===recIdx?'var(--brand)':i===cheapestIdx?'var(--green)':'var(--text)' }}>Rp {fmt(calc[i].total)}</div>
            </div>
          ))}
        </div>
      )}

      {expanded && <>
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
                {opts.map((o:any,i:number)=>{
                  const v = otherValOf(o,key)
                  const items = (o.others||[]).filter((x:any)=>String(x?.label||x?.key||'').trim().toLowerCase()===key)
                  const hasDetail = items.some((x:any)=>x.detail?.trim() || x.link?.trim())
                  if (!v) return <td key={i} style={{ ...cellNum, color:'var(--text3)' }}>—</td>
                  return (
                    <td key={i} style={cellNum}>
                      {hasDetail ? (
                        <button onClick={()=>setDetailItem({ title:`${disp} · ${o.label||`Opsi ${i+1}`}`, items })}
                          style={{ background:'var(--brand-soft)', color:'var(--brand)', border:'1px solid var(--brand)', borderRadius:6, padding:'2px 8px', fontSize:10.5, fontWeight:600, cursor:'pointer' }}
                          title="Klik lihat rincian">📄 Rp {fmt(v)}</button>
                      ) : `Rp ${fmt(v)}`}
                    </td>
                  )
                })}
              </tr>
            ))}
            {/* Peserta (kalau ada di salah satu opsi) */}
            {opts.some((o:any)=>(o.participants||[]).length>0) && (
              <tr>
                <td style={{ fontSize:11, color:'var(--text2)', paddingLeft:14 }}>↳ Peserta</td>
                {opts.map((o:any,i:number)=>{
                  const list = o.participants||[]
                  const total = pesertaTotal(list)
                  return <td key={i} style={cellNum}>{list.length>0 ? (
                    <button onClick={()=>setPesertaItem({ title:`Peserta · ${o.label||`Opsi ${i+1}`}`, list })}
                      style={{ background:'var(--bg3)', color:'var(--text)', border:'1px solid var(--border)', borderRadius:6, padding:'2px 8px', fontSize:10.5, fontWeight:600, cursor:'pointer' }}
                      title="Klik lihat rincian peserta">👥 {total} orang</button>
                  ) : '—'}</td>
                })}
              </tr>
            )}
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
      </>}

      {/* Popup rincian item (souvenir/oleh-oleh/dll) */}
      {detailItem && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setDetailItem(null)}>
          <div className="modal" style={{ width:460, maxWidth:'100%' }}>
            <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:13.5, fontWeight:700 }}>{detailItem.title}</span>
              <button onClick={()=>setDetailItem(null)} className="btn btn-icon">×</button>
            </div>
            <div style={{ padding:'14px 18px', maxHeight:'70vh', overflowY:'auto', display:'flex', flexDirection:'column', gap:10 }}>
              {detailItem.items.map((x:any,i:number)=>(
                <div key={i} style={{ border:'1px solid var(--border)', borderRadius:10, padding:12 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', gap:8, marginBottom:4 }}>
                    <span style={{ fontSize:12.5, fontWeight:700 }}>{x.label||x.key}</span>
                    <span style={{ fontSize:12, fontWeight:700, color:'var(--brand)' }}>Rp {fmt(otherTotal(x))}</span>
                  </div>
                  <div style={{ fontSize:10.5, color:'var(--text3)', marginBottom:x.detail||x.link?6:0 }}>{x.pax||0} pax × {x.times||1} = {(Number(x.pax)||0)*(Number(x.times)||1)} unit · @ Rp {fmt(x.price||0)}</div>
                  {x.detail?.trim() && <div style={{ fontSize:11.5, color:'var(--text2)', lineHeight:1.5, whiteSpace:'pre-wrap' }}>{x.detail}</div>}
                  {x.link?.trim() && <a href={x.link} target="_blank" rel="noopener noreferrer" style={{ fontSize:11, color:'var(--brand)', display:'inline-block', marginTop:6, wordBreak:'break-all' }}>🔗 {x.link}</a>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Popup rincian peserta */}
      {pesertaItem && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setPesertaItem(null)}>
          <div className="modal" style={{ width:520, maxWidth:'100%' }}>
            <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:13.5, fontWeight:700 }}>{pesertaItem.title} <span style={{ fontSize:11, fontWeight:400, color:'var(--text3)' }}>({pesertaTotal(pesertaItem.list)} orang)</span></span>
              <button onClick={()=>setPesertaItem(null)} className="btn btn-icon">×</button>
            </div>
            <div style={{ padding:'8px 0', maxHeight:'70vh', overflowY:'auto' }}>
              <table className="wp-table" style={{ width:'100%' }}>
                <thead><tr><th style={{ width:30, textAlign:'center' }}>No</th><th>Fungsi / Bagian</th><th style={{ textAlign:'center', width:70 }}>Jumlah</th><th>Keterangan</th></tr></thead>
                <tbody>
                  {pesertaItem.list.map((p:any,i:number)=>(
                    <tr key={i}>
                      <td style={{ textAlign:'center', fontSize:11, color:'var(--text3)' }}>{i+1}</td>
                      <td style={{ fontSize:11.5, fontWeight:600 }}>{p.fungsi ?? p.instansi ?? '—'}</td>
                      <td style={{ textAlign:'center', fontSize:11.5 }}>{p.jumlah || (p.nama?1:0) || '—'}</td>
                      <td style={{ fontSize:11, color:'var(--text2)' }}>{p.keterangan ?? p.jabatan ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr style={{ background:'var(--bg3)' }}>
                  <td/><td style={{ fontSize:11.5, fontWeight:700 }}>Total</td>
                  <td style={{ textAlign:'center', fontSize:12, fontWeight:800 }}>{pesertaTotal(pesertaItem.list)}</td><td/>
                </tr></tfoot>
              </table>
            </div>
          </div>
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
  const addOther = ()=>setF((p:any)=>({ ...p, options: p.options.map((o:any,i:number)=> i===active?{ ...o, others:[...(o.others||[]), { key:'custom', label:'', pax:0, times:1, price:0, detail:'', link:'' }] }:o) }))
  const setPeserta = (pi:number,k:string,v:any)=>setF((p:any)=>({ ...p, options: p.options.map((o:any,i:number)=> i===active?{ ...o, participants:(o.participants||[]).map((x:any,j:number)=> j===pi?{...x,[k]:v}:x) }:o) }))
  const addPeserta = ()=>setF((p:any)=>({ ...p, options: p.options.map((o:any,i:number)=> i===active?{ ...o, participants:[...(o.participants||[]), { fungsi:'', jumlah:0, keterangan:'' }] }:o) }))
  const delPeserta = (pi:number)=>setF((p:any)=>({ ...p, options: p.options.map((o:any,i:number)=> i===active?{ ...o, participants:(o.participants||[]).filter((_:any,j:number)=>j!==pi) }:o) }))
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
                  <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                    {(opt.others||[]).length===0 && <div style={{ fontSize:10.5, color:'var(--text3)' }}>Belum ada item. Klik <b>+ Item</b> untuk menambah.</div>}
                    {(opt.others||[]).map((o:any,i:number)=>(
                      <div key={i} style={{ border:'1px solid var(--border)', borderRadius:8, padding:8, background:'var(--bg2)' }}>
                        <div style={{ display:'grid', gridTemplateColumns:'1.3fr 70px 70px 110px 90px 28px', gap:6, alignItems:'center' }}>
                          <input className="input input-sm" placeholder="Label" value={o.label||''} onChange={e=>setOptOther(i,'label',e.target.value)} />
                          <input type="number" min={0} className="input input-sm" placeholder="Pax" value={o.pax||0} onChange={e=>setOptOther(i,'pax',clampNum(e.target.value))} />
                          <input type="number" min={0} className="input input-sm" placeholder="Times" value={o.times||0} onChange={e=>setOptOther(i,'times',clampNum(e.target.value))} />
                          <MoneyInput currency="IDR" className="input input-sm" placeholder="Price" value={o.price||0} onChange={n=>setOptOther(i,'price',clampNum(n))} />
                          <span style={{ fontSize:10, color:'var(--text2)', textAlign:'right' }}>Rp {fmt(otherTotal(o))}</span>
                          <button onClick={()=>delOther(i)} className="btn btn-icon btn-sm" style={{ color:'var(--red)' }}>×</button>
                        </div>
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginTop:6 }}>
                          <input className="input input-sm" placeholder="Rincian (mis. UGREEN UNO Robot + Keychain)" value={o.detail||''} onChange={e=>setOptOther(i,'detail',e.target.value)} />
                          <input className="input input-sm" placeholder="Link e-commerce (opsional)" value={o.link||''} onChange={e=>setOptOther(i,'link',e.target.value)} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Peserta */}
                <div>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                    <span style={{ fontSize:12, fontWeight:600 }}>Peserta <span style={{ fontSize:10, fontWeight:400, color:'var(--text3)' }}>({(opt.participants||[]).length})</span></span>
                    <button onClick={addPeserta} className="btn btn-sm">+ Peserta</button>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {(opt.participants||[]).length===0 && <div style={{ fontSize:10.5, color:'var(--text3)' }}>Belum ada peserta. Klik <b>+ Peserta</b> untuk menambah.</div>}
                    {(opt.participants||[]).map((p:any,i:number)=>(
                      <div key={i} style={{ display:'grid', gridTemplateColumns:'1.4fr 80px 1.4fr 28px', gap:6, alignItems:'center' }}>
                        <input className="input input-sm" placeholder="Fungsi / Bagian" value={p.fungsi ?? p.instansi ?? ''} onChange={e=>setPeserta(i,'fungsi',e.target.value)} />
                        <input type="number" min={0} className="input input-sm" placeholder="Jumlah" value={p.jumlah||0} onChange={e=>setPeserta(i,'jumlah',clampNum(e.target.value))} />
                        <input className="input input-sm" placeholder="Keterangan (opsional)" value={p.keterangan ?? p.jabatan ?? ''} onChange={e=>setPeserta(i,'keterangan',e.target.value)} />
                        <button onClick={()=>delPeserta(i)} className="btn btn-icon btn-sm" style={{ color:'var(--red)' }}>×</button>
                      </div>
                    ))}
                    {(opt.participants||[]).length>0 && (
                      <div style={{ fontSize:10.5, color:'var(--text2)', textAlign:'right', paddingRight:34 }}>Total: <b>{(opt.participants||[]).reduce((s:number,p:any)=>s+(Number(p.jumlah)||0),0)}</b> orang</div>
                    )}
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

// =====================  SUVENIR (ide usulan + stok)  =====================
function stockOf(s:any){ return (s.moves||[]).reduce((n:number,m:any)=> n + (m.type==='in' ? Number(m.qty)||0 : -(Number(m.qty)||0)), 0) }

function SuvenirTab() {
  const { data:session } = useSession(); const user = session?.user as any
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [moveFor, setMoveFor] = useState<any>(null)
  const [view, setView] = useState<'usulan'|'stok'>('usulan')

  const load = useCallback(async () => {
    setLoading(true)
    const r = await fetch('/api/souvenir').then(r=>r.json()).catch(()=>({data:[]})); setItems(r.data||[]); setLoading(false)
  }, [])
  useEffect(()=>{ load() }, [load])

  // Pisahkan berdasarkan kind: usulan vs stok. Barang lama tanpa kind:
  // kalau punya moves -> stok, selain itu -> usulan (biar data lama ga hilang).
  const kindOf = (s:any) => s.kind || ((s.moves||[]).length > 0 ? 'stok' : 'usulan')
  const usulanRows = items.filter(s => kindOf(s) === 'usulan')
  const stokRows = items.filter(s => kindOf(s) === 'stok')

  async function del(id:string, nama:string) {
    if (!confirm(`Hapus suvenir "${nama}"?`)) return
    await fetch(`/api/souvenir/${id}`, { method:'DELETE' }); toast.success('Dihapus'); load()
  }

  return (
    <>
      {(showForm||editing) && <SuvenirForm editing={editing} mode={view} user={user} onClose={()=>{setShowForm(false);setEditing(null)}} onSaved={()=>{setShowForm(false);setEditing(null);load()}} />}
      {moveFor && <StockMoveModal item={moveFor} user={user} onClose={()=>setMoveFor(null)} onSaved={()=>{setMoveFor(null);load()}} />}
      <div style={{ display:'flex', gap:10, padding:'10px 20px', background:'var(--bg2)', borderBottom:'1px solid var(--border)', flexWrap:'wrap', alignItems:'center', flexShrink:0 }}>
        <div style={{ display:'flex', gap:3, background:'var(--bg3)', borderRadius:8, padding:3 }}>
          {(['usulan','stok'] as const).map(v=>(
            <button key={v} onClick={()=>setView(v)} className="btn btn-sm" style={{ fontSize:11.5, textTransform:'capitalize', background:view===v?'var(--brand)':'transparent', color:view===v?'#fff':'var(--text2)', border:'none' }}>{v==='usulan'?'💡 Usulan':'📦 Stok'}</button>
          ))}
        </div>
        <button onClick={()=>setShowForm(true)} className="btn btn-sm btn-primary" style={{ marginLeft:'auto' }}>+ Suvenir</button>
      </div>
      <div style={{ flex:1, overflowY:'auto', padding:'14px 20px' }} className="safe-bottom page-pad">
        {loading ? <div style={{ textAlign:'center', padding:40, color:'var(--text3)' }}>Memuat...</div> :
         view==='usulan' ? (
           usulanRows.length===0 ? <EmptyS text="Belum ada usulan suvenir" /> : (
             <div className="card" style={{ padding:0, overflowX:'auto' }}>
               <table className="wp-table" style={{ width:'100%' }}>
                 <thead><tr>
                   <th style={{ width:34, textAlign:'center' }}>No</th>
                   <th>Nama Barang</th>
                   <th style={{ textAlign:'center', width:90 }}>Jumlah</th>
                   <th style={{ textAlign:'right', width:130 }}>Harga Satuan</th>
                   <th style={{ width:120 }}>Link</th>
                   <th style={{ width:110 }}></th>
                 </tr></thead>
                 <tbody>
                   {usulanRows.map((s,i)=>(
                     <tr key={s._id}>
                       <td style={{ textAlign:'center', fontSize:11, color:'var(--text3)' }}>{i+1}</td>
                       <td>
                         <div style={{ fontSize:12.5, fontWeight:600 }}>{s.nama}</div>
                         {s.deskripsi && <div style={{ fontSize:10.5, color:'var(--text3)' }}>{s.deskripsi}</div>}
                       </td>
                       <td style={{ textAlign:'center', fontSize:12 }}>{s.jumlahUsulan||0}</td>
                       <td style={{ textAlign:'right', fontSize:12 }}>{s.hargaSatuan>0?`Rp ${fmt(s.hargaSatuan)}`:'—'}</td>
                       <td>{s.link ? <a href={s.link} target="_blank" rel="noopener noreferrer" style={{ fontSize:10.5, color:'var(--brand)' }}>🔗 Buka</a> : <span style={{ fontSize:11, color:'var(--text3)' }}>—</span>}</td>
                       <td style={{ textAlign:'right' }}>
                         <button onClick={()=>setEditing(s)} className="btn btn-sm" style={{ fontSize:10 }}>Edit</button>{' '}
                         <button onClick={()=>del(s._id,s.nama)} className="btn btn-sm btn-danger" style={{ fontSize:10 }}>🗑</button>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
           )
         ) : (
           stokRows.length===0 ? <EmptyS text="Belum ada barang stok. Klik + Suvenir untuk menambah." /> : (
             <div className="card" style={{ padding:0, overflowX:'auto' }}>
               <table className="wp-table" style={{ width:'100%' }}>
                 <thead><tr>
                   <th style={{ width:34, textAlign:'center' }}>No</th>
                   <th>Nama Barang</th>
                   <th style={{ textAlign:'center', width:120 }}>Stok Tersedia</th>
                   <th style={{ width:160 }}></th>
                 </tr></thead>
                 <tbody>
                   {stokRows.map((s,i)=>{ const stock = stockOf(s); return (
                     <tr key={s._id}>
                       <td style={{ textAlign:'center', fontSize:11, color:'var(--text3)' }}>{i+1}</td>
                       <td style={{ fontSize:12.5, fontWeight:600 }}>{s.nama}</td>
                       <td style={{ textAlign:'center', fontSize:15, fontWeight:800, color: stock>0?'var(--green)':stock<0?'var(--red)':'var(--text3)' }}>{stock}</td>
                       <td style={{ textAlign:'right' }}>
                         <button onClick={()=>setMoveFor(s)} className="btn btn-sm" style={{ fontSize:10 }}>📥 Stok In/Out</button>{' '}
                         <button onClick={()=>del(s._id,s.nama)} className="btn btn-sm btn-danger" style={{ fontSize:10 }}>🗑</button>
                       </td>
                     </tr>
                   )})}
                 </tbody>
               </table>
             </div>
           )
         )}
      </div>
    </>
  )
}

function EmptyS({ text }: { text:string }) {
  return <div className="card" style={{ textAlign:'center', padding:40, color:'var(--text3)' }}><div style={{ fontSize:30, marginBottom:8 }}>🎁</div><div style={{ fontSize:12 }}>{text}</div></div>
}

function SuvenirForm({ editing, mode, user, onClose, onSaved }: { editing?:any; mode:'usulan'|'stok'; user:any; onClose:()=>void; onSaved:()=>void }) {
  const isStok = mode === 'stok' && !editing   // form stok cuma buat tambah baru
  const [f, setF] = useState<any>(() => editing ? { ...editing } : { nama:'', deskripsi:'', hargaSatuan:0, jumlahUsulan:0, link:'', catatan:'' })
  const [stokAwal, setStokAwal] = useState(0)
  const [saving, setSaving] = useState(false)
  const set = (k:string,v:any)=>setF((p:any)=>({...p,[k]:v}))
  async function save() {
    if (!f.nama?.trim()) { toast.error('Nama wajib'); return }
    setSaving(true)
    try {
      // Mode stok: simpan nama + langsung catat stok awal sbg gerakan 'in'
      const body:any = { ...f, createdBy:user?.name }
      if (!editing) body.kind = isStok ? 'stok' : 'usulan'
      if (isStok && stokAwal > 0) body.moves = [{ type:'in', qty:stokAwal, date:new Date().toISOString().slice(0,10), note:'Stok awal', by:user?.name }]
      const url = editing ? `/api/souvenir/${editing._id}` : '/api/souvenir'
      const r = await fetch(url, { method: editing?'PATCH':'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) })
      if (!r.ok) { toast.error('Gagal menyimpan'); return }
      toast.success(editing?'Diperbarui':'Tersimpan'); onSaved()
    } catch { toast.error('Gagal') } finally { setSaving(false) }
  }
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ width:isStok?420:500, maxWidth:'100%' }}>
        <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between' }}>
          <span style={{ fontSize:14, fontWeight:600 }}>{editing?'Edit Suvenir':isStok?'+ Barang Stok':'+ Usulan Suvenir'}</span>
          <button onClick={onClose} className="btn btn-icon">×</button>
        </div>
        <div style={{ padding:'14px 20px', display:'flex', flexDirection:'column', gap:11, maxHeight:'70vh', overflowY:'auto' }}>
          <div><label style={lbl}>Nama Barang *</label><input className="input" value={f.nama} onChange={e=>set('nama',e.target.value)} placeholder="mis. Omron Wrist" /></div>
          {isStok ? (
            // Form STOK: cukup nama + jumlah stok awal
            <div><label style={lbl}>Jumlah Stok Awal</label><input type="number" min={0} className="input" value={stokAwal} onChange={e=>setStokAwal(Math.max(0,Number(e.target.value)||0))} placeholder="0" /><div style={{ fontSize:10, color:'var(--text3)', marginTop:4 }}>Bisa diubah nanti lewat tombol Stok In/Out.</div></div>
          ) : (
            // Form USULAN: nama + jumlah + harga + link
            <>
              <div><label style={lbl}>Deskripsi</label><textarea className="input" rows={2} value={f.deskripsi} onChange={e=>set('deskripsi',e.target.value)} style={{ resize:'vertical' }} /></div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div><label style={lbl}>Harga Satuan</label><MoneyInput currency="IDR" className="input" value={f.hargaSatuan} onChange={n=>set('hargaSatuan',Math.max(0,Number(n)||0))} /></div>
                <div><label style={lbl}>Jumlah Usulan</label><input type="number" min={0} className="input" value={f.jumlahUsulan} onChange={e=>set('jumlahUsulan',Math.max(0,Number(e.target.value)||0))} /></div>
              </div>
              <div><label style={lbl}>Link E-commerce</label><input className="input" value={f.link} onChange={e=>set('link',e.target.value)} placeholder="https://..." /></div>
              <div><label style={lbl}>Catatan</label><textarea className="input" rows={2} value={f.catatan} onChange={e=>set('catatan',e.target.value)} style={{ resize:'vertical' }} /></div>
            </>
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

function StockMoveModal({ item, user, onClose, onSaved }: { item:any; user:any; onClose:()=>void; onSaved:()=>void }) {
  const [type, setType] = useState<'in'|'out'>('in')
  const [qty, setQty] = useState(0)
  const [date, setDate] = useState(new Date().toISOString().slice(0,10))
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const stock = stockOf(item)
  async function save() {
    if (!(qty>0)) { toast.error('Jumlah harus lebih dari 0'); return }
    if (type==='out' && qty>stock) { toast.error(`Stok tidak cukup (tersedia ${stock})`); return }
    setSaving(true)
    try {
      const r = await fetch(`/api/souvenir/${item._id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ addMove:{ type, qty, date, note, by:user?.name } }) })
      if (!r.ok) { toast.error('Gagal'); return }
      toast.success('Stok diperbarui'); onSaved()
    } catch { toast.error('Gagal') } finally { setSaving(false) }
  }
  async function removeMove(id:string) {
    if (!confirm('Hapus catatan stok ini?')) return
    const r = await fetch(`/api/souvenir/${item._id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ removeMoveId:id }) })
    if (r.ok) { toast.success('Dihapus'); onSaved() }
  }
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ width:460, maxWidth:'100%' }}>
        <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div><div style={{ fontSize:14, fontWeight:700 }}>{item.nama}</div><div style={{ fontSize:11, color:'var(--text3)' }}>Stok saat ini: <b style={{ color: stock>0?'var(--green)':'var(--text2)' }}>{stock}</b></div></div>
          <button onClick={onClose} className="btn btn-icon">×</button>
        </div>
        <div style={{ padding:'14px 20px', display:'flex', flexDirection:'column', gap:11 }}>
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={()=>setType('in')} className="btn btn-sm" style={{ flex:1, background:type==='in'?'#22c55e22':'var(--bg3)', color:type==='in'?'#16a34a':'var(--text2)', borderColor:type==='in'?'#22c55e':'var(--border)' }}>📥 Masuk (In)</button>
            <button onClick={()=>setType('out')} className="btn btn-sm" style={{ flex:1, background:type==='out'?'#dc262622':'var(--bg3)', color:type==='out'?'#dc2626':'var(--text2)', borderColor:type==='out'?'#dc2626':'var(--border)' }}>📤 Keluar (Out)</button>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div><label style={lbl}>Jumlah</label><input type="number" min={1} className="input" value={qty} onChange={e=>setQty(Math.max(0,Number(e.target.value)||0))} /></div>
            <div><label style={lbl}>Tanggal</label><input type="date" className="input" value={date} onChange={e=>setDate(e.target.value)} /></div>
          </div>
          <div><label style={lbl}>Keterangan</label><input className="input" value={note} onChange={e=>setNote(e.target.value)} placeholder="mis. beli batch 1 / dipakai event UAT" /></div>
          {(item.moves||[]).length>0 && (
            <div style={{ borderTop:'1px solid var(--border)', paddingTop:8 }}>
              <div style={{ fontSize:10.5, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', marginBottom:6 }}>Riwayat stok</div>
              <div style={{ maxHeight:150, overflowY:'auto', display:'flex', flexDirection:'column', gap:3 }}>
                {(item.moves||[]).slice().reverse().map((m:any)=>(
                  <div key={m._id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:10.5, padding:'3px 6px', background:'var(--bg3)', borderRadius:6 }}>
                    <span style={{ color:'var(--text3)' }}>{m.date||'—'} · {m.note||'-'}</span>
                    <span style={{ display:'flex', gap:6, alignItems:'center' }}>
                      <b style={{ color: m.type==='in'?'var(--green)':'var(--red)' }}>{m.type==='in'?'+':'−'}{m.qty}</b>
                      <button onClick={()=>removeMove(m._id)} className="btn btn-icon btn-sm" style={{ color:'var(--red)', fontSize:10 }}>×</button>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div style={{ padding:'12px 20px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'flex-end', gap:8 }}>
          <button onClick={onClose} className="btn">Tutup</button>
          <button onClick={save} disabled={saving} className="btn btn-primary">{saving?'...':'Simpan'}</button>
        </div>
      </div>
    </div>
  )
}
