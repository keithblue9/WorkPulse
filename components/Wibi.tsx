'use client'
import { useState, useRef, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'

type AttBubble = { kind: 'attendance-ask' } | { kind: 'attendance-choose'; types: any[] } | { kind: 'attendance-done' }
type Msg = { role: 'user' | 'assistant'; content: string; bubble?: AttBubble }

const AVATAR = '/wibi/wibi-avatar.png'

function localToday() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Roles that should NOT get the daily attendance check-in (external collaborators)
const NO_PRESENSI_ROLES = ['external', 'guest']

export default function Wibi() {
  const { data: session } = useSession()
  const user = session?.user as any

  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [greeting, setGreeting] = useState(false)
  const [greetText, setGreetText] = useState('')
  const [hasUnread, setHasUnread] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [attendanceTypes, setAttendanceTypes] = useState<any[]>([])
  const [modalOpen, setModalOpen] = useState(false)

  // Sembunyikan Wibi saat ada modal/popup terbuka biar ga nabrak tombol (pojok kanan bawah)
  useEffect(() => {
    const check = () => setModalOpen(!!document.querySelector('.modal-overlay'))
    check()
    const obs = new MutationObserver(check)
    obs.observe(document.body, { childList: true, subtree: true })
    return () => obs.disconnect()
  }, [])

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, loading, open])

  // ── Daily greeting + attendance check, delivered INSIDE the chat (no separate modal) ──
  useEffect(() => {
    if (!user) return
    const roles: string[] = (user.roles && user.roles.length) ? user.roles : (user.role ? [user.role] : [])
    const isGuest = roles.length > 0 && roles.every((r) => r === 'guest')
    const skipPresensi = roles.some((r: string) => NO_PRESENSI_ROLES.includes(String(r).toLowerCase()))
    const greetKey = `wibi-greet-${localToday()}`
    let cancelled = false

    async function run() {
      try { if (localStorage.getItem(greetKey)) return } catch { return }
      const first = isGuest ? '' : (user.name?.split(' ')[0] || '')
      const greetMsg = isGuest
        ? 'Halo! 👋 Aku Wibi, asisten AI di WinS. Klik aku kalau butuh bantuan ya!'
        : `Halo ${first}! 👋 Aku Wibi, asisten kamu di WinS.`

      await new Promise(res => setTimeout(res, 1800))
      if (cancelled) return
      setGreetText(greetMsg.split('\n')[0])
      setGreeting(true)
      setHasUnread(true)
      try { localStorage.setItem(greetKey, '1') } catch {}
      setTimeout(() => setGreeting(false), 9000)

      const chatMsgs: Msg[] = [{ role: 'assistant', content: greetMsg }]

      // Internal members (not guest) get the daily attendance check-in, unless they
      // already recorded attendance today (best-effort check against /api/profile + /api/attendance).
      if (!skipPresensi) {
        try {
          const pr = await fetch('/api/profile').then(r => r.json())
          if (pr?.data) {
            setProfile(pr.data)
            const prRoles = (pr.data?.roles && pr.data.roles.length) ? pr.data.roles : (pr.data?.role ? [pr.data.role] : [])
            const prSkip = prRoles.some((r: string) => NO_PRESENSI_ROLES.includes(String(r).toLowerCase()))
            if (!prSkip) {
              const month = localToday().slice(0, 7)
              const att = await fetch(`/api/attendance?userId=${pr.data._id}&month=${month}`).then(r => r.json())
              const todayDone = (att?.data || []).some((a: any) => a.date === localToday())
              if (!todayDone) {
                const cfg = await fetch('/api/config').then(r => r.json())
                const types = (cfg.data?.attendanceTypes || []).filter((t: any) => t.active)
                setAttendanceTypes(types)
                chatMsgs.push({ role: 'assistant', content: 'Sudah mengisi daftar hadir hari ini?', bubble: { kind: 'attendance-ask' } })
              }
            }
          }
        } catch { /* best-effort; skip attendance prompt on failure */ }
      }

      if (!cancelled) setMessages(m => [...m, ...chatMsgs])
    }
    run()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email])

  function toggleOpen() {
    setGreeting(false)
    setHasUnread(false)
    setOpen(o => !o)
    if (!open) setTimeout(() => inputRef.current?.focus(), 120)
  }

  // ── Attendance bubble actions ──
  function attendanceBelum() {
    setMessages(m => [...m, { role: 'user', content: 'Belum' }, { role: 'assistant', content: 'Oke, pilih tipe kehadiran hari ini ya:', bubble: { kind: 'attendance-choose', types: attendanceTypes } }])
  }
  async function attendanceSudah() {
    setMessages(m => [...m, { role: 'user', content: 'Sudah' }, { role: 'assistant', content: 'Sip, dicatat ya. Semangat kerjanya hari ini! 💪', bubble: { kind: 'attendance-done' } }])
  }
  async function submitAttendance(type: any) {
    const today = localToday()
    try {
      await fetch('/api/attendance', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: profile?._id, userName: user?.name, date: today, type: type.key, slots: [{ from: '08:00', to: '17:00', type: type.key }] }),
      })
      toast.success('Presensi tercatat!')
      setMessages(m => [...m, { role: 'user', content: type.label }, { role: 'assistant', content: `Presensi ${type.label} tercatat. Semangat hari ini! 💪`, bubble: { kind: 'attendance-done' } }])
    } catch {
      toast.error('Gagal mencatat presensi')
    }
  }

  async function send() {
    const text = input.trim()
    if (!text || loading) return
    const next = [...messages, { role: 'user' as const, content: text }]
    setMessages(next); setInput(''); setLoading(true)
    try {
      const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: next.map(({ role, content }) => ({ role, content })) }) })
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

  if (modalOpen && !open) return null

  return (
    <div style={{ position: 'fixed', right: 18, bottom: 18, zIndex: 300, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
      {/* Chat panel */}
      {open && (
        <div className="card scale-in" style={{ width: 340, maxWidth: 'calc(100vw - 32px)', height: 480, maxHeight: 'calc(100vh - 130px)', display: 'flex', flexDirection: 'column', borderRadius: 16, overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.25)', padding: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', background: 'var(--brand-soft)', flexShrink: 0 }}>
              <img src={AVATAR} alt="Wibi" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 18%', pointerEvents: 'none' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>Wibi</div>
              <div style={{ fontSize: 10, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)' }} /> Asisten AI · online</div>
            </div>
            {messages.length > 0 && <button onClick={() => setMessages([])} title="Bersihkan" className="btn btn-icon btn-sm">🗑️</button>}
            <button onClick={() => setOpen(false)} className="btn btn-icon btn-sm">✕</button>
          </div>

          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--bg)' }}>
            {messages.length === 0 && (
              <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text3)', fontSize: 12, padding: 10 }}>
                <div style={{ width: 88, height: 88, borderRadius: '50%', overflow: 'hidden', margin: '0 auto 10px', background: 'var(--brand-soft)' }}>
                  <img src={AVATAR} alt="Wibi" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 18%' }} />
                </div>
                <div style={{ fontWeight: 600, color: 'var(--text2)', marginBottom: 2 }}>Hai, aku Wibi 👋</div>
                Tanya apa aja, aku bantu jawab.
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start', gap: 6 }}>
                <div style={{ maxWidth: '82%', padding: '8px 11px', borderRadius: 12, fontSize: 12.5, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: m.role === 'user' ? 'var(--brand)' : 'var(--bg3)', color: m.role === 'user' ? '#fff' : 'var(--text)', borderBottomRightRadius: m.role === 'user' ? 3 : 12, borderBottomLeftRadius: m.role === 'user' ? 12 : 3 }}>
                  {m.content}
                </div>
                {/* Inline interactive bubbles for the attendance check-in */}
                {m.bubble?.kind === 'attendance-ask' && i === messages.length - 1 && (
                  <div style={{ display: 'flex', gap: 7 }}>
                    <button onClick={attendanceBelum} className="btn btn-sm" style={{ fontSize: 12 }}>Belum</button>
                    <button onClick={attendanceSudah} className="btn btn-sm btn-primary" style={{ fontSize: 12 }}>Sudah</button>
                  </div>
                )}
                {m.bubble?.kind === 'attendance-choose' && i === messages.length - 1 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 6, width: '82%' }}>
                    {(m.bubble as any).types.map((t: any) => (
                      <button key={t.key} onClick={() => submitAttendance(t)} style={{ padding: '8px 9px', borderRadius: 9, border: `1px solid ${t.textColor}66`, background: t.color, color: t.textColor, cursor: 'pointer', fontSize: 11.5, fontWeight: 600 }}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {loading && <div style={{ display: 'flex', justifyContent: 'flex-start' }}><div style={{ padding: '8px 12px', borderRadius: 12, background: 'var(--bg3)', color: 'var(--text3)', fontSize: 12 }}>Wibi mengetik…</div></div>}
          </div>

          <div style={{ display: 'flex', gap: 8, padding: 10, borderTop: '1px solid var(--border)', background: 'var(--bg2)' }}>
            <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKey} rows={1}
              placeholder="Tulis pesan untuk Wibi…" disabled={loading}
              style={{ flex: 1, resize: 'none', maxHeight: 90, padding: '8px 10px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 12.5, outline: 'none', fontFamily: 'inherit' }} />
            <button onClick={send} disabled={loading || !input.trim()} className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-end', opacity: (loading || !input.trim()) ? 0.5 : 1 }}>➤</button>
          </div>
        </div>
      )}

      {/* Greeting speech bubble */}
      {greeting && !open && (
        <div onClick={toggleOpen} style={{ maxWidth: 230, padding: '10px 13px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, borderBottomRightRadius: 4, boxShadow: '0 8px 24px rgba(0,0,0,0.18)', fontSize: 12.5, lineHeight: 1.5, color: 'var(--text)', cursor: 'pointer', animation: 'wibi-bubble-in 0.4s ease' }}>
          {greetText}
        </div>
      )}

      {/* Wibi avatar button (clean circular face, no photo background) */}
      <button onClick={toggleOpen} title="Chat dengan Wibi" className="wibi-float"
        style={{ position: 'relative', width: 58, height: 58, borderRadius: '50%', border: '2px solid var(--bg2)', background: 'linear-gradient(135deg, var(--brand), #8b7adc)', cursor: 'pointer', padding: 0, overflow: 'hidden', boxShadow: '0 8px 22px rgba(0,0,0,0.28)' }}>
        <img src={AVATAR} alt="Wibi" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 18%', pointerEvents: 'none', userSelect: 'none' }} />
        {!open && <span style={{ position: 'absolute', top: 3, right: 3, width: 11, height: 11, borderRadius: '50%', background: 'var(--green)', border: '2px solid var(--bg2)' }} />}
        {hasUnread && !open && <span style={{ position: 'absolute', top: -2, left: -2, width: 14, height: 14, borderRadius: '50%', background: 'var(--red)', border: '2px solid var(--bg2)' }} />}
      </button>
    </div>
  )
}
