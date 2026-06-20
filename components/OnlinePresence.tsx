'use client'
import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'

function avatarColor(name: string) {
  const colors = ['#4f8ef7', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#10b981']
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return colors[Math.abs(h) % colors.length]
}

export default function OnlinePresence() {
  const { data: session } = useSession()
  const user = session?.user as any
  const [online, setOnline] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Stable identity for this session (guests get a per-tab id so they show separately)
  const me = (() => {
    if (!user) return null
    const roles: string[] = (user.roles && user.roles.length) ? user.roles : (user.role ? [user.role] : [])
    const isGuest = roles.length > 0 && roles.every((r) => r === 'guest')
    let key = user.email
    let name = user.name
    if (isGuest) {
      let gid = ''
      try {
        gid = sessionStorage.getItem('wp-guest-id') || ''
        if (!gid) { gid = Math.random().toString(36).slice(2, 8); sessionStorage.setItem('wp-guest-id', gid) }
      } catch { gid = 'x' }
      key = `guest:${gid}`
      name = 'Guest'
    }
    return { key, name, role: user.division || roles[0] || 'member', isGuest }
  })()

  useEffect(() => {
    if (!me) return
    let alive = true
    const beat = () => { fetch('/api/presence', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(me) }).catch(() => {}) }
    const poll = () => { fetch('/api/presence').then(r => r.json()).then(d => { if (alive && d.data) setOnline(d.data) }).catch(() => {}) }
    beat(); poll()
    const beatId = setInterval(beat, 45000)
    const pollId = setInterval(poll, 30000)
    const onVis = () => { if (document.visibilityState === 'visible') { beat(); poll() } }
    document.addEventListener('visibilitychange', onVis)
    return () => { alive = false; clearInterval(beatId); clearInterval(pollId); document.removeEventListener('visibilitychange', onVis) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.key])

  useEffect(() => {
    function h(e: MouseEvent) { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [])

  if (!online.length) return null
  const shown = online.slice(0, 4)
  const extra = online.length - shown.length

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} title={`${online.length} online`}
        style={{ display: 'flex', alignItems: 'center', background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 4px' }}>
        <span style={{ display: 'inline-flex' }}>
          {shown.map((p, i) => (
            <span key={p.key} title={p.name}
              style={{ width: 26, height: 26, borderRadius: '50%', background: p.isGuest ? 'var(--text3)' : avatarColor(p.name), color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--bg2)', marginLeft: i === 0 ? 0 : -8 }}>
              {p.isGuest ? '🌐' : (p.name?.[0] || '?')}
            </span>
          ))}
          {extra > 0 && (
            <span style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--bg3)', color: 'var(--text2)', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--bg2)', marginLeft: -8 }}>+{extra}</span>
          )}
        </span>
        <span style={{ marginLeft: 6, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text3)' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)' }} />{online.length}
        </span>
      </button>
      {open && (
        <div className="glass-strong scale-in" style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, borderRadius: 10, padding: 6, zIndex: 200, minWidth: 200, maxHeight: 320, overflowY: 'auto' }}>
          <div style={{ padding: '6px 8px', fontSize: 11, fontWeight: 700, color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)' }} /> Sedang online ({online.length})
          </div>
          {online.map((p) => (
            <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6 }}>
              <span style={{ width: 24, height: 24, borderRadius: '50%', background: p.isGuest ? 'var(--text3)' : avatarColor(p.name), color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{p.isGuest ? '🌐' : (p.name?.[0] || '?')}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}{me && p.key === me.key ? ' (kamu)' : ''}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)' }}>{p.isGuest ? 'External / Guest' : (p.role || 'member')}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
