'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'

function MeetingForm({ editing, categories, onClose, onSave }: { editing?:any; categories:any[]; onClose:()=>void; onSave:()=>void }) {
  const { data:session } = useSession(); const user = session?.user as any
  const [form, setForm] = useState({
    title:editing?.title||'',
    category:editing?.category||categories[0]?.key||'general',
    meetingDate:editing?.meetingDate||new Date().toISOString().split('T')[0],
    notes:editing?.notes||'',
    pic:editing?.pic||user?.name||'',
    attendees:editing?.attendees?.join(', ')||'',
    picTags: editing?.picTags || [],
    categoryTags: editing?.categoryTags || [],
    tags:editing?.tags?.join(', ')||'',
  })
  const [evidenceFile, setEvidenceFile] = useState<string|null>(editing?.evidenceUrl||null)
  const [evidenceName, setEvidenceName] = useState<string>(editing?.evidenceName||'')
  const [saving, setSaving] = useState(false)
  const set = (k:string,v:any) => setForm(f=>({...f,[k]:v}))

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2*1024*1024) { toast.error('Max 2MB'); return }
    const reader = new FileReader()
    reader.onload = () => { setEvidenceFile(reader.result as string); setEvidenceName(file.name) }
    reader.readAsDataURL(file)
  }

  async function save() {
    if (!form.title || !form.meetingDate) { toast.error('Judul dan tanggal wajib'); return }
    setSaving(true)
    try {
      const url = editing ? `/api/meetings/${editing._id}` : '/api/meetings'
      const r = await fetch(url, { method:editing?'PATCH':'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          ...form,
          attendees: form.attendees.split(',').map((s:string)=>s.trim()).filter(Boolean),
          picTags: form.picTags,
          categoryTags: form.categoryTags,
          tags: form.tags.split(',').map((s:string)=>s.trim()).filter(Boolean),
          evidenceUrl: evidenceFile, evidenceName,
          authorId: user?.id || user?.email, authorName: user?.name,
        })
      })
      if (!r.ok) {
        const e = await r.json().catch(()=>({error:'Unknown error'}))
        toast.error('Gagal: ' + (e.error || r.statusText))
        return
      }
      toast.success(editing?'Diperbarui!':'Meeting report dibuat!'); onSave(); onClose()
    } catch { toast.error('Gagal') } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ width:560 }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between' }}>
          <span style={{ fontSize:14, fontWeight:600 }}>{editing?'Edit Meeting Report':'+ Meeting Report Baru'}</span>
          <button onClick={onClose} className="btn btn-icon">×</button>
        </div>
        <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:11, overflowY:'auto', maxHeight:'72vh' }}>
          <div><label style={lbl}>Judul Meeting *</label><input className="input" value={form.title} onChange={e=>set('title',e.target.value)} placeholder="cth: Weekly Review BPD" /></div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div><label style={lbl}>Kategori</label>
              <select className="input" value={form.category} onChange={e=>set('category',e.target.value)}>
                {categories.map((c:any)=><option key={c.key} value={c.key}>{c.label}</option>)}
              </select></div>
            <div><label style={lbl}>Tanggal *</label><input type="date" className="input" value={form.meetingDate} onChange={e=>set('meetingDate',e.target.value)} /></div>
          </div>
          <div><label style={lbl}>PIC</label><input className="input" value={form.pic} onChange={e=>set('pic',e.target.value)} placeholder="Nama PIC..." /></div>
          <div>
            <label style={lbl}>Peserta (pisahkan koma)</label>
            <input className="input" value={form.attendees} onChange={e=>set('attendees',e.target.value)} placeholder="Erwin, Nabila, ..." />
          </div>
          <div>
            <label style={lbl}>PIC (klik untuk tag)</label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
              {(members||[]).map((m:any) => {
                const checked = (form.picTags||[]).includes(m.name)
                return (
                  <button key={m._id} onClick={()=>set('picTags', checked ? form.picTags.filter((p:string)=>p!==m.name) : [...(form.picTags||[]), m.name])} className="btn btn-sm" style={{ background:checked?'var(--brand)':'var(--bg3)', color:checked?'#fff':'var(--text2)', borderColor:checked?'var(--brand)':'var(--border2)', fontSize:11 }}>{m.name}</button>
                )
              })}
            </div>
          </div>
          <div>
            <label style={lbl}>Kategori Activities terkait (klik untuk tag)</label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
              {(activityCats||[]).map((c:any) => {
                const checked = (form.categoryTags||[]).includes(c.key)
                return (
                  <button key={c.key} onClick={()=>set('categoryTags', checked ? form.categoryTags.filter((k:string)=>k!==c.key) : [...(form.categoryTags||[]), c.key])} className="btn btn-sm" style={{ background:checked?c.color:'var(--bg3)', color:checked?'#fff':'var(--text2)', borderColor:checked?c.color:'var(--border2)', fontSize:11 }}>{c.label}</button>
                )
              })}
            </div>
          </div>
          <div><label style={lbl}>Catatan Meeting *</label><textarea className="input" value={form.notes} onChange={e=>set('notes',e.target.value)} rows={5} placeholder="Tulis catatan meeting di sini..." style={{ resize:'vertical' }} /></div>
          <div><label style={lbl}>Evidence (Screenshot JPG/PNG)</label>
            <div style={{ border:'1px dashed var(--border2)', borderRadius:8, padding:14, textAlign:'center', cursor:'pointer' }} onClick={()=>document.getElementById('evidence-input')?.click()}>
              <input id="evidence-input" type="file" accept="image/*" style={{ display:'none' }} onChange={handleFile} />
              {evidenceFile ? (
                <div>
                  <img src={evidenceFile} alt="evidence" style={{ maxWidth:'100%', maxHeight:140, borderRadius:6, marginBottom:6 }} />
                  <div style={{ fontSize:11, color:'var(--green)' }}>✓ {evidenceName}</div>
                </div>
              ) : <div style={{ color:'var(--text3)', fontSize:12 }}>📷 Klik untuk upload screenshot evidence (max 600KB)</div>}
            </div>
          </div>
          <div><label style={lbl}>Tags (koma)</label><input className="input" value={form.tags} onChange={e=>set('tags',e.target.value)} placeholder="OnePro, follow-up..." /></div>
        </div>
        <div style={{ padding:'12px 20px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'flex-end', gap:8 }}>
          <button onClick={onClose} className="btn">Batal</button>
          <button onClick={save} disabled={saving} className="btn btn-primary">{saving?'Menyimpan...':editing?'Simpan':'Buat Report'}</button>
        </div>
      </div>
    </div>
  )
}

export default function MeetingsPage() {
  const { data:session } = useSession(); const user = session?.user as any
  const [meetings, setMeetings] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [search, setSearch] = useState('')
  const [viewing, setViewing] = useState<any>(null)

  async function load() {
    setLoading(true)
    const [m, c] = await Promise.all([
      fetch('/api/meetings').then(r=>r.json()),
      fetch('/api/config').then(r=>r.json()),
    ])
    setMeetings(m.data||[])
    setCategories(c.data?.meetingCategories?.filter((x:any)=>x.active) || [])
    setLoading(false)
  }
  useEffect(()=>{ load() }, [])

  async function del(id:string) {
    if (!confirm('Hapus meeting report?')) return
    await fetch(`/api/meetings/${id}`, { method:'DELETE' })
    toast.success('Dihapus'); load()
  }

  const filtered = meetings.filter(m => !search || m.title.toLowerCase().includes(search.toLowerCase()) || m.notes?.toLowerCase().includes(search.toLowerCase()) || m.pic?.toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {(showForm||editing) && <MeetingForm editing={editing} categories={categories} onClose={()=>{setShowForm(false);setEditing(null)}} onSave={load} />}
      {viewing && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setViewing(null)}>
          <div className="modal" style={{ width:640 }}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between' }}>
              <div>
                <div style={{ fontSize:15, fontWeight:600, color:'var(--text)' }}>{viewing.title}</div>
                <div style={{ fontSize:11, color:'var(--text3)', marginTop:3 }}>📅 {viewing.meetingDate} · 👤 {viewing.pic}</div>
              </div>
              <button onClick={()=>setViewing(null)} className="btn btn-icon">×</button>
            </div>
            <div style={{ padding:'16px 20px', overflowY:'auto', maxHeight:'70vh' }}>
              {viewing.attendees?.length > 0 && <div style={{ marginBottom:10, fontSize:11, color:'var(--text3)' }}>👥 Peserta: {viewing.attendees.join(', ')}</div>}
              <div style={{ fontSize:12, fontWeight:600, color:'var(--text2)', marginBottom:6 }}>Catatan:</div>
              <div style={{ background:'var(--bg3)', padding:'12px 14px', borderRadius:8, fontSize:12, lineHeight:1.7, color:'var(--text)', whiteSpace:'pre-wrap', marginBottom:12 }}>{viewing.notes}</div>
              {viewing.evidenceUrl && (
                <div>
                  <div style={{ fontSize:12, fontWeight:600, color:'var(--text2)', marginBottom:6 }}>Evidence:</div>
                  <img src={viewing.evidenceUrl} alt="evidence" style={{ maxWidth:'100%', borderRadius:6, border:'1px solid var(--border)' }} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div style={{ padding:'12px 20px', borderBottom:'1px solid var(--border)', background:'var(--bg2)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div><div style={{ fontSize:14, fontWeight:600 }}>Meeting Reports</div><div style={{ fontSize:11, color:'var(--text3)' }}>Catatan meeting tim — kanban view</div></div>
        <div style={{ display:'flex', gap:8 }}>
          <input className="input" style={{ width:220 }} value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Cari meeting..." />
          <button className="btn btn-primary btn-sm" onClick={()=>setShowForm(true)}>+ Meeting Report</button>
        </div>
      </div>

      <div style={{ flex:1, overflowX:'auto', overflowY:'hidden', padding:'14px 20px' }}>
        {loading ? <div style={{ textAlign:'center', padding:40, color:'var(--text3)' }}>Memuat...</div> : (
          <div style={{ display:'flex', gap:10, height:'100%' }}>
            {categories.map((cat:any) => {
              const catMeetings = filtered.filter(m => m.category === cat.key)
              return (
                <div key={cat.key} className="kanban-col" style={{ borderTop:`3px solid ${cat.color}`, height:'100%', overflowY:'auto' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12, position:'sticky', top:0, background:'var(--bg3)', paddingBottom:6 }}>
                    <span style={{ fontSize:12, fontWeight:600, color:cat.color }}>{cat.label}</span>
                    <span style={{ fontSize:10, color:'var(--text3)', background:'var(--bg4)', padding:'1px 7px', borderRadius:20 }}>{catMeetings.length}</span>
                  </div>
                  {catMeetings.map(m => (
                    <div key={m._id} className="kanban-card" onClick={()=>setViewing(m)} style={{ position:'relative' }}>
                      <div style={{ fontSize:12, fontWeight:600, color:'var(--text)', marginBottom:5, lineHeight:1.3 }}>{m.title}</div>
                      <div style={{ fontSize:10, color:'var(--text3)', marginBottom:6 }}>📅 {m.meetingDate}</div>
                      <div style={{ fontSize:11, color:'var(--text2)', marginBottom:7, lineHeight:1.4, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{m.notes}</div>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                          <div style={{ width:18, height:18, borderRadius:'50%', background:'var(--blue2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700, color:'#fff' }}>{m.pic?.[0]||'?'}</div>
                          <span style={{ fontSize:10, color:'var(--text3)' }}>{m.pic}</span>
                        </div>
                        <div style={{ display:'flex', gap:3 }}>
                          {m.evidenceUrl && <span title="Ada evidence" style={{ fontSize:11 }}>📎</span>}
                          {m.authorName === user?.name && <>
                            <button className="btn btn-icon btn-sm" onClick={(e)=>{e.stopPropagation();setEditing(m)}} style={{ fontSize:10, width:22, height:22 }}>✏️</button>
                            <button className="btn btn-icon btn-sm" onClick={(e)=>{e.stopPropagation();del(m._id)}} style={{ fontSize:10, width:22, height:22 }}>🗑</button>
                          </>}
                        </div>
                      </div>
                    </div>
                  ))}
                  {catMeetings.length === 0 && <div style={{ textAlign:'center', padding:'14px 0', color:'var(--text3)', fontSize:10 }}>Belum ada meeting</div>}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
const lbl: React.CSSProperties = { display:'block', fontSize:11, fontWeight:500, color:'var(--text2)', marginBottom:5 }
