'use client'
import React, { useState } from 'react'

export type SortDir = 'asc' | 'desc'

export function useSort(initialKey = '', initialDir: SortDir = 'asc') {
  const [sortKey, setSortKey] = useState(initialKey)
  const [sortDir, setSortDir] = useState<SortDir>(initialDir)
  function toggle(key: string) {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }
  return { sortKey, sortDir, toggle }
}

export function sortRows<T>(rows: T[], key: string, dir: SortDir, accessors: Record<string, (r: T) => any>): T[] {
  if (!key || !accessors[key]) return rows
  const acc = accessors[key]
  const sorted = [...rows].sort((a, b) => {
    const va = acc(a), vb = acc(b)
    if (va == null && vb == null) return 0
    if (va == null) return 1
    if (vb == null) return -1
    if (typeof va === 'number' && typeof vb === 'number') return va - vb
    return String(va).localeCompare(String(vb), 'id', { numeric: true })
  })
  return dir === 'desc' ? sorted.reverse() : sorted
}

export function SortTh({ label, k, sortKey, sortDir, onSort, style }:
  { label: string; k: string; sortKey: string; sortDir: SortDir; onSort: (k: string) => void; style?: React.CSSProperties }) {
  const active = sortKey === k
  return (
    <th aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} style={{ whiteSpace: 'nowrap', ...style }}>
      <button type="button" className="au-sort" onClick={() => onSort(k)} title="Urutkan">
        {label}
        <svg width="10" height="12" viewBox="0 0 10 12" aria-hidden="true" style={{ flexShrink: 0 }}>
          <path d="M5 1 9 5H1z" fill="currentColor" opacity={active && sortDir === 'asc' ? 1 : 0.28} />
          <path d="M5 11 1 7h8z" fill="currentColor" opacity={active && sortDir === 'desc' ? 1 : 0.28} />
        </svg>
      </button>
    </th>
  )
}
