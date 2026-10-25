'use client'
import { useState } from 'react'
import { Sheet } from './Sheet'
import { Icon } from './Icon'

type Props = {
  title: string; text?: React.ReactNode; confirmLabel: string; danger?: boolean; icon?: string
  /** Optional free-text field (replaces window.prompt). */
  input?: { label: string; placeholder?: string; required?: boolean; multiline?: boolean }
  onConfirm: (value: string) => Promise<unknown> | unknown; onClose: () => void
}
/** Confirmation sheet — replaces window.confirm()/prompt() so the flow stays in-app and themed. */
export function ConfirmSheet({ title, text, confirmLabel, danger, icon, input, onConfirm, onClose }: Props) {
  const [v, setV] = useState(''), [busy, setBusy] = useState(false), [tried, setTried] = useState(false)
  const missing = !!input?.required && !v.trim()
  async function go() {
    setTried(true)
    if (missing) return
    setBusy(true)
    try { await onConfirm(v.trim()) } finally { setBusy(false) }
  }
  return (
    <Sheet open title={title} onClose={onClose}>
      {text && <div className="au-small au-ink2" style={{ lineHeight: 1.55 }}>{text}</div>}
      {input && <label className="au-col" style={{ gap: 6 }}><span className="lbl">{input.label}{input.required ? ' *' : ''}</span>
        {input.multiline
          ? <textarea className="input" rows={3} value={v} onChange={e => setV(e.target.value)} placeholder={input.placeholder} aria-invalid={tried && missing} />
          : <input className="input" value={v} onChange={e => setV(e.target.value)} placeholder={input.placeholder} aria-invalid={tried && missing} />}
        {tried && missing && <span role="alert" className="au-xs" style={{ color: 'var(--bad)', fontWeight: 600 }}>Wajib diisi</span>}</label>}
      <div className="au-row" style={{ gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" className="btn" onClick={onClose}>Batal</button>
        <button type="button" className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} disabled={busy} onClick={go}>{icon && <Icon name={icon} size={15} />}{busy ? 'Memproses…' : confirmLabel}</button>
      </div>
    </Sheet>
  )
}
