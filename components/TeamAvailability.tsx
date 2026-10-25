'use client'
import { useEffect, useMemo, useState } from 'react'
import { Donut, Icon, Seg, Sheet } from '@/components/ui'
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
    <section className="au-card" style={{ width: '100%' }}>
      <div className="au-row au-between au-wrap" style={{ gap: 8 }}>
        <div className="au-col"><h2>Ketersediaan tim</h2><span className="au-xs au-muted">% member WFO · {periodLabel} · {memberCount} member</span></div>
        <div className="au-row au-wrap" style={{ gap: 6 }}>
          <div className="au-row" style={{ gap: 4 }}>
            <button type="button" onClick={() => shiftMonth(-1)} className="btn btn-icon btn-sm" aria-label="Bulan sebelumnya"><Icon name="left" size={15} /></button>
            <b style={{ fontSize: 13, minWidth: 74, textAlign: 'center' }}>{BULAN[mm0 - 1].slice(0, 3)} {my}</b>
            <button type="button" onClick={() => shiftMonth(1)} className="btn btn-icon btn-sm" aria-label="Bulan berikutnya"><Icon name="right" size={15} /></button>
          </div>
          {scope === 'week' && curWeek && (
            <div className="au-row" style={{ gap: 4 }}>
              <button type="button" onClick={() => shiftWeek(-1)} className="btn btn-icon btn-sm" aria-label="Minggu sebelumnya"><Icon name="left" size={15} /></button>
              <b style={{ fontSize: 12.5, minWidth: 96, textAlign: 'center', color: 'var(--accent-ink)' }} title={`${fmtShort(curWeek.start)} – ${fmtShort(curWeek.end)}`}>Minggu {curWeek.no} <span className="au-muted" style={{ fontWeight: 500 }}>({curWeek.start.getDate()}–{curWeek.end.getDate()})</span></b>
              <button type="button" onClick={() => shiftWeek(1)} className="btn btn-icon btn-sm" aria-label="Minggu berikutnya"><Icon name="right" size={15} /></button>
            </div>
          )}
          <Seg label="Periode" value={scope} onChange={s => { setScope(s); if (s === 'week') setViewWeek(isCurrentMonth ? weekIdxOfToday(my, mm0) : 0) }} options={[['week', 'Minggu'], ['month', 'Bulan']] as const} />
        </div>
      </div>

      {loading ? <div className="au-row" style={{ gap: 16 }}><div className="au-skel" style={{ width: 132, height: 132, borderRadius: '50%' }} /><div className="au-col" style={{ flex: 1, gap: 8 }}><div className="au-skel" /><div className="au-skel" style={{ width: '60%' }} /></div></div>
        : (
          <div className="au-grid g2" style={{ gap: 18 }}>
            <div className="au-col" style={{ gap: 10, minWidth: 0 }}>
              {stats.grandTotal === 0 ? <span className="au-small au-muted" style={{ padding: '24px 0' }}>Belum ada data presensi di periode ini.</span> : (
                <div className="au-row" style={{ gap: 16, alignItems: 'center' }}>
                  <Donut data={donutNonZero.map((d: any) => ({ value: d.value, color: d.color, name: d.name }))} size={132} stroke={18} label={`${stats.teamPct}% member WFO`}>
                    <b style={{ fontSize: 24, color: 'var(--ok)' }}>{stats.teamPct}%</b><span>WFO</span>
                  </Donut>
                  <div className="au-col" style={{ flex: 1, minWidth: 0, gap: 6 }}>
                    <span className="au-row au-wrap" style={{ gap: 6 }}><span className="au-tag">Pekerja {stats.pctPekerja}%</span><span className="au-tag">TAD {stats.pctTAD}%</span></span>
                    <span className="au-xs au-muted"><b style={{ color: 'var(--ok)' }}>{stats.wfoMembers}</b> dari {memberCount} member WFO · {stats.grandWfo} hari WFO</span>
                    <div className="au-col" style={{ gap: 3, maxWidth: 240 }}>{stats.donutData.map((d: any) => (
                      <span key={d.key} className="au-row au-xs" style={{ gap: 6 }}><i style={{ width: 9, height: 9, borderRadius: 3, background: d.color, flexShrink: 0 }} /><span className="au-ink2" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span><b>{d.value}</b></span>
                    ))}</div>
                    <button type="button" className="au-link" style={{ alignSelf: 'flex-start', padding: 0 }} onClick={() => setShowDetail(true)}>Detail per member</button>
                  </div>
                </div>
              )}
            </div>
            <div className="au-col" style={{ gap: 8, minWidth: 0 }}>
              <span className="lbl">WFO · {scope === 'week' && curWeek ? `Minggu ${curWeek.no} ${BULAN[mm0 - 1].slice(0, 3)}` : `${BULAN[mm0 - 1].slice(0, 3)} ${my}`}</span>
              {wfoList.length === 0 ? <span className="au-small au-muted">Belum ada member WFO di periode ini.</span> : (
                <div className="au-ig" style={{ maxHeight: 230, overflowY: 'auto' }}>
                  {wfoList.map((m: any) => (
                    <div key={m.id} className="au-igr" style={{ alignItems: 'flex-start', padding: '10px 14px' }}>
                      <span className="au-col" style={{ flex: 1, minWidth: 0, gap: 2 }}>
                        <span className="au-row" style={{ gap: 6 }}><b style={{ fontSize: 14 }}>{m.name}</b>{m.status === 'TAD' && <span className="au-tag">TAD</span>}<span className="au-xs au-muted" style={{ marginLeft: 'auto' }}>{m.wfoDates.length} hari</span></span>
                        <span className="au-xs au-ink2">{m.dayLabels.join(', ')}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {stats.notFilled.length > 0 && (
                <div className="au-col" style={{ gap: 6, padding: 10, borderRadius: 14, border: '1px dashed var(--line2)' }}>
                  <span className="lbl">Belum isi presensi ({stats.notFilled.length})</span>
                  <span className="au-row au-wrap" style={{ gap: 4 }}>{stats.notFilled.map((m: any) => <span key={m.id} className="au-tag">{m.name}{m.status === 'TAD' ? ' · TAD' : ''}</span>)}</span>
                </div>
              )}
            </div>
          </div>
        )}

      {showDetail && (
        <Sheet open title="Detail kehadiran tim" onClose={() => setShowDetail(false)}>
          <p className="au-xs au-muted" style={{ marginTop: -4 }}>{periodLabel} · % = porsi WFO dari hari terisi</p>
          <div className="au-key">{types.map((t: any) => <span key={t.key}><i style={{ background: t.textColor || 'var(--accent)' }} />{t.label}</span>)}</div>
          <div className="au-col" style={{ gap: 12 }}>
            {stats.memberRows.map((r: any) => (
              <div key={r.id} className="au-col" style={{ gap: 4 }}>
                <span className="au-row au-between"><b style={{ fontSize: 14 }}>{r.name} {r.status === 'TAD' && <span className="au-tag">TAD</span>}</b><span className="au-small"><b style={{ color: 'var(--accent-ink)' }}>{r.pct}% WFO</b> <span className="au-muted">· {r.total} hari</span></span></span>
                <div className="au-stack" style={{ height: 12 }}>
                  {r.total === 0 ? <i style={{ flex: 1, background: 'var(--sunken)' }} />
                    : PRIORITY.concat(Object.keys(r.days).filter((k: string) => !PRIORITY.includes(k))).filter((cat, idx, arr) => arr.indexOf(cat) === idx && r.days[cat]).map((cat: string) => (
                      <i key={cat} title={`${labelOf(cat)}: ${r.days[cat]} hari`} style={{ flex: r.days[cat], background: colorOf(cat) }} />
                    ))}
                </div>
              </div>
            ))}
          </div>
          <div className="au-row au-between au-small" style={{ paddingTop: 10, borderTop: '1px solid var(--line)' }}>
            <span>Total tim <b>{stats.grandWfo} WFO</b> / {stats.grandTotal} hari terisi</span><span>Rata-rata <b style={{ color: 'var(--ok)' }}>{stats.teamPct}%</b></span>
          </div>
        </Sheet>
      )}
    </section>
  )
}
