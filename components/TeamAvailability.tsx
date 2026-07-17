'use client'
import { useEffect, useMemo, useState } from 'react'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts'
import { getConfig } from '@/lib/configCache'
import { cachedFetch } from '@/lib/fetchCache'

// Prioritas kategori per hari (kalau 1 hari multiple slot): WFO > Dinas > Izin > WFH > Cuti > Sakit
const PRIORITY = ['wfo', 'dinas', 'izin', 'wfh', 'cuti', 'sakit']
const BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']
const HARI = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu']

function fmtD(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
function mondayOfWeek(d: Date) { const r = new Date(d); const wd = (r.getDay() + 6) % 7; r.setDate(r.getDate() - wd); return r }
// Parse 'YYYY-MM-DD' sbg tanggal LOKAL (hindari geser hari gara2 UTC)
function parseLocal(s: string) { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1) }
function dayNameOf(dateStr: string) { const d = parseLocal(dateStr); return isNaN(d.getTime()) ? '' : HARI[d.getDay()] }
function fmtShort(d: Date) { return `${d.getDate()} ${BULAN[d.getMonth()].slice(0, 3)}` }

// Minggu (Senin–Minggu) dalam 1 bulan, dipotong di batas bulan.
// Mis. Juli 2026: Minggu 1 = 1–5 Jul, Minggu 2 = 6–12 Jul, dst.
function weeksOfMonth(y: number, m: number) {
  const first = new Date(y, m - 1, 1)
  const last = new Date(y, m, 0)
  const out: { start: Date; end: Date; no: number }[] = []
  const cur = mondayOfWeek(first)
  let no = 1, guard = 0
  while (cur <= last && guard < 10) {
    guard++
    const wEnd = new Date(cur); wEnd.setDate(wEnd.getDate() + 6)
    out.push({
      start: cur < first ? new Date(first) : new Date(cur),
      end: wEnd > last ? new Date(last) : new Date(wEnd),
      no: no++,
    })
    cur.setDate(cur.getDate() + 7)
  }
  return out
}

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

  // ── Navigasi minggu dalam bulan terpilih ──
  const [my, mm0] = viewMonth.split('-').map(Number)
  const weekList = useMemo(() => weeksOfMonth(my, mm0), [my, mm0])
  const [viewWeek, setViewWeek] = useState(0)
  const wIdx = Math.min(Math.max(viewWeek, 0), Math.max(0, weekList.length - 1))
  const curWeek = weekList[wIdx]
  // Index minggu yg memuat hari ini (dipakai saat switch ke mode Minggu)
  const weekIdxOfToday = (y: number, m: number) => {
    const ws = weeksOfMonth(y, m)
    const i = ws.findIndex(w => now >= w.start && now <= new Date(w.end.getFullYear(), w.end.getMonth(), w.end.getDate(), 23, 59, 59))
    return i < 0 ? 0 : i
  }
  // Geser minggu bebas maju/mundur — minggu depan sengaja TIDAK dimatikan
  // karena dipakai buat lihat rencana ke depan.

  function shiftMonth(dir: -1|1) {
    const d = new Date(my, mm0 - 1 + dir, 1)
    setViewMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`)
    setViewWeek(0)
  }
  function shiftWeek(dir: -1|1) {
    const ni = wIdx + dir
    if (ni >= 0 && ni < weekList.length) { setViewWeek(ni); return }
    // lompat bulan: mundur -> minggu terakhir bulan sebelumnya; maju -> minggu pertama bulan berikutnya
    const d = new Date(my, mm0 - 1 + dir, 1)
    const nw = weeksOfMonth(d.getFullYear(), d.getMonth() + 1)
    setViewMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`)
    setViewWeek(dir < 0 ? Math.max(0, nw.length - 1) : 0)
  }

  useEffect(() => {
    (async () => {
      setLoading(true)
      let start: Date, end: Date
      if (scope === 'week') {
        const w = weekList[Math.min(Math.max(viewWeek, 0), Math.max(0, weekList.length - 1))]
        if (!w) { setLoading(false); return }
        start = w.start; end = w.end
      } else {
        start = new Date(my, mm0 - 1, 1)
        end = isCurrentMonth ? now : new Date(my, mm0, 0)
      }
      const [ov, cfg, usersR] = await Promise.all([
        cachedFetch(`/api/attendance/overview?from=${fmtD(start)}&to=${fmtD(end)}`).catch(() => ({ data: [] })),
        getConfig().catch(() => null),
        cachedFetch('/api/users').catch(() => ({ data: [] })),
      ])
      setDocs(ov.data || [])
      setTypes((cfg?.attendanceTypes || []).filter((t: any) => t.active !== false))
      setMembers((usersR.data || []).filter((u: any) => u.active !== false && !(u.roles || []).includes('guest')))
      setLoading(false)
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, viewMonth, viewWeek])

  const colorOf = (key: string) => (types.find((t: any) => t.key === key)?.textColor) || '#9aa6b3'
  const labelOf = (key: string) => (types.find((t: any) => t.key === key)?.label) || key

  // Hitungan berbasis MEMBER (bukan hari):
  // - Tiap member dapat SATU kategori utama utk periode terpilih, pakai prioritas
  //   WFO > Dinas > Izin > WFH > Cuti > Sakit. Jadi member yg pernah WFO di periode
  //   itu dihitung sebagai WFO.
  // - % WFO = jumlah member WFO / total member. Angka legend = jumlah MEMBER (maks = total member).
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

    // per member: kategori tiap hari (prioritas dalam 1 hari) + catat tanggal WFO
    const perMember: Record<string, { days: Record<string, number>, total: number, wfo: number, wfoDates: string[] }> = {}
    for (const [uid, dates] of Object.entries(byMemberDate)) {
      const days: Record<string, number> = {}
      const wfoDates: string[] = []
      let total = 0, wfo = 0
      for (const [date, slotTypes] of Object.entries(dates)) {
        const cat = pickDayCategory(slotTypes)
        if (!cat) continue
        days[cat] = (days[cat] || 0) + 1
        total++
        if (cat === 'wfo') { wfo++; wfoDates.push(date) }
      }
      wfoDates.sort()
      perMember[uid] = { days, total, wfo, wfoDates }
    }

    // map ke member objek (match by _id atau email) + kategori utama periode ini
    const memberRows = members.map(m => {
      const rec = perMember[m._id] || perMember[m.email] || { days: {}, total: 0, wfo: 0, wfoDates: [] }
      const pct = rec.total > 0 ? Math.round(rec.wfo / rec.total * 100) : 0   // % WFO member ini (dipakai di popup detail)
      const mainCat = rec.total > 0 ? pickDayCategory(Object.keys(rec.days)) : ''  // prioritas antar hari
      return { id: m._id, name: shortName(m.name), fullName: m.name, status: (m.status || 'pekerja'), division: m.division, sortOrder: m.sortOrder ?? 999, ...rec, pct, mainCat }
    })

    // Komposisi donut = jumlah MEMBER per kategori (tiap member dihitung 1x) + yg belum presensi.
    // Total selalu = jumlah member.
    const catCount: Record<string, number> = {}
    let grandTotal = 0, grandWfo = 0
    for (const r of memberRows) {
      if (r.mainCat) catCount[r.mainCat] = (catCount[r.mainCat] || 0) + 1
      grandTotal += r.total; grandWfo += r.wfo   // info hari (dipakai di popup)
    }
    const noData = memberRows.filter(r => r.total === 0).length
    const wfoMembers = memberRows.filter(r => r.wfo > 0).length
    const teamPct = memberCount > 0 ? Math.round(wfoMembers / memberCount * 100) : 0

    // % per status = member WFO / total member di status itu
    const calcStatus = (st: string) => {
      const rows = memberRows.filter(r => (st === 'TAD' ? r.status === 'TAD' : r.status !== 'TAD'))
      if (!rows.length) return 0
      return Math.round(rows.filter(r => r.wfo > 0).length / rows.length * 100)
    }

    // donut data: semua kategori (termasuk 0 di legend) + bucket belum presensi
    const donutData = types.map((t: any) => ({ name: t.label, key: t.key, value: catCount[t.key] || 0, color: t.textColor || '#4f8ef7' }))
    if (noData > 0) donutData.push({ name: 'Belum presensi', key: '__none', value: noData, color: '#9aa6b3' })

    return {
      memberRows: memberRows.sort((a, b) => b.pct - a.pct),
      // Member yang sama sekali belum isi presensi di periode ini
      notFilled: memberRows.filter((r: any) => r.total === 0).sort((a: any, b: any) => a.sortOrder - b.sortOrder),
      donutData, teamPct, grandTotal, grandWfo, wfoMembers,
      pctPekerja: calcStatus('pekerja'), pctTAD: calcStatus('TAD'),
    }
  }, [docs, members, types, memberCount])

  // Member yang WFO di periode terpilih + hari-harinya
  const wfoList = useMemo(() => {
    return stats.memberRows
      .filter((r: any) => (r.wfoDates || []).length > 0)
      .map((r: any) => ({
        ...r,
        // Mode Minggu -> nama hari (Senin, Selasa). Mode Bulan -> tanggal (1 Jul, 2 Jul)
        dayLabels: (r.wfoDates || []).map((d: string) => scope === 'week' ? dayNameOf(d) : fmtShort(parseLocal(d))).filter(Boolean),
      }))
      .sort((a: any, b: any) => (b.wfoDates.length - a.wfoDates.length) || (a.sortOrder - b.sortOrder))
  }, [stats.memberRows, scope])

  const periodLabel = scope === 'week'
    ? (curWeek ? `Minggu ${curWeek.no} ${BULAN[mm0 - 1]} (${fmtShort(curWeek.start)}–${fmtShort(curWeek.end)})` : 'minggu ini')
    : isCurrentMonth ? `${BULAN[mm0 - 1]} (s/d hari ini)` : `${BULAN[mm0 - 1]} ${my}`

  const donutNonZero = stats.donutData.filter((d: any) => d.value > 0)

  return (
    <div className="card" style={{ padding: 16, width: "100%" }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 8, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>👥 Team Availability</div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>% member WFO · {periodLabel} · {memberCount} member</div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Navigasi bulan (selalu ada — mode Minggu pun pilih minggu DALAM bulan ini) */}
          <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
            <button onClick={() => shiftMonth(-1)} className="btn btn-sm" style={{ padding: '3px 8px' }}>◀</button>
            <span style={{ fontSize: 11, fontWeight: 600, minWidth: 70, textAlign: 'center' }}>{BULAN[mm0 - 1].slice(0, 3)} {my}</span>
            <button onClick={() => shiftMonth(1)} className="btn btn-sm" style={{ padding: '3px 8px' }}>▶</button>
          </div>
          {/* Navigasi minggu (hanya mode Minggu) */}
          {scope === 'week' && curWeek && (
            <div style={{ display: 'flex', gap: 3, alignItems: 'center', background: 'var(--bg3)', borderRadius: 8, padding: 2 }}>
              <button onClick={() => shiftWeek(-1)} className="btn btn-sm" style={{ padding: '3px 8px' }}>‹</button>
              <span style={{ fontSize: 11, fontWeight: 700, minWidth: 92, textAlign: 'center', color: 'var(--brand)' }} title={`${fmtShort(curWeek.start)} – ${fmtShort(curWeek.end)}`}>
                Minggu {curWeek.no} <span style={{ fontWeight: 400, color: 'var(--text3)' }}>({curWeek.start.getDate()}–{curWeek.end.getDate()})</span>
              </span>
              <button onClick={() => shiftWeek(1)} className="btn btn-sm" style={{ padding: '3px 8px' }}>›</button>
            </div>
          )}
          <div style={{ display: 'flex', gap: 3, background: 'var(--bg3)', borderRadius: 8, padding: 3 }}>
            {(['week', 'month'] as const).map(s => (
              <button key={s} onClick={() => {
                setScope(s)
                if (s === 'week') setViewWeek(isCurrentMonth ? weekIdxOfToday(my, mm0) : 0)
              }} className="btn btn-sm" style={{ fontSize: 11, background: scope === s ? 'var(--brand)' : 'transparent', color: scope === s ? '#fff' : 'var(--text2)', border: 'none' }}>{s === 'week' ? 'Minggu' : 'Bulan'}</button>
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
                            <b>{payload[0].name}</b>: {payload[0].value} member ({memberCount > 0 ? Math.round(payload[0].value / memberCount * 100) : 0}%)
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
                    <div style={{ fontSize: 10, color: 'var(--text3)' }}><b style={{ color:'var(--green)' }}>{stats.wfoMembers}</b> dari {memberCount} member WFO · {stats.grandWfo} hari WFO</div>
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

            {/* KANAN: siapa yang WFO di periode terpilih + hari-harinya */}
            <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: 16, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>
                🏢 WFO · {scope === 'week' && curWeek ? `Minggu ${curWeek.no} ${BULAN[mm0 - 1].slice(0, 3)}` : `${BULAN[mm0 - 1].slice(0, 3)} ${my}`}
              </div>
              {wfoList.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text3)', padding: '14px 0' }}>Belum ada member WFO di periode ini.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 210, overflowY: 'auto' }}>
                  {wfoList.map((m: any, i: number) => (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 8px', borderRadius: 7, background: 'var(--bg3)' }}>
                      <span style={{ fontSize: 10, color: 'var(--text3)', minWidth: 12, textAlign: 'right', flexShrink: 0, paddingTop: 1 }}>{i + 1}.</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 600 }}>{m.name}</span>
                          {m.status === 'TAD' && <span style={{ fontSize: 8.5, color: '#f59e0b', fontWeight: 700 }}>TAD</span>}
                          <span style={{ fontSize: 9.5, color: 'var(--text3)', marginLeft: 'auto', flexShrink: 0 }}>{m.wfoDates.length} hari</span>
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text2)', marginTop: 1, lineHeight: 1.45 }}>
                          {m.dayLabels.join(', ')}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 2 }}>{wfoList.length} dari {memberCount} member pernah WFO</div>
                </div>
              )}

              {/* Legend: siapa yang belum isi presensi di periode ini */}
              {stats.notFilled.length > 0 && (
                <div style={{ marginTop: 10, padding: '7px 9px', borderRadius: 7, background: 'var(--bg3)', border: '1px dashed var(--border)' }}>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 4 }}>
                    ⚠️ Belum isi presensi ({stats.notFilled.length})
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {stats.notFilled.map((m: any) => (
                      <span key={m.id} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, background: 'var(--bg)', color: 'var(--text2)', border: '1px solid var(--border)' }}>
                        {m.name}{m.status === 'TAD' ? ' · TAD' : ''}
                      </span>
                    ))}
                  </div>
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
