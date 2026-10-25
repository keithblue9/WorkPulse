'use client'
import { useEffect, useRef } from 'react'
type Props = { open: boolean; title: string; onClose: () => void; onSave?: () => void; saveLabel?: string; saveDisabled?: boolean; wide?: boolean; children: React.ReactNode }
/** Modal on desktop, bottom sheet on phones (see .modal rules in globals.css). */
export function Sheet({ open, title, onClose, onSave, saveLabel = 'Simpan', saveDisabled, wide, children }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    const f = ref.current?.querySelector<HTMLElement>('input,select,textarea,button:not([data-sheet-close])')
    f?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); prev?.focus?.({ preventScroll: true }) }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div ref={ref} className="modal" role="dialog" aria-modal="true" aria-label={title} style={{ width: wide ? 820 : 520, maxWidth: '100%' }}>
        <div className="au-sheet-h">
          <button type="button" className="au-link" data-sheet-close onClick={onClose}>{onSave ? 'Batal' : 'Tutup'}</button>
          <h2>{title}</h2>
          {onSave ? <button type="button" className="au-link" style={{ fontWeight: 800 }} disabled={saveDisabled} onClick={onSave}>{saveLabel}</button> : <span style={{ width: 48 }} />}
        </div>
        <div data-modal-scroll className="au-sheet-b">{children}</div>
      </div>
    </div>
  )
}
