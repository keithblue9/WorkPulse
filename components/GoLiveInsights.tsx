'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

export default function GoLiveInsights() {
  const [apps, setApps] = useState<any[]>([])
  const [entities, setEntities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<{app:any; done:any[]; notDone:any[]; color:string}|null>(null)

  useEffect(() => {
    fetch('/api/golive').then(r => r.json())
      .then(d => { setApps(d.apps || []); setEntities(d.entities || []) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const COLORS = ['#4f8ef7', '#8b5cf6', '#22c55e', '#f59e0b', '#ec4899', '#14b8a6']
  const total = entities.length

  const appStats = useMemo(() => apps.map((a: any, i: number) => {
    const color = COLORS[i % COLORS.length]
    const done: any[] = [], notDone: any[] = []
    for (const e of entities) {
      const ap = (e.apps || {})[a.key]
      if (ap?.done || (ap?.subs && Object.values(ap.subs).some(Boolean))) done.push(e)
      else notDone.push(e)
    }
    return { ...a, done, notDone, color, count: done.length }
  }), [apps, entities])

  return (
    <div className="card" style={{ padding: 16, width: "100%" }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>🚀 Go-Live per Aplikasi</div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>Klik app untuk detail · total {total} entitas</div>
        </div>
        <Link href="/dashboard/golive" style={{ fontSize: 10.5, color: 'var(--brand)', textDecoration: 'none', fontWeight: 600 }}>Lihat tabel →</Link>
      </div>

      {loading ? <div style={{ fontSize: 12, color: 'var(--text3)', padding: '16px 0', textAlign: 'center' }}>Memuat…</div>
        : apps.length === 0 ? <div style={{ fontSize: 12, color: 'var(--text3)', padding: '16px 0', textAlign: 'center' }}>Belum ada data.</div>
          : (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {appStats.map(a => {
                const pct = total > 0 ? Math.round(a.count / total * 100) : 0
                return (
                  <div key={a._id} onClick={() => setDetail({ app: a, done: a.done, notDone: a.notDone, color: a.color })}
                    className="card glass-hover" style={{ flex: '1 1 150px', minWidth: 150, border: '1px solid var(--border)', borderLeft: `3px solid ${a.color}`, borderRadius: 10, padding: '12px 14px', background: 'var(--bg2)', cursor: 'pointer', transition: 'box-shadow .15s' }}
                    onMouseEnter={ev => (ev.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.10)')} onMouseLeave={ev => (ev.currentTarget.style.boxShadow = 'none')}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>{a.label}</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <span style={{ fontSize: 28, fontWeight: 800, color: a.color }}>{a.count}</span>
                      <span style={{ fontSize: 11, color: 'var(--text3)' }}>/ {total}</span>
                    </div>
                    <div style={{ height: 5, background: 'var(--bg3)', borderRadius: 3, overflow: 'hidden', marginTop: 8 }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: a.color, transition: 'width .4s' }} />
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--brand)', marginTop: 5 }}>Klik detail →</div>
                  </div>
                )
              })}
            </div>
          )}

      {/* Detail popup */}
      {detail && (
        <div className="modal-overlay" onClick={() => setDetail(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="card scale-in" onClick={ev => ev.stopPropagation()} style={{ width: 500, maxWidth: '100%', maxHeight: '82vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>{detail.app.label} — Detail Go-Live</span>
              <button onClick={() => setDetail(null)} className="btn btn-icon btn-sm">✕</button>
            </div>
            <div style={{ padding: '8px 18px', display: 'flex', gap: 14, fontSize: 12, borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--green)' }}>✓ {detail.done.length} sudah go-live</span>
              <span style={{ color: 'var(--red)' }}>• {detail.notDone.length} belum</span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 18px' }}>
              {detail.done.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>Sudah Go-Live</div>
                  {detail.done.map((e: any) => (
                    <div key={e._id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: 12, fontWeight: 600 }}>{e.name}</span>
                      <span style={{ fontSize: 10, color: 'var(--text3)' }}>{e.cocd}</span>
                      <span style={{ fontSize: 10, color: 'var(--text3)' }}>{e.group}</span>
                    </div>
                  ))}
                </div>
              )}
              {detail.notDone.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--red)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>Belum Go-Live</div>
                  {detail.notDone.map((e: any) => (
                    <div key={e._id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--red)', flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: 12 }}>{e.name}</span>
                      <span style={{ fontSize: 10, color: 'var(--text3)' }}>{e.cocd}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
