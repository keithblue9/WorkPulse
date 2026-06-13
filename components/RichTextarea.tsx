'use client'
import { useRef } from 'react'

// Textarea with bullet/numbering toolbar. Inserts "• " or "1. " at line start.
export default function RichTextarea({ value, onChange, rows=4, placeholder='', style={} }: {
  value: string; onChange: (v:string)=>void; rows?:number; placeholder?:string; style?:React.CSSProperties
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  function applyPrefix(prefix:'bullet'|'number') {
    const ta = ref.current
    if (!ta) return
    const start = ta.selectionStart, end = ta.selectionEnd
    const text = value || ''
    // Determine affected lines
    const before = text.slice(0, start)
    const sel = text.slice(start, end) || ''
    const after = text.slice(end)
    const lineStart = before.lastIndexOf('\n') + 1
    const block = text.slice(lineStart, end)
    const lines = block.split('\n')
    let counter = 1
    const transformed = lines.map(l => {
      const trimmed = l.replace(/^(\s*)([•\-*]\s+|\d+\.\s+)/, '$1') // strip existing
      if (trimmed.trim() === '') return trimmed
      if (prefix === 'bullet') return '• ' + trimmed
      return (counter++) + '. ' + trimmed
    }).join('\n')
    const newText = text.slice(0, lineStart) + transformed + after
    onChange(newText)
    setTimeout(() => { ta.focus(); ta.setSelectionRange(lineStart, lineStart + transformed.length) }, 0)
  }

  function handleKeyDown(e:React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter') {
      const ta = e.currentTarget
      const pos = ta.selectionStart
      const text = value || ''
      const lineStart = text.lastIndexOf('\n', pos - 1) + 1
      const currentLine = text.slice(lineStart, pos)
      const bulletMatch = currentLine.match(/^(\s*)([•\-*])\s+/)
      const numMatch = currentLine.match(/^(\s*)(\d+)\.\s+/)
      if (bulletMatch) {
        e.preventDefault()
        // If line is empty bullet, remove it (exit list)
        if (currentLine.trim() === bulletMatch[2]) {
          const newText = text.slice(0, lineStart) + text.slice(pos)
          onChange(newText)
          setTimeout(()=>{ ta.focus(); ta.setSelectionRange(lineStart, lineStart) }, 0)
          return
        }
        const insert = '\n' + bulletMatch[1] + bulletMatch[2] + ' '
        const newText = text.slice(0, pos) + insert + text.slice(pos)
        onChange(newText)
        setTimeout(()=>{ ta.focus(); ta.setSelectionRange(pos+insert.length, pos+insert.length) }, 0)
      } else if (numMatch) {
        e.preventDefault()
        if (currentLine.trim() === numMatch[2] + '.') {
          const newText = text.slice(0, lineStart) + text.slice(pos)
          onChange(newText)
          setTimeout(()=>{ ta.focus(); ta.setSelectionRange(lineStart, lineStart) }, 0)
          return
        }
        const next = parseInt(numMatch[2]) + 1
        const insert = '\n' + numMatch[1] + next + '. '
        const newText = text.slice(0, pos) + insert + text.slice(pos)
        onChange(newText)
        setTimeout(()=>{ ta.focus(); ta.setSelectionRange(pos+insert.length, pos+insert.length) }, 0)
      }
    }
  }

  return (
    <div>
      <div style={{ display:'flex', gap:4, marginBottom:4 }}>
        <button type="button" onClick={()=>applyPrefix('bullet')} className="btn btn-sm btn-icon" title="Bullet list" style={{ fontSize:13 }}>•</button>
        <button type="button" onClick={()=>applyPrefix('number')} className="btn btn-sm btn-icon" title="Numbered list" style={{ fontSize:11 }}>1.</button>
      </div>
      <textarea ref={ref} className="input" rows={rows} value={value} placeholder={placeholder} style={style}
        onChange={e=>onChange(e.target.value)} onKeyDown={handleKeyDown} />
    </div>
  )
}
