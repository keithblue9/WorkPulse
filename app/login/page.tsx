'use client'
import { useState, useEffect, useRef } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { displayAppName } from '@/lib/appName'
import { Icon } from '@/components/ui'

// A user is "guest/external-only" if every role they hold is 'guest'. These accounts
// are NOT shown in the Internal picker — external access is via the front-door button.
function isGuestOnly(u: any): boolean {
  const r = (u?.roles && u.roles.length) ? u.roles : (u?.role ? [u.role] : [])
  return r.length > 0 && r.every((x: string) => x === 'guest')
}

export default function LoginPage() {
  const [mode, setMode] = useState<'choose' | 'internal'>('choose')
  const [guestLoading, setGuestLoading] = useState(false)
  const [users, setUsers] = useState<any[]>([])
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [showUserPicker, setShowUserPicker] = useState(false)
  const [pin, setPin] = useState<string[]>(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [config, setConfig] = useState<any>({ appName: 'WINS', loginTagline: 'BPD Procurement — Pertamina', appColor: '#4f8ef7', appIcon: '', loginBackgrounds: [], loginSlideInterval: 5000 })
  const [currentSlide, setCurrentSlide] = useState(0)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const pickerRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/config?scope=login').then(r => r.json()).then(d => { if (d.data) setConfig(d.data) }).catch(() => {})
    fetch('/api/users?scope=login').then(r => r.json()).then(d => {
      const active = (d.data || []).filter((u: any) => u.active !== false && !isGuestOnly(u))
      setUsers(active)
      const lastEmail = localStorage.getItem('wp-last-user')
      if (lastEmail) { const u = active.find((x: any) => x.email === lastEmail); if (u) setSelectedUser(u) }
    }).catch(() => {})
  }, [])
  useEffect(() => {
    if (!config.loginBackgrounds?.length) return
    const id = setInterval(() => setCurrentSlide(prev => (prev + 1) % config.loginBackgrounds.length), config.loginSlideInterval || 5000)
    return () => clearInterval(id)
  }, [config.loginBackgrounds, config.loginSlideInterval])
  useEffect(() => {
    function h(e: MouseEvent) { if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setShowUserPicker(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [])

  function handlePinChange(i: number, v: string) {
    if (!/^\d?$/.test(v)) return
    const next = [...pin]; next[i] = v; setPin(next)
    if (v && i < 5) inputRefs.current[i + 1]?.focus()
    if (i === 5 && v && next.every(x => x)) submitWithPin(next.join(''))
  }
  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !pin[i] && i > 0) inputRefs.current[i - 1]?.focus()
  }
  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault()
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    const next = text.padEnd(6, '').split('').slice(0, 6)
    setPin(next as any)
    if (text.length === 6) submitWithPin(text)
    else inputRefs.current[Math.min(text.length, 5)]?.focus()
  }
  async function submitWithPin(pinStr: string) {
    if (!selectedUser) { toast.error('Pilih nama dulu'); return }
    if (pinStr.length !== 6) { toast.error('PIN harus 6 digit'); return }
    setLoading(true)
    const res = await signIn('credentials', { email: selectedUser.email, password: pinStr, redirect: false })
    setLoading(false)
    if (res?.ok) {
      localStorage.setItem('wp-last-user', selectedUser.email)
      toast.success(`Selamat datang, ${selectedUser.name}!`); router.push('/dashboard')
    } else {
      toast.error('PIN salah'); setPin(['', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
    }
  }
  async function handleGuest() {
    setGuestLoading(true)
    const res = await signIn('credentials', { guest: 'true', redirect: false })
    setGuestLoading(false)
    if (res?.ok) { router.push('/dashboard') }
    else { toast.error('Gagal masuk sebagai External') }
  }
  function selectUser(u: any) {
    setSelectedUser(u); setShowUserPicker(false); setPin(['', '', '', '', '', ''])
    setTimeout(() => inputRefs.current[0]?.focus(), 50)
  }
  function backToChoose() {
    setMode('choose'); setShowUserPicker(false); setPin(['', '', '', '', '', ''])
  }

  const bgs = config.loginBackgrounds || []
  const hasBg = bgs.length > 0
  const initials = (n: string) => String(n || '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') || '?'

  return (
    <main className="safe-all au-login">
      {hasBg && bgs.map((bg: string, i: number) => (
        <div key={i} className={`login-bg-slide login-bg-img${i === currentSlide ? ' active' : ''}`} style={{ backgroundImage: `url("${bg}")` }} aria-hidden="true" />
      ))}
      {!hasBg && <div className="au-login-aurora" aria-hidden="true"><i /><i /><i /></div>}

      <section className="au-login-card" aria-labelledby="login-title">
        <div className="au-col" style={{ alignItems: 'center', gap: 6, textAlign: 'center' }}>
          {config.appIcon
            ? <img src={config.appIcon} alt="" width={60} height={60} style={{ width: 60, height: 60, borderRadius: 18, objectFit: 'cover' }} />
            : <span className="au-login-mark" aria-hidden="true">{(displayAppName(config.appName) || 'W')[0]}</span>}
          <h1 id="login-title">{displayAppName(config.appName)}</h1>
          <span className="au-small au-muted">{config.loginTagline}</span>
        </div>

        {mode === 'choose' ? (
          <div className="au-col" style={{ gap: 10 }}>
            <span className="lbl" style={{ textAlign: 'center' }}>Masuk sebagai</span>
            <button type="button" className="au-login-btn primary" onClick={() => setMode('internal')}><Icon name="user" size={18} stroke={2.1} />Internal</button>
            <button type="button" className="au-login-btn" onClick={handleGuest} disabled={guestLoading}><Icon name="link" size={18} stroke={2.1} />{guestLoading ? 'Masuk…' : 'External (guest)'}</button>
            <span className="au-xs au-muted" style={{ textAlign: 'center' }}>External masuk langsung tanpa PIN, dengan akses terbatas.</span>
          </div>
        ) : (
          <div className="au-col" style={{ gap: 16 }}>
            <button onClick={backToChoose} type="button" className="au-link au-row" style={{ alignSelf: 'flex-start', gap: 4 }}><Icon name="back" size={14} />Kembali</button>

            <div ref={pickerRef} className="au-col" style={{ position: 'relative', gap: 6 }}>
              <span className="lbl" id="acct-lbl">Akun</span>
              <button onClick={() => setShowUserPicker(s => !s)} type="button" className="au-login-acct" aria-haspopup="listbox" aria-expanded={showUserPicker} aria-labelledby="acct-lbl">
                {selectedUser ? (
                  <>
                    <span className="au-av">{initials(selectedUser.name)}</span>
                    <span className="au-col" style={{ flex: 1, minWidth: 0, gap: 1, textAlign: 'left' }}>
                      <b className="au-small" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedUser.name}</b>
                      <span className="au-xs au-muted">{selectedUser.division || selectedUser.role}</span>
                    </span>
                  </>
                ) : <span className="au-small au-muted" style={{ flex: 1, textAlign: 'left' }}>Pilih nama akun</span>}
                <Icon name="chev" size={16} style={{ color: 'var(--muted)', transform: showUserPicker ? 'rotate(180deg)' : undefined, transition: 'transform .2s' }} />
              </button>
              {showUserPicker && (
                <div className="au-login-pick scale-in" role="listbox" aria-labelledby="acct-lbl">
                  {users.map(u => (
                    <button type="button" role="option" aria-selected={selectedUser?.email === u.email} key={u.email} onClick={() => selectUser(u)} className="au-login-opt">
                      <span className="au-av s">{initials(u.name)}</span>
                      <span className="au-col" style={{ flex: 1, minWidth: 0, gap: 1, textAlign: 'left' }}><span className="au-small" style={{ fontWeight: 600 }}>{u.name}</span><span className="au-xs au-muted">{u.division || u.role}</span></span>
                      {selectedUser?.email === u.email && <Icon name="check" size={16} stroke={2.4} style={{ color: 'var(--accent)' }} />}
                    </button>
                  ))}
                  {users.length === 0 && <span className="au-xs au-muted" style={{ padding: 14, textAlign: 'center' }}>Belum ada user</span>}
                </div>
              )}
            </div>

            <div className="au-col" style={{ gap: 6 }}>
              <span className="lbl" id="pin-lbl">PIN 6 digit</span>
              <div className="au-pinrow" role="group" aria-labelledby="pin-lbl">
                {pin.map((d, i) => (
                  <input key={i} ref={el => { inputRefs.current[i] = el }} type="password" inputMode="numeric" autoComplete={i === 0 ? 'one-time-code' : 'off'} pattern="[0-9]" maxLength={1} value={d}
                    aria-label={`Digit PIN ${i + 1}`} className="au-pinbox"
                    onChange={e => handlePinChange(i, e.target.value)} onKeyDown={e => handleKeyDown(i, e)} onPaste={i === 0 ? handlePaste : undefined}
                    disabled={!selectedUser || loading} />
                ))}
              </div>
            </div>

            <button type="button" className="au-login-btn primary" onClick={() => submitWithPin(pin.join(''))} disabled={loading || !selectedUser || pin.some(d => !d)}>
              {loading ? 'Masuk…' : 'Masuk'}
            </button>
          </div>
        )}
      </section>
    </main>
  )
}
