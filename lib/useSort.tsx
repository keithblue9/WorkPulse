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
    <th onClick={() => onSort(k)} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', ...style }} title="Klik untuk sort">
      {label} <span style={{ opacity: active ? 1 : 0.3, fontSize: 9, marginLeft: 2 }}>{active ? (sortDir === 'asc' ? '▲' : '▼') : '⬍'}</span>
    </th>
  )
}
