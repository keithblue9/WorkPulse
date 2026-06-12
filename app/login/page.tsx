'use client'
import { useState, useEffect, useRef } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const [users, setUsers] = useState<any[]>([])
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [showUserPicker, setShowUserPicker] = useState(false)
  const [pin, setPin] = useState<string[]>(['','','','','',''])
  const [loading, setLoading] = useState(false)
  const [config, setConfig] = useState<any>({ appName:'WorkPulse', loginTagline:'BPD & SS Procurement — Pertamina', appColor:'#4f8ef7', appIcon:'', loginBackgrounds:[], loginSlideInterval:5000 })
  const [currentSlide, setCurrentSlide] = useState(0)
  const inputRefs = useRef<(HTMLInputElement|null)[]>([])
  const pickerRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/config').then(r=>r.json()).then(d => { if (d.data) setConfig(d.data) }).catch(()=>{})
    fetch('/api/users').then(r=>r.json()).then(d => {
      const active = (d.data||[]).filter((u:any)=>u.active!==false)
      setUsers(active)
      // Restore last selected user from localStorage
      const lastEmail = localStorage.getItem('wp-last-user')
      if (lastEmail) { const u = active.find((x:any)=>x.email===lastEmail); if (u) setSelectedUser(u) }
    }).catch(()=>{})
  }, [])

  useEffect(() => {
    if (!config.loginBackgrounds?.length) return
    const id = setInterval(() => setCurrentSlide(prev => (prev+1) % config.loginBackgrounds.length), config.loginSlideInterval||5000)
    return () => clearInterval(id)
  }, [config.loginBackgrounds, config.loginSlideInterval])

  useEffect(() => {
    function h(e:MouseEvent){ if(pickerRef.current && !pickerRef.current.contains(e.target as Node)) setShowUserPicker(false) }
    document.addEventListener('mousedown',h); return () => document.removeEventListener('mousedown',h)
  }, [])

  function handlePinChange(i:number, v:string) {
    if (!/^\d?$/.test(v)) return
    const next = [...pin]; next[i] = v; setPin(next)
    if (v && i < 5) inputRefs.current[i+1]?.focus()
    // Auto-submit if all filled
    if (i === 5 && v && next.every(x=>x)) submitWithPin(next.join(''))
  }
  function handleKeyDown(i:number, e:React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !pin[i] && i > 0) inputRefs.current[i-1]?.focus()
  }
  function handlePaste(e:React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault()
    const text = e.clipboardData.getData('text').replace(/\D/g,'').slice(0,6)
    const next = text.padEnd(6,'').split('').slice(0,6)
    setPin(next as any)
    if (text.length === 6) submitWithPin(text)
    else inputRefs.current[Math.min(text.length, 5)]?.focus()
  }

  async function submitWithPin(pinStr:string) {
    if (!selectedUser) { toast.error('Pilih nama dulu'); return }
    if (pinStr.length !== 6) { toast.error('PIN harus 6 digit'); return }
    setLoading(true)
    const res = await signIn('credentials', { email: selectedUser.email, password: pinStr, redirect: false })
    setLoading(false)
    if (res?.ok) {
      localStorage.setItem('wp-last-user', selectedUser.email)
      toast.success(`Selamat datang, ${selectedUser.name}!`)
      router.push('/dashboard')
    } else {
      toast.error('PIN salah')
      setPin(['','','','','',''])
      inputRefs.current[0]?.focus()
    }
  }

  function selectUser(u:any) {
    setSelectedUser(u)
    setShowUserPicker(false)
    setPin(['','','','','',''])
    setTimeout(()=>inputRefs.current[0]?.focus(), 50)
  }

  const bgs = config.loginBackgrounds || []
  const hasBg = bgs.length > 0
  const appColor = config.appColor || '#4f8ef7'

  return (
    <div style={{ minHeight:'100vh', display:'flex', position:'relative', overflow:'hidden', background:'var(--bg)' }} className="safe-all">
      {hasBg ? (
        <>
          {bgs.map((bg:string, i:number) => (
            <div key={i} className={`login-bg-slide${i===currentSlide?' active':''}`} style={{ backgroundImage:`url("${bg}")` }} />
          ))}
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(105deg, rgba(13,17,23,0.88) 0%, rgba(13,17,23,0.55) 55%, rgba(13,17,23,0.15) 100%)' }} />
        </>
      ) : (
        <>
          <div className="ambient-bg">
            <div className="orb" style={{ width:500, height:500, top:'-10%', left:'-10%' }} />
            <div className="orb" style={{ width:400, height:400, bottom:'-15%', right:'30%', animationDelay:'-8s' }} />
          </div>
        </>
      )}

      <div style={{ position:'relative', zIndex:2, width:'100%', display:'flex', alignItems:'center', justifyContent:'flex-start', padding:'16px 24px' }}>
        <div className="glass-strong" style={{ width:'100%', maxWidth:380, padding:'32px 28px', borderRadius:20, boxShadow:'0 20px 60px rgba(0,0,0,0.25)' }}>
          {/* Logo + App name */}
          <div style={{ marginBottom:24 }}>
            {config.appIcon ? (
              <img src={config.appIcon} alt="logo" style={{ width:56, height:56, borderRadius:14, objectFit:'cover', marginBottom:14 }} />
            ) : (
              <div style={{ width:56, height:56, borderRadius:14, background:appColor, display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, fontWeight:700, color:'#fff', marginBottom:14, boxShadow:`0 8px 24px ${appColor}40` }}>
                {(config.appName||'W')[0]}
              </div>
            )}
            <div style={{ fontSize:24, fontWeight:700, color:'var(--text)', letterSpacing:'-0.02em', marginBottom:4 }}>{config.appName||'WorkPulse'}</div>
            <div style={{ fontSize:12, color:'var(--text3)' }}>{config.loginTagline}</div>
          </div>

          {/* User selector */}
          <div ref={pickerRef} style={{ position:'relative', marginBottom:18 }}>
            <label style={lbl}>Akun</label>
            <button onClick={()=>setShowUserPicker(s=>!s)} type="button" style={{ width:'100%', padding:'10px 12px', background:'var(--bg3)', border:'1px solid var(--border2)', borderRadius:8, display:'flex', alignItems:'center', gap:10, cursor:'pointer', color:'var(--text)' }}>
              {selectedUser ? (
                <>
                  <div style={{ width:30, height:30, borderRadius:'50%', background:appColor, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'#fff', flexShrink:0 }}>{selectedUser.name?.[0]}</div>
                  <div style={{ flex:1, textAlign:'left', minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{selectedUser.name}</div>
                    <div style={{ fontSize:10, color:'var(--text3)' }}>{selectedUser.division || selectedUser.role}</div>
                  </div>
                </>
              ) : (
                <span style={{ flex:1, textAlign:'left', color:'var(--text3)', fontSize:13 }}>Pilih nama akun...</span>
              )}
              <span style={{ color:'var(--text3)', fontSize:10 }}>▼</span>
            </button>
            {showUserPicker && (
              <div className="glass-strong scale-in" style={{ position:'absolute', top:'calc(100% + 6px)', left:0, right:0, maxHeight:260, overflowY:'auto', borderRadius:10, padding:6, zIndex:10 }}>
                {users.map(u => (
                  <div key={u.email} onClick={()=>selectUser(u)} style={{ padding:'8px 10px', borderRadius:7, cursor:'pointer', display:'flex', alignItems:'center', gap:10, background: selectedUser?.email===u.email?'var(--brand-soft)':'transparent' }}
                    onMouseEnter={e=>{if(selectedUser?.email!==u.email)(e.currentTarget as HTMLElement).style.background='var(--bg3)'}}
                    onMouseLeave={e=>{if(selectedUser?.email!==u.email)(e.currentTarget as HTMLElement).style.background='transparent'}}>
                    <div style={{ width:28, height:28, borderRadius:'50%', background:appColor, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'#fff' }}>{u.name[0]}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:12, fontWeight:500, color:'var(--text)' }}>{u.name}</div>
                      <div style={{ fontSize:10, color:'var(--text3)' }}>{u.division || u.role}</div>
                    </div>
                    {selectedUser?.email===u.email && <span style={{ color:appColor }}>✓</span>}
                  </div>
                ))}
                {users.length === 0 && <div style={{ padding:14, textAlign:'center', color:'var(--text3)', fontSize:11 }}>Belum ada user</div>}
              </div>
            )}
          </div>

          {/* PIN entry */}
          <div style={{ marginBottom:18 }}>
            <label style={lbl}>PIN 6 Digit</label>
            <div style={{ display:'flex', gap:8, justifyContent:'space-between' }}>
              {pin.map((d,i) => (
                <input key={i} ref={el=>{inputRefs.current[i]=el}} type="tel" inputMode="numeric" pattern="[0-9]" maxLength={1} value={d}
                  onChange={e=>handlePinChange(i, e.target.value)} onKeyDown={e=>handleKeyDown(i,e)} onPaste={i===0 ? handlePaste : undefined}
                  disabled={!selectedUser || loading}
                  style={{ width:'100%', height:48, textAlign:'center', fontSize:20, fontWeight:600, border:'1px solid var(--border2)', borderRadius:10, background:'var(--bg3)', color:'var(--text)', outline:'none' }}
                  onFocus={e=>(e.currentTarget.style.borderColor = appColor)}
                  onBlur={e=>(e.currentTarget.style.borderColor = 'var(--border2)')} />
              ))}
            </div>
          </div>

          <button onClick={()=>submitWithPin(pin.join(''))} disabled={loading || !selectedUser || pin.some(d=>!d)} className="btn btn-primary" style={{ width:'100%', justifyContent:'center', padding:'11px', fontSize:13, fontWeight:600 }}>
            {loading?'Masuk...':'Masuk'}
          </button>

          <div style={{ marginTop:14, paddingTop:12, borderTop:'1px solid var(--glass-border)', textAlign:'center' }}>
            <div style={{ fontSize:10, color:'var(--text3)' }}>PIN default: <code style={{ color:'var(--text2)' }}>123456</code> · Ubah di Profil setelah login</div>
          </div>
        </div>
      </div>
    </div>
  )
}
const lbl: React.CSSProperties = { display:'block', fontSize:11, fontWeight:500, color:'var(--text2)', marginBottom:6 }
