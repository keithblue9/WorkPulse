'use client'
import { useEffect, useMemo, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import { MoneyInput } from '@/components/MoneyInput'
import { useYear } from '@/lib/year'
import { ConfirmSheet, Empty, Icon, PageHeader, Pill, Seg, Sheet, Tile } from '@/components/ui'

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
  const [tab, setTab] = useState<'rencana'|'suvenir'>('rencana')
  const { year } = useYear()
  const [month, setMonth] = useState<number>(-1)
  const [adding, setAdding] = useState(0)
  return (
    <div className="au-page">
      <div className="au-view au-anim">
        <PageHeader eyebrow={tab === 'rencana' ? `Finance · ${month >= 0 ? MONTHS[month] + ' ' : ''}${year}` : 'Finance · suvenir'} title="[3rd Party] Event" actions={<>
          {tab === 'rencana' && <select className="input" aria-label="Bulan" style={{ width: 'auto', minHeight: 40 }} value={month} onChange={e=>setMonth(Number(e.target.value))}>
            <option value={-1}>Semua bulan</option>{MONTHS.map((m,i)=><option key={i} value={i}>{m}</option>)}
          </select>}
          <button type="button" className="btn btn-primary" onClick={() => setAdding(n => n + 1)}><Icon name="plus" size={16} stroke={2.2} />{tab === 'rencana' ? 'Rencana event' : 'Suvenir'}</button>
        </>} />
        <div className="rise"><Seg label="Tampilan" value={tab} onChange={setTab} options={[['rencana','Rencana'],['suvenir','Suvenir']] as const} /></div>
        {tab==='rencana' ? <RencanaTab year={year} month={month} adding={adding} /> : <SuvenirTab adding={adding} />}
      </div>
    </div>
  )
}

// =====================  RENCANA  =====================
function RencanaTab({ year, month, adding }: { year:number; month:number; adding:number }) {
  const { data:session } = useSession(); const user = session?.user as any
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [finalFor, setFinalFor] = useState<any>(null)
  const [delFor, setDelFor] = useState<any>(null)

  const load = useCallback(async () => {
    setLoading(true); setFailed(false)
    try {
      const qs = new URLSearchParams({ kind:'rencana', year:String(year) }); if (month>=0) qs.set('month', String(month+1))
      const r = await fetch(`/api/thirdparty?${qs}`); if (!r.ok) throw new Error()
      setItems((await r.json()).data||[])
    } catch { setFailed(true) } finally { setLoading(false) }
  }, [year, month])
  useEffect(()=>{ load() }, [load])
  useEffect(()=>{ if (adding) setShowForm(true) }, [adding])
  async function del(it:any) {
    const r = await fetch(`/api/thirdparty/${it._id}`,{method:'DELETE'}).catch(()=>null)
    if (!r?.ok) { toast.error('Gagal menghapus'); return }
    toast.success('Rencana dihapus'); setDelFor(null); load()
  }
  const recTotal = (it:any) => { const o = optionsOf(it); const i = Math.min(Math.max(Number(it.recommendedIndex)||0,0), o.length-1); return estimasiOf(o[i])*(1+FEE_RATE) }
  const executed = items.filter(i=>i.executed).length
  const estSum = items.reduce((s,i)=>s+recTotal(i),0)
  const finSum = items.reduce((s,i)=>s+(Number(i.finalTotal)||0),0)
  const short = (n:number) => { const a = Math.abs(n||0); const f = (v:number, u:string) => `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(v)} ${u}`; return a >= 1e9 ? f(n/1e9,'M') : a >= 1e6 ? f(n/1e6,'jt') : a >= 1e3 ? f(n/1e3,'rb') : fmt(n) }

  return (
    <>
      {(showForm||editing) && <RencanaForm editing={editing} user={user} onClose={()=>{setShowForm(false);setEditing(null)}} onSaved={()=>{setShowForm(false);setEditing(null);load()}} />}
      {finalFor && <RealisasiFinalModal it={finalFor} user={user} onClose={()=>setFinalFor(null)} onSaved={()=>{setFinalFor(null);load()}} />}
      {delFor && <ConfirmSheet danger icon="trash" title="Hapus rencana" confirmLabel="Ya, hapus" text={<>Hapus rencana <b>“{delFor.judulKegiatan||delFor.namaEO||''}”</b> beserta semua opsinya?</>} onConfirm={() => del(delFor)} onClose={() => setDelFor(null)} />}
      <div className="au-grid g4 au-tiles">
        <Tile icon="ev" color="var(--accent)" value={loading ? '–' : items.length} label="Rencana event" />
        <Tile icon="check" color="var(--aqua)" value={loading ? '–' : executed} label="Sudah dilaksanakan" />
        <Tile icon="budget" color="var(--warn)" value={loading ? '–' : `Rp ${short(estSum)}`} label="Estimasi (rekomendasi)" />
        <Tile icon="wallet" color="var(--hot)" value={loading ? '–' : `Rp ${short(finSum)}`} label="Realisasi final" />
      </div>
      {failed && <div className="au-row au-wrap p-bad" role="alert" style={{ borderRadius: 14, padding: 12 }}><span className="au-small" style={{ flex: 1 }}>Rencana event gagal dimuat.</span><button type="button" className="btn btn-sm" onClick={load}>Coba lagi</button></div>}
      {loading ? <div className="au-card">{[0,1,2].map(k => <div key={k} className="au-skel" />)}</div> :
       items.length===0 ? <div className="au-card"><Empty title="Belum ada rencana event" text={`Belum ada rencana pada ${month >= 0 ? MONTHS[month] + ' ' : ''}${year}.`} action={<button type="button" className="btn btn-primary" onClick={()=>setShowForm(true)}>Buat rencana</button>} /></div> :
       <div className="au-col" style={{ gap: 12 }}>{items.map(it => <RABCard key={it._id} it={it} onReload={load} onFinal={()=>setFinalFor(it)} onEdit={()=>setEditing(it)} onDelete={()=>setDelFor(it)} />)}</div>}
    </>
  )
}

// Kartu Rencana — perbandingan antar OPSI (tabel ke samping) + detail RAB per opsi
function RABCard({ it, onEdit, onDelete, onReload, onFinal }: { it:any; onEdit:()=>void; onDelete:()=>void; onReload:()=>void; onFinal:()=>void }) {
  const opts = useMemo(()=>optionsOf(it), [it])
  const multi = opts.length > 1
  const [openDetail, setOpenDetail] = useState<number|null>(multi ? null : 0)
  const [detailItem, setDetailItem] = useState<{title:string; items:any[]}|null>(null)
  const [pesertaItem, setPesertaItem] = useState<{title:string; list:any[]}|null>(null)
  const [expanded, setExpanded] = useState(false)   // default ringkas; klik utk lihat rincian
  const recIdx = Math.min(Math.max(Number(it.recommendedIndex)||0, 0), opts.length-1)
  // Optimistis: sakelar langsung berubah, dikembalikan bila gagal disimpan
  const [exec, setExec] = useState(!!it.executed)
  useEffect(() => { setExec(!!it.executed) }, [it.executed])

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
    background: i===recIdx ? 'var(--accent-soft)' : undefined,
    color: i===recIdx ? 'var(--accent-ink)' : undefined,
  })

  return (
    <section className="au-card au-rab rise">
      {/* Header agenda — ketuk untuk buka/tutup rincian */}
      <div className="au-row" style={{ alignItems:'flex-start', gap:10 }}>
        <button type="button" className="au-rabhd" aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)}>
          <span className="au-row au-wrap" style={{ gap:8 }}>
            <Icon name="chev" size={16} style={{ transform:`rotate(${expanded?0:-90}deg)`, transition:'transform .2s', color:'var(--muted)' }} />
            <b className="t">{it.judulKegiatan||'(tanpa judul)'}</b>
            <span className="au-tag">{opts.length} opsi</span>
            {it.executed && <Pill tone="ok">Terlaksana</Pill>}
          </span>
          <span className="au-row au-wrap au-xs au-ink2" style={{ gap:12, paddingLeft:24 }}>
            <span className="au-row" style={{ gap:4 }}><Icon name="cal" size={13} />{range}{it.durasiHari?` · ${it.durasiHari} hari`:''}</span>
            <span className="au-row" style={{ gap:4 }}><Icon name="team" size={13} />{it.jumlahPeserta||0} peserta</span>
            {it.picInternal && <span className="au-row" style={{ gap:4 }}><Icon name="user" size={13} />PIC {it.picInternal}</span>}
          </span>
        </button>
        <span className="au-row" style={{ gap:4 }}>
          <button type="button" onClick={onEdit} className="btn btn-icon btn-sm" aria-label={`Edit ${it.judulKegiatan||'rencana'}`} title="Edit"><Icon name="edit" size={15} /></button>
          <button type="button" onClick={onDelete} className="btn btn-icon btn-sm" aria-label={`Hapus ${it.judulKegiatan||'rencana'}`} title="Hapus"><Icon name="trash" size={15} /></button>
        </span>
      </div>

      {/* Checklist pelaksanaan + realisasi final */}
      <div className="au-row au-wrap au-rabexec">
        <label className="au-row" style={{ gap:10, cursor:'pointer' }}>
          <input type="checkbox" className="au-sw" checked={exec} onChange={async e=>{
            const checked = e.target.checked
            setExec(checked)
            const r = await fetch(`/api/thirdparty/${it._id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ executed:checked, executedAt: checked ? new Date().toISOString().slice(0,10) : '' }) }).catch(()=>null)
            if (!r?.ok) { setExec(!checked); toast.error('Gagal menyimpan'); return }
            toast.success(checked ? 'Ditandai sudah dilaksanakan' : 'Tanda pelaksanaan dilepas'); onReload()
          }} />
          <span className="au-small" style={{ fontWeight:600, color: exec ? 'var(--ok)' : 'var(--ink2)' }}>{exec ? 'Sudah dilaksanakan' : 'Tandai sudah dilaksanakan'}</span>
          {it.executed && it.executedAt && <span className="au-xs au-muted">{fmtTgl(it.executedAt)}</span>}
        </label>
        {it.executed && (
          it.finalTotal > 0 ? (
            <span className="au-row au-wrap" style={{ gap:8 }}>
              <span className="au-xs au-muted">Realisasi final</span>
              <b style={{ color:'var(--ok)', fontVariantNumeric:'tabular-nums' }}>Rp {fmt(it.finalTotal)}</b>
              {it.estimasiBiaya>0 && (()=>{ const est = calc[recIdx]?.total || it.estimasiBiaya; const diff = it.finalTotal - est; return (
                <Pill tone={diff>0?'bad':'ok'}>{diff>0?'Lebih':'Hemat'} Rp {fmt(Math.abs(diff))} vs estimasi</Pill>
              )})()}
              <button type="button" onClick={onFinal} className="btn btn-sm">Ubah realisasi</button>
            </span>
          ) : (
            <button type="button" onClick={onFinal} className="btn btn-sm btn-primary"><Icon name="plus" size={14} />Realisasi final</button>
          )
        )}
      </div>

      {/* Ringkasan opsi (selalu tampil) — total tiap opsi berdampingan */}
      {!expanded && (
        <div className="au-optgrid">
          {opts.map((o:any,i:number)=>(
            <button type="button" key={i} onClick={()=>setExpanded(true)} className="au-optc" data-rec={i===recIdx || undefined}>
              <span className="au-row au-wrap" style={{ gap:6 }}>
                <span className="au-xs" style={{ fontWeight:700 }}>{o.label||`Opsi ${i+1}`}</span>
                {i===recIdx && <span className="au-pin">REKOMENDASI</span>}
                {i===cheapestIdx && <Pill tone="ok">Termurah</Pill>}
              </span>
              <span className="au-xs au-muted">{o.venue||o.kota||'—'}</span>
              <b className="v">Rp {fmt(calc[i].total)}</b>
            </button>
          ))}
        </div>
      )}

      {expanded && <>
      {/* Tabel perbandingan antar opsi */}
      <div className="au-tblw">
        <table className="wp-table au-btbl" style={{ minWidth: 320 + opts.length*130 }}>
          <thead>
            <tr>
              <th style={{ minWidth:150 }}>Uraian</th>
              {opts.map((o:any,i:number)=>(
                <th key={i} style={headOpt(i)}>
                  {o.label||`Opsi ${i+1}`}{i===recIdx && <span className="au-pin" style={{ marginLeft:6 }} title="Rekomendasi tim">REK</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ fontSize:11, color:'var(--muted)' }}>Venue</td>
              {opts.map((o:any,i:number)=><td key={i} style={{ fontSize:11, textAlign:'right', fontWeight:600 }}>{o.venue||'—'}</td>)}
            </tr>
            <tr>
              <td style={{ fontSize:11, color:'var(--muted)' }}>Kota</td>
              {opts.map((o:any,i:number)=><td key={i} style={{ fontSize:11, textAlign:'right' }}>{o.kota||'—'}</td>)}
            </tr>
            <tr>
              <td style={{ fontSize:11, color:'var(--muted)' }}>EO</td>
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
                <td style={{ fontSize:11, color:'var(--ink2)', paddingLeft:22 }}>{disp}</td>
                {opts.map((o:any,i:number)=>{
                  const v = otherValOf(o,key)
                  const items = (o.others||[]).filter((x:any)=>String(x?.label||x?.key||'').trim().toLowerCase()===key)
                  const hasDetail = items.some((x:any)=>x.detail?.trim() || x.link?.trim())
                  if (!v) return <td key={i} style={{ ...cellNum, color:'var(--muted)' }}>—</td>
                  return (
                    <td key={i} style={cellNum}>
                      {hasDetail ? (
                        <button onClick={()=>setDetailItem({ title:`${disp} · ${o.label||`Opsi ${i+1}`}`, items })}
                          className="au-tag au-srcbtn" style={{ background:'var(--accent-soft)', color:'var(--accent-ink)' }}
                          title="Lihat rincian"><Icon name="file" size={12} />Rp {fmt(v)}</button>
                      ) : `Rp ${fmt(v)}`}
                    </td>
                  )
                })}
              </tr>
            ))}
            {/* Peserta (kalau ada di salah satu opsi) */}
            {opts.some((o:any)=>(o.participants||[]).length>0) && (
              <tr>
                <td style={{ fontSize:11, color:'var(--ink2)', paddingLeft:22 }}>Peserta</td>
                {opts.map((o:any,i:number)=>{
                  const list = o.participants||[]
                  const total = pesertaTotal(list)
                  return <td key={i} style={cellNum}>{list.length>0 ? (
                    <button onClick={()=>setPesertaItem({ title:`Peserta · ${o.label||`Opsi ${i+1}`}`, list })}
                      className="au-tag au-srcbtn" title="Lihat rincian peserta"><Icon name="team" size={12} />{total} orang</button>
                  ) : '—'}</td>
                })}
              </tr>
            )}
            <tr style={{ borderTop:'2px solid var(--line)' }}>
              <td style={{ fontSize:11, fontWeight:700 }}>Subtotal</td>
              {opts.map((_o:any,i:number)=><td key={i} style={{ ...cellNum, fontWeight:700 }}>Rp {fmt(calc[i].sub)}</td>)}
            </tr>
            <tr>
              <td style={{ fontSize:11, color:'var(--warn)' }}>EO Handling &amp; Mgmt Fee (10%)</td>
              {opts.map((_o:any,i:number)=><td key={i} style={{ ...cellNum, color:'var(--warn)' }}>Rp {fmt(calc[i].fee)}</td>)}
            </tr>
            <tr style={{ background:'var(--accent-soft)' }}>
              <td style={{ fontSize:12, fontWeight:800, color:'var(--accent-ink)' }}>TOTAL</td>
              {opts.map((_o:any,i:number)=>(
                <td key={i} style={{ ...cellNum, fontWeight:800, color: i===cheapestIdx ? 'var(--ok)' : 'var(--accent-ink)' }}>
                  Rp {fmt(calc[i].total)}
                  {i===cheapestIdx && <div style={{ fontSize:8.5, fontWeight:700, color:'var(--ok)' }}>TERMURAH</div>}
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
            <div key={i} style={{ fontSize:10.5, color:'var(--ink2)' }}><b>{o.label||`Opsi ${i+1}`}:</b> {o.catatan}</div>
          ) : null)}
        </div>
      )}

      {/* Detail RAB per opsi (collapsible) */}
      <div style={{ marginTop:10, display:'flex', gap:6, flexWrap:'wrap' }}>
        {opts.map((o:any,i:number)=>(
          <button type="button" key={i} onClick={()=>setOpenDetail(openDetail===i?null:i)} className="au-chip" aria-pressed={openDetail===i}>
            Detail {o.label||`Opsi ${i+1}`}
          </button>
        ))}
      </div>
      {openDetail!==null && opts[openDetail] && (
        <div className="au-tblw" style={{ marginTop:8 }}>
          <OptionDetailTable o={opts[openDetail]} c={calc[openDetail]} />
        </div>
      )}
      </>}

      {detailItem && (
        <Sheet open title={detailItem.title} onClose={()=>setDetailItem(null)}>
          {detailItem.items.map((x:any,i:number)=>(
            <div key={i} className="au-box" style={{ padding:14, gap:6 }}>
              <span className="au-row au-between" style={{ gap:8 }}><b className="au-small">{x.label||x.key}</b><b style={{ color:'var(--accent-ink)' }}>Rp {fmt(otherTotal(x))}</b></span>
              <span className="au-xs au-muted">{x.pax||0} pax × {x.times||1} = {(Number(x.pax)||0)*(Number(x.times)||1)} unit · @ Rp {fmt(x.price||0)}</span>
              {x.detail?.trim() && <span className="au-small au-ink2" style={{ whiteSpace:'pre-wrap', lineHeight:1.5 }}>{x.detail}</span>}
              {x.link?.trim() && <a href={x.link} target="_blank" rel="noopener noreferrer" className="au-link au-row au-xs" style={{ gap:4, wordBreak:'break-all' }}><Icon name="ext" size={13} />{x.link}</a>}
            </div>
          ))}
        </Sheet>
      )}

      {pesertaItem && (
        <Sheet open title={pesertaItem.title} onClose={()=>setPesertaItem(null)}>
          <span className="au-xs au-muted">{pesertaTotal(pesertaItem.list)} orang</span>
          <div className="au-tblw">
            <table className="wp-table au-ctbl">
              <thead><tr><th style={{ width:40, textAlign:'center' }}>No</th><th>Fungsi / bagian</th><th style={{ textAlign:'center', width:80 }}>Jumlah</th><th>Keterangan</th></tr></thead>
              <tbody>
                {pesertaItem.list.map((p:any,i:number)=>(
                  <tr key={i}>
                    <td data-l="No" className="au-xs au-muted" style={{ textAlign:'center' }}>{i+1}</td>
                    <td className="c-main au-small" style={{ fontWeight:600 }}>{p.fungsi ?? p.instansi ?? '—'}</td>
                    <td data-l="Jumlah" style={{ textAlign:'center' }}>{p.jumlah || (p.nama?1:0) || '—'}</td>
                    <td data-l="Keterangan" className="au-small au-ink2">{p.keterangan ?? p.jabatan ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Sheet>
      )}
    </section>
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
    <table className="wp-table au-btbl" style={{ minWidth:680 }}>
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
        {others.length===0 && <Line no="" uraian={<span style={{ color:'var(--muted)' }}>Tidak ada item</span>} />}
        {others.map((x:any,i:number)=>(
          <Line key={i} no="" uraian={x.label||x.key} vol={`${x.pax||0}×${x.times||1}`} sat="pax·kali" harga={x.price||0} jumlah={x.jumlah} />
        ))}
        <tr className="au-totrow"><td/><td colSpan={4} style={{ textAlign:'right', fontWeight:700, fontSize:11 }}>Subtotal</td><td style={{ textAlign:'right', fontWeight:700 }}>Rp {fmt(c.sub)}</td></tr>
        <tr><td/><td colSpan={4} style={{ textAlign:'right', fontSize:11, color:'var(--warn)' }}>EO Handling &amp; Management Fee (10%)</td><td style={{ textAlign:'right', color:'var(--warn)' }}>Rp {fmt(c.fee)}</td></tr>
        <tr style={{ background:'var(--accent-soft)' }}><td/><td colSpan={4} style={{ textAlign:'right', fontWeight:800, fontSize:12, color:'var(--accent-ink)' }}>TOTAL (termasuk fee)</td><td style={{ textAlign:'right', fontWeight:800, color:'var(--accent-ink)' }}>Rp {fmt(c.total)}</td></tr>
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
  const [delOptAsk, setDelOptAsk] = useState(false)

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
    setDelOptAsk(false)
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
    <Sheet open wide title={editing ? 'Edit rencana' : 'Rencana event'} onClose={onClose} onSave={save} saveDisabled={saving} saveLabel={saving ? 'Menyimpan…' : 'Simpan'}>
          {/* ── Info agenda (berlaku utk semua opsi) ── */}
          <div><label style={lbl}>Judul Kegiatan</label><input className="input" value={f.judulKegiatan||''} onChange={e=>set('judulKegiatan',e.target.value)} /></div>
          <div className="au-grid" style={{ gridTemplateColumns:'minmax(0,1fr) minmax(0,1fr) auto', gap:10, alignItems:'end' }}>
            <div><label style={lbl}>Tanggal Mulai</label><input type="date" className="input" value={f.tanggalMulai||''} onChange={e=>{ set('tanggalMulai',e.target.value); if(!f.tanggalSelesai||new Date(f.tanggalSelesai)<new Date(e.target.value)) set('tanggalSelesai',e.target.value) }} /></div>
            <div><label style={lbl}>Tanggal Selesai</label><input type="date" className="input" min={f.tanggalMulai||undefined} value={f.tanggalSelesai||''} onChange={e=>set('tanggalSelesai',e.target.value)} /></div>
            <div className="au-small au-ink2" style={{ paddingBottom:12, whiteSpace:'nowrap' }}>{durasiHari>0 ? <><b style={{ color:'var(--accent-ink)' }}>{durasiHari}</b> hari</> : '—'}</div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div><label style={lbl}>Jumlah Peserta</label><input type="number" min={0} className="input" value={f.jumlahPeserta||0} onChange={e=>set('jumlahPeserta',clampNum(e.target.value))} /></div>
            <div><label style={lbl}>PIC Internal (opsional)</label><input className="input" value={f.picInternal||''} onChange={e=>set('picInternal',e.target.value)} placeholder="Penanggung jawab dari tim" /></div>
          </div>

          {/* ── Tab opsi ── */}
          <div className="au-col" style={{ gap:10, borderTop:'1px solid var(--line)', paddingTop:14 }}>
            <div className="au-row au-between au-wrap" style={{ gap:6 }}>
              <span className="lbl">Opsi usulan <span className="au-muted" style={{ textTransform:'none', letterSpacing:0 }}>· tiap opsi bisa beda venue, item &amp; biaya</span></span>
              <span className="au-row" style={{ gap:6 }}>
                <button type="button" onClick={dupOpt} className="btn btn-sm">Duplikat opsi ini</button>
                <button type="button" onClick={addOpt} className="btn btn-sm btn-primary"><Icon name="plus" size={14} />Opsi</button>
              </span>
            </div>
            <div className="au-chips wrap" role="tablist" aria-label="Opsi">
              {f.options.map((o:any,i:number)=>(
                <button type="button" role="tab" key={i} onClick={()=>{ setActive(i); setDelOptAsk(false) }} className="au-chip" aria-selected={active===i} aria-pressed={active===i}>
                  {o.label||`Opsi ${i+1}`}{i===f.recommendedIndex && ' · rek'}
                  <span style={{ opacity:0.7, marginLeft:6, fontWeight:500 }}>Rp {fmt(estimasiOf(o)*(1+FEE_RATE))}</span>
                </button>
              ))}
            </div>

            {opt && (
              <div className="au-box" style={{ padding:14, gap:12 }}>
                <div className="au-row au-wrap" style={{ gap:10, alignItems:'flex-end' }}>
                  <div style={{ flex:'1 1 180px' }}><label style={lbl}>Nama opsi</label><input className="input" value={opt.label||''} onChange={e=>setOpt('label',e.target.value)} placeholder={`Opsi ${active+1}`} /></div>
                  <label className="au-row au-small" style={{ gap:8, cursor:'pointer', paddingBottom:10, whiteSpace:'nowrap' }}>
                    <input type="checkbox" className="au-sw" checked={f.recommendedIndex===active} onChange={()=>set('recommendedIndex',active)} />
                    Rekomendasi tim
                  </label>
                  {f.options.length>1 && (delOptAsk
                    ? <span className="au-row p-bad" style={{ gap:6, borderRadius:12, padding:'6px 8px', marginBottom:4 }}><span className="au-xs">Hapus {opt.label||`Opsi ${active+1}`}?</span><button type="button" className="btn btn-sm" onClick={()=>setDelOptAsk(false)}>Batal</button><button type="button" className="btn btn-sm btn-danger" onClick={()=>delOpt(active)}>Hapus</button></span>
                    : <button type="button" onClick={()=>setDelOptAsk(true)} className="btn btn-sm" style={{ marginBottom:6 }}><Icon name="trash" size={14} />Hapus opsi</button>)}
                </div>

                <div className="au-grid" style={{ gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:10 }}>
                  <div><label style={lbl}>Nama EO</label>
                    <input className="input input-sm" list="eo-list" value={opt.namaEO||''} onChange={e=>setOpt('namaEO',e.target.value)} placeholder="PTC / Kinanti / MTT / Others" />
                    <datalist id="eo-list"><option value="PTC"/><option value="Kinanti"/><option value="MTT"/><option value="Others"/></datalist></div>
                  <div><label style={lbl}>Kontak EO (opsional)</label><input className="input input-sm" value={opt.kontakEO||''} onChange={e=>setOpt('kontakEO',e.target.value)} placeholder="Nama PIC / No. HP EO" /></div>
                </div>
                <div className="au-grid" style={{ gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:10 }}>
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
                    <span className="lbl">Others</span>
                    <button type="button" onClick={addOther} className="btn btn-sm"><Icon name="plus" size={14} />Item</button>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                    {(opt.others||[]).length===0 && <div className="au-xs au-muted">Belum ada item. Ketuk <b>Item</b> untuk menambah.</div>}
                    {(opt.others||[]).map((o:any,i:number)=>(
                      <div key={i} className="au-box" style={{ padding:10, gap:6 }}>
                        <div className="au-othrow">
                          <input className="input input-sm" placeholder="Label" value={o.label||''} onChange={e=>setOptOther(i,'label',e.target.value)} />
                          <input type="number" min={0} className="input input-sm" placeholder="Pax" value={o.pax||0} onChange={e=>setOptOther(i,'pax',clampNum(e.target.value))} />
                          <input type="number" min={0} className="input input-sm" placeholder="Times" value={o.times||0} onChange={e=>setOptOther(i,'times',clampNum(e.target.value))} />
                          <MoneyInput currency="IDR" className="input input-sm" placeholder="Price" value={o.price||0} onChange={n=>setOptOther(i,'price',clampNum(n))} />
                          <span className="au-xs au-ink2 sum">Rp {fmt(otherTotal(o))}</span>
                          <button type="button" onClick={()=>delOther(i)} className="btn btn-icon btn-sm del" aria-label={`Hapus item ${o.label||i+1}`}><Icon name="x" size={13} /></button>
                        </div>
                        <div className="au-grid" style={{ gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:6 }}>
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
                    <span className="lbl">Peserta · {(opt.participants||[]).length}</span>
                    <button type="button" onClick={addPeserta} className="btn btn-sm"><Icon name="plus" size={14} />Peserta</button>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {(opt.participants||[]).length===0 && <div className="au-xs au-muted">Belum ada peserta. Ketuk <b>Peserta</b> untuk menambah.</div>}
                    {(opt.participants||[]).map((p:any,i:number)=>(
                      <div key={i} className="au-psrow">
                        <input className="input input-sm" placeholder="Fungsi / Bagian" value={p.fungsi ?? p.instansi ?? ''} onChange={e=>setPeserta(i,'fungsi',e.target.value)} />
                        <input type="number" min={0} className="input input-sm" placeholder="Jumlah" value={p.jumlah||0} onChange={e=>setPeserta(i,'jumlah',clampNum(e.target.value))} />
                        <input className="input input-sm" placeholder="Keterangan (opsional)" value={p.keterangan ?? p.jabatan ?? ''} onChange={e=>setPeserta(i,'keterangan',e.target.value)} />
                        <button type="button" onClick={()=>delPeserta(i)} className="btn btn-icon btn-sm" aria-label={`Hapus peserta ${i+1}`}><Icon name="x" size={13} /></button>
                      </div>
                    ))}
                    {(opt.participants||[]).length>0 && (
                      <div style={{ fontSize:10.5, color:'var(--ink2)', textAlign:'right', paddingRight:34 }}>Total: <b>{(opt.participants||[]).reduce((s:number,p:any)=>s+(Number(p.jumlah)||0),0)}</b> orang</div>
                    )}
                  </div>
                </div>

                <div><label style={lbl}>Catatan Opsi (opsional)</label><textarea className="input input-sm" rows={2} value={opt.catatan||''} onChange={e=>setOpt('catatan',e.target.value)} placeholder="Kelebihan/kekurangan opsi ini, rundown, dsb." style={{ resize:'vertical' }} /></div>

                <div className="au-total" style={{ flexWrap:'wrap' }}>
                  <span className="au-col" style={{ gap:2 }}><span className="lbl">Estimasi {opt.label||`Opsi ${active+1}`}</span><span className="au-xs">Belum termasuk EO handling &amp; management fee (10%)</span></span>
                  <span className="au-col" style={{ alignItems:'flex-end', gap:2 }}><b>Rp {fmt(estimasi)}</b><span className="au-xs">Termasuk fee: Rp {fmt(withFee)}</span></span>
                </div>
              </div>
            )}

            {/* Ringkasan perbandingan cepat */}
            {f.options.length > 1 && (
              <div className="au-box" style={{ padding:12, gap:6, borderStyle:'dashed' }}>
                <span className="lbl">Perbandingan (termasuk fee)</span>
                <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                  {f.options.map((o:any,i:number)=>{
                    const t = estimasiOf(o)*(1+FEE_RATE)
                    const totals = f.options.map((x:any)=>estimasiOf(x)*(1+FEE_RATE)).filter((v:number)=>v>0)
                    const min = totals.length?Math.min(...totals):0
                    return (
                      <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:11 }}>
                        <span style={{ color:'var(--ink2)' }}>{o.label||`Opsi ${i+1}`}{i===f.recommendedIndex && ' · rekomendasi'} {o.venue?`· ${o.venue}`:''}</span>
                        <b style={{ color: t>0 && t===min ? 'var(--ok)' : 'var(--ink)' }}>Rp {fmt(t)}{t>0 && t===min ? ' · termurah' : ''}</b>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
    </Sheet>
  )
}
function Section({ title, total, children }: { title:string; total:number; children:any }) {
  return (
    <div className="au-box" style={{ padding:12, gap:8, background:'var(--sunken)' }}>
      <div className="au-row au-between"><span className="lbl">{title}</span><b className="au-small" style={{ fontVariantNumeric:'tabular-nums' }}>Rp {fmt(total)}</b></div>
      {children}
    </div>
  )
}
function Trio({ a, b, c, obj, setK }: { a:[string,string]; b:[string,string]; c:[string,string]; obj:any; setK:(k:string,v:any)=>void }) {
  return (
    <div className="au-grid" style={{ gridTemplateColumns:'minmax(0,1fr) minmax(0,1fr) minmax(0,1.4fr)', gap:8 }}>
      {[a,b].map(([label,key])=>(
        <div key={key}><label style={{ ...lbl, fontSize:10 }}>{label}</label><input type="number" min={0} className="input input-sm" value={obj?.[key]||0} onChange={e=>setK(key,clampNum(e.target.value))} /></div>
      ))}
      <div><label style={{ ...lbl, fontSize:10 }}>{c[0]}</label><MoneyInput currency="IDR" className="input input-sm" value={obj?.[c[1]]||0} onChange={n=>setK(c[1],clampNum(n))} /></div>
    </div>
  )
}
// =====================  REALISASI  =====================
// Label gaya .lbl Aurora (mono kecil, huruf besar)
const lbl: React.CSSProperties = { display:'block', font:'500 11px var(--mono)', letterSpacing:'.06em', textTransform:'uppercase', color:'var(--muted)', marginBottom:6 }

// =====================  SUVENIR (ide usulan + stok)  =====================
function stockOf(s:any){ return (s.moves||[]).reduce((n:number,m:any)=> n + (m.type==='in' ? Number(m.qty)||0 : -(Number(m.qty)||0)), 0) }

function SuvenirTab({ adding }: { adding:number }) {
  const { data:session } = useSession(); const user = session?.user as any
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [moveFor, setMoveFor] = useState<any>(null)
  const [view, setView] = useState<'usulan'|'stok'>('usulan')
  const [delFor, setDelFor] = useState<any>(null)
  const first = useState(adding)[0]

  const load = useCallback(async () => {
    setLoading(true)
    const r = await fetch('/api/souvenir').then(r=>r.json()).catch(()=>({data:[]})); setItems(r.data||[]); setLoading(false)
  }, [])
  useEffect(()=>{ load() }, [load])
  useEffect(()=>{ if (adding && adding !== first) setShowForm(true) }, [adding, first])

  // Pisahkan berdasarkan kind: usulan vs stok. Barang lama tanpa kind:
  // kalau punya moves -> stok, selain itu -> usulan (biar data lama ga hilang).
  const kindOf = (s:any) => s.kind || ((s.moves||[]).length > 0 ? 'stok' : 'usulan')

  const usulanRows = items.filter(s => kindOf(s) === 'usulan')
  const stokRows = items.filter(s => kindOf(s) === 'stok')

  async function del(id:string) {
    const r = await fetch(`/api/souvenir/${id}`, { method:'DELETE' }).catch(()=>null)
    if (!r?.ok) { toast.error('Gagal menghapus'); return }
    toast.success('Dihapus'); setDelFor(null); load()
  }

  return (
    <>
      {(showForm||editing) && <SuvenirForm editing={editing} mode={view} user={user} onClose={()=>{setShowForm(false);setEditing(null)}} onSaved={()=>{setShowForm(false);setEditing(null);load()}} />}
      {moveFor && <StockMoveModal item={moveFor} user={user} onClose={()=>setMoveFor(null)} onSaved={()=>{setMoveFor(null);load()}} />}
      {delFor && <ConfirmSheet danger icon="trash" title="Hapus suvenir" confirmLabel="Ya, hapus" text={<>Hapus suvenir <b>“{delFor.nama}”</b>{kindOf(delFor) === 'stok' ? ' beserta riwayat stoknya' : ''}?</>} onConfirm={() => del(delFor._id)} onClose={() => setDelFor(null)} />}
      <div className="au-row au-wrap rise" style={{ gap:8 }}>
        <Seg label="Jenis suvenir" value={view} onChange={setView} options={[['usulan',`Usulan · ${usulanRows.length}`],['stok',`Stok · ${stokRows.length}`]] as const} />
      </div>
      {loading ? <div className="au-card">{[0,1,2].map(k => <div key={k} className="au-skel" />)}</div> :
       view==='usulan' ? (
         usulanRows.length===0 ? <div className="au-card"><Empty title="Belum ada usulan suvenir" action={<button type="button" className="btn btn-primary" onClick={()=>setShowForm(true)}>Tambah usulan</button>} /></div> : (
           <div className="au-tblw rise">
             <table className="wp-table au-ctbl">
               <thead><tr>
                 <th style={{ width:44, textAlign:'center' }}>No</th>
                 <th>Nama barang</th>
                 <th style={{ textAlign:'center', width:90 }}>Jumlah</th>
                 <th style={{ textAlign:'right', width:140 }}>Harga satuan</th>
                 <th style={{ textAlign:'right', width:150 }}>Total</th>
                 <th style={{ width:90 }}>Link</th>
                 <th style={{ width:100 }}><span className="sr-only">Aksi</span></th>
               </tr></thead>
               <tbody>
                 {usulanRows.map((s,i)=>(
                   <tr key={s._id}>
                     <td data-l="No" className="au-xs au-muted" style={{ textAlign:'center' }}>{i+1}</td>
                     <td className="c-main"><span className="au-col" style={{ gap:2 }}><b className="au-small">{s.nama}</b>{s.deskripsi && <span className="au-xs au-muted">{s.deskripsi}</span>}</span></td>
                     <td data-l="Jumlah" style={{ textAlign:'center' }}>{s.jumlahUsulan||0}</td>
                     <td data-l="Harga satuan" style={{ textAlign:'right', whiteSpace:'nowrap' }}>{s.hargaSatuan>0?`Rp ${fmt(s.hargaSatuan)}`:'—'}</td>
                     <td data-l="Total" style={{ textAlign:'right', fontWeight:700, whiteSpace:'nowrap' }}>{s.hargaSatuan>0 && s.jumlahUsulan>0 ? `Rp ${fmt(s.hargaSatuan*s.jumlahUsulan)}` : '—'}</td>
                     <td data-l="Link">{s.link ? <a href={s.link} target="_blank" rel="noopener noreferrer" className="au-link au-row au-xs" style={{ gap:4 }}><Icon name="ext" size={13} />Buka</a> : <span className="au-xs au-muted">—</span>}</td>
                     <td className="c-act"><span className="au-row" style={{ gap:4, justifyContent:'flex-end' }}>
                       <button type="button" onClick={()=>setEditing(s)} className="btn btn-icon btn-sm" aria-label={`Edit ${s.nama}`} title="Edit"><Icon name="edit" size={15} /></button>
                       <button type="button" onClick={()=>setDelFor(s)} className="btn btn-icon btn-sm" aria-label={`Hapus ${s.nama}`} title="Hapus"><Icon name="trash" size={15} /></button>
                     </span></td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
         )
       ) : (
         stokRows.length===0 ? <div className="au-card"><Empty title="Belum ada barang stok" text="Tambahkan barang beserta stok awalnya." action={<button type="button" className="btn btn-primary" onClick={()=>setShowForm(true)}>Tambah barang</button>} /></div> : (
           <div className="au-sgrid">
             {stokRows.map(s=>{ const stock = stockOf(s); return (
               <article key={s._id} className="au-card au-stock rise">
                 <span className="au-row au-between" style={{ gap:8, alignItems:'flex-start' }}><b className="au-small" style={{ overflowWrap:'anywhere' }}>{s.nama}</b>
                   <button type="button" onClick={()=>setDelFor(s)} className="btn btn-icon btn-sm" aria-label={`Hapus ${s.nama}`} title="Hapus"><Icon name="trash" size={14} /></button></span>
                 <span className="au-col" style={{ gap:0 }}><b className="n" style={{ color: stock>0?'var(--ok)':stock<0?'var(--bad)':'var(--muted)' }}>{stock}</b><span className="au-xs au-muted">stok tersedia · {(s.moves||[]).length} catatan</span></span>
                 <button type="button" onClick={()=>setMoveFor(s)} className="btn btn-sm" style={{ alignSelf:'flex-start' }}><Icon name="arrow" size={14} />Stok masuk / keluar</button>
               </article>
             )})}
           </div>
         )
       )}
    </>
  )
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
    <Sheet open title={editing?'Edit suvenir':isStok?'Barang stok baru':'Usulan suvenir'} onClose={onClose} onSave={save} saveDisabled={saving} saveLabel={saving ? 'Menyimpan…' : 'Simpan'}>
          <div><label style={lbl}>Nama Barang *</label><input className="input" value={f.nama} onChange={e=>set('nama',e.target.value)} placeholder="mis. Omron Wrist" /></div>
          {isStok ? (
            // Form STOK: cukup nama + jumlah stok awal
            <div><label style={lbl}>Jumlah Stok Awal</label><input type="number" min={0} className="input" value={stokAwal} onChange={e=>setStokAwal(Math.max(0,Number(e.target.value)||0))} placeholder="0" /><div className="au-xs au-muted" style={{ marginTop:6 }}>Bisa diubah nanti lewat tombol Stok masuk / keluar.</div></div>
          ) : (
            // Form USULAN: nama + jumlah + harga + link
            <>
              <div><label style={lbl}>Deskripsi</label><textarea className="input" rows={2} value={f.deskripsi} onChange={e=>set('deskripsi',e.target.value)} style={{ resize:'vertical' }} /></div>
              <div className="au-grid" style={{ gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:10 }}>
                <div><label style={lbl}>Harga Satuan</label><MoneyInput currency="IDR" className="input" value={f.hargaSatuan} onChange={n=>set('hargaSatuan',Math.max(0,Number(n)||0))} /></div>
                <div><label style={lbl}>Jumlah Usulan</label><input type="number" min={0} className="input" value={f.jumlahUsulan} onChange={e=>set('jumlahUsulan',Math.max(0,Number(e.target.value)||0))} /></div>
              </div>
              <div><label style={lbl}>Link E-commerce</label><input className="input" value={f.link} onChange={e=>set('link',e.target.value)} placeholder="https://..." /></div>
              <div><label style={lbl}>Catatan</label><textarea className="input" rows={2} value={f.catatan} onChange={e=>set('catatan',e.target.value)} style={{ resize:'vertical' }} /></div>
            </>
          )}
    </Sheet>
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
  const [rmAsk, setRmAsk] = useState<string|null>(null)
  async function removeMove(id:string) {
    if (rmAsk !== id) { setRmAsk(id); return }
    const r = await fetch(`/api/souvenir/${item._id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ removeMoveId:id }) })
    if (r.ok) { toast.success('Dihapus'); onSaved() } else toast.error('Gagal menghapus')
  }
  return (
    <Sheet open title={item.nama} onClose={onClose} onSave={save} saveDisabled={saving} saveLabel={saving ? 'Menyimpan…' : 'Simpan'}>
          <span className="au-small au-ink2">Stok saat ini: <b style={{ color: stock>0?'var(--ok)':'var(--ink2)' }}>{stock}</b></span>
          <Seg full label="Jenis gerakan" value={type} onChange={setType} options={[['in','Masuk'],['out','Keluar']] as const} />
          <div className="au-grid" style={{ gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:10 }}>
            <div><label style={lbl}>Jumlah</label><input type="number" min={1} className="input" value={qty} onChange={e=>setQty(Math.max(0,Number(e.target.value)||0))} /></div>
            <div><label style={lbl}>Tanggal</label><input type="date" className="input" value={date} onChange={e=>setDate(e.target.value)} /></div>
          </div>
          <div><label style={lbl}>Keterangan</label><input className="input" value={note} onChange={e=>setNote(e.target.value)} placeholder="mis. beli batch 1 / dipakai event UAT" /></div>
          {(item.moves||[]).length>0 && (
            <div className="au-col" style={{ gap:8 }}>
              <span className="lbl">Riwayat stok</span>
              <div className="au-ig" style={{ maxHeight:220, overflowY:'auto' }}>
                {(item.moves||[]).slice().reverse().map((m:any)=>(
                  <div key={m._id} className="au-igr" style={{ minHeight:44, padding:'6px 10px 6px 14px' }}>
                    <span className="au-xs au-ink2" style={{ flex:1, minWidth:0 }}>{m.date||'—'} · {m.note||'-'}</span>
                    <b style={{ color: m.type==='in'?'var(--ok)':'var(--bad)', fontVariantNumeric:'tabular-nums' }}>{m.type==='in'?'+':'−'}{m.qty}</b>
                    <button type="button" onClick={()=>removeMove(m._id)} className={`btn btn-sm${rmAsk===m._id?' btn-danger':' btn-icon'}`} aria-label="Hapus catatan stok">{rmAsk===m._id ? 'Hapus?' : <Icon name="x" size={13} />}</button>
                  </div>
                ))}
              </div>
            </div>
          )}
    </Sheet>
  )
}

// Input rincian realisasi final (aktif setelah agenda dicentang "sudah dilaksanakan")
function RealisasiFinalModal({ it, user, onClose, onSaved }: { it:any; user:any; onClose:()=>void; onSaved:()=>void }) {
  const opts = useMemo(()=>optionsOf(it), [it])
  // Prefill: kalau sudah pernah isi final pakai itu; kalau belum, ambil dari opsi rekomendasi
  const recIdx = Math.min(Math.max(Number(it.recommendedIndex)||0, 0), opts.length-1)
  const [pickedOpt, setPickedOpt] = useState<number>(it.finalOptionIndex>=0 ? it.finalOptionIndex : recIdx)
  const seed = it.finalTotal>0 ? {
    finalVenue: it.finalVenue||'', finalKota: it.finalKota||'', finalNamaEO: it.finalNamaEO||'',
    finalMrPax: it.finalMrPax||0, finalMrDays: it.finalMrDays||0, finalMrPrice: it.finalMrPrice||0,
    finalBrRooms: it.finalBrRooms||0, finalBrNights: it.finalBrNights||0, finalBrPrice: it.finalBrPrice||0,
    finalItems: (it.finalItems||[]).map((x:any)=>({ ...x })), finalCatatan: it.finalCatatan||'',
  } : (()=>{ const o = opts[recIdx]||{}; return {
    finalVenue: o.venue||'', finalKota: o.kota||'', finalNamaEO: o.namaEO||'',
    finalMrPax: o.mrPax||0, finalMrDays: o.mrDays||0, finalMrPrice: o.mrPrice||0,
    finalBrRooms: o.brRooms||0, finalBrNights: o.brNights||0, finalBrPrice: o.brPrice||0,
    finalItems: (o.others||[]).map((x:any)=>({ ...x })), finalCatatan:'',
  }})()
  const [f, setF] = useState<any>(seed)
  const [saving, setSaving] = useState(false)
  const set = (k:string,v:any)=>setF((p:any)=>({...p,[k]:v}))
  const setItem = (i:number,k:string,v:any)=>setF((p:any)=>({ ...p, finalItems: p.finalItems.map((x:any,j:number)=> j===i?{...x,[k]:v}:x) }))
  const addItem = ()=>setF((p:any)=>({ ...p, finalItems:[...(p.finalItems||[]), { key:'custom', label:'', pax:0, times:1, price:0 }] }))
  const delItem = (i:number)=>setF((p:any)=>({ ...p, finalItems:(p.finalItems||[]).filter((_:any,j:number)=>j!==i) }))

  // Isi ulang dari opsi tertentu
  function loadFromOption(idx:number){
    const o = opts[idx]||{}
    setPickedOpt(idx)
    setF({
      finalVenue:o.venue||'', finalKota:o.kota||'', finalNamaEO:o.namaEO||'',
      finalMrPax:o.mrPax||0, finalMrDays:o.mrDays||0, finalMrPrice:o.mrPrice||0,
      finalBrRooms:o.brRooms||0, finalBrNights:o.brNights||0, finalBrPrice:o.brPrice||0,
      finalItems:(o.others||[]).map((x:any)=>({...x})), finalCatatan: f.finalCatatan||'',
    })
  }

  const mr = (Number(f.finalMrPax)||0)*(Number(f.finalMrDays)||0)*(Number(f.finalMrPrice)||0)
  const br = (Number(f.finalBrRooms)||0)*(Number(f.finalBrNights)||0)*(Number(f.finalBrPrice)||0)
  const oth = (f.finalItems||[]).reduce((s:number,x:any)=>s+otherTotal(x),0)
  const sub = mr+br+oth
  const fee = sub*FEE_RATE
  const total = sub+fee
  const estimasi = opts[pickedOpt] ? estimasiOf(opts[pickedOpt])*(1+FEE_RATE) : (Number(it.estimasiBiaya)||0)*(1+FEE_RATE)
  const diff = total - estimasi

  async function save() {
    setSaving(true)
    try {
      const body = {
        finalOptionIndex: pickedOpt,
        finalVenue:f.finalVenue, finalKota:f.finalKota, finalNamaEO:f.finalNamaEO,
        finalMrPax:f.finalMrPax, finalMrDays:f.finalMrDays, finalMrPrice:f.finalMrPrice,
        finalBrRooms:f.finalBrRooms, finalBrNights:f.finalBrNights, finalBrPrice:f.finalBrPrice,
        finalItems:f.finalItems, finalCatatan:f.finalCatatan, finalTotal: total,
        executed: true,
      }
      const r = await fetch(`/api/thirdparty/${it._id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) })
      if (!r.ok) { toast.error('Gagal menyimpan'); return }
      toast.success('Realisasi final tersimpan'); onSaved()
    } catch { toast.error('Gagal') } finally { setSaving(false) }
  }

  return (
    <Sheet open wide title="Realisasi final" onClose={onClose} onSave={save} saveDisabled={saving} saveLabel={saving ? 'Menyimpan…' : 'Simpan'}>
          <span className="au-small au-ink2">{it.judulKegiatan||'(tanpa judul)'} · biaya aktual pelaksanaan</span>
          {opts.length>1 && (
            <div>
              <label style={lbl}>Opsi yang dipakai</label>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {opts.map((o:any,i:number)=>(
                  <button type="button" key={i} onClick={()=>loadFromOption(i)} className="au-chip" aria-pressed={pickedOpt===i}>{o.label||`Opsi ${i+1}`}{i===recIdx?' · rek':''}</button>
                ))}
              </div>
              <div className="au-xs au-muted" style={{ marginTop:6 }}>Pilih opsi untuk isi otomatis dari rencana, lalu sesuaikan angka aktualnya.</div>
            </div>
          )}
          <div className="au-grid" style={{ gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:10 }}>
            <div><label style={lbl}>Venue</label><input className="input input-sm" value={f.finalVenue} onChange={e=>set('finalVenue',e.target.value)} /></div>
            <div><label style={lbl}>Kota</label><input className="input input-sm" value={f.finalKota} onChange={e=>set('finalKota',e.target.value)} /></div>
            <div><label style={lbl}>EO</label><input className="input input-sm" value={f.finalNamaEO} onChange={e=>set('finalNamaEO',e.target.value)} /></div>
          </div>

          <div className="au-box" style={{ padding:12, gap:8, background:'var(--sunken)' }}>
            <div className="au-row au-between"><span className="lbl">Meeting Room</span><b className="au-small">Rp {fmt(mr)}</b></div>
            <div className="au-grid" style={{ gridTemplateColumns:'minmax(0,1fr) minmax(0,1fr) minmax(0,1.4fr)', gap:8 }}>
              <div><label style={{ ...lbl, fontSize:10 }}>Pax</label><input type="number" min={0} className="input input-sm" value={f.finalMrPax||0} onChange={e=>set('finalMrPax',clampNum(e.target.value))} /></div>
              <div><label style={{ ...lbl, fontSize:10 }}>Days</label><input type="number" min={0} className="input input-sm" value={f.finalMrDays||0} onChange={e=>set('finalMrDays',clampNum(e.target.value))} /></div>
              <div><label style={{ ...lbl, fontSize:10 }}>Price/pax/day</label><MoneyInput currency="IDR" className="input input-sm" value={f.finalMrPrice||0} onChange={n=>set('finalMrPrice',clampNum(n))} /></div>
            </div>
          </div>
          <div className="au-box" style={{ padding:12, gap:8, background:'var(--sunken)' }}>
            <div className="au-row au-between"><span className="lbl">Bedroom</span><b className="au-small">Rp {fmt(br)}</b></div>
            <div className="au-grid" style={{ gridTemplateColumns:'minmax(0,1fr) minmax(0,1fr) minmax(0,1.4fr)', gap:8 }}>
              <div><label style={{ ...lbl, fontSize:10 }}>Rooms</label><input type="number" min={0} className="input input-sm" value={f.finalBrRooms||0} onChange={e=>set('finalBrRooms',clampNum(e.target.value))} /></div>
              <div><label style={{ ...lbl, fontSize:10 }}>Nights</label><input type="number" min={0} className="input input-sm" value={f.finalBrNights||0} onChange={e=>set('finalBrNights',clampNum(e.target.value))} /></div>
              <div><label style={{ ...lbl, fontSize:10 }}>Price/room/night</label><MoneyInput currency="IDR" className="input input-sm" value={f.finalBrPrice||0} onChange={n=>set('finalBrPrice',clampNum(n))} /></div>
            </div>
          </div>

          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
              <span className="lbl">Others</span>
              <button type="button" onClick={addItem} className="btn btn-sm"><Icon name="plus" size={14} />Item</button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {(f.finalItems||[]).length===0 && <div className="au-xs au-muted">Belum ada item.</div>}
              {(f.finalItems||[]).map((o:any,i:number)=>(
                <div key={i} className="au-othrow">
                  <input className="input input-sm" placeholder="Label" value={o.label||''} onChange={e=>setItem(i,'label',e.target.value)} />
                  <input type="number" min={0} className="input input-sm" placeholder="Pax" value={o.pax||0} onChange={e=>setItem(i,'pax',clampNum(e.target.value))} />
                  <input type="number" min={0} className="input input-sm" placeholder="Times" value={o.times||0} onChange={e=>setItem(i,'times',clampNum(e.target.value))} />
                  <MoneyInput currency="IDR" className="input input-sm" placeholder="Price" value={o.price||0} onChange={n=>setItem(i,'price',clampNum(n))} />
                  <span className="au-xs au-ink2 sum">Rp {fmt(otherTotal(o))}</span>
                  <button type="button" onClick={()=>delItem(i)} className="btn btn-icon btn-sm del" aria-label={`Hapus item ${o.label||i+1}`}><Icon name="x" size={13} /></button>
                </div>
              ))}
            </div>
          </div>

          <div><label style={lbl}>Catatan Realisasi</label><textarea className="input input-sm" rows={2} value={f.finalCatatan||''} onChange={e=>set('finalCatatan',e.target.value)} style={{ resize:'vertical' }} /></div>

          <div className="au-ig">
            <div className="au-igr"><span className="k">Subtotal</span><span className="v">Rp {fmt(sub)}</span></div>
            <div className="au-igr"><span className="k">EO handling &amp; mgmt fee (10%)</span><span className="v" style={{ color:'var(--warn)' }}>Rp {fmt(fee)}</span></div>
          </div>
          <div className="au-total" style={{ flexWrap:'wrap' }}><span className="lbl">Total realisasi</span><b>Rp {fmt(total)}</b>
            {estimasi>0 && <span className="au-xs" style={{ width:'100%', textAlign:'right', fontWeight:700, color: diff>0?'var(--bad)':'var(--ok)' }}>{diff>0?'Lebih':'Hemat'} Rp {fmt(Math.abs(diff))} dari estimasi (Rp {fmt(estimasi)})</span>}
          </div>
    </Sheet>
  )
}
