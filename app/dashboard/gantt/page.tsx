'use client'
import { useEffect, useState } from 'react'
import { Initiative } from '@/types'

export default function GanttPage() {
  const [initiatives, setInitiatives] = useState<Initiative[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/initiatives').then(r => r.json()).then(d => {
      setInitiatives(d.data || [])
      setLoading(false)
    })
  }, [])

  const months = ['M1','M2','M3','M4','M5','M6','M7','M8','M9','M10','M11','M12']
  const CURRENT_MONTH = 6 // June = M6

  function makeBarStyle(start: number, end: number, color: string): React.CSSProperties {
    if (!start || start < 1) return { display: 'none' }
    const left = ((start - 1) / 12) * 100
    const width = ((end - start + 1) / 12) * 100
    return { position: 'absolute', top: 0, left: `${left}%`, width: `${width}%`, height: '100%', background: color, borderRadius: 2 }
  }

  const midLeft = `${((CURRENT_MONTH - 1) / 12) * 100}%`

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Gantt Chart</div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>Plan vs Actual · 2026</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 11, color: 'var(--text3)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 14, height: 8, background: '#1e3a6e', borderRadius: 2, display: 'inline-block' }}></span>Plan</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 14, height: 8, background: '#f59e0b', borderRadius: 2, display: 'inline-block' }}></span>Actual</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 2, height: 12, background: 'var(--red)', display: 'inline-block' }}></span>M6 Mid Year</span>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
        {loading ? <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>Memuat...</div> : (
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '40px 280px 80px 80px 1fr', background: 'var(--bg3)', borderBottom: '1px solid var(--border)' }}>
              {['No','Activity','%','Plan/Act',''].map((h, i) => (
                <div key={i} style={{ padding: '8px 10px', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', borderRight: i < 4 ? '1px solid var(--border)' : 'none' }}>
                  {h === '' ? (
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', borderBottom: '1px solid var(--border)', paddingBottom: 4, marginBottom: 4 }}>
                        {['TW 1','TW 2','TW 3','TW 4'].map(tw => <div key={tw} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700 }}>{tw}</div>)}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12,1fr)' }}>
                        {months.map((m, mi) => (
                          <div key={m} style={{ textAlign: 'center', fontSize: 10, fontWeight: mi + 1 === CURRENT_MONTH ? 700 : 400, color: mi + 1 === CURRENT_MONTH ? 'var(--red)' : 'var(--text3)' }}>{m}</div>
                        ))}
                      </div>
                    </div>
                  ) : h}
                </div>
              ))}
            </div>

            {/* Initiative rows */}
            {initiatives.map((ini, idx) => (
              <div key={ini._id}>
                {/* Section header */}
                <div style={{ background: 'var(--bg3)', borderBottom: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '40px 280px 80px 80px 1fr' }}>
                  <div style={{ padding: '8px 10px', fontSize: 12, fontWeight: 700, color: 'var(--blue)', gridColumn: '1', borderRight: '1px solid var(--border)', textAlign: 'center' }}>{idx + 1}</div>
                  <div style={{ padding: '8px 10px', fontSize: 12, fontWeight: 700, color: 'var(--blue)', gridColumn: '2/5', borderRight: '1px solid var(--border)' }}>{ini.title}</div>
                  <div style={{ padding: '8px 10px', position: 'relative' }}>
                    <div style={{ position: 'absolute', left: midLeft, top: 0, bottom: 0, width: 2, background: 'var(--red)', opacity: 0.6, zIndex: 5 }} />
                  </div>
                </div>

                {/* Phase rows */}
                {ini.phases.map((phase, pi) => (
                  <div key={phase._id} style={{ display: 'grid', gridTemplateColumns: '40px 280px 80px 80px 1fr', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg2)')}>
                    <div style={{ padding: '6px 10px', fontSize: 11, color: 'var(--text3)', textAlign: 'center', borderRight: '1px solid var(--border)' }}>{idx + 1}.{pi + 1}</div>
                    <div style={{ padding: '6px 10px', fontSize: 12, color: 'var(--text)', borderRight: '1px solid var(--border)' }}>{phase.name}</div>
                    <div style={{ padding: '6px 10px', borderRight: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ flex: 1, height: 5, background: 'var(--bg4)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${phase.actualPct}%`, background: phase.actualPct >= 100 ? 'var(--green)' : phase.actualPct > 0 ? 'var(--amber)' : 'var(--text3)', borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 600, minWidth: 28, textAlign: 'right', color: phase.actualPct >= 100 ? 'var(--green)' : phase.actualPct > 0 ? 'var(--amber)' : 'var(--text3)' }}>{phase.actualPct}%</span>
                      </div>
                    </div>
                    <div style={{ padding: '6px 10px', borderRight: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 10, display: 'flex', gap: 4 }}>
                        <span style={{ color: 'var(--text3)', fontWeight: 600, fontSize: 9, textTransform: 'uppercase' }}>Plan</span>
                        <span style={{ color: 'var(--text2)' }}>{phase.planPct}%</span>
                        <span style={{ color: 'var(--text3)', fontWeight: 600, fontSize: 9, textTransform: 'uppercase', marginLeft: 4 }}>Act</span>
                        <span style={{ color: phase.actualPct > 0 ? 'var(--amber)' : 'var(--text3)' }}>{phase.actualPct}%</span>
                      </div>
                    </div>
                    {/* Bar area */}
                    <div style={{ position: 'relative', height: 38, padding: '4px 6px' }}>
                      <div style={{ position: 'absolute', left: midLeft, top: 0, bottom: 0, width: 2, background: 'var(--red)', opacity: 0.5, zIndex: 5 }} />
                      {/* Plan bar */}
                      <div style={{ position: 'relative', height: 10, background: 'var(--bg4)', borderRadius: 2, marginBottom: 4, overflow: 'visible' }}>
                        <div style={{ fontSize: 9, color: 'var(--text3)', position: 'absolute', left: 0, top: -12, fontWeight: 600 }}>PLAN</div>
                        <div style={makeBarStyle(phase.planStartMonth, phase.planEndMonth, '#1e3a6e')} />
                      </div>
                      {/* Actual bar */}
                      <div style={{ position: 'relative', height: 10, background: 'var(--bg4)', borderRadius: 2, overflow: 'visible' }}>
                        <div style={{ fontSize: 9, color: 'var(--text3)', position: 'absolute', left: 0, top: -2, fontWeight: 600 }}>ACT</div>
                        {phase.actualStartMonth && phase.actualEndMonth && (
                          <div style={makeBarStyle(phase.actualStartMonth, phase.actualEndMonth, '#f59e0b')} />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}

            {/* Footer */}
            <div style={{ background: 'var(--bg3)', borderTop: '1px solid var(--border)', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <span style={{ color: 'var(--red)', fontWeight: 700, fontSize: 13 }}>▲ M6 (Mid Year)</span>
              <span style={{ color: 'var(--text3)', fontSize: 11 }}>Diproveksikan mencapai target progress kumulatif</span>
              <span style={{ color: 'var(--red)', fontWeight: 700, fontSize: 14 }}>50%</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
