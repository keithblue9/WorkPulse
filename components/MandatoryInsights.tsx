'use client'
import { useEffect, useMemo, useState } from 'react'
import { cachedFetch } from '@/lib/fetchCache'
import { useYear } from '@/lib/year'
import { Ring as AuRing, Seg, Sheet } from '@/components/ui'

type Detail = { title: string; rows: { name: string; sub?: string; ok: boolean; extra?: string }[]; okLabel: string; noLabel: string }

function resultColor(r: string) { if (['P1','P2','P3'].includes(r)) return 'var(--ok)'; if (r==='P4') return 'var(--warn-bar)'; if (['P5','P6'].includes(r)) return 'var(--bad)'; return 'var(--muted)' }
const Ring = ({ pct, color, size = 88 }: { pct: number; color: string; size?: number }) => <AuRing value={pct} color={color} size={size} stroke={9} label={`${pct}%`}><b style={{ fontSize: 20 }}>{pct}%</b></AuRing>

export default function MandatoryInsights({ section }: { section?: 'mcu' | 'training' | 'kpi' }) {
  const { year } = useYear()
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
    { key: 'mcu', title: 'Progress MCU', color: '#0FA898', data: mcu, okLabel: 'Sudah MCU', noLabel: 'Belum MCU' },
    { key: 'training', title: 'Training', color: '#7B6BFF', data: training, okLabel: 'Sudah training', noLabel: 'Belum training' },
    { key: 'kpi', title: 'Support KPI', color: '#4B3BFF', data: kpi, okLabel: 'Sudah mengisi', noLabel: 'Belum mengisi' },
  ]
  const cards = section ? allCards.filter(c => c.key === section) : allCards

  const fmt = (d: string) => d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: '2-digit' }) : '–'
  return (
    <section className="au-card" style={{ width: '100%' }}>
      <div className="au-row au-between au-wrap" style={{ gap: 8 }}>
        <h2>{section ? `${cards[0]?.title || 'Mandatory'} ${year}` : `Mandatory ${year}`}</h2>
        <Seg label="Status pegawai" value={status} onChange={setStatus} options={[['all', 'Semua'], ['pekerja', 'Pekerja'], ['TAD', 'TAD']] as const} />
      </div>
      {loading ? <div className="au-row" style={{ gap: 14 }}><div className="au-skel" style={{ width: 88, height: 88, borderRadius: '50%' }} /><div className="au-col" style={{ gap: 8, flex: 1 }}><div className="au-skel" style={{ width: '60%' }} /><div className="au-skel" style={{ width: '40%' }} /></div></div> : (
        <div className="au-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {cards.map(c => (
            <div key={c.key} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetail({ title: c.title, rows: c.data.rows, okLabel: c.okLabel, noLabel: c.noLabel }) } }}
              onClick={() => setDetail({ title: c.title, rows: c.data.rows, okLabel: c.okLabel, noLabel: c.noLabel })} className="au-mcard">
              <Ring pct={c.data.pct} color={c.color} />
              <div className="au-col" style={{ flex: 1, minWidth: 0, gap: 4 }}>
                <b style={{ fontSize: 15 }}>{c.title}</b>
                <span className="au-small au-ink2">{c.data.done} dari {c.data.total} {c.okLabel.toLowerCase()}</span>
                {c.key === 'mcu' && <>
                  {status === 'all'
                    ? <span className="au-row au-wrap" style={{ gap: 4 }}><span className="au-tag">Pekerja {fmt((mcu as any).lastPekerja)}</span><span className="au-tag">TAD {fmt((mcu as any).lastTAD)}</span></span>
                    : <span className="au-xs au-muted">MCU terakhir {fmt((mcu as any).lastDate)}</span>}
                  {Object.keys((mcu as any).pCount).length > 0 && <span className="au-row au-wrap" style={{ gap: 4 }}>{['P1','P2','P3','P4','P5','P6'].filter(p => (mcu as any).pCount[p]).map(p => <span key={p} className="au-tag"><i style={{ background: resultColor(p) }} />{p}: {(mcu as any).pCount[p]}</span>)}</span>}
                </>}
                {c.key === 'kpi' && jenisOptions.length > 0 && (
                  <select className="input input-sm" aria-label="Jenis Support KPI" value={kpiJenis} onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()} onChange={e => setKpiJenis(e.target.value)}>
                    <option value="all">Semua jenis</option>{jenisOptions.map(j => <option key={j} value={j}>{j}</option>)}
                  </select>
                )}
                {c.key === 'kpi' && (status === 'all'
                  ? <span className="au-row au-wrap" style={{ gap: 4 }}><span className="au-tag">Pekerja {(kpi as any).totPekerja}×</span><span className="au-tag">TAD {(kpi as any).totTAD}×</span></span>
                  : <span className="au-xs au-muted">Total pengisian {(kpi as any).totPekerja + (kpi as any).totTAD}×</span>)}
                <span className="au-xs" style={{ color: 'var(--accent-ink)', fontWeight: 600 }}>Lihat detail</span>
              </div>
            </div>
          ))}
        </div>
      )}
      {detail && (
        <Sheet open title={`${detail.title} ${year}`} onClose={() => setDetail(null)}>
          <div className="au-row au-wrap" style={{ gap: 8 }}><span className="au-pill p-ok">{detail.rows.filter(r => r.ok).length} {detail.okLabel.toLowerCase()}</span><span className="au-pill p-bad">{detail.rows.filter(r => !r.ok).length} {detail.noLabel.toLowerCase()}</span></div>
          <div className="au-ig">{detail.rows.map((r, i) => (
            <div key={i} className="au-igr">
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: r.ok ? 'var(--ok)' : 'var(--bad)', flexShrink: 0 }} />
              <span className="au-col" style={{ minWidth: 0, flex: 1 }}><b style={{ fontSize: 14 }}>{r.name}</b>{r.sub && <span className="au-xs au-muted">{r.sub}</span>}</span>
              {r.extra && <span className="au-small au-ink2" style={{ fontWeight: 600 }}>{r.extra}</span>}
            </div>
          ))}</div>
        </Sheet>
      )}
    </section>
  )
}
