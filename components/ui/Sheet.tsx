'use client'
import { useEffect, useRef } from 'react'
type Props = { open: boolean; title: string; onClose: () => void; onSave?: () => void; saveLabel?: string; saveDisabled?: boolean; wide?: boolean; children: React.ReactNode }
/** Modal on desktop, bottom sheet on phones (see .modal rules in globals.css). */
export function Sheet({ open, title, onClose, onSave, saveLabel = 'Simpan', saveDisabled, wide, children }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  // onClose sering berupa fungsi inline (identitas baru tiap render). Simpan di ref supaya efek
  // di bawah hanya jalan saat sheet dibuka/ditutup — bukan tiap ketikan (fokus tidak melompat).
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    const dlg = ref.current
    // Fokus ke elemen bertanda autoFocus bila ada; selain itu ke dialog (tanpa memunculkan keyboard di HP).
    if (dlg && !dlg.contains(document.activeElement)) dlg.focus({ preventScroll: true })
    // Hanya sheet paling atas yang menutup dengan Esc (sheet bisa bertumpuk).
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const overlays = document.querySelectorAll('.modal-overlay')
      if (overlays[overlays.length - 1] === ref.current?.parentElement) closeRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); if (prev && document.contains(prev)) prev.focus?.({ preventScroll: true }) }
  }, [open])
  if (!open) return null
  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div ref={ref} className="modal" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} style={{ width: wide ? 820 : 520, maxWidth: '100%', outline: 'none' }}>
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
