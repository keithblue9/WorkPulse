'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'

export default function ChangePasswordPage() {
  const router = useRouter()
  const [form, setForm] = useState({ currentPassword:'', newPassword:'', confirmPassword:'' })
  const [saving, setSaving] = useState(false)
  const [show, setShow] = useState({ current:false, new:false, confirm:false })
  const set = (k:string,v:any) => setForm(f=>({...f,[k]:v}))

  async function save() {
    if (!form.currentPassword || !form.newPassword) { toast.error('Lengkapi semua field'); return }
    if (form.newPassword !== form.confirmPassword) { toast.error('Password baru dan konfirmasi tidak sama'); return }
    if (form.newPassword.length < 6) { toast.error('Password minimal 6 karakter'); return }
    setSaving(true)
    try {
      const r = await fetch('/api/auth/change-password', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword }) })
      const d = await r.json()
      if (!r.ok) { toast.error(d.error||'Gagal'); return }
      toast.success('Password berhasil diubah!')
      setForm({ currentPassword:'', newPassword:'', confirmPassword:'' })
    } catch { toast.error('Gagal') } finally { setSaving(false) }
  }

  const strength = (() => {
    const p = form.newPassword
    if (!p) return { score:0, label:'', color:'var(--bg4)' }
    let score = 0
    if (p.length >= 6) score++
    if (p.length >= 10) score++
    if (/[A-Z]/.test(p)) score++
    if (/[0-9]/.test(p)) score++
    if (/[^a-zA-Z0-9]/.test(p)) score++
    if (score <= 1) return { score, label:'Lemah', color:'var(--red)' }
    if (score <= 3) return { score, label:'Sedang', color:'var(--amber)' }
    return { score, label:'Kuat', color:'var(--green)' }
  })()

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ padding:'12px 20px', borderBottom:'1px solid var(--border)', background:'var(--bg2)', flexShrink:0 }}>
        <div style={{ fontSize:14, fontWeight:600 }}>Ganti Password</div>
        <div style={{ fontSize:11, color:'var(--text3)' }}>Ubah password akun lo</div>
      </div>
      <div style={{ flex:1, overflowY:'auto', padding:'24px 20px' }}>
        <div className="card" style={{ maxWidth:480, margin:'0 auto', padding:24 }}>
          <div style={{ fontSize:13, fontWeight:600, color:'var(--text)', marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
            🔐 Ubah Password
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div>
              <label style={lbl}>Password Lama</label>
              <div style={{ position:'relative' }}>
                <input type={show.current?'text':'password'} className="input" value={form.currentPassword} onChange={e=>set('currentPassword',e.target.value)} placeholder="Password saat ini..." style={{ paddingRight:36 }} />
                <span onClick={()=>setShow(s=>({...s,current:!s.current}))} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', cursor:'pointer', fontSize:14, color:'var(--text3)' }}>{show.current?'🙈':'👁'}</span>
              </div>
            </div>
            <div>
              <label style={lbl}>Password Baru</label>
              <div style={{ position:'relative' }}>
                <input type={show.new?'text':'password'} className="input" value={form.newPassword} onChange={e=>set('newPassword',e.target.value)} placeholder="Min 6 karakter..." style={{ paddingRight:36 }} />
                <span onClick={()=>setShow(s=>({...s,new:!s.new}))} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', cursor:'pointer', fontSize:14, color:'var(--text3)' }}>{show.new?'🙈':'👁'}</span>
              </div>
              {form.newPassword && (
                <div style={{ marginTop:6, display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ flex:1, height:4, background:'var(--bg4)', borderRadius:2, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${(strength.score/5)*100}%`, background:strength.color, transition:'all 0.3s' }} />
                  </div>
                  <span style={{ fontSize:10, fontWeight:600, color:strength.color }}>{strength.label}</span>
                </div>
              )}
            </div>
            <div>
              <label style={lbl}>Konfirmasi Password Baru</label>
              <div style={{ position:'relative' }}>
                <input type={show.confirm?'text':'password'} className="input" value={form.confirmPassword} onChange={e=>set('confirmPassword',e.target.value)} placeholder="Ulangi password baru..." style={{ paddingRight:36 }} />
                <span onClick={()=>setShow(s=>({...s,confirm:!s.confirm}))} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', cursor:'pointer', fontSize:14, color:'var(--text3)' }}>{show.confirm?'🙈':'👁'}</span>
              </div>
              {form.confirmPassword && form.newPassword && form.confirmPassword !== form.newPassword && (
                <div style={{ fontSize:10, color:'var(--red)', marginTop:4 }}>⚠ Password tidak sama</div>
              )}
            </div>
            <button onClick={save} disabled={saving} className="btn btn-primary" style={{ justifyContent:'center', padding:'10px' }}>
              {saving ? 'Mengubah...' : '🔐 Ubah Password'}
            </button>
          </div>
          <div style={{ marginTop:14, padding:'10px 12px', background:'var(--bg3)', borderRadius:7, fontSize:10, color:'var(--text3)' }}>
            💡 Tips: Gunakan kombinasi huruf besar, kecil, angka, dan simbol untuk password yang lebih kuat.
          </div>
        </div>
      </div>
    </div>
  )
}
const lbl: React.CSSProperties = { display:'block', fontSize:11, fontWeight:500, color:'var(--text2)', marginBottom:5 }
