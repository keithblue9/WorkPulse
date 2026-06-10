'use client'
import { useEffect, useState } from 'react'
import { Issue, Initiative } from '@/types'
import toast from 'react-hot-toast'
import { useSession } from 'next-auth/react'

const STATUS_LABELS: Record<string, string> = { on_track: 'On Track', at_risk: 'At Risk', delayed: 'Delayed', completed: 'Completed' }
const STATUS_COLORS: Record<string, string> = { on_track: 'var(--green)', at_risk: 'var(--amber)', delayed: 'var(--red)', completed: 'var(--blue)' }

function IssueModal({ issue, onClose, onSave }: { issue: Issue; onClose: () => void; onSave: () => void }) {
  const { data: session } = useSession()
  const user = session?.user as any
  const [progress, setProgress] = useState(issue.progress)
  const [status, setStatus] = useState(issue.status)
  const [nextPlan, setNextPlan] = useState(issue.nextPlan)
  const [dueDate, setDueDate] = useState(issue.dueDate)
  const [progressNote, setProgressNote] = useState('')
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      await fetch(`/api/issues/${issue._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ progress, status, nextPlan, dueDate, progressNote, updatedBy: user?.name || 'User' }),
      })
      toast.success('Issue updated!')
      onSave()
      onClose()
    } catch { toast.error('Gagal menyimpan') }
    finally { setSaving(false) }
  }

  async function addComment() {
    if (!comment.trim()) return
    await fetch(`/api/issues/${issue._id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: comment, authorId: user?.id, authorName: user?.name }),
    })
    setComment('')
    toast.success('Komentar ditambahkan')
    onSave()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, width: 580, maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{issue.title}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>PIC: {issue.picName} · Due: {issue.dueDate}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
          {/* Progress */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Progress (%)</label>
            <input type="range" min={0} max={100} value={progress} onChange={e => setProgress(Number(e.target.value))}
              style={{ width: '100%', marginBottom: 4 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)' }}>
              <span>0%</span><span style={{ fontWeight: 700, color: 'var(--amber)', fontSize: 14 }}>{progress}%</span><span>100%</span>
            </div>
          </div>

          {/* Status */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Status</label>
            <select value={status} onChange={e => setStatus(e.target.value as any)} style={inputStyle}>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>

          {/* Next plan */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Next Plan</label>
            <textarea value={nextPlan} onChange={e => setNextPlan(e.target.value)} rows={2}
              style={{ ...inputStyle, resize: 'vertical' as const }} />
          </div>

          {/* Due date */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Due Date</label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={inputStyle} />
          </div>

          {/* Progress note */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Catatan update progress</label>
            <input value={progressNote} onChange={e => setProgressNote(e.target.value)} placeholder="Apa yang sudah dikerjakan?"
              style={inputStyle} />
          </div>

          {/* History */}
          {issue.progressHistory?.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>History Progress</div>
              {[...issue.progressHistory].reverse().slice(0, 5).map((h, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, padding: '6px 10px', background: 'var(--bg3)', borderRadius: 6, marginBottom: 6, fontSize: 12 }}>
                  <span style={{ color: 'var(--text3)', flexShrink: 0 }}>{h.date}</span>
                  <span style={{ color: 'var(--amber)', fontWeight: 600, flexShrink: 0 }}>{h.progress}%</span>
                  <span style={{ color: 'var(--text2)' }}>{h.note}</span>
                  <span style={{ color: 'var(--text3)', marginLeft: 'auto', flexShrink: 0 }}>{h.updatedBy}</span>
                </div>
              ))}
            </div>
          )}

          {/* Comments */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>Komentar</div>
            {issue.comments?.slice(-5).map((c) => (
              <div key={c._id} style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--blue2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                  {c.authorName?.[0] || 'U'}
                </div>
                <div style={{ flex: 1, background: 'var(--bg3)', borderRadius: 6, padding: '6px 10px' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 2 }}>{c.authorName}</div>
                  <div style={{ fontSize: 12, color: 'var(--text)' }}>{c.text}</div>
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={comment} onChange={e => setComment(e.target.value)} placeholder="Tulis komentar..." onKeyDown={e => e.key === 'Enter' && addComment()}
                style={{ ...inputStyle, flex: 1 }} />
              <button onClick={addComment} style={{ ...saveBtnStyle, padding: '8px 14px', flexShrink: 0 }}>Kirim</button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={cancelBtnStyle}>Batal</button>
          <button onClick={save} disabled={saving} style={saveBtnStyle}>{saving ? 'Menyimpan...' : 'Simpan'}</button>
        </div>
      </div>
    </div>
  )
}

export default function IssuesPage() {
  const [issues, setIssues] = useState<Issue[]>([])
  const [initiatives, setInitiatives] = useState<Initiative[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Issue | null>(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPIC, setFilterPIC] = useState('')

  async function load() {
    const params = new URLSearchParams()
    if (filterStatus) params.set('status', filterStatus)
    if (filterPIC) params.set('pic', filterPIC)
    const [i, ini] = await Promise.all([
      fetch(`/api/issues?${params}`).then(r => r.json()),
      fetch('/api/initiatives').then(r => r.json()),
    ])
    setIssues(i.data || [])
    setInitiatives(ini.data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [filterStatus, filterPIC])

  function getInitiativeTitle(id: string) {
    const ini = initiatives.find(i => i._id === id)
    return ini ? `[${ini.code}]` : ''
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {selected && <IssueModal issue={selected} onClose={() => setSelected(null)} onSave={load} />}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Issue Summary</div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>Summary Strategic Initiatives — All Issues</div>
        </div>
        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 11, color: 'var(--text3)' }}>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLORS[k], display: 'inline-block' }} />{v}
            </span>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, padding: '10px 24px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...inputStyle, width: 160 }}>
          <option value="">Semua Status</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input value={filterPIC} onChange={e => setFilterPIC(e.target.value)} placeholder="Filter PIC..." style={{ ...inputStyle, width: 160 }} />
        <button onClick={load} style={btnStyle}>↻ Refresh</button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }}>
        {loading ? <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>Memuat...</div> : (
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            {/* Table header */}
            <div style={{ display: 'grid', gridTemplateColumns: '40px 200px 1fr 200px 120px 100px 160px', background: 'var(--bg3)', borderBottom: '1px solid var(--border)' }}>
              {['No', 'Critical Issue', 'Progress', 'Next Plan', 'Due Date', 'Status', 'PIC'].map((h, i) => (
                <div key={h} style={{ padding: '8px 10px', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', borderRight: i < 6 ? '1px solid var(--border)' : 'none' }}>{h}</div>
              ))}
            </div>

            {issues.length === 0 && (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)', fontSize: 13 }}>Tidak ada issue ditemukan</div>
            )}

            {issues.map((issue, idx) => (
              <div key={issue._id}
                style={{ display: 'grid', gridTemplateColumns: '40px 200px 1fr 200px 120px 100px 160px', borderBottom: '1px solid var(--border)', cursor: 'pointer', background: 'var(--bg2)', transition: 'background 0.1s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg2)')}
                onClick={() => setSelected(issue)}>
                <div style={{ padding: '10px', fontSize: 12, color: 'var(--text3)', fontWeight: 600, borderRight: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start' }}>{idx + 1}</div>
                <div style={{ padding: '10px', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 2 }}>{getInitiativeTitle(issue.initiativeId)}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3 }}>{issue.title}</div>
                </div>
                <div style={{ padding: '10px', borderRight: '1px solid var(--border)', display: 'flex', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    {issue.progressHistory?.slice(-3).map((h, i) => (
                      <div key={i} style={{ display: 'flex', gap: 6, fontSize: 11, color: 'var(--text3)', marginBottom: 3, alignItems: 'flex-start' }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: i === issue.progressHistory.length - 1 ? 'var(--blue)' : 'var(--text3)', marginTop: 4, flexShrink: 0 }} />
                        <span style={{ color: i === issue.progressHistory.length - 1 ? 'var(--text2)' : 'var(--text3)', fontWeight: i === issue.progressHistory.length - 1 ? 600 : 400 }}>
                          {h.date}: {h.note} ({h.progress}%)
                        </span>
                      </div>
                    ))}
                    {(!issue.progressHistory || issue.progressHistory.length === 0) && (
                      <span style={{ fontSize: 11, color: 'var(--text3)' }}>Belum ada update</span>
                    )}
                    <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ flex: 1, height: 4, background: 'var(--bg4)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${issue.progress}%`, background: issue.progress >= 80 ? 'var(--green)' : issue.progress >= 40 ? 'var(--amber)' : 'var(--text3)', borderRadius: 2 }} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', minWidth: 30 }}>{issue.progress}%</span>
                    </div>
                  </div>
                </div>
                <div style={{ padding: '10px', borderRight: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start' }}>
                  <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>{issue.nextPlan}</div>
                </div>
                <div style={{ padding: '10px', borderRight: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>{issue.dueDate}</span>
                </div>
                <div style={{ padding: '10px', borderRight: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start' }}>
                  <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600 }} className={`badge-${issue.status}`}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'inline-block', marginRight: 4 }} />
                    {STATUS_LABELS[issue.status]}
                  </span>
                </div>
                <div style={{ padding: '10px', display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', gap: 4 }}>
                  <span style={{ background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 20, padding: '2px 8px', fontSize: 11, color: 'var(--text2)' }}>{issue.picName || issue.pic}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 5, fontWeight: 500 }
const inputStyle: React.CSSProperties = { width: '100%', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 7, padding: '8px 10px', color: 'var(--text)', fontSize: 13, outline: 'none' }
const btnStyle: React.CSSProperties = { padding: '7px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: '1px solid var(--border2)', background: 'var(--bg3)', color: 'var(--text2)' }
const cancelBtnStyle: React.CSSProperties = { ...btnStyle }
const saveBtnStyle: React.CSSProperties = { ...btnStyle, background: 'var(--blue)', borderColor: 'var(--blue)', color: '#fff' }
