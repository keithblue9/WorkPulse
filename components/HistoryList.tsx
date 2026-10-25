'use client'
import { useEffect, useState } from 'react'

type Row = { _id: string; action: 'create' | 'update' | 'delete'; by?: string; createdAt: string; note?: string; changes?: { label: string; from: string; to: string }[] }
const when = (s: string) => { const d = new Date(s); return isNaN(+d) ? '' : d.toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }

/** Riwayat perubahan (siapa mengubah apa) — dimuat saat dibuka supaya sheet tetap ringan. */
export default function HistoryList({ entity, id }: { entity: 'activity' | 'reimbursement'; id: string }) {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [err, setErr] = useState(false)
  useEffect(() => {
    if (!open || rows) return
    fetch(`/api/audit?entity=${entity}&id=${encodeURIComponent(id)}`, { cache: 'no-store' }).then(r => r.ok ? r.json() : Promise.reject()).then(j => setRows(j.data || [])).catch(() => setErr(true))
  }, [open, rows, entity, id])
  return (
    <details className="au-hist" onToggle={e => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary className="au-small" style={{ fontWeight: 600, cursor: 'pointer' }}>Riwayat perubahan</summary>
      {err ? <span className="au-xs au-muted">Riwayat gagal dimuat.</span>
        : !rows ? <span className="au-xs au-muted">Memuat…</span>
        : !rows.length ? <span className="au-xs au-muted">Belum ada riwayat. Riwayat tercatat untuk perubahan mulai fitur ini aktif.</span>
        : <ol className="au-col" style={{ gap: 10, margin: '10px 0 0', padding: 0, listStyle: 'none' }}>
          {rows.map(r => (
            <li key={r._id} className="au-col" style={{ gap: 3, borderLeft: '2px solid var(--line2)', paddingLeft: 10 }}>
              <span className="au-xs au-muted"><b style={{ color: 'var(--ink)' }}>{r.by || 'Sistem'}</b> · {when(r.createdAt)}{r.note ? ` · ${r.note}` : ''}</span>
              {(r.changes || []).map((c, k) => <span key={k} className="au-xs au-ink2">{c.label}: <s style={{ opacity: .6 }}>{c.from}</s> → <b style={{ color: 'var(--ink)' }}>{c.to}</b></span>)}
            </li>
          ))}
        </ol>}
    </details>
  )
}
