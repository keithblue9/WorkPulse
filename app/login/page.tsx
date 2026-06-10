'use client'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const [email, setEmail] = useState('mas.e@pertamina.com')
  const [password, setPassword] = useState('workpulse123')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
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

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ width: 360, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: 36 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 44, height: 44, background: 'var(--blue)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: '#fff', margin: '0 auto 10px' }}>W</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>WorkPulse</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>BPD & SS Procurement — Pertamina</div>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 6, fontWeight: 500 }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, padding: '9px 12px', color: 'var(--text)', fontSize: 13, outline: 'none' }}
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 6, fontWeight: 500 }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, padding: '9px 12px', color: 'var(--text)', fontSize: 13, outline: 'none' }}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{ width: '100%', background: 'var(--blue)', border: 'none', borderRadius: 8, padding: '10px 0', color: '#fff', fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Masuk...' : 'Masuk'}
          </button>
        </form>

        <div style={{ marginTop: 20, padding: '12px', background: 'var(--bg3)', borderRadius: 8, fontSize: 11, color: 'var(--text3)' }}>
          <div style={{ fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>Demo accounts:</div>
          <div>Manager: mas.e@pertamina.com</div>
          <div>Admin: admin@pertamina.com</div>
          <div>Member: rina.s@pertamina.com</div>
          <div style={{ marginTop: 4, color: 'var(--text3)' }}>Password: workpulse123</div>
        </div>
      </div>
    </div>
  )
}
