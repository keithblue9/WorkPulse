'use client'
import { useState, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [config, setConfig] = useState<any>({ appName:'WorkPulse', loginTagline:'BPD & SS Procurement — Pertamina', appColor:'#4f8ef7', appIcon:'', loginBackgrounds:[], loginSlideInterval:5000 })
  const [currentSlide, setCurrentSlide] = useState(0)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/config').then(r=>r.json()).then(d => { if (d.data) setConfig(d.data) }).catch(()=>{})
  }, [])

  // slideshow
  useEffect(() => {
    if (!config.loginBackgrounds?.length) return
    const id = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % config.loginBackgrounds.length)
    }, config.loginSlideInterval || 5000)
    return () => clearInterval(id)
  }, [config.loginBackgrounds, config.loginSlideInterval])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) { toast.error('Email & password wajib'); return }
    setLoading(true)
    const res = await signIn('credentials', { email, password, redirect: false })
    setLoading(false)
    if (res?.ok) {
      toast.success('Selamat datang!')
      router.push('/dashboard')
    } else {
      toast.error('Email atau password salah')
    }
  }

  const bgs = config.loginBackgrounds || []
  const hasBg = bgs.length > 0
  const appColor = config.appColor || '#4f8ef7'

  return (
    <div style={{ minHeight:'100vh', display:'flex', position:'relative', overflow:'hidden', background:'var(--bg)' }} className="safe-all">
      {/* Background slideshow */}
      {hasBg ? (
        <>
          {bgs.map((bg:string, i:number) => (
            <div key={i} className={`login-bg-slide${i===currentSlide?' active':''}`} style={{ backgroundImage:`url("${bg}")` }} />
          ))}
          {/* Overlay */}
          <div style={{ position:'absolute', inset:0, background:`linear-gradient(105deg, rgba(15,17,23,0.85) 0%, rgba(15,17,23,0.55) 50%, rgba(15,17,23,0.15) 100%)` }} />
        </>
      ) : (
        // Fallback gradient background
        <div style={{ position:'absolute', inset:0, background:`linear-gradient(135deg, ${appColor}22 0%, var(--bg) 50%, ${appColor}11 100%)` }} />
      )}

      {/* Left-aligned login card */}
      <div style={{ position:'relative', zIndex:2, width:'100%', display:'flex', alignItems:'center', justifyContent:'flex-start', padding:'16px 24px' }}>
        <div style={{ width:'100%', maxWidth:380, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:18, padding:'32px 28px', boxShadow:'0 20px 60px rgba(0,0,0,0.25)' }}>
          {/* Logo + App name */}
          <div style={{ marginBottom:24 }}>
            {config.appIcon ? (
              <img src={config.appIcon} alt="logo" style={{ width:54, height:54, borderRadius:14, objectFit:'cover', marginBottom:14 }} />
            ) : (
              <div style={{ width:54, height:54, borderRadius:14, background:appColor, display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, fontWeight:700, color:'#fff', marginBottom:14, boxShadow:`0 8px 24px ${appColor}40` }}>
                {(config.appName||'W')[0]}
              </div>
            )}
            <div style={{ fontSize:24, fontWeight:700, color:'var(--text)', lineHeight:1.2, marginBottom:4 }}>{config.appName||'WorkPulse'}</div>
            <div style={{ fontSize:12, color:'var(--text3)', lineHeight:1.5 }}>{config.loginTagline}</div>
          </div>

          <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div>
              <label style={lbl}>Email</label>
              <input type="email" className="input" value={email} onChange={e=>setEmail(e.target.value)} placeholder="nama@workpulse.com" autoFocus />
            </div>
            <div>
              <label style={lbl}>Password</label>
              <div style={{ position:'relative' }}>
                <input type={showPwd?'text':'password'} className="input" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" style={{ paddingRight:38 }} />
                <span onClick={()=>setShowPwd(s=>!s)} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', cursor:'pointer', fontSize:14, color:'var(--text3)', userSelect:'none' }}>{showPwd?'🙈':'👁'}</span>
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn btn-primary" style={{ justifyContent:'center', padding:'11px', marginTop:6, fontSize:13, fontWeight:600 }}>
              {loading?'Masuk...':'Masuk'}
            </button>
          </form>

          <div style={{ marginTop:18, paddingTop:14, borderTop:'1px solid var(--border)', textAlign:'center' }}>
            <div style={{ fontSize:10, color:'var(--text3)' }}>© {new Date().getFullYear()} {config.appName||'WorkPulse'}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
const lbl: React.CSSProperties = { display:'block', fontSize:11, fontWeight:500, color:'var(--text2)', marginBottom:5 }
