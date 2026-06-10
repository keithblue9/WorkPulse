'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'

const SIZES_BAJU = ['XS','S','M','L','XL','XXL','XXXL']
const SIZES_CELANA = ['28','29','30','31','32','33','34','36','38','40']
const SIZES_SEPATU = ['38','39','40','41','42','43','44','45']

export default function ProfilePage() {
  const { data:session, update } = useSession(); const user = session?.user as any
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState<string|null>(null)

  useEffect(() => {
    async function load() {
      const d = await fetch('/api/users').then(r=>r.json())
      const me = (d.data||[]).find((u:any) => u.email === user?.email)
      if (me) { setProfile(me); setAvatarPreview(me.avatar || null) }
      setLoading(false)
    }
    if (user?.email) load()
  }, [user])

  function set(k:string,v:any) { setProfile((p:any) => ({...p,[k]:v})) }

  function handleAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 500000) { toast.error('Ukuran foto max 500KB'); return }
    const reader = new FileReader()
    reader.onload = () => { const b64 = reader.result as string; setAvatarPreview(b64); set('avatar', b64) }
    reader.readAsDataURL(file)
  }

  async function save() {
    setSaving(true)
    try {
      await fetch('/api/profile', { method:'PATCH', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ userId: profile._id, ...profile }) })
      toast.success('Profil disimpan!')
    } catch { toast.error('Gagal menyimpan') } finally { setSaving(false) }
  }

  if (loading || !profile) return <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text3)' }}>Memuat...</div>

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ padding:'12px 20px', borderBottom:'1px solid var(--border)', background:'var(--bg2)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div><div style={{ fontSize:14, fontWeight:600 }}>Profil Saya</div><div style={{ fontSize:11, color:'var(--text3)' }}>Edit informasi personal lo</div></div>
        <button onClick={save} disabled={saving} className="btn btn-primary btn-sm">{saving?'Menyimpan...':'💾 Simpan Perubahan'}</button>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'20px' }}>
        <div style={{ maxWidth:700, margin:'0 auto' }}>
          {/* Avatar & basic */}
          <div className="card" style={{ padding:'20px', marginBottom:16 }}>
            <div style={{ display:'flex', gap:20, alignItems:'flex-start' }}>
              {/* Avatar */}
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
                <div style={{ width:80, height:80, borderRadius:'50%', overflow:'hidden', background:'var(--bg4)', display:'flex', alignItems:'center', justifyContent:'center', border:'2px solid var(--border2)' }}>
                  {avatarPreview ? <img src={avatarPreview} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="avatar" /> :
                    <span style={{ fontSize:28, fontWeight:700, color:'var(--text2)' }}>{profile.name?.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}</span>}
                </div>
                <label style={{ cursor:'pointer', fontSize:11, color:'var(--blue)', fontWeight:500 }}>
                  📷 Ganti foto
                  <input type="file" accept="image/*" style={{ display:'none' }} onChange={handleAvatar} />
                </label>
                <div style={{ fontSize:10, color:'var(--text3)' }}>Max 500KB</div>
              </div>
              {/* Basic info */}
              <div style={{ flex:1, display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div style={{ gridColumn:'1/-1' }}><label style={lbl}>Nama Lengkap</label><input className="input" value={profile.name||''} onChange={e=>set('name',e.target.value)} /></div>
                <div><label style={lbl}>Email</label><input className="input" value={profile.email||''} disabled style={{ opacity:0.6 }} /></div>
                <div><label style={lbl}>Divisi</label><input className="input" value={profile.division||''} onChange={e=>set('division',e.target.value)} /></div>
                <div><label style={lbl}>No. HP</label><input className="input" value={profile.phone||''} onChange={e=>set('phone',e.target.value)} placeholder="08xxxxxxxxxx" /></div>
                <div><label style={lbl}>Role</label><input className="input" value={profile.role||''} disabled style={{ opacity:0.6, textTransform:'capitalize' }} /></div>
              </div>
            </div>
          </div>

          {/* Personal info */}
          <div className="card" style={{ padding:'16px 20px', marginBottom:16 }}>
            <div style={{ fontSize:13, fontWeight:600, color:'var(--text)', marginBottom:14 }}>📋 Informasi Personal</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div><label style={lbl}>Tanggal Lahir</label><input type="date" className="input" value={profile.birthDate||''} onChange={e=>set('birthDate',e.target.value)} /></div>
              <div><label style={lbl}>Tempat Lahir</label><input className="input" value={profile.birthPlace||''} onChange={e=>set('birthPlace',e.target.value)} placeholder="Kota kelahiran" /></div>
              <div style={{ gridColumn:'1/-1' }}><label style={lbl}>Alamat Rumah</label><textarea className="input" value={profile.address||''} onChange={e=>set('address',e.target.value)} rows={2} placeholder="Alamat lengkap..." /></div>
              <div><label style={lbl}>Hobi</label><input className="input" value={profile.hobbies||''} onChange={e=>set('hobbies',e.target.value)} placeholder="Olahraga, memasak, dll" /></div>
              <div><label style={lbl}>Makanan Favorit</label><input className="input" value={profile.favoriteFood||''} onChange={e=>set('favoriteFood',e.target.value)} placeholder="Soto ayam, nasi goreng, dll" /></div>
            </div>
          </div>

          {/* Clothing sizes */}
          <div className="card" style={{ padding:'16px 20px', marginBottom:16 }}>
            <div style={{ fontSize:13, fontWeight:600, color:'var(--text)', marginBottom:14 }}>👕 Ukuran Pakaian & Sepatu</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
              <div><label style={lbl}>Baju</label>
                <select className="input" value={profile.sizeBaju||''} onChange={e=>set('sizeBaju',e.target.value)}>
                  <option value="">Pilih...</option>
                  {SIZES_BAJU.map(s=><option key={s} value={s}>{s}</option>)}
                </select></div>
              <div><label style={lbl}>Jaket</label>
                <select className="input" value={profile.sizeJaket||''} onChange={e=>set('sizeJaket',e.target.value)}>
                  <option value="">Pilih...</option>
                  {SIZES_BAJU.map(s=><option key={s} value={s}>{s}</option>)}
                </select></div>
              <div><label style={lbl}>Celana</label>
                <select className="input" value={profile.sizeCelana||''} onChange={e=>set('sizeCelana',e.target.value)}>
                  <option value="">Pilih...</option>
                  {SIZES_CELANA.map(s=><option key={s} value={s}>{s}</option>)}
                </select></div>
              <div><label style={lbl}>Sepatu</label>
                <select className="input" value={profile.sizeSepatu||''} onChange={e=>set('sizeSepatu',e.target.value)}>
                  <option value="">Pilih...</option>
                  {SIZES_SEPATU.map(s=><option key={s} value={s}>{s}</option>)}
                </select></div>
            </div>
          </div>

          <div style={{ display:'flex', justifyContent:'flex-end' }}>
            <button onClick={save} disabled={saving} className="btn btn-primary">{saving?'Menyimpan...':'💾 Simpan Semua Perubahan'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
const lbl: React.CSSProperties = { display:'block', fontSize:11, fontWeight:500, color:'var(--text2)', marginBottom:5 }
