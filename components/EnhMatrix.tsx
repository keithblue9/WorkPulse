'use client'
import { score } from '@/lib/enhancement'

const CAT_K: Record<string, string> = { 'Quick Win': 'qw', Strategis: 'st', Minor: 'mi', 'To Be Consider': 'tc' }
export const catK = (c: string) => `k-${CAT_K[c] || 'none'}`
const n1 = (v: number) => (Math.round(v * 100) / 100).toLocaleString('id-ID')
type V = { e: Record<string, any>; s: ReturnType<typeof score> }

/** Impact (atas) vs effort (kanan); skor sama disusun bertingkat agar tidak saling menutupi. */
export function EnhMatrix({ list, onOpen, small }: { list: V[]; onOpen?: (id: string) => void; small?: boolean }) {
  const seen = new Map<string, number>()
  const placed = list.filter(v => CAT_K[v.s.cat]).map(v => {
    const key = `${v.s.impact.toFixed(2)}|${v.s.effort.toFixed(2)}`, k = seen.get(key) || 0
    seen.set(key, k + 1)
    return { v, x: 8 + (Math.min(v.s.effort, 5) / 5) * 84, y: Math.min(94, 6 + (Math.min(v.s.impact, 5) / 5) * 84 + k * (small ? 5 : 7)) }
  })
  return (
    <div className="au-col" style={{ gap: 8 }}>
      <div className={`au-matrix${small ? ' mm' : ''}`} role="group" aria-label="Matriks impact dan effort">
        <div className="qd k-qw" style={{ left: 0, top: 0, background: 'color-mix(in srgb,var(--qw) 12%,transparent)' }}>QUICK WIN</div>
        <div className="qd k-st" style={{ right: 0, top: 0, textAlign: 'right', background: 'color-mix(in srgb,var(--st) 10%,transparent)' }}>STRATEGIS</div>
        <div className="qd k-mi" style={{ left: 0, bottom: 0, display: 'flex', alignItems: 'flex-end' }}>MINOR</div>
        <div className="qd k-tc" style={{ right: 0, bottom: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', background: 'color-mix(in srgb,var(--tc) 9%,transparent)' }}>TO BE CONSIDER</div>
        {placed.map(({ v, x, y }) => {
          const label = `${v.e.code} ${v.e.title}: impact ${n1(v.s.impact)}, effort ${n1(v.s.effort)}`
          return onOpen
            ? <button key={v.e._id} type="button" className={`dot ${catK(v.s.cat)}`} style={{ left: `${x}%`, bottom: `${y}%` }} title={`${v.e.code} · ${v.e.title}`} aria-label={label} onClick={() => onOpen(v.e._id)}>{small ? '' : String(v.e.code || '').replace(/^B-/, '')}</button>
            : <span key={v.e._id} role="img" className={`dot ${catK(v.s.cat)}`} style={{ left: `${x}%`, bottom: `${y}%` }} title={`${v.e.code} · ${v.e.title}`} aria-label={label}>{small ? '' : String(v.e.code || '').replace(/^B-/, '')}</span>
        })}
      </div>
      {!small && <div className="au-row au-between au-xs au-muted"><span>← Effort rendah</span><span>Impact naik ke atas · ambang 2,5</span><span>Effort tinggi →</span></div>}
    </div>
  )
}
