'use client'
import { useEffect, useMemo, useState } from 'react'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts'
import { getConfig } from '@/lib/configCache'

// Prioritas kategori per hari (kalau 1 hari multiple slot): WFO > Dinas > Izin > WFH > Cuti > Sakit
const PRIORITY = ['wfo', 'dinas', 'izin', 'wfh', 'cuti', 'sakit']
const BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']

function fmtD(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
function mondayOfWeek(d: Date) { const r = new Date(d); const wd = (r.getDay() + 6) % 7; r.setDate(r.getDate() - wd); return r }

// Nama depan; khusus Dwi Bagus -> "D. Bagus"
function shortName(full: string) {
  if (!full) return '—'
  const parts = full.trim().split(/\s+/)
  if (/^dwi$/i.test(parts[0]) && parts[1]) return `D. ${parts[1]}`
  return parts[0]
}

// Pilih kategori dominan 1 hari dari beberapa slot pakai prioritas
function pickDayCategory(slotTypes: string[]): string {
  for (const p of PRIORITY) if (slotTypes.some(t => String(t).toLowerCase() === p)) return p
  return String(slotTypes[0] || '').toLowerCase()
}

export default function TeamAvailability() {
  const [scope, setScope] = useState<'week' | 'month'>('month')
  const now = new Date()
  const [viewMonth, setViewMonth] = useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`)
  const [docs, setDocs] = useState<any[]>([])
  const [types, setTypes] = useState<any[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showDetail, setShowDetail] = useState(false)

  const isCurrentMonth = viewMonth === `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`
  const memberCount = members.length

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
      if (scope === 'week') { start = mondayOfWeek(now); end = now }
      else { start = new Date(ym, mm - 1, 1); end = isCurrentMonth ? now : new Date(ym, mm, 0) }
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

  const colorOf = (key: string) => (types.find((t: any) => t.key === key)?.textColor) || '#9aa6b3'
  const labelOf = (key: string) => (types.find((t: any) => t.key === key)?.label) || key

  // Hitung per member: 1 hari = 1 kategori (prioritas). % WFO = hari WFO / hari terisi.
  const stats = useMemo(() => {
    // group slots by member + date
    const byMemberDate: Record<string, Record<string, string[]>> = {}
    for (const doc of docs) {
      const uid = doc.userId
      const date = doc.date
      if (!uid || !date) continue
      const types0 = (doc.slots || []).map((s: any) => s.type)
      if (!types0.length) continue
      ;(byMemberDate[uid] = byMemberDate[uid] || {})
      ;(byMemberDate[uid][date] = (byMemberDate[uid][date] || [])).push(...types0)
    }

    // per member: hitung hari per kategori (setelah prioritas)
    const perMember: Record<string, { days: Record<string, number>, total: number, wfo: number }> = {}
    for (const [uid, dates] of Object.entries(byMemberDate)) {
      const days: Record<string, number> = {}
      let total = 0, wfo = 0
      for (const [, slotTypes] of Object.entries(dates)) {
        const cat = pickDayCategory(slotTypes)
        if (!cat) continue
        days[cat] = (days[cat] || 0) + 1
        total++
        if (cat === 'wfo') wfo++
      }
      perMember[uid] = { days, total, wfo }
    }

    // map ke member objek (match by _id atau email)
    const memberRows = members.map(m => {
      const rec = perMember[m._id] || perMember[m.email] || { days: {}, total: 0, wfo: 0 }
      const pct = rec.total > 0 ? Math.round(rec.wfo / rec.total * 100) : 0
      return { id: m._id, name: shortName(m.name), fullName: m.name, status: (m.status || 'pekerja'), division: m.division, ...rec, pct }
    })

    // komposisi total (semua member) untuk donut
    const catTotals: Record<string, number> = {}
    let grandTotal = 0, grandWfo = 0
    for (const r of memberRows) {
      for (const [cat, n] of Object.entries(r.days)) { catTotals[cat] = (catTotals[cat] || 0) + n }
      grandTotal += r.total; grandWfo += r.wfo
    }
    const teamPct = grandTotal > 0 ? Math.round(grandWfo / grandTotal * 100) : 0

    // per status
    const calcStatus = (st: string) => {
      const rows = memberRows.filter(r => (st === 'TAD' ? r.status === 'TAD' : r.status !== 'TAD'))
      const t = rows.reduce((s, r) => s + r.total, 0)
      const w = rows.reduce((s, r) => s + r.wfo, 0)
      return t > 0 ? Math.round(w / t * 100) : 0
    }

    // donut data: semua kategori (termasuk 0 di legend)
    const donutData = types.map((t: any) => ({ name: t.label, key: t.key, value: catTotals[t.key] || 0, color: t.textColor || '#4f8ef7' }))

    return {
      memberRows: memberRows.sort((a, b) => b.pct - a.pct),
      donutData, teamPct, grandTotal, grandWfo,
      pctPekerja: calcStatus('pekerja'), pctTAD: calcStatus('TAD'),
    }
  }, [docs, members, types])

  // WFO hari ini
  const wfoToday = useMemo(() => {
    const todayStr = fmtD(now)
    const wfoIds = new Set<string>()
    for (const doc of docs) {
      if (doc.date !== todayStr) continue
      for (const s of (doc.slots || [])) { if (String(s.type).toLowerCase() === 'wfo') wfoIds.add(doc.userId) }
    }
    return members.filter(m => wfoIds.has(m.email) || wfoIds.has(m._id)).sort((a: any, b: any) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docs, members])

  const periodLabel = scope === 'week' ? 'minggu ini'
    : isCurrentMonth ? `${BULAN[parseInt(viewMonth.split('-')[1])-1]} (s/d hari ini)` : BULAN[parseInt(viewMonth.split('-')[1])-1] + ' ' + viewMonth.split('-')[0]

  const donutNonZero = stats.donutData.filter((d: any) => d.value > 0)

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 8, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>👥 Team Availability</div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>% WFO dari hari terisi · {periodLabel} · {memberCount} member</div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {scope === 'month' && (
            <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
              <button onClick={() => shiftMonth(-1)} className="btn btn-sm" style={{ padding: '3px 8px' }}>◀</button>
              <span style={{ fontSize: 11, fontWeight: 600, minWidth: 70, textAlign: 'center' }}>{BULAN[parseInt(viewMonth.split('-')[1]) - 1].slice(0, 3)} {viewMonth.split('-')[0]}</span>
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
            {/* KIRI: donut komposisi + summary status */}
            <div>
              {stats.grandTotal === 0 ? <div style={{ fontSize: 12, color: 'var(--text3)', padding: '30px 0', textAlign: 'center' }}>Belum ada data presensi.</div> : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ position: 'relative', width: 130, height: 130, flexShrink: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={donutNonZero} dataKey="value" nameKey="name" innerRadius={42} outerRadius={62} paddingAngle={2} stroke="none">
                          {donutNonZero.map((d: any, i: number) => <Cell key={i} fill={d.color} />)}
                        </Pie>
                        <Tooltip content={({ active, payload }: any) => active && payload?.length ? (
                          <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', fontSize: 11, boxShadow: '0 6px 20px rgba(0,0,0,0.15)' }}>
                            <b>{payload[0].name}</b>: {payload[0].value} hari ({stats.grandTotal > 0 ? Math.round(payload[0].value / stats.grandTotal * 100) : 0}%)
                          </div>) : null} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--green)' }}>{stats.teamPct}%</div>
                      <div style={{ fontSize: 9, color: 'var(--text3)' }}>WFO</div>
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 6, background: '#4f8ef722', color: '#4f8ef7' }}>Pekerja: {stats.pctPekerja}%</span>
                      <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 6, background: '#f59e0b22', color: '#f59e0b' }}>TAD: {stats.pctTAD}%</span>
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text3)' }}>Total {stats.grandWfo} WFO / {stats.grandTotal} hari terisi</div>
                    {/* legend ringkas */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 2 }}>
                      {stats.donutData.map((d: any) => (
                        <div key={d.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5 }}>
                          <span style={{ width: 8, height: 8, borderRadius: 2, background: d.color, flexShrink: 0 }} />
                          <span style={{ flex: 1, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                          <span style={{ fontWeight: 700 }}>{d.value}</span>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => setShowDetail(true)} style={{ fontSize: 10.5, color: 'var(--brand)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', marginTop: 2 }}>Klik detail per member →</button>
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

      {/* POPUP DETAIL per member */}
      {showDetail && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowDetail(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="card" onClick={e => e.stopPropagation()} style={{ width: 560, maxWidth: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Detail Kehadiran Tim</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{periodLabel} · % = porsi WFO dari hari terisi</div>
              </div>
              <button onClick={() => setShowDetail(false)} className="btn btn-icon btn-sm">✕</button>
            </div>
            {/* Legend */}
            <div style={{ padding: '8px 18px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {types.map((t: any) => (
                <span key={t.key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10.5, color: 'var(--text2)' }}>
                  <span style={{ width: 9, height: 9, borderRadius: 2, background: t.textColor || '#4f8ef7' }} />{t.label}
                </span>
              ))}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '10px 18px' }}>
              {stats.memberRows.map((r: any) => (
                <div key={r.id} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{r.name} <span style={{ fontSize: 9.5, color: 'var(--text3)', fontWeight: 400 }}>{r.status === 'TAD' ? 'TAD' : ''}</span></span>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: '#4f8ef7' }}>{r.pct}% WFO <span style={{ color: 'var(--text3)', fontWeight: 400 }}>· {r.total} hari</span></span>
                  </div>
                  {/* stacked bar sama panjang (proporsi dari total hari terisi member itu) */}
                  <div style={{ display: 'flex', height: 14, borderRadius: 4, overflow: 'hidden', background: 'var(--bg3)' }}>
                    {r.total === 0 ? <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8.5, color: 'var(--text3)' }}>belum ada data</div>
                      : PRIORITY.concat(Object.keys(r.days).filter((k: string) => !PRIORITY.includes(k))).filter((cat, idx, arr) => arr.indexOf(cat) === idx && r.days[cat]).map((cat: string) => (
                        <div key={cat} title={`${labelOf(cat)}: ${r.days[cat]} hari`} style={{ width: `${r.days[cat] / r.total * 100}%`, background: colorOf(cat) }} />
                      ))}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: '10px 18px', borderTop: '1px solid var(--border)', fontSize: 11.5, color: 'var(--text2)', display: 'flex', justifyContent: 'space-between' }}>
              <span>Total tim: <b style={{ color: '#4f8ef7' }}>{stats.grandWfo} WFO</b> / {stats.grandTotal} hari terisi</span>
              <span>Rata-rata: <b style={{ color: 'var(--green)' }}>{stats.teamPct}%</b></span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
