'use client'
import { useEffect, useRef } from 'react'
import { ganttScale } from '@/lib/gantt'
import { DAY, dUTC, ptd, type Act } from '@/lib/progress'

/** Gantt per aktivitas: batang = rencana, isi = % selesai, garis merah = hari ini. */
export function Gantt({ acts, today, onSelect, labels }: { acts: Act[]; today: number; onSelect?: (i: number) => void; labels?: string[] /* teks kecil per baris, default bobot · % selesai */ }) {
  const g = ganttScale(acts, today)
  const wrap = useRef<HTMLDivElement>(null)
  const tPos = g ? g.pos(today) : 0
  // Di layar sempit timeline bisa digeser: mulai dengan "hari ini" terlihat.
  useEffect(() => {
    const el = wrap.current, line = el?.querySelector<HTMLElement>('.au-tline')
    if (!el || !line || el.scrollWidth <= el.clientWidth) return
    el.scrollLeft = Math.max(0, line.offsetLeft - el.clientWidth * 0.6)
  }, [tPos])
  if (!g) return <p className="au-small au-muted">Belum ada tanggal aktivitas. Isi tanggal mulai & selesai untuk melihat timeline.</p>
  const step = g.months.length > 16 ? 3 : g.months.length > 10 ? 2 : 1
  return (
    <>
    <div className="au-gwrap" ref={wrap}>
      <div className="au-gantt">
        <div className="au-ghead"><span /><div className="au-gmon">{g.months.map((m, i) => <span key={m.t} className={m.jan || i === 0 ? 'yr' : ''}>{i % step ? '' : m.label}</span>)}</div></div>
        <div className="au-gbody">
          <div className="au-tline" style={{ left: `calc(var(--gl) + (100% - var(--gl)) * ${g.pos(today) / 100})` }} />
          {acts.map((a, i) => {
            const s = dUTC(a.start), e = dUTC(a.end)
            const ok = Number.isFinite(s) && Number.isFinite(e) && e >= s
            const l = ok ? g.pos(s) : 0, w = ok ? Math.max(g.pos(e + DAY) - l, 1.3) : 0
            const late = ok && ptd(a, today) > a.pct + 0.5 && today > s
            const label = `${a.name}, ${a.start || '?'} sampai ${a.end || '?'}, ${Math.round(a.pct)}% selesai${late ? ', tertinggal dari rencana' : ''}`
            return (
              <div className="au-grow" key={i}>
                <button type="button" className="au-glab" onClick={() => onSelect?.(i)} disabled={!onSelect}>
                  <b>{a.name}</b><span className="au-xs au-muted">{labels?.[i] ?? `${Math.round(a.w)}% bobot · ${Math.round(a.pct)}% selesai`}</span>
                </button>
                <div className="au-gtr">
                  {g.months.map(m => <span key={m.t} className={`gl${m.jan ? ' yl' : ''}`} style={{ left: `${g.pos(m.t)}%` }} />)}
                  {ok && <button type="button" className={`au-bar${late ? ' late' : ''}${a.pct >= 60 ? ' done' : ''}`} style={{ left: `${l}%`, width: `${w}%` }} aria-label={label} onClick={() => onSelect?.(i)} disabled={!onSelect}>
                    <i style={{ width: `${Math.min(100, a.pct)}%` }} />{w > 6 && <em>{Math.round(a.pct)}%</em>}
                  </button>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
    <div className="au-key" style={{ marginTop: 10 }}>
      <span><i style={{ background: 'var(--accent)' }} />Selesai</span><span><i style={{ background: 'var(--plan)' }} />Rencana</span>
      <span><i style={{ background: 'transparent', boxShadow: 'inset 0 0 0 2px var(--today)' }} />Tertinggal</span><span><i style={{ background: 'var(--today)' }} />Hari ini</span>
    </div>
    </>
  )
}
