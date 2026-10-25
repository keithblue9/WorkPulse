'use client'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useSession } from 'next-auth/react'
import { MoneyInput } from '@/components/MoneyInput'
import { useYear } from '@/lib/year'
import { ConfirmSheet, Empty, Icon, PageHeader, Sheet, Tile } from '@/components/ui'

const MONTHS = ['','Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']
const fmt = (n:number) => new Intl.NumberFormat('id-ID').format(n||0)
// Ringkas untuk tile: 25.000.000 -> 25 jt
const short = (n:number) => { const a = Math.abs(n||0); const f = (v:number, u:string) => `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(v)} ${u}`; return a >= 1e9 ? f(n/1e9,'M') : a >= 1e6 ? f(n/1e6,'jt') : a >= 1e3 ? f(n/1e3,'rb') : fmt(n) }

function CashCardForm({ editing, defaultYear, onClose, onSave }: { editing?:any; defaultYear:number; onClose:()=>void; onSave:()=>void }) {
  const { data:session } = useSession(); const user = session?.user as any
  const [form, setForm] = useState({
    year: editing?.year || defaultYear,
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
      if (!r.ok) { toast.error('Gagal menyimpan'); return }
      toast.success(editing?'Diperbarui':'Cash Card ditambah'); onSave(); onClose()
    } catch { toast.error('Gagal menyimpan') } finally { setSaving(false) }
  }
  const pct = form.topUpAmount > 0 ? (form.settlementAmount/form.topUpAmount)*100 : 0
  const L = (label:string, el:React.ReactNode) => <label className="au-col" style={{ gap: 6, minWidth: 0 }}><span className="lbl">{label}</span>{el}</label>

  return (
    <Sheet open title={editing ? 'Edit Cash Card' : 'Cash Card baru'} onClose={onClose} onSave={save} saveDisabled={saving} saveLabel={saving ? 'Menyimpan…' : 'Simpan'}>
      <fieldset className="au-col" style={{ gap: 8, border: 0, padding: 0, margin: 0 }}><legend className="lbl" style={{ marginBottom: 8 }}>Periode</legend>
        <div className="au-grid au-fgrid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))' }}>
          {L('Tahun', <input type="number" className="input" value={form.year} onChange={e=>set('year',Number(e.target.value))} />)}
          {L('Bulan', <select className="input" value={form.month} onChange={e=>set('month',Number(e.target.value))}>{MONTHS.slice(1).map((m,i)=><option key={m} value={i+1}>{m}</option>)}</select>)}
          {L('Tanggal', <input type="date" className="input" value={form.date} onChange={e=>set('date',e.target.value)} />)}
        </div></fieldset>
      <fieldset className="au-col" style={{ gap: 8, border: 0, padding: 0, margin: 0 }}><legend className="lbl" style={{ marginBottom: 8 }}>Top up (a)</legend>
        <div className="au-grid au-fgrid">
          {L('PR No.', <input className="input" value={form.prNo} onChange={e=>set('prNo',e.target.value)} />)}
          {L('Nominal (Rp)', <MoneyInput currency="IDR" className="input" value={form.topUpAmount} onChange={n=>set('topUpAmount',n)} />)}
        </div></fieldset>
      <fieldset className="au-col" style={{ gap: 8, border: 0, padding: 0, margin: 0 }}><legend className="lbl" style={{ marginBottom: 8 }}>Settlement (b)</legend>
        <div className="au-grid au-fgrid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
          {L('Ref ID Jojonomic', <input className="input" value={form.jojonomicId} onChange={e=>set('jojonomicId',e.target.value)} />)}
          {L('PO No.', <input className="input" value={form.poNo} onChange={e=>set('poNo',e.target.value)} />)}
          {L('Nominal (Rp)', <MoneyInput currency="IDR" className="input" value={form.settlementAmount} onChange={n=>set('settlementAmount',n)} />)}
        </div></fieldset>
      <div className="au-col" style={{ gap: 6 }}>
        <span className="lbl">Pengembalian dana (d)</span>
        <div className="au-row au-wrap" style={{ gap: 8 }}>
          <MoneyInput currency="IDR" className="input" style={{ flex: 1, minWidth: 160 }} value={form.refundAmount} onChange={n=>set('refundAmount',n)} placeholder="Sisa yang dikembalikan ke kantor" />
          <button type="button" className="btn" onClick={()=>set('refundAmount', Math.max(0,(form.topUpAmount||0)-(form.settlementAmount||0)))}>Semua sisa dikembalikan</button>
        </div>
      </div>
      {L('Catatan', <input className="input" value={form.notes} onChange={e=>set('notes',e.target.value)} />)}
      {form.topUpAmount > 0 && (
        <div className="au-ig">
          <div className="au-igr"><span className="k">Terpakai (c)</span><span className="v">{pct.toFixed(1)}%</span></div>
          <div className="au-igr"><span className="k">Pengembalian</span><span className="v">Rp {fmt(form.refundAmount||0)}</span></div>
          <div className="au-igr"><span className="k">Operasional</span><span className="v">{form.settlementAmount > 0 ? `Rp ${fmt((form.topUpAmount||0)-(form.settlementAmount||0)-(form.refundAmount||0))}` : <span className="au-muted" style={{ fontWeight: 400 }}>isi settlement dulu</span>}</span></div>
        </div>
      )}
    </Sheet>
  )
}

export default function CashCardPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [ask, setAsk] = useState<{ kind:'lock'|'delete'; item:any } | null>(null)
  const { year } = useYear()

  const load = useCallback(async () => {
    setLoading(true); setFailed(false)
    try {
      const r = await fetch(`/api/cashcard?year=${year}`)
      if (!r.ok) throw new Error()
      setItems((await r.json()).data||[])
    } catch { setFailed(true) } finally { setLoading(false) }
  }, [year])
  useEffect(() => { load() }, [load])

  async function del(id:string) {
    const r = await fetch(`/api/cashcard/${id}`, { method:'DELETE' }).catch(() => null)
    if (!r?.ok) { toast.error('Gagal menghapus'); return }
    toast.success('Dihapus'); setAsk(null); load()
  }
  async function setLock(i:any, next:boolean) {
    const r = await fetch(`/api/cashcard/${i._id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ locked: next }) }).catch(() => null)
    if (!r?.ok) { toast.error('Gagal menyimpan'); return }
    toast.success(next?'Angka terkunci':'Kunci dibuka'); setAsk(null); load()
  }
  function toggleLock(i:any) { if (i.locked) setLock(i, false); else setAsk({ kind:'lock', item:i }) }

  // Pengeluaran Operasional per row = |Pengembalian − (Top Up − Settlement)|, selalu positif.
  // null (—) kalau settlement & pengembalian dua-duanya belum diisi (belum ada yg direkonsiliasi).
  const rowOperasional = (i:any) => ((i.settlementAmount||0) === 0 && (i.refundAmount||0) === 0)
    ? null
    : Math.abs((i.refundAmount||0) - ((i.topUpAmount||0)-(i.settlementAmount||0)))
  const sum = (k:string) => items.reduce((s,i)=>s+(Number(i[k])||0),0)
  const totOps = items.reduce((s,i)=>s+(rowOperasional(i)||0),0)
  const totTop = sum('topUpAmount'), totSet = sum('settlementAmount')

  return (
    <div className="au-page">
      {(showForm||editing) && <CashCardForm editing={editing} defaultYear={year} onClose={()=>{setShowForm(false);setEditing(null)}} onSave={load} />}
      {ask?.kind === 'lock' && <ConfirmSheet title="Kunci angka" confirmLabel="Kunci" icon="lock"
        text={<>Kunci angka <b>{MONTHS[ask.item.month]} {ask.item.year}</b>? Settlement bulan ini tidak akan berubah lagi walaupun ada reimburse baru. Masih bisa diubah manual lewat Edit.</>}
        onConfirm={() => setLock(ask.item, true)} onClose={() => setAsk(null)} />}
      {ask?.kind === 'delete' && <ConfirmSheet danger icon="trash" title="Hapus baris" confirmLabel="Ya, hapus"
        text={<>Hapus data Cash Card <b>{MONTHS[ask.item.month]} {ask.item.year}</b>?</>}
        onConfirm={() => del(ask.item._id)} onClose={() => setAsk(null)} />}
      <div className="au-view au-anim">
        <PageHeader eyebrow={`Finance · ${year}`} title="Cash Card" actions={
          <button type="button" onClick={()=>setShowForm(true)} className="btn btn-primary"><Icon name="plus" size={16} stroke={2.2} />Tambah</button>} />
        <div className="au-grid g4 au-tiles">
          <Tile icon="card" color="var(--accent)" value={loading ? '–' : `Rp ${short(totTop)}`} label="Top up (a)" />
          <Tile icon="check" color="var(--aqua)" value={loading ? '–' : `Rp ${short(totSet)}`} label="Settlement (b)" hint={totTop ? `${((totSet/totTop)*100).toFixed(1)}%` : undefined} />
          <Tile icon="back" color="var(--ok)" value={loading ? '–' : `Rp ${short(sum('refundAmount'))}`} label="Pengembalian (d)" />
          <Tile icon="ops" color="var(--hot)" value={loading ? '–' : `Rp ${short(totOps)}`} label="Operasional (e)" />
        </div>
        {failed && <div className="au-row au-wrap p-bad" role="alert" style={{ borderRadius: 14, padding: 12 }}><span className="au-small" style={{ flex: 1 }}>Data Cash Card gagal dimuat.</span><button type="button" className="btn btn-sm" onClick={load}>Coba lagi</button></div>}
        {loading ? <div className="au-card">{[0,1,2].map(k => <div key={k} className="au-skel" />)}</div>
         : items.length === 0 ? <div className="au-card"><Empty title={`Belum ada data ${year}`} text="Catat top up dan settlement Cash Card per bulan." action={<button type="button" className="btn btn-primary" onClick={()=>setShowForm(true)}>Tambah bulan</button>} /></div>
         : <div className="au-tblw rise">
          <table className="wp-table au-ctbl" style={{ minWidth: 1000 }}>
            <thead><tr>
              <th>Periode</th><th>PR No.</th><th style={{ textAlign:'right' }}>Top up <span className="au-muted">(a)</span></th>
              <th>Ref ID Jojonomic</th><th>PO No.</th><th style={{ textAlign:'right' }}>Settlement <span className="au-muted">(b)</span></th>
              <th style={{ textAlign:'center' }} title="(c) = (b)/(a)">% <span className="au-muted">(c)</span></th>
              <th style={{ textAlign:'right' }}>Pengembalian <span className="au-muted">(d)</span></th>
              <th style={{ textAlign:'right' }} title="(e) = |(d) − ((a) − (b))|">Operasional <span className="au-muted">(e)</span></th><th><span className="sr-only">Aksi</span></th>
            </tr></thead>
            <tbody>
              {items.map(i => {
                const pct = i.topUpAmount > 0 ? ((i.settlementAmount/i.topUpAmount)*100) : 0
                const ops = rowOperasional(i)
                return (
                  <tr key={i._id}>
                    <td className="c-main"><span className="au-row" style={{ gap: 6 }}><b>{MONTHS[i.month]} {i.year}</b>{i.locked && <span title="Terkunci" style={{ color: 'var(--accent)', display: 'inline-grid' }}><Icon name="lock" size={14} /></span>}</span></td>
                    <td data-l="PR No." className="au-small">{i.prNo||'—'}</td>
                    <td data-l="Top up (a)" style={{ textAlign:'right', fontWeight:700, whiteSpace: 'nowrap' }}>Rp {fmt(i.topUpAmount)}</td>
                    <td data-l="Ref ID" className="au-small" style={{ fontFamily: 'var(--mono)' }}>{i.jojonomicId||'—'}</td>
                    <td data-l="PO No." className="au-small">{i.poNo||'—'}</td>
                    <td data-l="Settlement (b)" style={{ textAlign:'right', fontWeight:700, whiteSpace: 'nowrap' }}>Rp {fmt(i.settlementAmount)}</td>
                    <td data-l="% (c)" style={{ textAlign:'center' }}><span className="au-pctbar" style={{ ['--p' as any]: `${Math.min(100, pct)}%` }}><b style={{ color: pct>=100?'var(--ok)':pct>0?'var(--accent-ink)':'var(--muted)' }}>{pct.toFixed(1)}%</b></span></td>
                    <td data-l="Pengembalian (d)" style={{ textAlign:'right', fontWeight:700, color:'var(--ok)', whiteSpace: 'nowrap' }}>Rp {fmt(i.refundAmount||0)}</td>
                    <td data-l="Operasional (e)" style={{ textAlign:'right', fontWeight:700, whiteSpace: 'nowrap', color: ops === null ? 'var(--muted)' : 'var(--bad)' }}>{ops !== null ? 'Rp ' + fmt(ops) : '—'}</td>
                    <td className="c-act"><span className="au-row" style={{ gap: 4 }}>
                      <button type="button" onClick={()=>toggleLock(i)} className="btn btn-icon btn-sm" aria-pressed={!!i.locked} aria-label={i.locked ? `Buka kunci ${MONTHS[i.month]} ${i.year}` : `Kunci angka ${MONTHS[i.month]} ${i.year}`} title={i.locked?'Buka kunci':'Simpan & kunci angka'} style={i.locked ? { background: 'var(--accent-soft)', color: 'var(--accent-ink)' } : undefined}><Icon name="lock" size={15} /></button>
                      <button type="button" onClick={()=>setEditing(i)} className="btn btn-icon btn-sm" aria-label={`Edit ${MONTHS[i.month]} ${i.year}`} title="Edit manual"><Icon name="edit" size={15} /></button>
                      <button type="button" onClick={()=>setAsk({ kind:'delete', item:i })} className="btn btn-icon btn-sm" aria-label={`Hapus ${MONTHS[i.month]} ${i.year}`} title="Hapus"><Icon name="trash" size={15} /></button>
                    </span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>}
      </div>
    </div>
  )
}
