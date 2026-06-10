'use client'
import { useEffect, useState } from 'react'
import { Initiative } from '@/types'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts'

export default function InfographPage() {
  const [initiatives, setInitiatives] = useState<Initiative[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/initiatives').then(r => r.json()).then(d => {
      setInitiatives(d.data || [])
      setLoading(false)
    })
  }, [])

  const COLORS = ['#4f8ef7', '#f59e0b', '#22c55e', '#a78bfa', '#ef4444', '#2dd4bf']

  // Gantt progress comparison data
  const ganttData = initiatives.map(ini => ({
    name: ini.code,
    Plan: ini.planProgress,
    Actual: ini.actualProgress,
  }))

  // Phase completion across all initiatives
  const phaseNames = [...new Set(initiatives.flatMap(i => i.phases.map(p => p.name)))]
  const phaseData = initiatives.flatMap(i => i.phases.map(p => ({
    initiative: i.code,
    phase: p.name.length > 20 ? p.name.slice(0, 20) + '…' : p.name,
    plan: p.planPct,
    actual: p.actualPct,
    status: p.status,
  })))

  // All milestones across all initiatives, sorted
  const allMilestones = initiatives.flatMap(ini =>
    ini.milestones.map(m => ({ ...m, initiativeCode: ini.code, initiativeTitle: ini.title }))
  ).sort((a, b) => (a.targetDate || '').localeCompare(b.targetDate || ''))

  const statusColor: Record<string, string> = { done: 'var(--green)', pending: 'var(--text3)', delayed: 'var(--red)' }

  function DonutChart({ pct, color, label }: { pct: number; color: string; label: string }) {
    const r = 48
    const circ = 2 * Math.PI * r
    const offset = circ - (pct / 100) * circ
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <svg viewBox="0 0 120 120" width={120} height={120}>
          <circle cx={60} cy={60} r={r} fill="none" stroke="#252b3d" strokeWidth={12} />
          <circle cx={60} cy={60} r={r} fill="none" stroke={color} strokeWidth={12}
            strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
            transform="rotate(-90 60 60)" style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
          <text x={60} y={55} textAnchor="middle" fontSize={22} fontWeight={700} fill={color}>{pct}%</text>
          <text x={60} y={72} textAnchor="middle" fontSize={10} fill="#6b7190">actual</text>
        </svg>
        <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', lineHeight: 1.4 }}>{label}</div>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Infografis Progress</div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>Visual summary semua Strategic Initiatives</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={btnStyle}>Bulan Ini</button>
          <button style={btnStyle}>Q2</button>
          <button style={{ ...btnStyle, background: 'var(--blue)', borderColor: 'var(--blue)', color: '#fff' }} onClick={() => window.print()}>↓ Export</button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        {loading ? <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>Memuat...</div> : (
          <>
            {/* Donut row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
              {initiatives.map((ini, i) => (
                <div key={ini._id} style={cardStyle}>
                  <DonutChart pct={ini.actualProgress} color={COLORS[i]} label={ini.title.split('(')[0].trim()} />
                  <div style={{ width: '100%', marginTop: 12 }}>
                    {ini.phases.map(p => (
                      <div key={p._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                        <span style={{ fontSize: 11, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }}>{p.name}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: p.actualPct >= 100 ? 'var(--green)' : p.actualPct > 0 ? 'var(--amber)' : 'var(--text3)', flexShrink: 0 }}>{p.actualPct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Bar chart: Plan vs Actual */}
            <div style={{ ...cardStyle, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>Plan vs Actual Progress — Per Initiative</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={ganttData} barGap={4} barCategoryGap="30%">
                  <XAxis dataKey="name" tick={{ fill: '#9da3b8', fontSize: 12 }} axisLine={{ stroke: '#2e3550' }} tickLine={false} />
                  <YAxis tick={{ fill: '#9da3b8', fontSize: 11 }} axisLine={{ stroke: '#2e3550' }} tickLine={false} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                  <Tooltip contentStyle={{ background: '#1e2335', border: '1px solid #2e3550', borderRadius: 8, fontSize: 12 }} formatter={(v: number) => `${v}%`} />
                  <Bar dataKey="Plan" fill="#1e3a6e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Actual" fill="#4f8ef7" radius={[4, 4, 0, 0]} />
                  <Legend wrapperStyle={{ fontSize: 12, color: '#9da3b8' }} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Phase details bar chart */}
            <div style={{ ...cardStyle, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>Detail Progress per Phase</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {phaseData.slice(0, 12).map((p, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ fontSize: 10, color: 'var(--text3)', width: 50, textAlign: 'right', flexShrink: 0 }}>[{p.initiative}]</div>
                    <div style={{ fontSize: 11, color: 'var(--text2)', width: 200, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.phase}</div>
                    <div style={{ flex: 1, position: 'relative', height: 20, background: 'var(--bg4)', borderRadius: 4, overflow: 'hidden' }}>
                      {/* Plan bar (lighter) */}
                      <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${p.plan}%`, background: '#1e3a6e', borderRadius: 4 }} />
                      {/* Actual bar (on top) */}
                      <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${p.actual}%`, background: p.actual >= 100 ? 'var(--green)' : p.actual > 0 ? 'var(--amber)' : 'transparent', borderRadius: 4, transition: 'width 0.6s ease' }}>
                        {p.actual > 10 && <span style={{ position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)', fontSize: 10, fontWeight: 700, color: '#000', opacity: 0.8 }}>{p.actual}%</span>}
                      </div>
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text3)', width: 50, flexShrink: 0 }}>P:{p.plan}%</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 11, color: 'var(--text3)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 12, height: 8, background: '#1e3a6e', borderRadius: 2, display: 'inline-block' }} />Plan</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 12, height: 8, background: 'var(--amber)', borderRadius: 2, display: 'inline-block' }} />Actual</span>
              </div>
            </div>

            {/* Milestone timeline */}
            <div style={cardStyle}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 14 }}>Milestone Timeline — All Initiatives</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {allMilestones.map((m, i) => (
                  <div key={i} style={{ display: 'flex', gap: 14, paddingBottom: 12, borderBottom: i < allMilestones.length - 1 ? '1px solid var(--border)' : 'none', paddingTop: 12, alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 12, flexShrink: 0 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', border: `2px solid ${statusColor[m.status] || 'var(--text3)'}`, background: m.status === 'done' ? 'var(--greenbg)' : 'transparent', flexShrink: 0 }} />
                      {i < allMilestones.length - 1 && <div style={{ width: 1, flex: 1, background: 'var(--border)', marginTop: 3, minHeight: 20 }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', marginBottom: 3 }}>{m.title}</div>
                      <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text3)', flexWrap: 'wrap' }}>
                        <span>📅 {m.targetDate}</span>
                        <span style={{ color: 'var(--blue)' }}>[ {m.initiativeCode} ]</span>
                        <span style={{ color: statusColor[m.status], fontWeight: 600 }}>
                          {m.status === 'done' ? '✓ Selesai' : m.status === 'delayed' ? '⚠ Delayed' : '○ Planned'}
                        </span>
                        {m.actualDate && <span style={{ color: 'var(--green)' }}>Actual: {m.actualDate}</span>}
                      </div>
                    </div>
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

const cardStyle: React.CSSProperties = { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px' }
const btnStyle: React.CSSProperties = { padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: '1px solid var(--border2)', background: 'var(--bg3)', color: 'var(--text2)' }
