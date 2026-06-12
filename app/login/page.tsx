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
      toast.success(`Selamat datang, ${selectedUser.name}!`); router.push('/dashboard')
    } else {
      toast.error('PIN salah'); setPin(['','','','','',''])
      inputRefs.current[0]?.focus()
    }
  }
  function selectUser(u:any) {
    setSelectedUser(u); setShowUserPicker(false); setPin(['','','','','',''])
    setTimeout(()=>inputRefs.current[0]?.focus(), 50)
  }

  const bgs = config.loginBackgrounds || []
  const hasBg = bgs.length > 0
  const appColor = config.appColor || '#4f8ef7'

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', position:'relative', overflow:'hidden', background:'#f5f5f7', padding:'24px 5vw' }} className="safe-all">
      {hasBg && bgs.map((bg:string, i:number) => (
        <div key={i} className={`login-bg-slide${i===currentSlide?' active':''}`} style={{ backgroundImage:`url("${bg}")` }} />
      ))}
      {!hasBg && (
        <div className="ambient-bg">
          <div className="orb" style={{ width:500, height:500, top:'-10%', left:'-10%', opacity:0.25 }} />
          <div className="orb" style={{ width:400, height:400, bottom:'-15%', right:'15%', animationDelay:'-8s', opacity:0.25 }} />
        </div>
      )}

      {/* Apple-style light glass card, positioned LEFT */}
      <div style={{
        position:'relative', zIndex:2, width:'100%', maxWidth:380,
        padding:'32px 28px', borderRadius:22,
        background: 'rgba(255,255,255,0.72)',
        backdropFilter: 'blur(40px) saturate(180%)',
        WebkitBackdropFilter: 'blur(40px) saturate(180%)',
        border:'1px solid rgba(255,255,255,0.5)',
        boxShadow: '0 24px 60px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.7)',
        color:'#1a1a1a',
        marginLeft: 0,
      }}>
        <div style={{ marginBottom:22, textAlign:'center' }}>
          {config.appIcon ? (
            <img src={config.appIcon} alt="logo" style={{ width:56, height:56, borderRadius:14, objectFit:'cover', marginBottom:12 }} />
          ) : (
            <div style={{ width:56, height:56, borderRadius:14, background:appColor, display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:28, fontWeight:700, color:'#fff', marginBottom:12, boxShadow:`0 8px 20px ${appColor}40` }}>{(config.appName||'W')[0]}</div>
          )}
          <div style={{ fontSize:24, fontWeight:700, letterSpacing:'-0.02em', marginBottom:3, color:'#1a1a1a' }}>{config.appName||'WorkPulse'}</div>
          <div style={{ fontSize:12, color:'rgba(0,0,0,0.55)' }}>{config.loginTagline}</div>
        </div>

        <div ref={pickerRef} style={{ position:'relative', marginBottom:16 }}>
          <label style={{ display:'block', fontSize:11, fontWeight:600, color:'rgba(0,0,0,0.6)', marginBottom:6 }}>Akun</label>
          <button onClick={()=>setShowUserPicker(s=>!s)} type="button" style={{
            width:'100%', padding:'10px 12px', background:'rgba(255,255,255,0.7)', border:'1px solid rgba(0,0,0,0.08)', borderRadius:10,
            display:'flex', alignItems:'center', gap:10, cursor:'pointer', color:'#1a1a1a',
          }}>
            {selectedUser ? (
              <>
                <div style={{ width:30, height:30, borderRadius:'50%', background:appColor, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'#fff', flexShrink:0 }}>{selectedUser.name?.[0]}</div>
                <div style={{ flex:1, textAlign:'left', minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:'#1a1a1a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{selectedUser.name}</div>
                  <div style={{ fontSize:10, color:'rgba(0,0,0,0.5)' }}>{selectedUser.division || selectedUser.role}</div>
                </div>
              </>
            ) : (
              <span style={{ flex:1, textAlign:'left', color:'rgba(0,0,0,0.4)', fontSize:13 }}>Pilih nama akun...</span>
            )}
            <span style={{ color:'rgba(0,0,0,0.4)', fontSize:10 }}>▼</span>
          </button>
          {showUserPicker && (
            <div className="scale-in" style={{ position:'absolute', top:'calc(100% + 6px)', left:0, right:0, maxHeight:260, overflowY:'auto', borderRadius:12, padding:6, zIndex:10, background:'rgba(255,255,255,0.92)', backdropFilter:'blur(40px) saturate(180%)', border:'1px solid rgba(0,0,0,0.06)', boxShadow:'0 12px 30px rgba(0,0,0,0.12)' }}>
              {users.map(u => (
                <div key={u.email} onClick={()=>selectUser(u)} style={{ padding:'8px 10px', borderRadius:8, cursor:'pointer', display:'flex', alignItems:'center', gap:10, background: selectedUser?.email===u.email?'rgba(0,0,0,0.05)':'transparent', color:'#1a1a1a' }}
                  onMouseEnter={e=>{if(selectedUser?.email!==u.email)(e.currentTarget as HTMLElement).style.background='rgba(0,0,0,0.03)'}}
                  onMouseLeave={e=>{if(selectedUser?.email!==u.email)(e.currentTarget as HTMLElement).style.background='transparent'}}>
                  <div style={{ width:28, height:28, borderRadius:'50%', background:appColor, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'#fff' }}>{u.name[0]}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:12, fontWeight:500 }}>{u.name}</div>
                    <div style={{ fontSize:10, color:'rgba(0,0,0,0.5)' }}>{u.division || u.role}</div>
                  </div>
                  {selectedUser?.email===u.email && <span style={{ color:appColor }}>✓</span>}
                </div>
              ))}
              {users.length === 0 && <div style={{ padding:14, textAlign:'center', color:'rgba(0,0,0,0.4)', fontSize:11 }}>Belum ada user</div>}
            </div>
          )}
        </div>

        <div style={{ marginBottom:18 }}>
          <label style={{ display:'block', fontSize:11, fontWeight:600, color:'rgba(0,0,0,0.6)', marginBottom:6 }}>PIN 6 Digit</label>
          <div style={{ display:'flex', gap:8, justifyContent:'space-between' }}>
            {pin.map((d,i) => (
              <input key={i} ref={el=>{inputRefs.current[i]=el}} type="tel" inputMode="numeric" pattern="[0-9]" maxLength={1} value={d}
                onChange={e=>handlePinChange(i, e.target.value)} onKeyDown={e=>handleKeyDown(i,e)} onPaste={i===0 ? handlePaste : undefined}
                disabled={!selectedUser || loading}
                style={{ width:'100%', height:46, textAlign:'center', fontSize:20, fontWeight:600, border:'1px solid rgba(0,0,0,0.1)', borderRadius:10, background:'rgba(255,255,255,0.6)', color:'#1a1a1a', outline:'none' }}
                onFocus={e=>(e.currentTarget.style.borderColor = appColor)}
                onBlur={e=>(e.currentTarget.style.borderColor = 'rgba(0,0,0,0.1)')} />
            ))}
          </div>
        </div>

        <button onClick={()=>submitWithPin(pin.join(''))} disabled={loading || !selectedUser || pin.some(d=>!d)}
          style={{ width:'100%', padding:'12px', fontSize:13, fontWeight:600, background:appColor, color:'#fff', border:'none', borderRadius:10, cursor:'pointer', opacity:(loading||!selectedUser||pin.some(d=>!d))?0.5:1, boxShadow:`0 4px 12px ${appColor}40` }}>
          {loading?'Masuk...':'Masuk'}
        </button>
        <div style={{ marginTop:14, paddingTop:12, borderTop:'1px solid rgba(0,0,0,0.06)', textAlign:'center' }}>
          <div style={{ fontSize:10, color:'rgba(0,0,0,0.45)' }}>PIN default: <code style={{ color:'rgba(0,0,0,0.7)', background:'rgba(0,0,0,0.05)', padding:'1px 5px', borderRadius:3 }}>123456</code> · Ubah di Profil</div>
        </div>
      </div>
    </div>
  )
}
