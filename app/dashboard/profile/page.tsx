'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import Link from 'next/link'

function ChangePinSection() {
  const [form, setForm] = useState({ currentPin:'', newPin:'', confirmPin:'' })
  const [show, setShow] = useState(false)
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!/^\d{6}$/.test(form.newPin)) { toast.error('PIN baru harus 6 digit angka'); return }
    if (form.newPin !== form.confirmPin) { toast.error('Konfirmasi PIN tidak sama'); return }
    setSaving(true)
    try {
      const r = await fetch('/api/auth/change-password', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ currentPassword: form.currentPin, newPassword: form.newPin }) })
      const d = await r.json()
      if (!r.ok) { toast.error(d.error||'Gagal'); return }
      toast.success('PIN berhasil diubah')
      setForm({ currentPin:'', newPin:'', confirmPin:'' }); setShow(false)
    } catch { toast.error('Gagal') } finally { setSaving(false) }
  }

  return (
    <div className="card" style={{ padding:'16px 20px', marginTop:14 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: show?14:0 }}>
        <div>
          <div style={{ fontSize:13, fontWeight:600 }}>🔐 Ganti PIN</div>
          <div style={{ fontSize:10, color:'var(--text3)' }}>PIN 6 digit untuk login</div>
        </div>
        <button onClick={()=>setShow(!show)} className="btn btn-sm">{show?'Batal':'Ubah PIN'}</button>
      </div>
      {show && (
        <div style={{ display:'flex', flexDirection:'column', gap:10, paddingTop:14, borderTop:'1px solid var(--border)' }}>
          <div>
            <label style={lbl}>PIN Lama (6 digit)</label>
            <input type="tel" inputMode="numeric" maxLength={6} className="input" value={form.currentPin} onChange={e=>setForm(f=>({...f,currentPin:e.target.value.replace(/\D/g,'')}))} placeholder="••••••" />
          </div>
          <div>
            <label style={lbl}>PIN Baru (6 digit)</label>
            <input type="tel" inputMode="numeric" maxLength={6} className="input" value={form.newPin} onChange={e=>setForm(f=>({...f,newPin:e.target.value.replace(/\D/g,'')}))} placeholder="••••••" />
          </div>
          <div>
            <label style={lbl}>Konfirmasi PIN Baru</label>
            <input type="tel" inputMode="numeric" maxLength={6} className="input" value={form.confirmPin} onChange={e=>setForm(f=>({...f,confirmPin:e.target.value.replace(/\D/g,'')}))} placeholder="••••••" />
          </div>
          <button onClick={save} disabled={saving} className="btn btn-primary" style={{ justifyContent:'center' }}>{saving?'Mengubah...':'Simpan PIN Baru'}</button>
        </div>
      )}
    </div>
  )
}

export default function ProfilePage() {
  const { data:session } = useSession(); const sessUser = session?.user as any
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)

  useEffect(() => {
    fetch('/api/profile').then(r=>r.json()).then(d=>setProfile(d.data)).catch(()=>{})
  }, [])

  if (!profile) return <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text3)' }}>Memuat...</div>

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ padding:'12px 20px', borderBottom:'1px solid var(--border)', background:'var(--bg2)', flexShrink:0 }}>
        <div style={{ fontSize:14, fontWeight:600 }}>My Profile</div>
        <div style={{ fontSize:11, color:'var(--text3)' }}>Akun dan PIN</div>
      </div>
      <div style={{ flex:1, overflowY:'auto', padding:'18px 20px' }} className="safe-bottom page-pad">
        <div style={{ maxWidth:560, margin:'0 auto' }}>
          {/* Profile summary card */}
          <div className="card" style={{ padding:'20px 24px', textAlign:'center' }}>
            <div style={{ width:84, height:84, borderRadius:'50%', background:'var(--brand)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:34, fontWeight:700, color:'#fff', margin:'0 auto 12px' }}>{profile.name?.[0]}</div>
            <div style={{ fontSize:18, fontWeight:700, color:'var(--text)', letterSpacing:'-0.01em' }}>{profile.name}</div>
            <div style={{ fontSize:11, color:'var(--text3)', marginTop:4 }}>{profile.role} · {profile.division||'—'}</div>
            <Link href="/dashboard/biodata" style={{ display:'inline-block', marginTop:14 }}>
              <button className="btn btn-sm btn-primary">✏️ Edit Biodata Lengkap</button>
            </Link>
          </div>

          {/* Change PIN */}
          <ChangePinSection />

          {/* Quick info */}
          <div className="card" style={{ padding:'14px 18px', marginTop:14 }}>
            <div style={{ fontSize:12, fontWeight:600, marginBottom:10 }}>Info Akun</div>
            <div style={{ fontSize:11, color:'var(--text2)', lineHeight:1.8 }}>
              Untuk update biodata lengkap (alamat, no rekening, kontak darurat, ukuran), klik <b>Edit Biodata Lengkap</b> di atas.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
const lbl: React.CSSProperties = { display:'block', fontSize:11, fontWeight:500, color:'var(--text2)', marginBottom:5 }
