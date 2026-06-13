'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import { DEFAULT_ROLES } from '@/lib/defaults'

const ROLE_COLORS: Record<string,string> = { admin:'var(--red)', manager:'var(--brand)', member:'var(--green)', guest:'var(--text3)', finance:'var(--amber)', cashier:'var(--purple)' }

function MemberModal({ editing, onClose, onSave, allRoles }: { editing?:any; onClose:()=>void; onSave:()=>void; allRoles:any[] }) {
  const [form, setForm] = useState({
    name: editing?.name || '',
    password: '',
    roles: editing?.roles && editing.roles.length ? editing.roles : (editing?.role ? [editing.role] : ['member']),
    division: editing?.division || '',
    phone: editing?.phone || '',
    fonnteToken: editing?.fonnteToken || '',
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const set = (k:string,v:any) => setForm(f=>({...f,[k]:v}))

  function toggleRole(roleKey:string) {
    setForm(f=>({...f, roles: f.roles.includes(roleKey) ? f.roles.filter((r:string)=>r!==roleKey) : [...f.roles, roleKey] }))
  }

  async function save() {
    if (!form.name) { toast.error('Nama wajib'); return }
    if (form.roles.length === 0) { toast.error('Pilih minimal 1 role'); return }
    if (!editing && !form.password) { toast.error('PIN/Password wajib untuk member baru'); return }
    setSaving(true)
    try {
      const body: any = {
        name: form.name,
        roles: form.roles,
        role: form.roles[0], // back-compat: first role as primary
        division: form.division,
        phone: form.phone,
        fonnteToken: form.fonnteToken,
      }
      if (!editing) {
        // generate email from name slug
        body.email = `${form.name.toLowerCase().replace(/[^a-z0-9]+/g,'.').replace(/^\.|\.$/g,'')}@workpulse.local`
      }
      if (form.password) body.password = form.password
      const url = editing ? `/api/users/${editing._id}` : '/api/users'
      const r = await fetch(url, { method: editing?'PATCH':'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) })
      if (!r.ok) { const e = await r.json(); throw new Error(e.error) }
      toast.success(editing ? 'Diperbarui!' : 'Ditambahkan!'); onSave(); onClose()
    } catch(e:any) { toast.error(e.message||'Gagal') } finally { setSaving(false) }
  }

  async function del() {
    if (!editing) return
    if (!confirm(`Hapus ${editing.name}? Tindakan ini permanen.`)) return
    setDeleting(true)
    try {
      const r = await fetch(`/api/users/${editing._id}`, { method:'DELETE' })
      if (!r.ok) throw new Error('Gagal hapus')
      toast.success('Member dihapus'); onSave(); onClose()
    } catch(e:any) { toast.error(e.message||'Gagal') } finally { setDeleting(false) }
  }

  const hasCashierRole = form.roles.includes('cashier')

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ width:520 }}>
        <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between' }}>
          <span style={{ fontSize:14, fontWeight:600 }}>{editing ? 'Edit Member' : '+ Tambah Member'}</span>
          <button onClick={onClose} className="btn btn-icon">×</button>
        </div>
        <div style={{ padding:'14px 20px', display:'flex', flexDirection:'column', gap:11 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div><label style={lbl}>Nama *</label><input className="input" value={form.name} onChange={e=>set('name',e.target.value)} /></div>
            <div><label style={lbl}>Divisi</label><input className="input" value={form.division} onChange={e=>set('division',e.target.value)} placeholder="BPD Proc, TnD" /></div>
          </div>
          <div><label style={lbl}>No. HP (untuk WhatsApp / Fonnte)</label><input className="input" value={form.phone} onChange={e=>set('phone',e.target.value)} placeholder="08xxxxxxxxxx" /></div>
          <div>
            <label style={lbl}>Role (boleh pilih lebih dari 1)</label>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {allRoles.map((r:any) => {
                const checked = form.roles.includes(r.key)
                const color = ROLE_COLORS[r.key] || 'var(--brand)'
                return (
                  <button key={r.key} onClick={()=>toggleRole(r.key)} style={{ padding:'5px 12px', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer', border:`1px solid ${checked?color:'var(--border)'}`, background: checked?color+'22':'var(--bg3)', color: checked?color:'var(--text2)' }}>
                    {checked ? '✓ ' : ''}{r.label || r.key}
                  </button>
                )
              })}
            </div>
            <div style={{ fontSize:10, color:'var(--text3)', marginTop:4 }}>Klik untuk toggle. Hak akses menu sesuai konfigurasi role di Configuration.</div>
          </div>
          {hasCashierRole && (
            <div className="card" style={{ padding:'10px 12px', background:'var(--brand-soft)', border:'1px dashed var(--brand)' }}>
              <div style={{ fontSize:11, fontWeight:600, color:'var(--brand)', marginBottom:6 }}>💰 Cashier Settings</div>
              <label style={lbl}>Token Fonnte (untuk auto WhatsApp)</label>
              <input className="input" value={form.fonnteToken} onChange={e=>set('fonnteToken',e.target.value)} placeholder="Paste token dari fonnte.com" />
              <div style={{ fontSize:10, color:'var(--text3)', marginTop:4 }}>Get token: <a href="https://fonnte.com" target="_blank" style={{ color:'var(--brand)' }}>fonnte.com</a> → Device → Token. Test kirim bisa dari menu Configuration.</div>
            </div>
          )}
          <div><label style={lbl}>{editing ? 'PIN Baru (6 digit, kosongkan jika tidak diubah)' : 'PIN 6 Digit *'}</label>
            <input type="password" maxLength={6} className="input" value={form.password} onChange={e=>set('password',e.target.value.replace(/\D/g,''))} placeholder={editing ? '...' : 'Default: 123456'} /></div>
        </div>
        <div style={{ padding:'12px 20px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'space-between' }}>
          {editing ? <button onClick={del} disabled={deleting} className="btn btn-danger btn-sm">{deleting?'...':'🗑 Hapus'}</button> : <div />}
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={onClose} className="btn">Batal</button>
            <button onClick={save} disabled={saving} className="btn btn-primary">{saving?'Menyimpan...':'Simpan'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function MembersPage() {
  const [users, setUsers] = useState<any[]>([])
  const [config, setConfig] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [search, setSearch] = useState('')

  async function load() {
    setLoading(true)
    const [u,c] = await Promise.all([fetch('/api/users').then(r=>r.json()), fetch('/api/config').then(r=>r.json())])
    setUsers(u.data||[]); setConfig(c.data); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const allRoles = (config?.roleDefs && config.roleDefs.length > 0) ? config.roleDefs : DEFAULT_ROLES
  const filtered = users.filter(u => !search || u.name?.toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {(showForm||editing) && <MemberModal editing={editing} onClose={()=>{setShowForm(false);setEditing(null)}} onSave={load} allRoles={allRoles} />}

      <div style={{ padding:'12px 20px', borderBottom:'1px solid var(--border)', background:'var(--bg2)', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
        <div>
          <div style={{ fontSize:14, fontWeight:600 }}>Member Management</div>
          <div style={{ fontSize:11, color:'var(--text3)' }}>{users.length} member · Multi-role · Configurable permissions</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <input className="input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Cari..." style={{ width:200 }} />
          <button onClick={()=>setShowForm(true)} className="btn btn-primary btn-sm">+ Tambah</button>
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'14px 20px' }} className="safe-bottom">
        {loading ? <div style={{ textAlign:'center', padding:40, color:'var(--text3)' }}>Memuat...</div> : (
          <div className="card" style={{ overflow:'auto' }}>
            <table className="wp-table">
              <thead><tr><th>Nama</th><th>Divisi</th><th>Roles</th><th>No HP</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {filtered.map(u => {
                  const roles = u.roles && u.roles.length ? u.roles : (u.role ? [u.role] : [])
                  return (
                    <tr key={u._id} onClick={()=>setEditing(u)} style={{ cursor:'pointer' }}>
                      <td>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <div style={{ width:30, height:30, borderRadius:'50%', background:'var(--brand)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'#fff' }}>{u.name?.[0]}</div>
                          <div>
                            <div style={{ fontSize:12, fontWeight:600 }}>{u.name}</div>
                            {u.jabatan && <div style={{ fontSize:10, color:'var(--text3)' }}>{u.jabatan}</div>}
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize:11 }}>{u.division||'—'}</td>
                      <td>
                        <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                          {roles.map((r:string) => (
                            <span key={r} className="badge" style={{ background:(ROLE_COLORS[r]||'var(--brand)')+'22', color:ROLE_COLORS[r]||'var(--brand)', fontSize:9 }}>{r}</span>
                          ))}
                        </div>
                      </td>
                      <td style={{ fontSize:11 }}>{u.phone||'—'}</td>
                      <td><span className="badge" style={{ background: u.active!==false?'var(--greenbg)':'var(--redbg)', color: u.active!==false?'var(--green)':'var(--red)', fontSize:9 }}>{u.active!==false?'Active':'Inactive'}</span></td>
                      <td><button className="btn btn-icon btn-sm">✏️</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
const lbl: React.CSSProperties = { display:'block', fontSize:11, fontWeight:500, color:'var(--text2)', marginBottom:5 }
