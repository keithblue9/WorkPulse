'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { AttendanceRecord, AttendanceType, AppConfig } from '@/types'
import toast from 'react-hot-toast'
import { format, getDaysInMonth, getDay, startOfMonth } from 'date-fns'

const TEAM = [
  { id: 'mas-e', name: 'Mas E', division: 'BPD Proc', color: '#2563d4' },
  { id: 'rina-s', name: 'Rina S', division: 'SS Proc', color: '#7c3aed' },
  { id: 'budi-h', name: 'Budi H', division: 'TnD', color: '#0d9488' },
  { id: 'dewi-p', name: 'Dewi P', division: 'EIT', color: '#d97706' },
  { id: 'adi-k', name: 'Adi K', division: 'PMO', color: '#16a34a' },
]

export default function AttendancePage() {
  const { data: session } = useSession()
  const user = session?.user as any
  const [month, setMonth] = useState(() => format(new Date(), 'yyyy-MM'))
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [summary, setSummary] = useState<any>(null)
  const [selectedUserId, setSelectedUserId] = useState('mas-e')
  const [hoveredDay, setHoveredDay] = useState<number | null>(null)
  const [contextMenu, setContextMenu] = useState<{ day: number; x: number; y: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [cfg, att, sum] = await Promise.all([
        fetch('/api/config').then(r => r.json()),
        fetch(`/api/attendance?userId=${selectedUserId}&month=${month}`).then(r => r.json()),
        fetch(`/api/attendance/summary?month=${month}`).then(r => r.json()),
      ])
      setConfig(cfg.data)
      setRecords(att.data || [])
      setSummary(sum.data)
      setLoading(false)
    }
    load()
  }, [month, selectedUserId])

  const attTypes: AttendanceType[] = config?.attendanceTypes?.filter(t => t.active) || [
    { key: 'wfo', label: 'WFO', color: '#1a2d4a', textColor: '#4f8ef7', active: true },
    { key: 'wfh', label: 'WFH', color: '#1e1630', textColor: '#a78bfa', active: true },
    { key: 'dinas', label: 'Dinas Luar', color: '#2a1f0a', textColor: '#f59e0b', active: true },
    { key: 'cuti', label: 'Cuti', color: '#142a1e', textColor: '#22c55e', active: true },
    { key: 'sakit', label: 'Sakit', color: '#2a1010', textColor: '#ef4444', active: true },
    { key: 'izin', label: 'Izin', color: '#1a1a2a', textColor: '#9da3b8', active: true },
  ]

  function getRecord(day: number) {
    const dateStr = `${month}-${String(day).padStart(2, '0')}`
    return records.find(r => r.date === dateStr)
  }

  async function setAttendance(day: number, typeKey: string) {
    const dateStr = `${month}-${String(day).padStart(2, '0')}`
    const typeDef = attTypes.find(t => t.key === typeKey)
    await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: selectedUserId, date: dateStr, type: typeKey }),
    })
    setRecords(prev => {
      const filtered = prev.filter(r => r.date !== dateStr)
      return [...filtered, { _id: dateStr, userId: selectedUserId, date: dateStr, type: typeKey, createdAt: '' }]
    })
    setContextMenu(null)
    toast.success(`${dateStr}: ${typeDef?.label}`)
  }

  async function clearAttendance(day: number) {
    const dateStr = `${month}-${String(day).padStart(2, '0')}`
    await fetch(`/api/attendance?userId=${selectedUserId}&date=${dateStr}`, { method: 'DELETE' })
    setRecords(prev => prev.filter(r => r.date !== dateStr))
    setContextMenu(null)
    toast.success('Absensi dihapus')
  }

  const daysInMonth = getDaysInMonth(new Date(month + '-01'))
  const firstDayDow = (getDay(startOfMonth(new Date(month + '-01'))) + 6) % 7 // Mon=0
  const today = format(new Date(), 'yyyy-MM-dd')
  const DAY_LABELS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']

  const [prevM, nextM] = (() => {
    const d = new Date(month + '-01')
    const p = new Date(d); p.setMonth(p.getMonth() - 1)
    const n = new Date(d); n.setMonth(n.getMonth() + 1)
    return [format(p, 'yyyy-MM'), format(n, 'yyyy-MM')]
  })()

  // Compute monthly counts
  const typeCounts = attTypes.map(t => ({ ...t, count: records.filter(r => r.type === t.key).length }))

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={() => setContextMenu(null)}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Absensi Harian</div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>Klik tanggal untuk set kehadiran</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setMonth(prevM)} style={btnStyle}>◀ Prev</button>
          <span style={{ padding: '6px 14px', background: 'var(--bg3)', borderRadius: 6, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{month}</span>
          <button onClick={() => setMonth(nextM)} style={btnStyle}>Next ▶</button>
        </div>
      </div>

      {contextMenu && (
        <div style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y, background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, zIndex: 100, minWidth: 160, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
          onClick={e => e.stopPropagation()}>
          <div style={{ padding: '8px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text3)', borderBottom: '1px solid var(--border)' }}>
            {month}-{String(contextMenu.day).padStart(2,'0')}
          </div>
          {attTypes.map(t => (
            <div key={t.key} onClick={() => setAttendance(contextMenu.day, t.key)}
              style={{ padding: '8px 14px', cursor: 'pointer', fontSize: 12, color: t.textColor, display: 'flex', alignItems: 'center', gap: 8 }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg4)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: t.textColor, display: 'inline-block' }} />
              {t.label}
            </div>
          ))}
          <div onClick={() => clearAttendance(contextMenu.day)}
            style={{ padding: '8px 14px', cursor: 'pointer', fontSize: 12, color: 'var(--text3)', borderTop: '1px solid var(--border)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg4)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            ✕ Hapus
          </div>
        </div>
      )}

      <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16 }}>
          {/* Calendar */}
          <div>
            {/* User selector */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              {TEAM.map(m => (
                <button key={m.id} onClick={() => setSelectedUserId(m.id)}
                  style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: `1px solid ${selectedUserId === m.id ? m.color : 'var(--border)'}`, background: selectedUserId === m.id ? m.color + '33' : 'var(--bg3)', color: selectedUserId === m.id ? m.color : 'var(--text2)' }}>
                  {m.name}
                </button>
              ))}
            </div>

            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
              {/* Day labels */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 8 }}>
                {DAY_LABELS.map(d => (
                  <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--text3)', padding: '4px 0' }}>{d}</div>
                ))}
              </div>

              {/* Days grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
                {Array.from({ length: firstDayDow }).map((_, i) => <div key={`e${i}`} />)}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1
                  const dow = (firstDayDow + i) % 7
                  const isWeekend = dow >= 5
                  const rec = getRecord(day)
                  const typeDef = rec ? attTypes.find(t => t.key === rec.type) : null
                  const dateStr = `${month}-${String(day).padStart(2, '0')}`
                  const isToday = dateStr === today
                  return (
                    <div key={day}
                      onContextMenu={e => { e.preventDefault(); setContextMenu({ day, x: e.clientX, y: e.clientY }) }}
                      onClick={e => { e.stopPropagation(); setContextMenu({ day, x: e.clientX - 20, y: e.clientY + 8 }) }}
                      onMouseEnter={() => setHoveredDay(day)}
                      onMouseLeave={() => setHoveredDay(null)}
                      title={typeDef?.label || 'Klik untuk set kehadiran'}
                      style={{
                        height: 38, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: isToday ? 700 : 400, cursor: 'pointer',
                        background: typeDef ? typeDef.color : isWeekend ? 'var(--bg3)' : 'var(--bg4)',
                        color: typeDef ? typeDef.textColor : isWeekend ? 'var(--text3)' : 'var(--text2)',
                        border: isToday ? '2px solid var(--blue)' : `1px solid ${typeDef ? typeDef.textColor + '44' : 'var(--border)'}`,
                        opacity: isWeekend && !typeDef ? 0.5 : 1,
                        transform: hoveredDay === day ? 'scale(1.05)' : 'scale(1)',
                        transition: 'all 0.1s',
                      }}>
                      {typeDef ? <div style={{ textAlign: 'center' }}><div style={{ fontSize: 10, lineHeight: 1 }}>{day}</div><div style={{ fontSize: 9, lineHeight: 1 }}>{typeDef.label.slice(0, 3)}</div></div> : day}
                    </div>
                  )
                })}
              </div>

              {/* Legend */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                {attTypes.map(t => (
                  <div key={t.key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text2)' }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: t.textColor }} />
                    {t.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Monthly summary for selected user */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginTop: 12 }}>
              {typeCounts.filter(t => t.count > 0).map(t => (
                <div key={t.key} style={{ background: t.color, border: `1px solid ${t.textColor}44`, borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: t.textColor }}>{t.count}</div>
                  <div style={{ fontSize: 11, color: t.textColor, opacity: 0.8 }}>{t.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Team summary */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>Rekap Tim — {month}</div>
              {TEAM.map(m => {
                const memberSummary = summary?.summary?.find((s: any) => s.name === m.name)
                const wfo = memberSummary?.counts?.wfo || 0
                const total = memberSummary?.total || 0
                const pct = total > 0 ? Math.round((wfo / 22) * 100) : 0
                const todayRec = records.find(r => r.userId === m.id && r.date === today)
                const todayType = attTypes.find(t => t.key === todayRec?.type)
                return (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                      {m.name.split(' ').map((x: string) => x[0]).join('')}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>{m.name}</span>
                        {todayType && <span style={{ fontSize: 10, fontWeight: 600, color: todayType.textColor }}>Hari ini: {todayType.label}</span>}
                      </div>
                      <div style={{ height: 5, background: 'var(--bg4)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: m.color, borderRadius: 3 }} />
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>
                        WFO: {wfo}h · Total: {total}h · {pct}%
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Team-level donut */}
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>Summary Kehadiran Tim</div>
              {attTypes.map(t => {
                const cnt = summary?.teamCounts?.[t.key] || 0
                const total = Object.values(summary?.teamCounts || {}).reduce((a: number, b: any) => a + b, 0) as number
                const pct = total > 0 ? Math.round((cnt / total) * 100) : 0
                return (
                  <div key={t.key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div style={{ fontSize: 11, color: 'var(--text2)', width: 70, textAlign: 'right', flexShrink: 0 }}>{t.label}</div>
                    <div style={{ flex: 1, height: 16, background: 'var(--bg4)', borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: t.textColor, borderRadius: 3, display: 'flex', alignItems: 'center', paddingLeft: 6 }}>
                        {pct > 10 && <span style={{ fontSize: 9, fontWeight: 700, color: '#000', opacity: 0.7 }}>{pct}%</span>}
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', width: 20, flexShrink: 0 }}>{cnt}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const btnStyle: React.CSSProperties = { padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: '1px solid var(--border2)', background: 'var(--bg3)', color: 'var(--text2)' }
