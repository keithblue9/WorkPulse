'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon, Portal } from '@/components/ui'

type Item = { href: string; label: string; icon: string; group: string }
type Row = { t: string; s: string; i: string; run: () => void }

/** ⌘K / Ctrl+K: jump to any menu the user may open, switch theme or year. */
export default function CommandPalette({ open, onClose, items, onTheme, years, onYear }: { open: boolean; onClose: () => void; items: Item[]; onTheme: () => void; years: number[]; onYear: (y: number) => void }) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [idx, setIdx] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => { if (open) { setQ(''); setIdx(0); setTimeout(() => input.current?.focus(), 10) } }, [open])

  const rows = useMemo<Row[]>(() => {
    const all: Row[] = [
      ...items.map(m => ({ t: m.label, s: m.group, i: m.icon, run: () => router.push(m.href) })),
      { t: 'Ganti tema', s: 'Aksi', i: 'moon', run: onTheme },
      ...years.map(y => ({ t: `Tahun ${y}`, s: 'Aksi', i: 'cal', run: () => onYear(y) })),
    ]
    const s = q.trim().toLowerCase()
    return (s ? all.filter(r => (r.t + ' ' + r.s).toLowerCase().includes(s)) : all.slice(0, 10)).slice(0, 12)
  }, [q, items, years, router, onTheme, onYear])

  if (!open) return null
  const go = (r?: Row) => { if (!r) return; onClose(); r.run() }
  return (
    <Portal>
    <div className="modal-overlay" style={{ alignItems: 'flex-start', paddingTop: '12vh' }} onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="wn-pal" role="dialog" aria-modal="true" aria-label="Cari cepat">
        <input ref={input} value={q} placeholder="Cari menu atau aksi…" aria-label="Cari cepat" autoComplete="off"
          onChange={e => { setQ(e.target.value); setIdx(0) }}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(i + 1, rows.length - 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(i => Math.max(i - 1, 0)) }
            else if (e.key === 'Enter') { e.preventDefault(); go(rows[idx]) }
            else if (e.key === 'Escape') onClose()
          }} />
        <ul role="listbox">
          {rows.length ? rows.map((r, i) => (
            <li key={r.t + r.s}><button type="button" role="option" aria-selected={i === idx} onMouseEnter={() => setIdx(i)} onClick={() => go(r)}><Icon name={r.i} /><span>{r.t}</span><span className="k">{r.s}</span></button></li>
          )) : <li className="au-small au-muted" style={{ padding: 14 }}>Tidak ada hasil untuk &quot;{q}&quot;.</li>}
        </ul>
      </div>
    </div>
    </Portal>
  )
}
