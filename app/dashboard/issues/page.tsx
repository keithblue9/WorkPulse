'use client'
import { useEffect, useState, useRef } from 'react'
import { Issue, Initiative } from '@/types'
import toast from 'react-hot-toast'
import { useSession } from 'next-auth/react'

type ViewMode = 'table' | 'kanban' | 'timeline'

const CATEGORY_FILTERS = ['All','KPI','Non-KPI','Go-Live','Anggaran','Others']

const STATUS_LABELS: Record<string,string> = { on_track:'On Track', at_risk:'At Risk', delayed:'Delayed', completed:'Completed' }
const STATUS_COLS = ['on_track','at_risk','delayed','completed']
const STATUS_COLORS: Record<string,string> = { on_track:'var(--green)', at_risk:'var(--amber)', delayed:'var(--red)', completed:'var(--blue)' }

function IssueModal({ issue, onClose, onSave }: { issue: Issue; onClose: ()=>void; onSave: ()=>void }) {
  const { data: session } = useSession()
  const [filterCat, setFilterCat] = useState('All'); const user = session?.user as any
  const [form, setForm] = useState({ progress: issue.progress, status: issue.status, nextPlan: issue.nextPlan, dueDate: issue.dueDate, note: '' })
  const [comment, setComment] = useState(''); const [saving, setSaving] = useState(false); const [activeTab, setActiveTab] = useState<'edit'|'history'|'comments'>('edit')
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
  async function save() {
    setSaving(true)
    try {
      await fetch(`/api/issues/${issue._id}`, { method:'PATCH', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ ...form, progressNote: form.note, updatedBy: user?.name || 'User' }) })
      toast.success('Issue diperbarui!'); onSave(); onClose()
    } catch { toast.error('Gagal') } finally { setSaving(false) }
  }
  async function addComment() {
    if (!comment.trim()) return
    await fetch(`/api/issues/${issue._id}/comments`, { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ text: comment, authorId: user?.id, authorName: user?.name }) })
    setComment(''); toast.success('Komentar ditambahkan'); onSave()
  }
  const progressColor = form.progress >= 80 ? 'var(--green)' : form.progress >= 40 ? 'var(--blue)' : 'var(--amber)'
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 620 }}>
        <div style={{ padding:'18px 22px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div>
            <div style={{ fontSize:15, fontWeight:600, color:'var(--text)', marginBottom:4 }}>{issue.title}</div>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <span className={`badge badge-${issue.status}`}>{STATUS_LABELS[issue.status]}</span>
              <span style={{ fontSize:11, color:'var(--text3)' }}>PIC: {issue.picName} · Due: {issue.dueDate}</span>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-icon" style={{ fontSize:18 }}>×</button>
        </div>
        {/* Tabs */}
        <div style={{ display:'flex', borderBottom:'1px solid var(--border)', padding:'0 22px' }}>
          {(['edit','history','comments'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding:'10px 14px', background:'none', border:'none', cursor:'pointer', fontSize:12, fontWeight:500, color: activeTab === tab ? 'var(--blue)' : 'var(--text3)', borderBottom: activeTab === tab ? '2px solid var(--blue)' : '2px solid transparent', marginBottom:-1, textTransform:'capitalize' }}>{tab === 'edit' ? 'Edit' : tab === 'history' ? 'Riwayat' : 'Komentar'}</button>
          ))}
        </div>
        <div style={{ flex:1, overflow:'auto', padding:'18px 22px' }}>
          {activeTab === 'edit' && (
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div>
                <label style={{ display:'block', fontSize:12, fontWeight:500, color:'var(--text2)', marginBottom:6 }}>Progress — <span style={{ color: progressColor, fontWeight:700 }}>{form.progress}%</span></label>
                <input type="range" min={0} max={100} value={form.progress} onChange={e => set('progress', Number(e.target.value))} style={{ width:'100%', accentColor: progressColor }} />
                <div className="prog-bar" style={{ marginTop:6 }}><div className="prog-fill" style={{ width:`${form.progress}%`, background: progressColor }} /></div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div><label style={{ display:'block', fontSize:12, fontWeight:500, color:'var(--text2)', marginBottom:5 }}>Status</label>
                  <select className="input" value={form.status} onChange={e => set('status', e.target.value)}>
                    {Object.entries(STATUS_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                  </select></div>
                <div><label style={{ display:'block', fontSize:12, fontWeight:500, color:'var(--text2)', marginBottom:5 }}>Due Date</label>
                  <input type="date" className="input" value={form.dueDate} onChange={e => set('dueDate', e.target.value)} /></div>
              </div>
              <div><label style={{ display:'block', fontSize:12, fontWeight:500, color:'var(--text2)', marginBottom:5 }}>Next Plan</label>
                <textarea className="input" value={form.nextPlan} onChange={e => set('nextPlan', e.target.value)} rows={2} style={{ resize:'vertical' }} /></div>
              <div><label style={{ display:'block', fontSize:12, fontWeight:500, color:'var(--text2)', marginBottom:5 }}>Catatan update</label>
                <input className="input" value={form.note} onChange={e => set('note', e.target.value)} placeholder="Apa yang sudah dikerjakan?" /></div>
            </div>
          )}
          {activeTab === 'history' && (
            <div>
              {(!issue.progressHistory?.length) && <div style={{ textAlign:'center', padding:'24px 0', color:'var(--text3)' }}>Belum ada riwayat</div>}
              {[...( issue.progressHistory || [])].reverse().map((h,i) => (
                <div key={i} style={{ display:'flex', gap:12, padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
                  <div style={{ width:6, height:6, borderRadius:'50%', background:'var(--blue)', marginTop:5, flexShrink:0 }} />
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                      <span style={{ fontSize:12, fontWeight:600, color:'var(--blue)' }}>{h.progress}%</span>
                      <span style={{ fontSize:11, color:'var(--text3)' }}>{h.date} · {h.updatedBy}</span>
                    </div>
                    <div style={{ fontSize:12, color:'var(--text2)' }}>{h.note || '—'}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {activeTab === 'comments' && (
            <div>
              {(issue.comments || []).map((c,i) => (
                <div key={i} style={{ display:'flex', gap:10, marginBottom:14 }}>
                  <div style={{ width:28, height:28, borderRadius:'50%', background:'var(--blue2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'#fff', flexShrink:0 }}>{c.authorName?.[0] || 'U'}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:11, fontWeight:600, color:'var(--text2)', marginBottom:3 }}>{c.authorName}</div>
                    <div style={{ background:'var(--bg3)', borderRadius:8, padding:'8px 12px', fontSize:12, color:'var(--text)' }}>{c.text}</div>
                  </div>
                </div>
              ))}
              <div style={{ display:'flex', gap:8, marginTop:8 }}>
                <input className="input" value={comment} onChange={e => setComment(e.target.value)} placeholder="Tulis komentar..." onKeyDown={e => e.key === 'Enter' && addComment()} style={{ flex:1 }} />
                <button className="btn btn-primary btn-sm" onClick={addComment}>Kirim</button>
              </div>
            </div>
          )}
        </div>
        <div style={{ padding:'12px 22px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'flex-end', gap:8 }}>
          <button onClick={onClose} className="btn">Batal</button>
          <button onClick={save} disabled={saving} className="btn btn-primary">{saving ? 'Menyimpan...' : 'Simpan Perubahan'}</button>
        </div>
      </div>
    </div>
  )
}

function KanbanView({ issues, initiatives, onSelect }: { issues: Issue[]; initiatives: Initiative[]; onSelect: (i: Issue) => void }) {
  const [dragging, setDragging] = useState<string|null>(null)
  function getInitCode(id: string) { return initiatives.find(i => i._id === id)?.code || '' }
  async function drop(status: string) {
    if (!dragging) return
    await fetch(`/api/issues/${dragging}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ status }) })
    setDragging(null); toast.success('Status diperbarui')
  }
  return (
    <div style={{ display:'flex', gap:12, overflowX:'auto', padding:'16px 20px', flex:1 }}>
      {STATUS_COLS.map(col => {
        const colIssues = issues.filter(i => i.status === col)
        return (
          <div key={col} className="kanban-col" onDragOver={e => e.preventDefault()} onDrop={() => drop(col)} style={{ flexShrink:0 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <span className={`badge badge-${col}`}>{STATUS_LABELS[col]}</span>
              <span style={{ fontSize:11, color:'var(--text3)', background:'var(--bg4)', padding:'1px 7px', borderRadius:20 }}>{colIssues.length}</span>
            </div>
            {colIssues.map(issue => (
              <div key={issue._id} className="kanban-card" draggable onDragStart={() => setDragging(issue._id)} onDragEnd={() => setDragging(null)} onClick={() => onSelect(issue)} style={{ opacity: dragging === issue._id ? 0.4 : 1 }}>
                <div style={{ fontSize:10, color:'var(--text3)', marginBottom:4 }}>{getInitCode(issue.initiativeId)}</div>
                <div style={{ fontSize:12, fontWeight:500, color:'var(--text)', marginBottom:8, lineHeight:1.4 }}>{issue.title}</div>
                <div className="prog-bar" style={{ marginBottom:6 }}><div className="prog-fill" style={{ width:`${issue.progress}%`, background: issue.progress >= 80 ? 'var(--green)' : issue.progress >= 40 ? 'var(--blue)' : 'var(--amber)' }} /></div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:10, color:'var(--text3)' }}>{issue.dueDate}</span>
                  <span style={{ fontSize:10, fontWeight:600, color: issue.progress >= 80 ? 'var(--green)' : 'var(--amber)' }}>{issue.progress}%</span>
                </div>
                {issue.picName && <div style={{ marginTop:6, display:'flex', alignItems:'center', gap:5 }}><div style={{ width:18, height:18, borderRadius:'50%', background:'var(--blue2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:8, fontWeight:700, color:'#fff' }}>{issue.picName[0]}</div><span style={{ fontSize:10, color:'var(--text3)' }}>{issue.picName}</span></div>}
              </div>
            ))}
            {colIssues.length === 0 && <div style={{ textAlign:'center', padding:'20px 0', color:'var(--text3)', fontSize:11, border:'1px dashed var(--border)', borderRadius:6 }}>Drop issue di sini</div>}
          </div>
        )
      })}
    </div>
  )
}

function TimelineView({ issues, onSelect }: { issues: Issue[]; onSelect: (i: Issue) => void }) {
  const sorted = [...issues].sort((a,b) => a.dueDate?.localeCompare(b.dueDate || '') || 0)
  const today = new Date().toISOString().split('T')[0]
  return (
    <div style={{ overflowY:'auto', padding:'16px 20px', flex:1 }}>
      <div style={{ position:'relative', paddingLeft:28 }}>
        <div style={{ position:'absolute', left:11, top:0, bottom:0, width:2, background:'var(--border)' }} />
        {sorted.map((issue, i) => {
          const isOverdue = issue.dueDate < today && issue.status !== 'completed'
          const dotColor = issue.status === 'completed' ? 'var(--green)' : isOverdue ? 'var(--red)' : STATUS_COLORS[issue.status]
          return (
            <div key={issue._id} style={{ position:'relative', marginBottom:20 }} className="fade-in" style={{ animationDelay:`${i*0.04}s` }}>
              <div style={{ position:'absolute', left:-22, top:8, width:12, height:12, borderRadius:'50%', background: dotColor, border:'2px solid var(--bg2)', boxShadow:`0 0 0 3px ${dotColor}33` }} />
              <div className="card" style={{ padding:'12px 16px', cursor:'pointer', transition:'all 0.15s' }} onClick={() => onSelect(issue)}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor='var(--blue)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor='var(--border)'}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
                  <div style={{ fontSize:13, fontWeight:500, color:'var(--text)', flex:1, marginRight:10 }}>{issue.title}</div>
                  <span className={`badge badge-${issue.status}`}>{STATUS_LABELS[issue.status]}</span>
                </div>
                <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:8 }}>
                  <span style={{ fontSize:11, color: isOverdue ? 'var(--red)' : 'var(--text3)' }}>📅 {issue.dueDate}{isOverdue ? ' ⚠ Overdue' : ''}</span>
                  <span style={{ fontSize:11, color:'var(--text3)' }}>👤 {issue.picName}</span>
                </div>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <div className="prog-bar" style={{ flex:1 }}><div className="prog-fill" style={{ width:`${issue.progress}%`, background: dotColor }} /></div>
                  <span style={{ fontSize:11, fontWeight:600, color: dotColor, minWidth:32 }}>{issue.progress}%</span>
                </div>
                {issue.nextPlan && <div style={{ fontSize:11, color:'var(--text3)', marginTop:6, borderTop:'1px solid var(--border)', paddingTop:6 }}>→ {issue.nextPlan}</div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function IssuesPage() {
  const [issues, setIssues] = useState<Issue[]>([])
  const [initiatives, setInitiatives] = useState<Initiative[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Issue|null>(null)
  const [view, setView] = useState<ViewMode>('table')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPIC, setFilterPIC] = useState('')
  const [search, setSearch] = useState('')

  async function load() {
    const params = new URLSearchParams()
    if (filterStatus) params.set('status', filterStatus)
    if (filterPIC) params.set('pic', filterPIC)
    const [ii, ini] = await Promise.all([
      fetch(`/api/issues?${params}`).then(r => r.json()),
      fetch('/api/initiatives').then(r => r.json()),
    ])
    setIssues(ii.data || []); setInitiatives(ini.data || []); setLoading(false)
  }
  useEffect(() => { load() }, [filterStatus, filterPIC])

  const filtered = filteredIssues.filter(i => !search || i.title.toLowerCase().includes(search.toLowerCase()) || i.picName?.toLowerCase().includes(search.toLowerCase()))
  const getCode = (id: string) => initiatives.find(i => i._id === id)?.code || ''

  const filteredIssues = filterCat === 'All' ? issues : issues.filter((i:any) => (i.category||'Others') === filterCat || (i.subType||'') === filterCat)

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {selected && <IssueModal issue={selected} onClose={() => setSelected(null)} onSave={load} />}
      {/* Header */}
      <div style={{ padding:'12px 20px', borderBottom:'1px solid var(--border)', background:'var(--bg2)', display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
        <input className="input" style={{ width:220 }} value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Cari issue..." />
        <select className="input" style={{ width:140 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Semua Status</option>
          {Object.entries(STATUS_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input className="input" style={{ width:140 }} value={filterPIC} onChange={e => setFilterPIC(e.target.value)} placeholder="Filter PIC..." />
        <div style={{ flex:1 }} />
        {/* View switcher */}
        <div style={{ display:'flex', gap:4, background:'var(--bg3)', borderRadius:8, padding:3 }}>
          {([['table','⊟ Table'],['kanban','⊞ Kanban'],['timeline','⟳ Timeline']] as const).map(([v,l]) => (
            <button key={v} onClick={() => setView(v)} style={{ padding:'4px 12px', borderRadius:6, fontSize:12, fontWeight:500, cursor:'pointer', border:'none', background: view === v ? 'var(--bg2)' : 'transparent', color: view === v ? 'var(--text)' : 'var(--text3)', boxShadow: view === v ? 'var(--shadow-sm)' : 'none', transition:'all 0.15s' }}>{l}</button>
          ))}
        </div>
        <div style={{ fontSize:12, color:'var(--text3)' }}>{filtered.length} issue</div>
      </div>

      {/* Category filter chips */}
      <div style={{ display:'flex', gap:5, padding:'8px 20px', flexShrink:0, flexWrap:'wrap', borderBottom:'1px solid var(--border)', background:'var(--bg2)' }}>
        {CATEGORY_FILTERS.map(c => (
          <button key={c} onClick={()=>setFilterCat(c)} style={{ padding:'4px 12px', borderRadius:20, fontSize:11, fontWeight:600, cursor:'pointer', border:`1px solid ${filterCat===c?'var(--brand)':'var(--border)'}`, background:filterCat===c?'var(--brand-soft)':'var(--bg3)', color:filterCat===c?'var(--brand)':'var(--text2)' }}>{c}</button>
        ))}
      </div>

      {loading ? <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text3)' }}>Memuat...</div> : (
        <>
          {view === 'table' && (
            <div style={{ flex:1, overflowY:'auto', padding:'0 20px 16px' }}>
              <div className="card" style={{ marginTop:16, overflow:'hidden' }}>
                <table className="wp-table" style={{ width:'100%' }}>
                  <thead><tr>
                    <th style={{ width:36 }}>#</th>
                    <th>Issue</th>
                    <th style={{ width:180 }}>Progress</th>
                    <th style={{ width:200 }}>Next Plan</th>
                    <th style={{ width:110 }}>Due Date</th>
                    <th style={{ width:110 }}>Status</th>
                    <th style={{ width:120 }}>PIC</th>
                  </tr></thead>
                  <tbody>
                    {filtered.map((issue, i) => (
                      <tr key={issue._id} style={{ cursor:'pointer' }} onClick={() => setSelected(issue)}>
                        <td style={{ color:'var(--text3)', fontSize:11 }}>{i+1}</td>
                        <td>
                          <div style={{ fontSize:10, color:'var(--text3)', marginBottom:2 }}>[{getCode(issue.initiativeId)}]</div>
                          <div style={{ fontSize:12, fontWeight:500, color:'var(--text)' }}>{issue.title}</div>
                          {issue.progressHistory?.slice(-1)[0] && <div style={{ fontSize:10, color:'var(--text3)', marginTop:2 }}>↻ {issue.progressHistory.slice(-1)[0].date}</div>}
                        </td>
                        <td>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <div className="prog-bar" style={{ flex:1 }}><div className="prog-fill" style={{ width:`${issue.progress}%`, background: issue.progress>=80?'var(--green)':issue.progress>=40?'var(--blue)':'var(--amber)' }} /></div>
                            <span style={{ fontSize:11, fontWeight:600, color:'var(--text2)', minWidth:28 }}>{issue.progress}%</span>
                          </div>
                        </td>
                        <td style={{ fontSize:11 }}>{issue.nextPlan}</td>
                        <td style={{ fontSize:11, fontWeight:500, color: issue.dueDate < new Date().toISOString().split('T')[0] && issue.status !== 'completed' ? 'var(--red)' : 'var(--text2)' }}>{issue.dueDate}</td>
                        <td><span className={`badge badge-${issue.status}`}>{STATUS_LABELS[issue.status]}</span></td>
                        <td>
                          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                            <div style={{ width:22, height:22, borderRadius:'50%', background:'var(--blue2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700, color:'#fff' }}>{issue.picName?.[0]}</div>
                            <span style={{ fontSize:11 }}>{issue.picName}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {view === 'kanban' && <KanbanView issues={filtered} initiatives={initiatives} onSelect={setSelected} />}
          {view === 'timeline' && <TimelineView issues={filtered} onSelect={setSelected} />}
        </>
      )}
    </div>
  )
}
