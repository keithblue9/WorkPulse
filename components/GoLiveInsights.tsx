'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function GoLiveInsights() {
  const [apps, setApps] = useState<any[]>([])
  const [entities, setEntities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/golive').then(r => r.json())
      .then(d => { setApps(d.apps || []); setEntities(d.entities || []) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const COLORS = ['#4f8ef7', '#8b5cf6', '#22c55e', '#f59e0b', '#ec4899', '#14b8a6']
  const total = entities.length

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>🚀 Go-Live per Aplikasi</div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>Jumlah entitas yang sudah go-live · total {total} entitas</div>
        </div>
        <Link href="/dashboard/golive" style={{ fontSize: 10.5, color: 'var(--brand)', textDecoration: 'none', fontWeight: 600 }}>Lihat detail →</Link>
      </div>

      {loading ? <div style={{ fontSize: 12, color: 'var(--text3)', padding: '16px 0', textAlign: 'center' }}>Memuat…</div>
        : apps.length === 0 ? <div style={{ fontSize: 12, color: 'var(--text3)', padding: '16px 0', textAlign: 'center' }}>Belum ada data go-live.</div>
          : (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {apps.map((a, i) => {
                const done = entities.filter(e => { const ap=(e.apps||{})[a.key]; return ap?.done || (ap?.subs && Object.values(ap.subs).some(Boolean)) }).length
                const pct = total > 0 ? Math.round(done / total * 100) : 0
                const color = COLORS[i % COLORS.length]
                return (
                  <div key={a._id} style={{ flex: '1 1 150px', minWidth: 150, border: '1px solid var(--border)', borderLeft: `3px solid ${color}`, borderRadius: 10, padding: '12px 14px', background: 'var(--bg2)' }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>{a.label}</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <span style={{ fontSize: 28, fontWeight: 800, color }}>{done}</span>
                      <span style={{ fontSize: 11, color: 'var(--text3)' }}>/ {total} entitas</span>
                    </div>
                    <div style={{ height: 5, background: 'var(--bg3)', borderRadius: 3, overflow: 'hidden', marginTop: 8 }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width .4s' }} />
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>{pct}% go-live</div>
                  </div>
                )
              })}
            </div>
          )}
    </div>
  )
}
