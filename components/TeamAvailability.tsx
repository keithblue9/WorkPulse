'use client'
import { useEffect, useMemo, useState } from 'react'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts'
import { getConfig } from '@/lib/configCache'

const WORKING = ['wfo', 'wfh', 'dinas']
const BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']

function fmtD(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
function mondayOfWeek(d: Date) { const r = new Date(d); const wd = (r.getDay() + 6) % 7; r.setDate(r.getDate() - wd); return r }

export default function TeamAvailability() {
  const [scope, setScope] = useState<'week' | 'month'>('month')
  // viewMonth: "YYYY-MM" for month nav
  const now = new Date()
  const [viewMonth, setViewMonth] = useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`)
  const [docs, setDocs] = useState<any[]>([])
  const [types, setTypes] = useState<any[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const isCurrentMonth = viewMonth === `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`
  const memberCount = members.length

  // Navigasi bulan
  function shiftMonth(dir: -1|1) {
    const [y, m] = viewMonth.split('-').map(Number)
    const d = new Date(y, m - 1 + dir, 1)
    setViewMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`)
  }

  useEffect(() => {
    (async () => {
      setLoading(true)
      const [ym, mm] = viewMonth.split('-').map(Number)
      let start: Date, end: Date
      if (scope === 'week') {
        start = mondayOfWeek(now)
        end = now
      } else {
        start = new Date(ym, mm - 1, 1)
        // Kalau bulan ini -> s/d hari ini, kalau bulan lalu -> sampai akhir bulan
        end = isCurrentMonth ? now : new Date(ym, mm, 0) // day 0 = last day of month
      }
      const [ov, cfg, usersR] = await Promise.all([
        fetch(`/api/attendance/overview?from=${fmtD(start)}&to=${fmtD(end)}`).then(r => r.json()).catch(() => ({ data: [] })),
        getConfig().catch(() => null),
        fetch('/api/users').then(r => r.json()).catch(() => ({ data: [] })),
      ])
      setDocs(ov.data || [])
      setTypes((cfg?.attendanceTypes || []).filter((t: any) => t.active !== false))
      setMembers((usersR.data || []).filter((u: any) => u.active !== false && !(u.roles || []).includes('guest')))
      setLoading(false)
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, viewMonth])

  // Kategori dominan per member
  const { data, available, availPct } = useMemo(() => {
    const perMember: Record<string, Record<string, number>> = {}
    for (const doc of docs) for (const s of (doc.slots || [])) {
      (perMember[doc.userId] = perMember[doc.userId] || {})[s.type] = (perMember[doc.userId][s.type] || 0) + 1
    }
    const catCount: Record<string, number> = {}
    let availMembers = 0
    const ids = Object.keys(perMember)
    for (const uid of ids) {
      const counts = perMember[uid]
      let best = '', bestN = -1
      for (const [t, n] of Object.entries(counts)) {
        if (n > bestN || (n === bestN && WORKING.includes(t) && !WORKING.includes(best))) { best = t; bestN = n }
      }
      catCount[best] = (catCount[best] || 0) + 1
      if (Object.keys(counts).some(t => WORKING.includes(t))) availMembers++
    }
    const noData = Math.max(0, memberCount - ids.length)
    const data = types.map((t: any) => ({ name: t.label, key: t.key, value: catCount[t.key] || 0, color: t.textColor || '#4f8ef7' })).filter((d: any) => d.value > 0)
    if (noData > 0) data.push({ name: 'Belum presensi', key: '__none', value: noData, color: '#9aa6b3' })
    return { data, available: availMembers, availPct: memberCount > 0 ? Math.round(availMembers / memberCount * 100) : 0 }
  }, [docs, types, memberCount])

  // WFO hari ini: list nama member
  const wfoToday = useMemo(() => {
    const todayStr = fmtD(now)
    const wfoIds = new Set<string>()
    for (const doc of docs) {
      if (doc.date !== todayStr) continue
      for (const s of (doc.slots || [])) { if (s.type === 'wfo') wfoIds.add(doc.userId) }
    }
    return members.filter(m => wfoIds.has(m.email) || wfoIds.has(m._id)).sort((a: any, b: any) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docs, members])

  const periodLabel = scope === 'week'
    ? 'minggu ini'
    : isCurrentMonth ? `${BULAN[parseInt(viewMonth.split('-')[1])-1]} (s/d hari ini)` : BULAN[parseInt(viewMonth.split('-')[1])-1] + ' ' + viewMonth.split('-')[0]

  return (
    <div className="card" style={{ padding: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 8, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>👥 Team Availability</div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>Kategori dominan per member · {periodLabel} · {memberCount} member</div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {scope === 'month' && (
            <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
              <button onClick={() => shiftMonth(-1)} className="btn btn-sm" style={{ padding: '3px 8px' }}>◀</button>
              <span style={{ fontSize: 11, fontWeight: 600, minWidth: 70, textAlign: 'center' }}>
                {BULAN[parseInt(viewMonth.split('-')[1]) - 1].slice(0, 3)} {viewMonth.split('-')[0]}
              </span>
              <button onClick={() => shiftMonth(1)} disabled={isCurrentMonth} className="btn btn-sm" style={{ padding: '3px 8px', opacity: isCurrentMonth ? 0.3 : 1 }}>▶</button>
            </div>
          )}
          <div style={{ display: 'flex', gap: 3, background: 'var(--bg3)', borderRadius: 8, padding: 3 }}>
            {(['week', 'month'] as const).map(s => (
              <button key={s} onClick={() => { setScope(s); if (s === 'month') setViewMonth(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`) }} className="btn btn-sm" style={{ fontSize: 11, background: scope === s ? 'var(--brand)' : 'transparent', color: scope === s ? '#fff' : 'var(--text2)', border: 'none' }}>{s === 'week' ? 'Minggu' : 'Bulan'}</button>
            ))}
          </div>
        </div>
      </div>

      {loading ? <div style={{ fontSize: 12, color: 'var(--text3)', padding: '30px 0', textAlign: 'center' }}>Memuat…</div>
        : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* KIRI: donut + breakdown */}
            <div>
              {data.length === 0 ? <div style={{ fontSize: 12, color: 'var(--text3)', padding: '30px 0', textAlign: 'center' }}>Belum ada data presensi.</div> : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ position: 'relative', width: 140, height: 140, flexShrink: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={data} dataKey="value" nameKey="name" innerRadius={44} outerRadius={66} paddingAngle={2} stroke="none">
                          {data.map((d, i) => <Cell key={i} fill={d.color} />)}
                        </Pie>
                        <Tooltip content={({ active, payload }: any) => active && payload?.length ? (
                          <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', fontSize: 11, boxShadow: '0 6px 20px rgba(0,0,0,0.15)' }}>
                            <b>{payload[0].name}</b>: {payload[0].value} member ({memberCount > 0 ? Math.round(payload[0].value / memberCount * 100) : 0}%)
                          </div>) : null} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--green)' }}>{availPct}%</div>
                      <div style={{ fontSize: 9, color: 'var(--text3)' }}>Available</div>
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {data.map(d => (
                      <div key={d.key} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12 }}>
                        <span style={{ width: 9, height: 9, borderRadius: 2, background: d.color, flexShrink: 0 }} />
                        <span style={{ flex: 1, color: 'var(--text2)' }}>{d.name}</span>
                        <span style={{ fontWeight: 700, fontSize: 12 }}>{d.value}</span>
                        <span style={{ fontSize: 10, color: 'var(--text3)', width: 30, textAlign: 'right' }}>{memberCount > 0 ? Math.round(d.value / memberCount * 100) : 0}%</span>
                      </div>
                    ))}
                    <div style={{ marginTop: 4, paddingTop: 6, borderTop: '1px solid var(--border)', fontSize: 10.5, color: 'var(--text3)' }}>
                      Available (WFO/WFH/Dinas): <b style={{ color: 'var(--green)' }}>{available}</b> / {memberCount}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* KANAN: WFO hari ini */}
            <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>🏢 WFO Hari Ini</div>
              {wfoToday.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text3)', padding: '14px 0' }}>Belum ada member WFO hari ini.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {wfoToday.map((m: any) => (
                    <div key={m._id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 7, background: 'var(--bg3)' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: m.color || 'var(--brand)', flexShrink: 0 }} />
                      <span style={{ fontSize: 12, fontWeight: 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
                      {m.division && <span style={{ fontSize: 10, color: 'var(--text3)' }}>{m.division}</span>}
                    </div>
                  ))}
                  <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 2 }}>{wfoToday.length} dari {memberCount} member WFO</div>
                </div>
              )}
            </div>
          </div>
        )}
    </div>
  )
}
