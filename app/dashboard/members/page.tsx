'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'

const ROLES = ['admin','manager','member','guest','finance']
const ROLE_COLORS: Record<string,string> = { admin:'var(--red)', manager:'var(--blue)', member:'var(--green)', guest:'var(--text3)', finance:'var(--amber)' }

function MemberModal({ editing, onClose, onSave }: { editing?:any; onClose:()=>void; onSave:()=>void }) {
  const [form, setForm] = useState({ name:editing?.name||'', email:editing?.email||'', password:'', role:editing?.role||'member', division:editing?.division||'', phone:editing?.phone||'' })
  const [saving, setSaving] = useState(false)
  const set = (k:string,v:any) => setForm(f=>({...f,[k]:v}))

  async function save() {
    if (!form.name || !form.email) { toast.error('Nama dan email wajib'); return }
    if (!editing && !form.password) { toast.error('Password wajib untuk member baru'); return }
    setSaving(true)
    try {
      const body: any = { name:form.name, email:form.email, role:form.role, division:form.division, phone:form.phone }
      if (form.password) body.password = form.password
      const url = editing ? `/api/users/${editing._id}` : '/api/users'
      const r = await fetch(url, { method: editing?'PATCH':'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) })
      if (!r.ok) { const e = await r.json(); throw new Error(e.error); }
      toast.success(editing ? 'Member diperbarui!' : 'Member ditambahkan!'); onSave(); onClose()
    } catch(e:any) { toast.error(e.message||'Gagal') } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ width:460 }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between' }}>
          <span style={{ fontSize:14, fontWeight:600 }}>{editing ? 'Edit Member' : '+ Tambah Member'}</span>
          <button onClick={onClose} className="btn btn-icon">×</button>
        </div>
        <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:12 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div><label style={lbl}>Nama *</label><input className="input" value={form.name} onChange={e=>set('name',e.target.value)} placeholder="Nama lengkap" /></div>
            <div><label style={lbl}>Divisi</label><input className="input" value={form.division} onChange={e=>set('division',e.target.value)} placeholder="BPD Proc, TnD, dll" /></div>
          </div>
          <div><label style={lbl}>Email *</label><input type="email" className="input" value={form.email} onChange={e=>set('email',e.target.value)} placeholder="email@pertamina.com" /></div>
          <div><label style={lbl}>No. HP</label><input className="input" value={form.phone} onChange={e=>set('phone',e.target.value)} placeholder="08xxxxxxxxxx" /></div>
          <div><label style={lbl}>Role</label>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {ROLES.map(r => (
                <button key={r} onClick={()=>set('role',r)} style={{ padding:'5px 12px', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer', border:`1px solid ${form.role===r?ROLE_COLORS[r]:'var(--border)'}`, background: form.role===r?ROLE_COLORS[r]+'22':'var(--bg3)', color: form.role===r?ROLE_COLORS[r]:'var(--text2)', textTransform:'capitalize' }}>{r}</button>
              ))}
            </div></div>
          <div><label style={lbl}>{editing ? 'Password Baru (kosongkan jika tidak diubah)' : 'Password *'}</label>
            <input type="password" className="input" value={form.password} onChange={e=>set('password',e.target.value)} placeholder={editing ? 'Kosongkan jika tidak diubah' : 'Minimal 8 karakter'} /></div>
        </div>
        <div style={{ padding:'12px 20px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'flex-end', gap:8 }}>
          <button onClick={onClose} className="btn">Batal</button>
          <button onClick={save} disabled={saving} className="btn btn-primary">{saving ? 'Menyimpan...' : editing ? 'Simpan' : 'Tambah Member'}</button>
        </div>
      </div>
    </div>
  )
}

export default function MembersPage() {
  const { data:session } = useSession(); const user = session?.user as any
  const [members, setMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [search, setSearch] = useState('')

  async function load() { const d = await fetch('/api/users').then(r=>r.json()); setMembers(d.data||[]); setLoading(false) }
  useEffect(() => { load() }, [])

  async function deactivate(id: string, name: string) {
    if (!confirm(`Nonaktifkan member "${name}"?`)) return
    await fetch(`/api/users/${id}`, { method:'DELETE' })
    toast.success('Member dinonaktifkan'); load()
  }

  const filtered = members.filter(m => !search || m.name.toLowerCase().includes(search.toLowerCase()) || m.email.toLowerCase().includes(search.toLowerCase()) || m.division?.toLowerCase().includes(search.toLowerCase()))

  if (user?.role !== 'admin') return (
    <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text3)', flexDirection:'column', gap:8 }}>
      <div style={{ fontSize:32 }}>🔒</div>
      <div>Hanya admin yang bisa mengakses halaman ini</div>
    </div>
  )

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {(showForm||editing) && <MemberModal editing={editing} onClose={()=>{setShowForm(false);setEditing(null)}} onSave={load} />}

      <div style={{ padding:'12px 20px', borderBottom:'1px solid var(--border)', background:'var(--bg2)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div><div style={{ fontSize:14, fontWeight:600 }}>Manajemen Member</div><div style={{ fontSize:11, color:'var(--text3)' }}>Kelola akun, role, dan hak akses tim</div></div>
        <button className="btn btn-primary btn-sm" onClick={()=>setShowForm(true)}>+ Tambah Member</button>
      </div>

      {/* Stats */}
      <div style={{ display:'flex', gap:10, padding:'10px 20px', background:'var(--bg2)', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
        {ROLES.map(r => {
          const count = members.filter(m=>m.role===r).length
          return count > 0 ? (
            <div key={r} style={{ padding:'4px 12px', borderRadius:20, fontSize:11, fontWeight:600, background:ROLE_COLORS[r]+'22', color:ROLE_COLORS[r], textTransform:'capitalize' }}>{r}: {count}</div>
          ) : null
        })}
        <div style={{ marginLeft:'auto', fontSize:12, color:'var(--text3)' }}>Total: {members.filter(m=>m.active!==false).length} aktif</div>
      </div>

      <div style={{ padding:'10px 20px', borderBottom:'1px solid var(--border)', background:'var(--bg2)', flexShrink:0 }}>
        <input className="input" style={{ width:260 }} value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Cari nama, email, divisi..." />
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'16px 20px' }}>
        {loading ? <div style={{ textAlign:'center', padding:40, color:'var(--text3)' }}>Memuat...</div> : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:10 }}>
            {filtered.map((m, i) => (
              <div key={m._id} className="card fade-in" style={{ padding:'14px 16px', animationDelay:`${i*0.04}s`, opacity: m.active===false ? 0.5 : 1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                  <div style={{ width:38, height:38, borderRadius:'50%', background: ROLE_COLORS[m.role]+'44', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700, color:ROLE_COLORS[m.role], flexShrink:0 }}>
                    {m.name.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:'var(--text)', display:'flex', alignItems:'center', gap:6 }}>
                      {m.name}
                      {m.active === false && <span style={{ fontSize:10, color:'var(--red)', background:'var(--redbg)', padding:'1px 6px', borderRadius:20 }}>Nonaktif</span>}
                    </div>
                    <div style={{ fontSize:11, color:'var(--text3)' }}>{m.email}</div>
                  </div>
                  <span style={{ padding:'2px 9px', borderRadius:20, fontSize:10, fontWeight:600, background:ROLE_COLORS[m.role]+'22', color:ROLE_COLORS[m.role], textTransform:'capitalize', flexShrink:0 }}>{m.role}</span>
                </div>
                <div style={{ display:'flex', gap:16, fontSize:11, color:'var(--text3)', marginBottom:10 }}>
                  {m.division && <span>🏢 {m.division}</span>}
                  {m.phone && <span>📱 {m.phone}</span>}
                </div>
                <div style={{ display:'flex', gap:6, justifyContent:'flex-end' }}>
                  <button className="btn btn-sm" onClick={()=>setEditing(m)}>✏️ Edit</button>
                  {m._id !== user?.id && m.active !== false && (
                    <button className="btn btn-sm" style={{ color:'var(--red)', borderColor:'var(--red)' }} onClick={()=>deactivate(m._id, m.name)}>Nonaktifkan</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
const lbl: React.CSSProperties = { display:'block', fontSize:11, fontWeight:500, color:'var(--text2)', marginBottom:5 }
