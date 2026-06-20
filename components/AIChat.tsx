'use client'
import { useState, useRef, useEffect } from 'react'

type Msg = { role: 'user' | 'assistant'; content: string }

export default function AIChat() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, loading, open])

  async function send() {
    const text = input.trim()
    if (!text || loading) return
    const next = [...messages, { role: 'user' as const, content: text }]
    setMessages(next)
    setInput('')
    setLoading(true)
    try {
      const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: next }) })
      const d = await r.json()
      if (d.reply) setMessages(m => [...m, { role: 'assistant', content: d.reply }])
      else setMessages(m => [...m, { role: 'assistant', content: `⚠️ ${d.error || 'Gagal memuat respons'}` }])
    } catch (e: any) {
      setMessages(m => [...m, { role: 'assistant', content: `⚠️ ${e?.message || 'Koneksi gagal'}` }])
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <div style={{ position: 'fixed', right: 18, bottom: 18, zIndex: 300 }} className="ai-chat-fab">
      {open && (
        <div className="card scale-in" style={{ position: 'absolute', bottom: 62, right: 0, width: 340, height: 460, maxHeight: 'calc(100vh - 110px)', display: 'flex', flexDirection: 'column', borderRadius: 16, overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.25)', padding: 0 }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🤖</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>Chat AI</div>
              <div style={{ fontSize: 10, color: 'var(--text3)' }}>Asisten · Haiku</div>
            </div>
            {messages.length > 0 && (
              <button onClick={() => setMessages([])} title="Bersihkan" className="btn btn-icon btn-sm">🗑️</button>
            )}
            <button onClick={() => setOpen(false)} className="btn btn-icon btn-sm">✕</button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--bg)' }}>
            {messages.length === 0 && (
              <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text3)', fontSize: 12, padding: 16 }}>
                <div style={{ fontSize: 26, marginBottom: 8 }}>💬</div>
                Tanya apa aja ke asisten AI.<br />Mulai ketik di bawah 👇
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{ maxWidth: '82%', padding: '8px 11px', borderRadius: 12, fontSize: 12.5, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: m.role === 'user' ? 'var(--brand)' : 'var(--bg3)', color: m.role === 'user' ? '#fff' : 'var(--text)', borderBottomRightRadius: m.role === 'user' ? 3 : 12, borderBottomLeftRadius: m.role === 'user' ? 12 : 3 }}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ padding: '8px 12px', borderRadius: 12, background: 'var(--bg3)', color: 'var(--text3)', fontSize: 12 }}>mengetik…</div>
              </div>
            )}
          </div>

          {/* Input */}
          <div style={{ display: 'flex', gap: 8, padding: 10, borderTop: '1px solid var(--border)', background: 'var(--bg2)' }}>
            <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKey} rows={1}
              placeholder="Ketik pesan…" disabled={loading}
              style={{ flex: 1, resize: 'none', maxHeight: 90, padding: '8px 10px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 12.5, outline: 'none', fontFamily: 'inherit' }} />
            <button onClick={send} disabled={loading || !input.trim()} className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-end', opacity: (loading || !input.trim()) ? 0.5 : 1 }}>➤</button>
          </div>
        </div>
      )}

      {/* Floating button */}
      <button onClick={() => setOpen(o => !o)} title="Chat AI"
        style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--brand)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 24, boxShadow: '0 8px 22px rgba(0,0,0,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {open ? '✕' : '💬'}
      </button>
    </div>
  )
}
