'use client'
import { useEffect, useState } from 'react'
import { DashboardStats, Initiative } from '@/types'
import toast from 'react-hot-toast'

function DonutChart({ pct, color, size = 90 }: { pct: number; color: string; size?: number }) {
  const r = size * 0.4
  const circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#252b3d" strokeWidth={size*0.11} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={size*0.11}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
    </svg>
  )
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [initiatives, setInitiatives] = useState<Initiative[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [s, i] = await Promise.all([
          fetch('/api/dashboard').then(r => r.json()),
          fetch('/api/initiatives').then(r => r.json()),
        ])
        setStats(s.data)
        setInitiatives(i.data || [])
      } catch {
        toast.error('Gagal memuat data')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const donutColor = (status: string) => status === 'at_risk' || status === 'delayed' ? '#f59e0b' : '#4f8ef7'

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Topbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Dashboard</div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>Last updated: 4 Mei 2026 · M6 Mid Year Review</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={btnStyle}>⊞ Filter</button>
          <button style={btnStyle}>↓ Export</button>
          <button style={primaryBtnStyle} onClick={() => toast.success('Fitur ini tersedia di versi production')}>+ Tambah Issue</button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>Memuat data...</div>
        ) : (
          <>
            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
              {[
                { label: 'Total Initiatives', value: stats?.totalInitiatives ?? 0, sub: 'Strategic Initiatives aktif', color: 'var(--blue)', pct: 100 },
                { label: 'Avg Progress', value: `${stats?.avgProgress ?? 0}%`, sub: 'Target M6: 50%', color: 'var(--amber)', pct: stats?.avgProgress ?? 0 },
                { label: 'On Track', value: stats?.onTrackCount ?? 0, sub: 'Sesuai rencana', color: 'var(--green)', pct: ((stats?.onTrackCount ?? 0) / (stats?.totalInitiatives || 1)) * 100 },
                { label: 'At Risk / Delayed', value: stats?.atRiskCount ?? 0, sub: 'Perlu perhatian', color: 'var(--red)', pct: ((stats?.atRiskCount ?? 0) / (stats?.totalInitiatives || 1)) * 100 },
              ].map((k) => (
                <div key={k.label} style={cardStyle}>
                  <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{k.label}</div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: k.color }}>{k.value}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{k.sub}</div>
                  <div style={{ height: 3, background: 'var(--bg4)', borderRadius: 2, marginTop: 10, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${k.pct}%`, background: k.color, borderRadius: 2, transition: 'width 0.8s ease' }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Donut charts */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
              {initiatives.map((ini) => (
                <div key={ini._id} style={{ ...cardStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 16px' }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', marginBottom: 12, lineHeight: 1.4, fontWeight: 500 }}>
                    {ini.code} — {ini.title.split('(')[0].trim()}
                  </div>
                  <div style={{ position: 'relative', width: 100, height: 100, marginBottom: 12 }}>
                    <DonutChart pct={ini.actualProgress} color={donutColor(ini.status)} size={100} />
                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center' }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: donutColor(ini.status) }}>{ini.actualProgress}%</div>
                      <div style={{ fontSize: 9, color: 'var(--text3)' }}>plan {ini.planProgress}%</div>
                    </div>
                  </div>
                  <div style={{ width: '100%' }}>
                    {ini.phases.slice(0, 4).map((p) => (
                      <div key={p._id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4, color: 'var(--text2)' }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>{p.name}</span>
                        <span style={{ fontWeight: 600, color: p.actualPct >= 100 ? 'var(--green)' : p.actualPct > 0 ? 'var(--amber)' : 'var(--text3)', flexShrink: 0 }}>{p.actualPct}%</span>
                      </div>
                    ))}
                  </div>
                  <span style={{ marginTop: 8, padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }} className={`badge-${ini.status}`}>
                    {ini.status === 'on_track' ? 'On Track' : ini.status === 'at_risk' ? 'At Risk' : ini.status === 'delayed' ? 'Delayed' : 'Completed'}
                  </span>
                </div>
              ))}
            </div>

            {/* Bottom grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {/* Workload */}
              <div style={cardStyle}>
                <div style={secTitle}>◕ Workload per PIC</div>
                {stats?.workloadByPic.map((w) => (
                  <div key={w.name} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <div style={{ fontSize: 11, color: 'var(--text2)', width: 80, textAlign: 'right', flexShrink: 0 }}>{w.name}</div>
                    <div style={{ flex: 1, height: 20, background: 'var(--bg4)', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                      <div style={{ height: '100%', width: `${(w.count / (stats.totalInitiatives || 1)) * 100}%`, background: w.color, borderRadius: 4, display: 'flex', alignItems: 'center', paddingLeft: 6 }}>
                        <span style={{ fontSize: 10, fontWeight: 600, color: '#fff' }}>{w.count} SI</span>
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', width: 20, flexShrink: 0 }}>{w.count}</div>
                  </div>
                ))}
              </div>

              {/* Overdue */}
              <div style={cardStyle}>
                <div style={secTitle}>⚠ Items Perlu Perhatian</div>
                {stats?.overdueItems.length === 0 && (
                  <div style={{ color: 'var(--text3)', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>Semua item on track ✓</div>
                )}
                {stats?.overdueItems.map((item) => (
                  <div key={item.issueId} style={{ display: 'flex', gap: 10, padding: '8px 10px', background: 'var(--bg3)', borderRadius: 6, borderLeft: `3px solid ${item.gap > 30 ? 'var(--red)' : 'var(--amber)'}`, marginBottom: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.issueTitle}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>Actual {item.actualPct}% vs Plan {item.planPct}% · PIC: {item.pic}</div>
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: item.gap > 30 ? 'var(--red)' : 'var(--amber)', flexShrink: 0 }}>-{item.gap}%</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const cardStyle: React.CSSProperties = { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }
const secTitle: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }
const btnStyle: React.CSSProperties = { padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: '1px solid var(--border2)', background: 'var(--bg3)', color: 'var(--text2)' }
const primaryBtnStyle: React.CSSProperties = { ...btnStyle, background: 'var(--blue)', borderColor: 'var(--blue)', color: '#fff' }
