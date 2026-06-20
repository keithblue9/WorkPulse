'use client'
import { useState, useRef, useEffect } from 'react'
import { useSession } from 'next-auth/react'

type Msg = { role: 'user' | 'assistant'; content: string }

const FACE = '/siera/siera-08.png' // framed to face via objectPosition
const WAVE = '/siera/siera-01.png'

function localToday() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function Siera() {
  const { data: session } = useSession()
  const user = session?.user as any

  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [greeting, setGreeting] = useState(false)
  const [greetText, setGreetText] = useState('')

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Greet the member once per day when they open the app
  useEffect(() => {
    if (!user) return
    const key = `siera-greet-${localToday()}`
    try { if (localStorage.getItem(key)) return } catch { return }
    const roles: string[] = (user.roles && user.roles.length) ? user.roles : (user.role ? [user.role] : [])
    const isGuest = roles.length > 0 && roles.every((r) => r === 'guest')
    const first = isGuest ? '' : (user.name?.split(' ')[0] || '')
    const t = setTimeout(() => {
      setGreetText(isGuest
        ? 'Halo! 👋 Aku SIERA. Klik aku kalau butuh bantuan ya!'
        : `Halo ${first}! 👋 Aku SIERA. Ada yang bisa dibantu hari ini?`)
      setGreeting(true)
      try { localStorage.setItem(key, '1') } catch {}
      setTimeout(() => setGreeting(false), 9000)
    }, 1800)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, loading, open])

  function toggleOpen() {
    setGreeting(false)
    setOpen(o => !o)
    if (!open) setTimeout(() => inputRef.current?.focus(), 120)
  }

  async function send() {
    const text = input.trim()
    if (!text || loading) return
    const next = [...messages, { role: 'user' as const, content: text }]
    setMessages(next); setInput(''); setLoading(true)
    try {
      const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: next }) })
      const d = await r.json()
      setMessages(m => [...m, { role: 'assistant', content: d.reply || `⚠️ ${d.error || 'Gagal memuat respons'}` }])
    } catch (e: any) {
      setMessages(m => [...m, { role: 'assistant', content: `⚠️ ${e?.message || 'Koneksi gagal'}` }])
    } finally {
      setLoading(false); setTimeout(() => inputRef.current?.focus(), 50)
    }
  }
  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <div style={{ position: 'fixed', right: 18, bottom: 18, zIndex: 300, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
      {/* Chat panel */}
      {open && (
        <div className="card scale-in" style={{ width: 340, maxWidth: 'calc(100vw - 32px)', height: 460, maxHeight: 'calc(100vh - 130px)', display: 'flex', flexDirection: 'column', borderRadius: 16, overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.25)', padding: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', background: 'var(--brand-soft)', flexShrink: 0 }}>
              <img src={FACE} alt="SIERA" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 0%', pointerEvents: 'none' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>SIERA</div>
              <div style={{ fontSize: 10, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)' }} /> Asisten AI · online</div>
            </div>
            {messages.length > 0 && <button onClick={() => setMessages([])} title="Bersihkan" className="btn btn-icon btn-sm">🗑️</button>}
            <button onClick={() => setOpen(false)} className="btn btn-icon btn-sm">✕</button>
          </div>

          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--bg)' }}>
            {messages.length === 0 && (
              <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text3)', fontSize: 12, padding: 10 }}>
                <img src={WAVE} alt="SIERA" style={{ height: 120, marginBottom: 6 }} />
                <div style={{ fontWeight: 600, color: 'var(--text2)', marginBottom: 2 }}>Hai, aku SIERA 👋</div>
                Tanya apa aja, aku bantu jawab.
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{ maxWidth: '82%', padding: '8px 11px', borderRadius: 12, fontSize: 12.5, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: m.role === 'user' ? 'var(--brand)' : 'var(--bg3)', color: m.role === 'user' ? '#fff' : 'var(--text)', borderBottomRightRadius: m.role === 'user' ? 3 : 12, borderBottomLeftRadius: m.role === 'user' ? 12 : 3 }}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && <div style={{ display: 'flex', justifyContent: 'flex-start' }}><div style={{ padding: '8px 12px', borderRadius: 12, background: 'var(--bg3)', color: 'var(--text3)', fontSize: 12 }}>SIERA mengetik…</div></div>}
          </div>

          <div style={{ display: 'flex', gap: 8, padding: 10, borderTop: '1px solid var(--border)', background: 'var(--bg2)' }}>
            <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKey} rows={1}
              placeholder="Tulis pesan untuk SIERA…" disabled={loading}
              style={{ flex: 1, resize: 'none', maxHeight: 90, padding: '8px 10px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 12.5, outline: 'none', fontFamily: 'inherit' }} />
            <button onClick={send} disabled={loading || !input.trim()} className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-end', opacity: (loading || !input.trim()) ? 0.5 : 1 }}>➤</button>
          </div>
        </div>
      )}

      {/* Greeting speech bubble */}
      {greeting && !open && (
        <div onClick={toggleOpen} style={{ maxWidth: 230, padding: '10px 13px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, borderBottomRightRadius: 4, boxShadow: '0 8px 24px rgba(0,0,0,0.18)', fontSize: 12.5, lineHeight: 1.5, color: 'var(--text)', cursor: 'pointer', animation: 'siera-bubble-in 0.4s ease' }}>
          {greetText}
        </div>
      )}

      {/* SIERA avatar button (clean circular face) */}
      <button onClick={toggleOpen} title="Chat dengan SIERA" className="siera-float"
        style={{ position: 'relative', width: 58, height: 58, borderRadius: '50%', border: '2px solid var(--bg2)', background: 'linear-gradient(135deg, var(--brand), #8b7adc)', cursor: 'pointer', padding: 0, overflow: 'hidden', boxShadow: '0 8px 22px rgba(0,0,0,0.28)' }}>
        <img src={FACE} alt="SIERA" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 0%', pointerEvents: 'none', userSelect: 'none' }} />
        {!open && <span style={{ position: 'absolute', top: 3, right: 3, width: 11, height: 11, borderRadius: '50%', background: 'var(--green)', border: '2px solid var(--bg2)' }} />}
      </button>
    </div>
  )
}
