'use client'
import { useState, useRef, useEffect } from 'react'
import toast from 'react-hot-toast'
import { exportJpg, exportPdf, exportPpt } from '@/lib/exportView'

// getNodes returns the list of section nodes to export — each becomes its own
// page (PDF) / slide (PPT) / image (JPG), so nothing gets crammed/shrunk.
export default function ExportMenu({ getNodes, filename, title }: { getNodes: () => HTMLElement[]; filename: string; title?: string }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function h(e: MouseEvent) { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  async function run(kind: 'pdf' | 'jpg' | 'ppt') {
    const nodes = (getNodes() || []).filter(Boolean)
    if (!nodes.length) { toast.error('Belum ada konten untuk diexport'); return }
    setOpen(false); setBusy(kind)
    const t = toast.loading(`Menyiapkan ${kind.toUpperCase()}...`)
    try {
      if (kind === 'pdf') await exportPdf(nodes, filename)
      else if (kind === 'jpg') await exportJpg(nodes, filename)
      else await exportPpt(nodes, filename, title)
      toast.success(`${kind.toUpperCase()} berhasil diunduh`, { id: t })
    } catch (e: any) {
      toast.error(`Gagal export ${kind.toUpperCase()}: ${e?.message || 'error'}`, { id: t })
    } finally { setBusy(null) }
  }

  const opts: Array<['pdf' | 'jpg' | 'ppt', string]> = [['pdf', '📄  PDF'], ['jpg', '🖼️  JPG (gambar)'], ['ppt', '📊  PPT']]

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button onClick={() => setOpen(o => !o)} disabled={!!busy} className="btn btn-sm">
        {busy ? `⏳ ${busy.toUpperCase()}...` : '⬇ Export'}
      </button>
      {open && (
        <div className="card" style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', zIndex: 50, minWidth: 160, padding: 4, boxShadow: 'var(--shadow)' }}>
          {opts.map(([k, label]) => (
            <button key={k} onClick={() => run(k)}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: 'none', background: 'transparent', color: 'var(--text2)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
