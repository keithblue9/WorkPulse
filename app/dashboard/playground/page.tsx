'use client'
import { useState, useRef, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'

const AVATAR = '/wibi/wibi-avatar.png'

type Att = { name: string; mediaType: string; dataUrl: string; kind: 'image' | 'document' }
type Msg = { role: 'user' | 'assistant'; text: string; attachments?: Att[] }

const SUGGESTIONS = [
  'Analisa realisasi budget tahun ini, ada anomali?',
  'Ringkas reimbursement bulan ini per sumber dana',
  'Cost element mana yang paling boros vs plan?',
  'Insight cash card: bulan mana settlement paling tinggi?',
]

// very small markdown: **bold**, line breaks, - bullets
function inlineBold(s: string, keyBase: number) {
  return s.split(/(\*\*[^*]+\*\*)/g).map((p, j) =>
    p.startsWith('**') && p.endsWith('**') ? <b key={`${keyBase}-${j}`}>{p.slice(2, -2)}</b> : <span key={`${keyBase}-${j}`}>{p}</span>
  )
}
function renderText(t: string) {
  return t.split('\n').map((ln, i) => {
    const m = ln.match(/^(\s*)[-•]\s+(.*)$/)
    if (m) return <div key={i} style={{ paddingLeft: 16, position: 'relative' }}><span style={{ position: 'absolute', left: 2 }}>•</span>{inlineBold(m[2], i)}</div>
    return <div key={i}>{ln ? inlineBold(ln, i) : '\u00A0'}</div>
  })
}

export default function PlaygroundPage() {
  const { data: session } = useSession()
  const user = session?.user as any
  const first = user?.name?.split(' ')[0] || ''

  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [pending, setPending] = useState<Att[]>([])
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight }, [messages, loading])

  async function onFiles(files: FileList | null) {
    if (!files) return
    const arr = Array.from(files).slice(0, 5)
    for (const f of arr) {
      const isImg = f.type.startsWith('image/')
      const isPdf = f.type === 'application/pdf'
      if (!isImg && !isPdf) { toast.error(`${f.name}: hanya gambar atau PDF`); continue }
      if (f.size > 8 * 1024 * 1024) { toast.error(`${f.name}: maksimal 8MB`); continue }
      const dataUrl: string = await new Promise((res, rej) => {
        const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(f)
      })
      setPending(p => [...p, { name: f.name, mediaType: f.type, dataUrl, kind: isImg ? 'image' : 'document' }])
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  function attBlocks(atts: Att[]) {
    return atts.map(a => {
      const data = a.dataUrl.split(',')[1] || ''
      return a.kind === 'image'
        ? { type: 'image', source: { type: 'base64', media_type: a.mediaType, data } }
        : { type: 'document', source: { type: 'base64', media_type: a.mediaType || 'application/pdf', data } }
    })
  }

  async function send() {
    const text = input.trim()
    if ((!text && pending.length === 0) || loading) return
    const userMsg: Msg = { role: 'user', text, attachments: pending.length ? pending : undefined }
    const next = [...messages, userMsg]
    setMessages(next); setInput(''); setPending([]); setLoading(true)
    if (inputRef.current) inputRef.current.style.height = 'auto'

    // Build API messages: attachments hanya untuk pesan terakhir (hindari kirim base64 berulang)
    const apiMsgs = next.map((m, i) => {
      const isLast = i === next.length - 1
      if (m.attachments?.length && isLast) {
        return { role: m.role, content: [...attBlocks(m.attachments), { type: 'text', text: m.text || 'Tolong analisa lampiran ini.' }] }
      }
      let t = m.text || ''
      if (m.attachments?.length) t += `\n[lampiran: ${m.attachments.map(a => a.name).join(', ')}]`
      return { role: m.role, content: t }
    })

    try {
      const r = await fetch('/api/playground', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: apiMsgs }) })
      const d = await r.json()
      setMessages(m => [...m, { role: 'assistant', text: d.reply || `⚠️ ${d.error || 'Gagal memuat respons'}` }])
    } catch (e: any) {
      setMessages(m => [...m, { role: 'assistant', text: `⚠️ ${e?.message || 'Koneksi gagal'}` }])
    } finally {
      setLoading(false); setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const empty = messages.length === 0

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', background: 'var(--bg3)', flexShrink: 0 }}>
          <img src={AVATAR} alt="Wibi" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 18%' }} />
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Playground · Wibi</div>
          <div style={{ fontSize: 11.5, color: 'var(--text3)' }}><span style={{ color: 'var(--green)' }}>●</span> Asisten AI · bisa baca data WinS, gambar &amp; dokumen</div>
        </div>
        {messages.length > 0 && (
          <button onClick={() => setMessages([])} className="btn btn-sm" style={{ marginLeft: 'auto' }} title="Mulai obrolan baru">🗑 Bersihkan</button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '20px', minHeight: 0 }}>
        {empty ? (
          <div style={{ maxWidth: 680, margin: '6vh auto 0', textAlign: 'center' }}>
            <div style={{ width: 76, height: 76, borderRadius: '50%', overflow: 'hidden', margin: '0 auto 14px', background: 'var(--bg3)' }}>
              <img src={AVATAR} alt="Wibi" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 18%' }} />
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Halo {first}! 👋 Aku Wibi</div>
            <div style={{ fontSize: 13.5, color: 'var(--text2)', marginBottom: 22, lineHeight: 1.6 }}>
              Aku bisa <b>baca data WinS</b> (budget, reimbursement, cash card, petty cash, 3rd party, dll), analisa insight,
              cari anomali, sampai bantu hal umum. Upload gambar atau dokumen (PDF) juga boleh.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10, textAlign: 'left' }}>
              {SUGGESTIONS.map((s, i) => (
                <button key={i} onClick={() => { setInput(s); setTimeout(() => inputRef.current?.focus(), 30) }}
                  className="card" style={{ padding: '12px 14px', fontSize: 12.5, cursor: 'pointer', textAlign: 'left', lineHeight: 1.45 }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ maxWidth: 820, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
                {m.role === 'assistant' && (
                  <div style={{ width: 30, height: 30, borderRadius: '50%', overflow: 'hidden', background: 'var(--bg3)', flexShrink: 0 }}>
                    <img src={AVATAR} alt="Wibi" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 18%' }} />
                  </div>
                )}
                <div style={{ maxWidth: '76%' }}>
                  {m.attachments && m.attachments.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6, justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                      {m.attachments.map((a, j) => a.kind === 'image' ? (
                        <img key={j} src={a.dataUrl} alt={a.name} style={{ maxWidth: 160, maxHeight: 160, borderRadius: 10, border: '1px solid var(--border)' }} />
                      ) : (
                        <div key={j} style={{ fontSize: 11.5, padding: '8px 12px', borderRadius: 10, background: 'var(--bg3)', border: '1px solid var(--border)' }}>📄 {a.name}</div>
                      ))}
                    </div>
                  )}
                  {(m.text || m.role === 'assistant') && (
                    <div style={{
                      padding: '10px 14px', borderRadius: 14, fontSize: 13.5, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                      background: m.role === 'user' ? 'var(--brand)' : 'var(--bg2)',
                      color: m.role === 'user' ? '#fff' : 'var(--text)',
                      border: m.role === 'user' ? 'none' : '1px solid var(--border)',
                      borderTopRightRadius: m.role === 'user' ? 4 : 14, borderTopLeftRadius: m.role === 'user' ? 14 : 4,
                    }}>
                      {m.role === 'assistant' ? renderText(m.text) : m.text}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', overflow: 'hidden', background: 'var(--bg3)', flexShrink: 0 }}>
                  <img src={AVATAR} alt="Wibi" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 18%' }} />
                </div>
                <div style={{ padding: '12px 16px', borderRadius: 14, background: 'var(--bg2)', border: '1px solid var(--border)', fontSize: 13, color: 'var(--text3)' }}>Wibi lagi mikir…</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Composer */}
      <div style={{ borderTop: '1px solid var(--border)', padding: '12px 20px 16px' }}>
        <div style={{ maxWidth: 820, margin: '0 auto' }}>
          {pending.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
              {pending.map((a, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, padding: '5px 8px 5px 6px', borderRadius: 8, background: 'var(--bg3)', border: '1px solid var(--border)' }}>
                  {a.kind === 'image' ? <img src={a.dataUrl} alt="" style={{ width: 24, height: 24, borderRadius: 4, objectFit: 'cover' }} /> : <span>📄</span>}
                  <span style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
                  <button onClick={() => setPending(p => p.filter((_, j) => j !== i))} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 14 }}>×</button>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
            <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple style={{ display: 'none' }} onChange={e => onFiles(e.target.files)} />
            <button onClick={() => fileRef.current?.click()} className="btn btn-icon" title="Upload gambar / dokumen" style={{ flexShrink: 0, height: 42, width: 42 }}>📎</button>
            <textarea ref={inputRef} value={input} onChange={e => { setInput(e.target.value); const t = e.target; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 140) + 'px' }} onKeyDown={onKey} rows={1}
              placeholder="Tanya apa aja ke Wibi… (Shift+Enter buat baris baru)"
              style={{ flex: 1, resize: 'none', minHeight: 42, maxHeight: 140, padding: '11px 14px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 13.5, lineHeight: 1.5, fontFamily: 'inherit' }} />
            <button onClick={send} disabled={loading || (!input.trim() && pending.length === 0)} className="btn btn-primary btn-icon" style={{ flexShrink: 0, height: 42, width: 42, opacity: loading || (!input.trim() && pending.length === 0) ? 0.5 : 1 }} title="Kirim">➤</button>
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 6, textAlign: 'center' }}>Wibi membaca ringkasan data WinS terkini. Untuk angka super-detail, paste langsung datanya ya.</div>
        </div>
      </div>
    </div>
  )
}
