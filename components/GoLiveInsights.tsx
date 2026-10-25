'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { cachedFetch } from '@/lib/fetchCache'
import { Empty, Sheet } from '@/components/ui'

export default function GoLiveInsights() {
  const [apps, setApps] = useState<any[]>([])
  const [entities, setEntities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<{app:any; done:any[]; notDone:any[]; color:string}|null>(null)

  useEffect(() => {
    cachedFetch('/api/golive')
      .then((d: any) => { setApps(d.apps || []); setEntities(d.entities || []) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const COLORS = ['#4B3BFF', '#7B6BFF', '#0FA898', '#F2A33A', '#FF5D3B', '#14b8a6']
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
    <section className="au-card" style={{ width: '100%' }}>
      <div className="au-row au-between au-wrap" style={{ gap: 8 }}>
        <div className="au-col"><h2>Go-live per aplikasi</h2><span className="au-xs au-muted">Ketuk aplikasi untuk detail · {total} entitas</span></div>
        <Link href="/dashboard/golive" className="au-link">Lihat tabel</Link>
      </div>
      {loading ? <div className="au-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>{[0, 1].map(k => <div key={k} className="au-tile"><div className="au-skel" style={{ width: '40%' }} /><div className="au-skel" style={{ width: 50, height: 26 }} /></div>)}</div>
        : apps.length === 0 ? <Empty title="Belum ada data go-live" />
        : (
          <div className="au-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
            {appStats.map(a => {
              const pct = total > 0 ? Math.round(a.count / total * 100) : 0
              return (
                <button type="button" key={a._id} className="au-tile" onClick={() => setDetail({ app: a, done: a.done, notDone: a.notDone, color: a.color })}>
                  <span className="au-row au-between"><span className="lbl">{a.label}</span><span className="au-xs au-muted">{pct}%</span></span>
                  <b className="v" style={{ color: a.color }}>{a.count}<small style={{ fontSize: 14, color: 'var(--muted)', fontWeight: 600 }}> / {total}</small></b>
                  <span className="au-track" style={{ height: 8 }}><i className="a" style={{ width: `${pct}%`, background: a.color }} /></span>
                </button>
              )
            })}
          </div>
        )}
      {detail && (
        <Sheet open title={`Go-live ${detail.app.label}`} onClose={() => setDetail(null)}>
          <div className="au-row au-wrap" style={{ gap: 8 }}><span className="au-pill p-ok">{detail.done.length} sudah go-live</span><span className="au-pill p-bad">{detail.notDone.length} belum</span></div>
          {detail.done.length > 0 && <><span className="au-igh">Sudah go-live</span><div className="au-ig">{detail.done.map((e: any) => (
            <div key={e._id} className="au-igr"><span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--ok)', flexShrink: 0 }} /><b style={{ flex: 1, fontSize: 14 }}>{e.name}</b><span className="au-xs au-muted">{[e.cocd, e.group].filter(Boolean).join(' · ')}</span></div>
          ))}</div></>}
          {detail.notDone.length > 0 && <><span className="au-igh">Belum go-live</span><div className="au-ig">{detail.notDone.map((e: any) => (
            <div key={e._id} className="au-igr"><span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--bad)', flexShrink: 0 }} /><span style={{ flex: 1, fontSize: 14 }}>{e.name}</span><span className="au-xs au-muted">{e.cocd}</span></div>
          ))}</div></>}
        </Sheet>
      )}
    </section>
  )
}
