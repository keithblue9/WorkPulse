'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'

const CATS = ['SI', 'Non-SI', 'Others', 'GoLive']
const CAT_COLORS: Record<string,{color:string;bg:string}> = {
  'SI':      { color:'var(--blue)',   bg:'var(--bluebg)' },
  'Non-SI':  { color:'var(--purple)', bg:'var(--purplebg)' },
  'Others':  { color:'var(--teal)',   bg:'var(--tealbg)' },
  'GoLive':  { color:'var(--green)',  bg:'var(--greenbg)' },
}

function KPIForm({ editing, onClose, onSave }: { editing?:any; onClose:()=>void; onSave:()=>void }) {
  const [form, setForm] = useState({
    title: editing?.title||'', category: editing?.category||'SI',
    projectName: editing?.projectName||'', pic: editing?.pic?.join(', ')||'',
    weight: editing?.weight||0, planPct: editing?.planPct||0, actualPct: editing?.actualPct||0,
    status: editing?.status||'on_track', year: editing?.year||2026,
  })
  const [saving, setSaving] = useState(false)
  const set = (k:string,v:any) => setForm(f=>({...f,[k]:v}))

  async function save() {
    if (!form.title) { toast.error('Judul wajib diisi'); return }
    setSaving(true)
    try {
      const url = editing ? `/api/kpi/${editing._id}` : '/api/kpi'
      await fetch(url, { method: editing?'PATCH':'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ ...form, pic: form.pic.split(',').map((s:string)=>s.trim()).filter(Boolean) }) })
      toast.success(editing?'KPI diperbarui!':'KPI ditambahkan!'); onSave(); onClose()
    } catch { toast.error('Gagal') } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ width:520 }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between' }}>
          <span style={{ fontSize:14, fontWeight:600 }}>{editing?'Edit KPI Item':'+ Tambah KPI Item'}</span>
          <button onClick={onClose} className="btn btn-icon">×</button>
        </div>
        <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:12 }}>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {CATS.map(c => {
              const cfg = CAT_COLORS[c]
              return <button key={c} onClick={()=>set('category',c)} style={{ padding:'4px 12px', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer', border:`1px solid ${form.category===c?cfg.color:'var(--border)'}`, background:form.category===c?cfg.bg:'var(--bg3)', color:form.category===c?cfg.color:'var(--text2)' }}>{c}</button>
            })}
          </div>
          <div><label style={lbl}>Judul KPI / Nama Project *</label><input className="input" value={form.title} onChange={e=>set('title',e.target.value)} placeholder="cth: OnePro Phase 3 - PAL" /></div>
          <div><label style={lbl}>Nama Project (opsional)</label><input className="input" value={form.projectName} onChange={e=>set('projectName',e.target.value)} placeholder="cth: OnePro PAL, iVendor VM 3.0" /></div>
          <div><label style={lbl}>PIC (pisahkan dengan koma)</label><input className="input" value={form.pic} onChange={e=>set('pic',e.target.value)} placeholder="Erwin, Nabila, Bagus" /></div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
            <div><label style={lbl}>Bobot (%)</label><input type="number" min={0} max={100} step={0.1} className="input" value={form.weight} onChange={e=>set('weight',parseFloat(e.target.value))} /></div>
            <div><label style={lbl}>Plan (%)</label><input type="number" min={0} max={100} className="input" value={form.planPct} onChange={e=>set('planPct',parseInt(e.target.value))} /></div>
            <div><label style={lbl}>Actual (%)</label><input type="number" min={0} max={100} className="input" value={form.actualPct} onChange={e=>set('actualPct',parseInt(e.target.value))} /></div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div><label style={lbl}>Status</label>
              <select className="input" value={form.status} onChange={e=>set('status',e.target.value)}>
                <option value="on_track">On Track</option>
                <option value="at_risk">At Risk</option>
                <option value="delayed">Delayed</option>
                <option value="completed">Completed</option>
              </select></div>
            <div><label style={lbl}>Tahun</label>
              <select className="input" value={form.year} onChange={e=>set('year',parseInt(e.target.value))}>
                <option value={2026}>2026</option><option value={2027}>2027</option>
              </select></div>
          </div>
        </div>
        <div style={{ padding:'12px 20px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'flex-end', gap:8 }}>
          <button onClick={onClose} className="btn">Batal</button>
          <button onClick={save} disabled={saving} className="btn btn-primary">{saving?'Menyimpan...':editing?'Simpan':'Tambah KPI'}</button>
        </div>
      </div>
    </div>
  )
}

export default function KPIPage() {
  const { data:session } = useSession(); const user = session?.user as any
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [filterCat, setFilterCat] = useState('All')

  async function load() { const d = await fetch('/api/kpi').then(r=>r.json()); setItems(d.data||[]); setLoading(false) }
  useEffect(() => { load() }, [])

  async function del(id:string) {
    if (!confirm('Hapus KPI ini?')) return
    await fetch(`/api/kpi/${id}`, { method:'DELETE' })
    toast.success('Dihapus'); load()
  }

  const filtered = filterCat==='All' ? items : items.filter(i=>i.category===filterCat)
  const totalPlan = items.reduce((s,i)=>s+i.planPct,0)
  const totalActual = items.reduce((s,i)=>s+i.actualPct,0)
  const canManage = ['admin','manager'].includes(user?.role||'')

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {(showForm||editing) && <KPIForm editing={editing} onClose={()=>{setShowForm(false);setEditing(null)}} onSave={load} />}
      <div style={{ padding:'12px 20px', borderBottom:'1px solid var(--border)', background:'var(--bg2)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div><div style={{ fontSize:14, fontWeight:600 }}>KPI Tracker 2026</div><div style={{ fontSize:11, color:'var(--text3)' }}>Strategic Initiatives & Non-SI · Hierarchy KPI tim</div></div>
        {canManage && <button className="btn btn-primary btn-sm" onClick={()=>setShowForm(true)}>+ Tambah KPI</button>}
      </div>

      {/* Summary */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, padding:'12px 20px', background:'var(--bg2)', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
        {CATS.map(c => {
          const catItems = items.filter(i=>i.category===c)
          const cfg = CAT_COLORS[c]
          const avg = catItems.length ? Math.round(catItems.reduce((s,i)=>s+i.actualPct,0)/catItems.length) : 0
          return (
            <div key={c} className="card" style={{ padding:'10px 12px', borderLeft:`3px solid ${cfg.color}` }}>
              <div style={{ fontSize:10, color:'var(--text3)', marginBottom:3 }}>{c} · {catItems.length} item</div>
              <div style={{ fontSize:18, fontWeight:700, color:cfg.color }}>{avg}%</div>
              <div className="prog-bar" style={{ marginTop:5 }}><div className="prog-fill" style={{ width:`${avg}%`, background:cfg.color }} /></div>
            </div>
          )
        })}
      </div>

      {/* Filter */}
      <div style={{ display:'flex', gap:6, padding:'10px 20px', background:'var(--bg2)', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
        {['All',...CATS].map(c => (
          <button key={c} onClick={()=>setFilterCat(c)} style={{ padding:'3px 12px', borderRadius:20, fontSize:11, fontWeight:500, cursor:'pointer', border:`1px solid ${filterCat===c?'var(--blue)':'var(--border)'}`, background:filterCat===c?'var(--bluebg)':'var(--bg3)', color:filterCat===c?'var(--blue)':'var(--text2)' }}>{c}</button>
        ))}
        <div style={{ marginLeft:'auto', fontSize:12, color:'var(--text3)' }}>{filtered.length} item</div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'16px 20px' }}>
        {loading ? <div style={{ textAlign:'center', padding:40, color:'var(--text3)' }}>Memuat...</div> : (
          filtered.length === 0 ? (
            <div style={{ textAlign:'center', padding:60, color:'var(--text3)' }}>
              <div style={{ fontSize:32, marginBottom:12 }}>🎯</div>
              <div>Belum ada KPI. Tambahkan target KPI tim!</div>
              {canManage && <button className="btn btn-primary btn-sm" style={{ marginTop:12 }} onClick={()=>setShowForm(true)}>+ Tambah KPI Pertama</button>}
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {CATS.map(cat => {
                const catItems = filtered.filter(i=>i.category===cat)
                if (catItems.length===0) return null
                const cfg = CAT_COLORS[cat]
                return (
                  <div key={cat}>
                    <div style={{ fontSize:11, fontWeight:700, color:cfg.color, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6, display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ padding:'2px 8px', borderRadius:20, background:cfg.bg, color:cfg.color, fontSize:10 }}>{cat}</span>
                      <span style={{ color:'var(--text3)', fontWeight:400 }}>{catItems.length} item</span>
                    </div>
                    {catItems.map(item => (
                      <div key={item._id} className="card fade-in" style={{ padding:'12px 16px', marginBottom:8, borderLeft:`3px solid ${cfg.color}` }}>
                        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:8 }}>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:13, fontWeight:600, color:'var(--text)', marginBottom:3 }}>{item.title}</div>
                            {item.projectName && <div style={{ fontSize:11, color:'var(--text3)' }}>📁 {item.projectName}</div>}
                            <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>👥 {item.pic?.join(', ')}</div>
                          </div>
                          <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                            <span className={`badge badge-${item.status}`}>{item.status.replace('_',' ')}</span>
                            {canManage && <>
                              <button className="btn btn-icon btn-sm" onClick={()=>setEditing(item)} style={{ fontSize:12 }}>✏️</button>
                              <button className="btn btn-icon btn-sm" onClick={()=>del(item._id)} style={{ fontSize:12 }}>🗑</button>
                            </>}
                          </div>
                        </div>
                        {/* Progress bars */}
                        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <span style={{ fontSize:10, color:'var(--text3)', width:50, textAlign:'right' }}>Plan</span>
                            <div className="prog-bar" style={{ flex:1 }}><div className="prog-fill" style={{ width:`${item.planPct}%`, background:'var(--bg5)' }} /></div>
                            <span style={{ fontSize:11, fontWeight:600, color:'var(--text2)', width:36 }}>{item.planPct}%</span>
                          </div>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <span style={{ fontSize:10, color:'var(--text3)', width:50, textAlign:'right' }}>Actual</span>
                            <div className="prog-bar" style={{ flex:1 }}>
                              <div className="prog-fill" style={{ width:`${item.actualPct}%`, background: item.actualPct>=item.planPct?'var(--green)':item.actualPct>=item.planPct*0.8?'var(--blue)':'var(--amber)' }} />
                            </div>
                            <span style={{ fontSize:11, fontWeight:700, color: item.actualPct>=item.planPct?'var(--green)':item.actualPct>=item.planPct*0.8?'var(--blue)':'var(--amber)', width:36 }}>{item.actualPct}%</span>
                          </div>
                        </div>
                        {item.weight > 0 && <div style={{ marginTop:6, fontSize:10, color:'var(--text3)' }}>Bobot: {(item.weight*100).toFixed(1)}%</div>}
                      </div>
                    ))}
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
