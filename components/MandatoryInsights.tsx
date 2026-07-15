'use client'
import { useEffect, useMemo, useState } from 'react'
import { cachedFetch } from '@/lib/fetchCache'

type Detail = { title: string; rows: { name: string; sub?: string; ok: boolean; extra?: string }[]; okLabel: string; noLabel: string }

function resultColor(r: string) { if (['P1','P2','P3'].includes(r)) return '#22c55e'; if (r==='P4') return '#f59e0b'; if (['P5','P6'].includes(r)) return '#dc2626'; return 'var(--text3)' }

function Ring({ pct, color, size = 96 }: { pct: number; color: string; size?: number }) {
  const r = size / 2 - 8, c = 2 * Math.PI * r
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg3)" strokeWidth={8} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={8} strokeLinecap="round"
        strokeDasharray={`${c * pct / 100} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fontSize={size * 0.22} fontWeight={800} fill="var(--text)">{pct}%</text>
    </svg>
  )
}

export default function MandatoryInsights({ section }: { section?: 'mcu' | 'training' | 'kpi' }) {
  const [year, setYear] = useState(new Date().getFullYear())
  const [status, setStatus] = useState<'all' | 'pekerja' | 'TAD'>('all')
  const [kpiJenis, setKpiJenis] = useState<string>('all')
  const [users, setUsers] = useState<any[]>([])
  const [recs, setRecs] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<Detail | null>(null)

  useEffect(() => {
    (async () => {
      setLoading(true)
      const [u, m] = await Promise.all([
        cachedFetch('/api/users').catch(() => ({ data: [] })),
        cachedFetch(`/api/mandatory?year=${year}`).catch(() => ({ data: [] })),
      ])
      setUsers((u.data || []).filter((x: any) => x.active !== false && !(x.roles || []).includes('guest')).sort((a: any, b: any) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999)))
      const map: Record<string, any> = {}; for (const r of (m.data || [])) map[r.userId] = r
      setRecs(map); setLoading(false)
    })()
  }, [year])

  const idOf = (u: any) => u.email || u.id || u._id
  const members = useMemo(() => users.filter(u => status === 'all' || (u.status || 'pekerja') === status), [users, status])
  const jenisOptions = useMemo(() => {
    const set = new Set<string>()
    for (const r of Object.values(recs)) for (const k of (r.supportKpi || [])) set.add(k.jenis === 'lainnya' ? (k.customName || 'Lainnya') : k.jenis)
    return Array.from(set).filter(Boolean)
  }, [recs])

  const mcu = useMemo(() => {
    const rows = members.map(u => { const r = recs[idOf(u)]; const ok = r?.mcu?.done === 'sudah'; return { name: u.name, sub: u.division, ok, extra: r?.mcu?.result || '', date: r?.mcu?.date || '', status: (u.status||'pekerja') } })
    const done = rows.filter(r => r.ok).length
    const pCount: Record<string, number> = {}
    let lastDate = '', lastPekerja = '', lastTAD = ''
    for (const r of rows) {
      if (r.extra) pCount[r.extra] = (pCount[r.extra] || 0) + 1
      if (r.date) {
        if (r.date > lastDate) lastDate = r.date
        if (r.status === 'TAD') { if (r.date > lastTAD) lastTAD = r.date }
        else { if (r.date > lastPekerja) lastPekerja = r.date }
      }
    }
    return { pct: rows.length ? Math.round(done / rows.length * 100) : 0, done, total: rows.length, rows, pCount, lastDate, lastPekerja, lastTAD }
  }, [members, recs])

  const training = useMemo(() => {
    const rows = members.map(u => { const r = recs[idOf(u)]; const n = (r?.trainings || []).length; return { name: u.name, sub: u.division, ok: n > 0, extra: n ? `${n} training` : '' } })
    const done = rows.filter(r => r.ok).length
    return { pct: rows.length ? Math.round(done / rows.length * 100) : 0, done, total: rows.length, rows }
  }, [members, recs])

  const kpi = useMemo(() => {
    const rows = members.map(u => {
      const r = recs[idOf(u)]
      let items = (r?.supportKpi || [])
      if (kpiJenis !== 'all') items = items.filter((k: any) => (k.jenis === 'lainnya' ? (k.customName || 'Lainnya') : k.jenis) === kpiJenis)
      const jml = items.reduce((s: number, k: any) => s + (k.jumlah || 0), 0)
      return { name: u.name, sub: u.division, ok: items.length > 0, extra: items.length ? `${jml}× isi` : '', jml, status: (u.status||'pekerja') }
    })
    const done = rows.filter(r => r.ok).length
    // Total pengisian per status (mirip MCU breakdown)
    const totPekerja = rows.filter(r=>r.status!=='TAD').reduce((s,r)=>s+r.jml,0)
    const totTAD = rows.filter(r=>r.status==='TAD').reduce((s,r)=>s+r.jml,0)
    const donePekerja = rows.filter(r=>r.status!=='TAD' && r.ok).length
    const doneTAD = rows.filter(r=>r.status==='TAD' && r.ok).length
    return { pct: rows.length ? Math.round(done / rows.length * 100) : 0, done, total: rows.length, rows, totPekerja, totTAD, donePekerja, doneTAD }
  }, [members, recs, kpiJenis])

  const allCards = [
    { key: 'mcu', title: '🩺 Progress MCU', color: '#22c55e', data: mcu, okLabel: 'Sudah MCU', noLabel: 'Belum MCU' },
    { key: 'training', title: '🎓 Training', color: '#8b5cf6', data: training, okLabel: 'Sudah training', noLabel: 'Belum training' },
    { key: 'kpi', title: '📊 Support KPI', color: '#4f8ef7', data: kpi, okLabel: 'Sudah mengisi', noLabel: 'Belum mengisi' },
  ]
  const cards = section ? allCards.filter(c => c.key === section) : allCards

  return (
    <div className="card" style={{ padding: 16, width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{section ? cards[0]?.title || 'Mandatory' : `📋 Mandatory ${year}`}</div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 3, alignItems: 'center', marginRight: 4 }}>
            <button onClick={() => setYear(y => y - 1)} className="btn btn-sm" style={{ padding: '2px 7px', fontSize: 10 }}>◀</button>
            <span style={{ fontSize: 11, fontWeight: 700, minWidth: 34, textAlign: 'center' }}>{year}</span>
            <button onClick={() => setYear(y => y + 1)} disabled={year >= new Date().getFullYear()} className="btn btn-sm" style={{ padding: '2px 7px', fontSize: 10, opacity: year >= new Date().getFullYear() ? 0.3 : 1 }}>▶</button>
          </div>
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>Status:</span>
          {(['all', 'pekerja', 'TAD'] as const).map(s => (
            <button key={s} onClick={() => setStatus(s)} className="btn btn-sm" style={{ fontSize: 10.5, textTransform: 'capitalize', background: status === s ? 'var(--brand-soft)' : 'var(--bg3)', color: status === s ? 'var(--brand)' : 'var(--text2)', borderColor: status === s ? 'var(--brand)' : 'var(--border)' }}>{s === 'all' ? 'Semua' : s}</button>
          ))}
        </div>
      </div>

      {loading ? <div style={{ fontSize: 12, color: 'var(--text3)', padding: '20px 0', textAlign: 'center' }}>Memuat…</div> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          {cards.map(c => (
            <div key={c.key} onClick={() => setDetail({ title: c.title, rows: c.data.rows, okLabel: c.okLabel, noLabel: c.noLabel })}
              className="card" style={{ padding: 14, cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 12, transition: 'box-shadow .15s', border: '1px solid var(--border)', minHeight: 132 }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.10)')} onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}>
              <Ring pct={c.data.pct} color={c.color} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 3 }}>{c.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text2)' }}>{c.data.done} / {c.data.total} {c.okLabel.toLowerCase()}</div>

                {/* MCU: tanggal terakhir (berjajar) + breakdown hasil P */}
                {c.key === 'mcu' && (
                  <div style={{ marginTop: 5 }}>
                    {status === 'all' ? (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 9.5, color: 'var(--text3)', background: 'var(--bg3)', padding: '2px 7px', borderRadius: 5 }}>Pekerja: <b style={{ color: 'var(--text2)' }}>{(mcu as any).lastPekerja ? new Date((mcu as any).lastPekerja).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'2-digit'}) : '—'}</b></span>
                        <span style={{ fontSize: 9.5, color: 'var(--text3)', background: 'var(--bg3)', padding: '2px 7px', borderRadius: 5 }}>TAD: <b style={{ color: 'var(--text2)' }}>{(mcu as any).lastTAD ? new Date((mcu as any).lastTAD).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'2-digit'}) : '—'}</b></span>
                      </div>
                    ) : (
                      <div style={{ fontSize: 9.5, color: 'var(--text3)' }}>MCU terakhir: <b style={{ color: 'var(--text2)' }}>{(mcu as any).lastDate ? new Date((mcu as any).lastDate).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'2-digit'}) : '—'}</b></div>
                    )}
                    {Object.keys((mcu as any).pCount).length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5 }}>
                        {['P1','P2','P3','P4','P5','P6'].filter(p=>(mcu as any).pCount[p]).map(p => (
                          <span key={p} style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 5, background: resultColor(p)+'22', color: resultColor(p) }}>{p}: {(mcu as any).pCount[p]}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {c.key === 'kpi' && jenisOptions.length > 0 && (
                  <select value={kpiJenis} onClick={e => e.stopPropagation()} onChange={e => setKpiJenis(e.target.value)} style={{ marginTop: 6, fontSize: 10.5, padding: '3px 6px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', width: '100%' }}>
                    <option value="all">Semua jenis</option>
                    {jenisOptions.map(j => <option key={j} value={j}>{j}</option>)}
                  </select>
                )}

                {/* KPI: total pengisian per status (mirip MCU, bukan per nama) */}
                {c.key === 'kpi' && (
                  <div style={{ marginTop: 5 }}>
                    {status === 'all' ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 5, background: c.color+'22', color: c.color }}>Pekerja: {(kpi as any).totPekerja}×</span>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 5, background: '#f59e0b22', color: '#f59e0b' }}>TAD: {(kpi as any).totTAD}×</span>
                      </div>
                    ) : (
                      <div style={{ fontSize: 10, color: 'var(--text3)' }}>Total pengisian: <b style={{ color: c.color }}>{(kpi as any).totPekerja + (kpi as any).totTAD}×</b></div>
                    )}
                  </div>
                )}

                <div style={{ fontSize: 10, color: 'var(--brand)', marginTop: 5 }}>Klik untuk detail →</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {detail && (
        <div className="modal-overlay" onClick={() => setDetail(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="card scale-in" onClick={e => e.stopPropagation()} style={{ width: 460, maxWidth: '100%', maxHeight: '82vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>{detail.title} — Detail</span>
              <button onClick={() => setDetail(null)} className="btn btn-icon btn-sm">✕</button>
            </div>
            <div style={{ padding: '10px 18px', display: 'flex', gap: 10, fontSize: 11.5, borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--green)' }}>✓ {detail.rows.filter(r => r.ok).length} {detail.okLabel}</span>
              <span style={{ color: 'var(--red)' }}>• {detail.rows.filter(r => !r.ok).length} {detail.noLabel}</span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 18px' }}>
              {detail.rows.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: r.ok ? 'var(--green)' : 'var(--red)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600 }}>{r.name}</div>
                    {r.sub && <div style={{ fontSize: 10, color: 'var(--text3)' }}>{r.sub}</div>}
                  </div>
                  {r.extra && <span style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 600 }}>{r.extra}</span>}
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: r.ok ? 'var(--green)' : 'var(--red)' }}>{r.ok ? detail.okLabel : detail.noLabel}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
