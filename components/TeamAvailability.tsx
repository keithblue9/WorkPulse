'use client'
import { useEffect, useMemo, useState } from 'react'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts'
import { getConfig } from '@/lib/configCache'

const WORKING = ['wfo', 'wfh', 'dinas'] // dianggap "available/bekerja"

function fmtDate(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

export default function TeamAvailability() {
  const [scope, setScope] = useState<'week' | 'month'>('week')
  const [docs, setDocs] = useState<any[]>([])
  const [types, setTypes] = useState<any[]>([])
  const [memberCount, setMemberCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      setLoading(true)
      const today = new Date()
      let start: Date
      if (scope === 'week') { const d = new Date(today); const wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); start = d }
      else start = new Date(today.getFullYear(), today.getMonth(), 1)
      const [ov, cfg, usersR] = await Promise.all([
        fetch(`/api/attendance/overview?from=${fmtDate(start)}&to=${fmtDate(today)}`).then(r => r.json()).catch(() => ({ data: [] })),
        getConfig().catch(() => null),
        fetch('/api/users').then(r => r.json()).catch(() => ({ data: [] })),
      ])
      setDocs(ov.data || [])
      setTypes((cfg?.attendanceTypes || []).filter((t: any) => t.active !== false))
      setMemberCount((usersR.data || []).filter((u: any) => u.active !== false && !(u.roles || []).includes('guest')).length)
      setLoading(false)
    })()
  }, [scope])

  const { data, available, availPct } = useMemo(() => {
    // Tiap member dihitung TEPAT SATU KALI: diklasifikasi ke kategori dominan
    // (tipe kehadiran terbanyak di periode; seri -> prioritas tipe working). Total pasti = jumlah member.
    const perMember: Record<string, Record<string, number>> = {}
    for (const doc of docs) for (const s of (doc.slots || [])) {
      (perMember[doc.userId] = perMember[doc.userId] || {})[s.type] = (perMember[doc.userId][s.type] || 0) + 1
    }
    const catCount: Record<string, number> = {}
    let noData = 0, availMembers = 0
    const memberIds = Object.keys(perMember)
    for (const uid of memberIds) {
      const counts = perMember[uid]
      // dominan: count terbesar; kalau seri, prioritaskan tipe working (biar member yg campuran tetap dianggap available)
      let best = '', bestN = -1
      for (const [t, n] of Object.entries(counts)) {
        if (n > bestN || (n === bestN && WORKING.includes(t) && !WORKING.includes(best))) { best = t; bestN = n }
      }
      catCount[best] = (catCount[best] || 0) + 1
      if (Object.keys(counts).some(t => WORKING.includes(t))) availMembers++
    }
    noData = Math.max(0, memberCount - memberIds.length)
    const denom = memberCount || 1
    const data = types.map((t: any) => ({ name: t.label, key: t.key, value: catCount[t.key] || 0, color: t.textColor || '#4f8ef7' })).filter((d: any) => d.value > 0)
    if (noData > 0) data.push({ name: 'Belum presensi', key: '__none', value: noData, color: '#9aa6b3' })
    return { data, available: availMembers, availPct: Math.round(availMembers / denom * 100) }
  }, [docs, types, memberCount])

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, gap: 8, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>👥 Team Availability</div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>Per member (kategori dominan) · {scope === 'week' ? 'minggu ini' : 'bulan ini'} s/d hari ini · total {memberCount} member</div>
        </div>
        <div style={{ display: 'flex', gap: 4, background: 'var(--bg3)', borderRadius: 8, padding: 3 }}>
          {(['week', 'month'] as const).map(s => (
            <button key={s} onClick={() => setScope(s)} className="btn btn-sm" style={{ fontSize: 11, background: scope === s ? 'var(--brand)' : 'transparent', color: scope === s ? '#fff' : 'var(--text2)', border: 'none' }}>{s === 'week' ? 'Minggu' : 'Bulan'}</button>
          ))}
        </div>
      </div>

      {loading ? <div style={{ fontSize: 12, color: 'var(--text3)', padding: '30px 0', textAlign: 'center' }}>Memuat…</div>
        : data.length === 0 ? <div style={{ fontSize: 12, color: 'var(--text3)', padding: '30px 0', textAlign: 'center' }}>Belum ada data presensi periode ini.</div>
          : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', width: 170, height: 170, flexShrink: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data} dataKey="value" nameKey="name" innerRadius={54} outerRadius={80} paddingAngle={2} stroke="none">
                      {data.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip content={({ active, payload }: any) => active && payload?.length ? (
                      <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', fontSize: 11, boxShadow: '0 6px 20px rgba(0,0,0,0.15)' }}>
                        <b>{payload[0].name}</b>: {payload[0].value} member ({memberCount > 0 ? Math.round(payload[0].value / memberCount * 100) : 0}%)
                      </div>) : null} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                  <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--green)' }}>{availPct}%</div>
                  <div style={{ fontSize: 9.5, color: 'var(--text3)' }}>Available</div>
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 150, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {data.map(d => (
                  <div key={d.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: d.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, color: 'var(--text2)' }}>{d.name}</span>
                    <span style={{ fontWeight: 700 }}>{d.value} <span style={{ fontWeight: 400, fontSize: 10, color: 'var(--text3)' }}>member</span></span>
                    <span style={{ fontSize: 10.5, color: 'var(--text3)', width: 34, textAlign: 'right' }}>{memberCount > 0 ? Math.round(d.value / memberCount * 100) : 0}%</span>
                  </div>
                ))}
                <div style={{ marginTop: 4, paddingTop: 8, borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text3)' }}>
                  Available (WFO/WFH/Dinas): <b style={{ color: 'var(--green)' }}>{available}</b> dari {memberCount} member
                </div>
              </div>
            </div>
          )}
    </div>
  )
}
