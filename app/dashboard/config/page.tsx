'use client'
import { getConfig, invalidateConfig } from '@/lib/configCache'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import { DEFAULT_ROLES, DEFAULT_WIDGETS, DEFAULT_LINK_CATEGORIES, DEFAULT_FONNTE } from '@/lib/defaults'

type Tab = 'branding'|'login'|'taxonomies'|'attendance'|'budget'|'roles'|'widgets'|'fonnte'|'reset'|'system'

function Section({ title, sub, children, action }: { title:string; sub?:string; children:React.ReactNode; action?:React.ReactNode }) {
  return (
    <div className="card" style={{ padding:'16px 18px', marginBottom:14 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <div>
          <div style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{title}</div>
          {sub && <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>{sub}</div>}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

function TaxonomyEditor({ items, onChange, label }: { items:any[]; onChange:(items:any[])=>void; label:string }) {
  const [editing, setEditing] = useState<number|null>(null)
  const [newItem, setNewItem] = useState({ key:'', label:'', color:'#4f8ef7' })
  const [showAdd, setShowAdd] = useState(false)

  function update(i:number, patch:any) { onChange(items.map((it,idx) => idx===i ? {...it, ...patch} : it)) }
  function remove(i:number) {
    if (!confirm(`Hapus "${items[i].label}"?`)) return
    onChange(items.filter((_,idx) => idx!==i))
  }
  function move(i:number, dir:number) {
    const j = i + dir
    if (j < 0 || j >= items.length) return
    const arr = [...items]
    const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp
    onChange(arr)
  }
  function add() {
    if (!newItem.key || !newItem.label) { toast.error('Key dan label wajib'); return }
    if (items.some(i => i.key === newItem.key)) { toast.error('Key sudah ada'); return }
    onChange([...items, { ...newItem, active:true }])
    setNewItem({ key:'', label:'', color:'#4f8ef7' })
    setShowAdd(false)
  }

  return (
    <div>
      <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:10 }}>
        {items.map((item:any, i:number) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', background:'var(--bg3)', borderRadius:7, border:`1px solid ${item.color}33`, opacity:item.active?1:0.5 }}>
            <div style={{ display:'flex', flexDirection:'column', gap:1, flexShrink:0 }}>
              <button onClick={()=>move(i,-1)} disabled={i===0} title="Naik" style={{ background:'none', border:'none', cursor:i===0?'default':'pointer', color:'var(--text3)', fontSize:9, lineHeight:1, padding:0, opacity:i===0?0.25:0.8 }}>▲</button>
              <button onClick={()=>move(i,1)} disabled={i===items.length-1} title="Turun" style={{ background:'none', border:'none', cursor:i===items.length-1?'default':'pointer', color:'var(--text3)', fontSize:9, lineHeight:1, padding:0, opacity:i===items.length-1?0.25:0.8 }}>▼</button>
            </div>
            <span style={{ fontSize:10, color:'var(--text3)', minWidth:16, textAlign:'center', flexShrink:0 }}>{i+1}</span>
            <input type="color" value={item.color} onChange={e=>update(i,{color:e.target.value})} style={{ width:24, height:24, borderRadius:4, border:'1px solid var(--border)', cursor:'pointer', flexShrink:0 }} />
            <input value={item.label} onChange={e=>update(i,{label:e.target.value})} style={{ flex:1, background:'transparent', border:'none', outline:'none', color:'var(--text)', fontSize:12, fontWeight:500 }} />
            <span style={{ fontSize:10, color:'var(--text3)' }}>{item.key}</span>
            <div className={`toggle-wrap${item.active?' on':''}`} onClick={()=>update(i,{active:!item.active})} />
            <button onClick={()=>remove(i)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text3)', fontSize:14, lineHeight:1 }}>🗑</button>
          </div>
        ))}
      </div>
      {showAdd ? (
        <div style={{ background:'var(--bg3)', borderRadius:7, padding:10, display:'flex', gap:6, alignItems:'center' }}>
          <input type="color" value={newItem.color} onChange={e=>setNewItem({...newItem,color:e.target.value})} style={{ width:24, height:24, borderRadius:4, border:'1px solid var(--border)', cursor:'pointer', flexShrink:0 }} />
          <input value={newItem.key} onChange={e=>setNewItem({...newItem,key:e.target.value.toLowerCase().replace(/\s/g,'_')})} placeholder="key" style={{ width:80, padding:'4px 8px', fontSize:11 }} className="input" />
          <input value={newItem.label} onChange={e=>setNewItem({...newItem,label:e.target.value})} placeholder="Label tampilan" style={{ flex:1, padding:'4px 8px', fontSize:12 }} className="input" />
          <button className="btn btn-sm btn-primary" onClick={add}>Tambah</button>
          <button className="btn btn-sm" onClick={()=>setShowAdd(false)}>×</button>
        </div>
      ) : (
        <button className="btn btn-sm" onClick={()=>setShowAdd(true)}>+ Tambah {label}</button>
      )}
    </div>
  )
}

function ResetSection() {
  const [scope, setScope] = useState<string[]>([])
  const [confirmText, setConfirmText] = useState('')
  const [loading, setLoading] = useState(false)

  const options = [
    { key:'initiatives', label:'Strategic Initiatives & Phases' },
    { key:'issues', label:'Issues' },
    { key:'kpi', label:'KPI Items' },
    { key:'activities', label:'Activities (Projects)' },
    { key:'agenda', label:'Daily Agenda' },
    { key:'budget', label:'Budget entries' },
    { key:'announcements', label:'Announcements' },
    { key:'reimbursements', label:'Reimbursements' },
    { key:'links', label:'Link Hub' },
    { key:'attendance', label:'Attendance records' },
  ]

  function toggle(key:string) {
    setScope(prev => prev.includes(key) ? prev.filter(k=>k!==key) : [...prev, key])
  }

  async function reset(all:boolean=false) {
    if (confirmText !== 'RESET') { toast.error('Ketik RESET untuk konfirmasi'); return }
    const targets = all ? options.map(o=>o.key) : scope
    if (targets.length === 0) { toast.error('Pilih minimal satu kategori'); return }
    setLoading(true)
    try {
      const r = await fetch('/api/admin/reset', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ confirm:'RESET', scope: all ? 'all' : targets }) })
      const d = await r.json()
      if (!r.ok) { toast.error(d.error); return }
      const total = Object.values(d.results||{}).reduce((s:any,v:any)=>s+(v as number),0)
      toast.success(`✅ ${total} item terhapus`)
      setConfirmText(''); setScope([])
    } catch (e:any) { toast.error('Gagal: '+e.message) } finally { setLoading(false) }
  }

  return (
    <Section title="🗑️ Reset Data" sub="Hapus data berdasarkan kategori. Tidak bisa dibatalkan.">
      <div style={{ background:'var(--redbg)', border:'1px solid var(--red)', borderRadius:8, padding:'10px 12px', marginBottom:14 }}>
        <div style={{ fontSize:11, color:'var(--red)', fontWeight:600, marginBottom:4 }}>⚠ Peringatan</div>
        <div style={{ fontSize:11, color:'var(--text2)', lineHeight:1.5 }}>
          Reset akan menghapus data secara permanen. User accounts tidak akan terhapus. Untuk konfirmasi, ketik <b>RESET</b> di bawah.
        </div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:14 }}>
        {options.map(o => (
          <label key={o.key} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', background:'var(--bg3)', borderRadius:6, cursor:'pointer' }}>
            <input type="checkbox" checked={scope.includes(o.key)} onChange={()=>toggle(o.key)} />
            <span style={{ fontSize:12, color:'var(--text2)' }}>{o.label}</span>
          </label>
        ))}
      </div>
      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
        <input value={confirmText} onChange={e=>setConfirmText(e.target.value)} placeholder="Ketik RESET untuk konfirmasi" className="input" style={{ flex:1 }} />
        <button className="btn btn-danger btn-sm" onClick={()=>reset(false)} disabled={loading||confirmText!=='RESET'}>Hapus Terpilih</button>
        <button className="btn btn-danger btn-sm" onClick={()=>reset(true)} disabled={loading||confirmText!=='RESET'} style={{ opacity:0.7 }}>🚨 Reset SEMUA</button>
      </div>
    </Section>
  )
}


const MENU_KEYS = ['dashboard','activities','calendar','issues','progress','attendance','biodata','links','meetings','notes','budget','reimbursement','cashcard','cashier','settlementcc','members','config']
const MENU_LABELS: Record<string,string> = {
  dashboard:'Dashboard', activities:'Activities', calendar:'Calendar', issues:'Issues', progress:'Progress',
  attendance:'Presensi', biodata:'Biodata', links:'Link Hub', meetings:'Meeting Reports', notes:'Notes',
  budget:'Anggaran', reimbursement:'Reimbursement', cashcard:'Cash Card', cashier:'Cashier', settlementcc:'Settlement CC',
  members:'Member', config:'Configuration'
}

// Ensure newly-added builtin roles (e.g. ccholder) show up in the editor even when
// the DB config was seeded before they existed. Existing roles and any custom menu
// edits are preserved untouched; only missing builtins are appended.
function withBuiltins(roles:any[]):any[] {
  const list = (roles && roles.length) ? [...roles] : [...DEFAULT_ROLES]
  const have = new Set(list.map((r:any)=>r.key))
  for (const def of DEFAULT_ROLES) if (!have.has(def.key)) list.push({ ...def })
  return list
}

function RolesEditor({ roles, onChange }: { roles:any[]; onChange:(roles:any[])=>void }) {
  const [editing, setEditing] = useState<number|null>(null)
  const [newRole, setNewRole] = useState({ key:'', label:'', allowedMenus:[] as string[] })
  const [showAdd, setShowAdd] = useState(false)

  function update(i:number, patch:any) { onChange(roles.map((r:any,idx:number)=>idx===i?{...r,...patch}:r)) }
  function toggleMenu(i:number, menu:string) {
    const role = roles[i]
    const allowed = role.allowedMenus || []
    const next = allowed.includes(menu) ? allowed.filter((m:string)=>m!==menu) : [...allowed, menu]
    update(i, { allowedMenus: next })
  }
  function remove(i:number) { if(!confirm(`Hapus role "${roles[i].label}"?`))return; onChange(roles.filter((_:any,idx:number)=>idx!==i)) }
  function add() {
    if (!newRole.key) return
    onChange([...roles, { ...newRole, builtin:false }])
    setNewRole({ key:'', label:'', allowedMenus:[] }); setShowAdd(false)
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      {roles.map((r:any, i:number) => (
        <div key={i} className="card" style={{ padding:12 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              {editing===i ? (
                <>
                  <input className="input input-sm" style={{ width:120 }} value={r.key} onChange={e=>update(i, { key:e.target.value })} disabled={r.builtin} />
                  <input className="input input-sm" style={{ width:160 }} value={r.label} onChange={e=>update(i, { label:e.target.value })} placeholder="Label" />
                </>
              ) : (
                <>
                  <code style={{ fontSize:11, padding:'3px 8px', background:'var(--bg3)', borderRadius:5 }}>{r.key}</code>
                  <span style={{ fontWeight:600, fontSize:13 }}>{r.label}</span>
                  {r.builtin && <span className="badge" style={{ background:'var(--brand-soft)', color:'var(--brand)', fontSize:9 }}>built-in</span>}
                </>
              )}
            </div>
            <div style={{ display:'flex', gap:5 }}>
              <button className="btn btn-icon btn-sm" onClick={()=>setEditing(editing===i?null:i)}>{editing===i?'✓':'✏️'}</button>
              {!r.builtin && <button onClick={()=>remove(i)} className="btn btn-icon btn-sm" style={{ color:'var(--red)' }}>🗑</button>}
            </div>
          </div>
          <div style={{ fontSize:10, color:'var(--text3)', marginBottom:5 }}>Menu yang bisa diakses:</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
            {MENU_KEYS.map(menu => {
              const checked = (r.allowedMenus||[]).includes(menu)
              return (
                <button key={menu} onClick={()=>toggleMenu(i, menu)} style={{ padding:'3px 9px', borderRadius:14, fontSize:10, fontWeight:500, cursor:'pointer', border:`1px solid ${checked?'var(--brand)':'var(--border)'}`, background:checked?'var(--brand-soft)':'var(--bg3)', color:checked?'var(--brand)':'var(--text3)' }}>
                  {checked?'✓ ':''}{MENU_LABELS[menu]}
                </button>
              )
            })}
          </div>
        </div>
      ))}
      {showAdd ? (
        <div className="card" style={{ padding:12, border:'1px dashed var(--brand)' }}>
          <div style={{ display:'flex', gap:8, marginBottom:8 }}>
            <input className="input input-sm" placeholder="Key (e.g. auditor)" value={newRole.key} onChange={e=>setNewRole(r=>({...r, key:e.target.value.replace(/\s+/g,'_').toLowerCase()}))} />
            <input className="input input-sm" placeholder="Label (e.g. Auditor)" value={newRole.label} onChange={e=>setNewRole(r=>({...r, label:e.target.value}))} />
            <button onClick={add} className="btn btn-primary btn-sm">+ Tambah</button>
            <button onClick={()=>setShowAdd(false)} className="btn btn-sm">Batal</button>
          </div>
        </div>
      ) : (
        <button onClick={()=>setShowAdd(true)} className="btn btn-sm" style={{ alignSelf:'flex-start' }}>+ Tambah Role</button>
      )}
    </div>
  )
}

function FonnteSettings({ config, onSave }: { config:any; onSave:(patch:any)=>void }) {
  const [users, setUsers] = useState<any[]>([])
  const [cashierUserId, setCashierUserId] = useState(config?.fonnte?.cashierUserId || '')
  const [tplCashier, setTplCashier] = useState(config?.fonnte?.messageToCashier || '')
  const [tplMember, setTplMember] = useState(config?.fonnte?.messageToMember || '')
  const [testNum, setTestNum] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => { fetch('/api/users').then(r=>r.json()).then(d=>setUsers(d.data||[])) }, [])

  async function test() {
    if (!testNum) { alert('Masukkan nomor HP test'); return }
    setSending(true)
    try {
      const r = await fetch('/api/fonnte', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ target: testNum, message: '🧪 Test message dari WorkPulse. Konfigurasi Fonnte berhasil.' }) })
      const d = await r.json()
      if (r.ok && d.success) alert('✅ Test kirim sukses (via ' + (d.resolvedFrom||'?') + '). Cek WA target.')
      else alert('❌ Gagal: ' + (d.error||'unknown'))
    } finally { setSending(false) }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div>
        <label style={lbl}>Cashier User (yang punya token Fonnte)</label>
        <select className="input" value={cashierUserId} onChange={e=>{ setCashierUserId(e.target.value); onSave({ cashierUserId: e.target.value }) }}>
          <option value="">— Pilih cashier —</option>
          {users.filter((u:any)=>u.active!==false).map((u:any) => (
            <option key={u._id} value={u._id}>{u.name}{u.division?` · ${u.division}`:''} {u.fonnteToken?'✓ has token':''}</option>
          ))}
        </select>
        <div style={{ fontSize:10, color:'var(--text3)', marginTop:5 }}>User yang dipilih harus punya role <code>cashier</code> dan token Fonnte di profil-nya.</div>
      </div>
      <div>
        <label style={lbl}>Template Pesan ke Cashier (saat member submit reimburse)</label>
        <textarea className="input" rows={5} value={tplCashier} onChange={e=>setTplCashier(e.target.value)} onBlur={()=>onSave({ messageToCashier: tplCashier })} />
        <div style={{ fontSize:10, color:'var(--text3)', marginTop:5 }}>Variabel: <code>{`{memberName} {purpose} {amount} {category} {bank} {noRekening}`}</code></div>
      </div>
      <div>
        <label style={lbl}>Template Pesan ke Member (saat cashier transfer)</label>
        <textarea className="input" rows={5} value={tplMember} onChange={e=>setTplMember(e.target.value)} onBlur={()=>onSave({ messageToMember: tplMember })} />
        <div style={{ fontSize:10, color:'var(--text3)', marginTop:5 }}>Variabel: <code>{`{memberName} {purpose} {amount} {category} {bank} {noRekening}`}</code></div>
      </div>
      <div className="card" style={{ padding:12, background:'var(--bg3)' }}>
        <div style={{ fontSize:11, fontWeight:600, marginBottom:6 }}>🧪 Test Kirim WhatsApp</div>
        <div style={{ display:'flex', gap:8 }}>
          <input className="input input-sm" value={testNum} onChange={e=>setTestNum(e.target.value)} placeholder="08xxxxxxxxxx" />
          <button onClick={test} disabled={sending} className="btn btn-primary btn-sm">{sending?'...':'Test Kirim'}</button>
        </div>
      </div>
    </div>
  )
}



function WidgetGroupsEditor({ widgets, onChange }: { widgets:any[]; onChange:(w:any[])=>void }) {
  // Group widgets by segment with dashboard-tab semantic mapping
  const GROUPS: { key:string; label:string; icon:string }[] = [
    { key:'stats', label:'Tab General — Stat Cards', icon:'📊' },
    { key:'ai',    label:'Tab General — AI Insights', icon:'🤖' },
    { key:'main',  label:'Tab General — Main Widgets', icon:'📈' },
  ]
  function toggleAll(segment:string, active:boolean) {
    onChange(widgets.map(w => w.segment === segment ? { ...w, active } : w))
  }
  function toggleOne(key:string, active:boolean) {
    onChange(widgets.map(w => w.key === key ? { ...w, active } : w))
  }
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(360px, 1fr))', gap:14 }}>
      {GROUPS.map(g => {
        const items = widgets.filter(w => w.segment === g.key)
        const allOn = items.length > 0 && items.every(w => w.active !== false)
        return (
          <div key={g.key} className="card" style={{ padding:14 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
              <div style={{ fontSize:13, fontWeight:700, display:'flex', alignItems:'center', gap:6 }}>
                <span>{g.icon}</span><span>{g.label}</span>
              </div>
              <button onClick={()=>toggleAll(g.key, !allOn)} className="btn btn-sm" style={{ background: allOn ? 'var(--brand-soft)' : 'var(--bg3)', color: allOn ? 'var(--brand)' : 'var(--text2)' }}>
                {allOn ? 'Sembunyikan Semua' : 'Tampilkan Semua'}
              </button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:1 }}>
              {items.length === 0 ? (
                <div style={{ padding:10, color:'var(--text3)', fontSize:11, textAlign:'center' }}>Tidak ada widget di group ini</div>
              ) : items.map(w => (
                <label key={w.key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'9px 10px', borderRadius:6, cursor:'pointer', borderBottom:'1px solid var(--border)' }}
                  onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='var(--bg3)'}
                  onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='transparent'}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, fontWeight:500, color:'var(--text)' }}>{w.label}</div>
                    <div style={{ fontSize:10, color:'var(--text3)' }}>key: <code style={{ fontSize:9 }}>{w.key}</code></div>
                  </div>
                  <input type="checkbox" checked={w.active !== false} onChange={e=>toggleOne(w.key, e.target.checked)} style={{ width:18, height:18, cursor:'pointer', accentColor:'var(--brand)' }} />
                </label>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function ConfigPage() {
  const { data:session } = useSession(); const user = session?.user as any
  const [config, setConfig] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<Tab>('branding')

  useEffect(()=>{ getConfig().then((data:any)=>({ data })).then(d=>{ setConfig(d.data); setLoading(false) }) }, [])

  async function save(patch:any) {
    setSaving(true)
    try {
      const r = await fetch('/api/config', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(patch) })
      const d = await r.json()
      setConfig(d.data); invalidateConfig(); toast.success('Tersimpan!')
    } catch { toast.error('Gagal') } finally { setSaving(false) }
  }

  function handleIconUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 300000) { toast.error('Max 300KB'); return }
    const reader = new FileReader()
    reader.onload = () => save({ appIcon: reader.result as string })
    reader.readAsDataURL(file)
  }

  const userRoles = (user?.roles && user.roles.length) ? user.roles : (user?.role ? [user.role] : [])
  const isAdmin = userRoles.includes('admin') || user?.role === 'admin'
  if (user && !isAdmin) return (
    <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:10, color:'var(--text3)', padding:20, textAlign:'center' }}>
      <div style={{ fontSize:32 }}>🔒</div>
      <div>Hanya admin yang bisa akses Konfigurasi</div>
      <div style={{ fontSize:11, maxWidth:360, lineHeight:1.6 }}>
        Kalau kamu sudah di-set role <b>admin</b> di menu Member tapi masih muncul pesan ini, coba <b>logout lalu login ulang</b> — sesi login lama belum memuat role baru.
      </div>
      <button onClick={()=>{ import('next-auth/react').then(m=>m.signOut({ callbackUrl:'/login' })) }} className="btn btn-primary btn-sm">Logout sekarang</button>
    </div>
  )

  if (loading || !config) return <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text3)' }}>Memuat...</div>

  const tabs: { key:Tab; label:string; icon:string }[] = [
    { key:'branding',   label:'Branding App',  icon:'🎨' },
    { key:'login',      label:'Login & PWA',   icon:'🔐' },
    { key:'taxonomies', label:'Kategori & Status', icon:'🏷️' },
    { key:'attendance', label:'Tipe Absensi',  icon:'📅' },
    { key:'budget',     label:'Kategori Anggaran', icon:'💰' },
    { key:'roles',      label:'Roles & Permissions', icon:'🔐' },
    { key:'widgets',    label:'Dashboard Widgets', icon:'📊' },
    { key:'fonnte',     label:'WhatsApp / Fonnte', icon:'💬' },
    { key:'reset',      label:'Reset Data',    icon:'🗑️' },
    { key:'system',     label:'Sistem Info',   icon:'ℹ️' },
  ]

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ padding:'12px 20px', borderBottom:'1px solid var(--border)', background:'var(--bg2)', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
        <div><div style={{ fontSize:14, fontWeight:600 }}>Konfigurasi Admin</div><div style={{ fontSize:11, color:'var(--text3)' }}>Semua pengaturan dan data taxonomy</div></div>
        {saving && <span style={{ fontSize:11, color:'var(--amber)' }}>⟳ Menyimpan...</span>}
      </div>

      <div style={{ display:'flex', gap:4, padding:'8px 20px', background:'var(--bg2)', borderBottom:'1px solid var(--border)', flexShrink:0, overflowX:'auto' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={()=>setTab(t.key)} style={{ padding:'6px 14px', borderRadius:8, fontSize:12, fontWeight:500, cursor:'pointer', whiteSpace:'nowrap', border:`1px solid ${tab===t.key?'var(--blue)':'var(--border)'}`, background:tab===t.key?'var(--bluebg)':'var(--bg3)', color:tab===t.key?'var(--blue)':'var(--text2)' }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'14px 20px' }}>
        {tab === 'branding' && (
          <>
            <Section title="🎨 Branding Aplikasi" sub="Atur nama, tagline, icon, dan warna utama">
              <div style={{ display:'grid', gridTemplateColumns:'auto 1fr', gap:14, alignItems:'flex-start' }}>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
                  <div style={{ width:84, height:84, borderRadius:18, background:config.appIcon?'transparent':config.appColor, display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', border:'1px solid var(--border)' }}>
                    {config.appIcon ? <img src={config.appIcon} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="logo" /> :
                      <span style={{ fontSize:36, fontWeight:700, color:'#fff' }}>{config.appName?.[0]||'W'}</span>}
                  </div>
                  <label style={{ fontSize:11, color:'var(--blue)', cursor:'pointer', fontWeight:500 }}>
                    📷 Upload icon
                    <input type="file" accept="image/*" style={{ display:'none' }} onChange={handleIconUpload} />
                  </label>
                  {config.appIcon && <button className="btn btn-sm" onClick={()=>save({ appIcon:'' })} style={{ fontSize:10 }}>Hapus icon</button>}
                  <div style={{ fontSize:9, color:'var(--text3)' }}>Max 300KB</div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:11 }}>
                  <div><label style={lbl}>Nama Aplikasi</label>
                    <input className="input" defaultValue={config.appName} onBlur={e=>e.target.value!==config.appName && save({ appName: e.target.value })} placeholder="WorkPulse" /></div>
                  <div><label style={lbl}>Tagline / Subtitle</label>
                    <input className="input" defaultValue={config.appTagline} onBlur={e=>e.target.value!==config.appTagline && save({ appTagline: e.target.value })} placeholder="BPD & SS Procurement" /></div>
                  <div style={{ display:'flex', gap:10, alignItems:'flex-end' }}>
                    <div style={{ flex:1 }}><label style={lbl}>Warna Brand Utama</label>
                      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                        <input type="color" defaultValue={config.appColor} onChange={e=>save({ appColor: e.target.value })} style={{ width:40, height:36, borderRadius:6, border:'1px solid var(--border)', cursor:'pointer' }} />
                        <input className="input" defaultValue={config.appColor} onBlur={e=>e.target.value!==config.appColor && save({ appColor: e.target.value })} placeholder="#4f8ef7" style={{ width:120 }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Section>

            <Section title="📅 Period & Target" sub="Tahun aktif dan target kumulatif">
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
                <div><label style={lbl}>Tahun Aktif</label><input type="number" className="input" defaultValue={config.activeYear} onBlur={e=>save({ activeYear: parseInt(e.target.value) })} /></div>
                <div><label style={lbl}>Bulan Mid Year</label><input type="number" min={1} max={12} className="input" defaultValue={config.midYearMonth} onBlur={e=>save({ midYearMonth: parseInt(e.target.value) })} /></div>
                <div><label style={lbl}>Target M{config.midYearMonth} (%)</label><input type="number" className="input" defaultValue={config.midYearTarget} onBlur={e=>save({ midYearTarget: parseInt(e.target.value) })} /></div>
                <div><label style={lbl}>Target Year End (%)</label><input type="number" className="input" defaultValue={config.yearEndTarget} onBlur={e=>save({ yearEndTarget: parseInt(e.target.value) })} /></div>
              </div>
            </Section>
          </>
        )}

        
        {tab === 'login' && (
          <>
            <Section title="🔐 Login Page" sub="Tulisan dan slideshow background di halaman login">
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div>
                  <label style={lbl}>Tagline Login Page</label>
                  <input className="input" defaultValue={config.loginTagline||''} onBlur={e=>e.target.value!==config.loginTagline && save({ loginTagline: e.target.value })} placeholder="BPD & SS Procurement — Pertamina" />
                  <div style={{ fontSize:10, color:'var(--text3)', marginTop:4 }}>Tulisan ini muncul di bawah nama aplikasi di halaman login.</div>
                </div>

                <div>
                  <label style={lbl}>Background Slideshow ({((config.loginBackgrounds || [])||[]).length} gambar)</label>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(140px, 1fr))', gap:8, marginBottom:8 }}>
                    {((config.loginBackgrounds || [])||[]).map((bg:string, i:number) => (
                      <div key={i} style={{ position:'relative', aspectRatio:'16/10', borderRadius:7, overflow:'hidden', border:'1px solid var(--border)' }}>
                        <img src={bg} alt={`bg-${i}`} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                        <button onClick={()=>{if(confirm('Hapus gambar ini?'))save({ loginBackgrounds: (config.loginBackgrounds || []).filter((_:any,idx:number)=>idx!==i) })}} className="btn btn-icon btn-sm" style={{ position:'absolute', top:4, right:4, fontSize:11, background:'rgba(0,0,0,0.6)', color:'#fff', border:'none' }}>×</button>
                      </div>
                    ))}
                    <label style={{ aspectRatio:'16/10', borderRadius:7, border:'2px dashed var(--border2)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'var(--text3)' }}>
                      <div style={{ fontSize:22 }}>+</div>
                      <div style={{ fontSize:10 }}>Tambah</div>
                      <input type="file" accept="image/*" style={{ display:'none' }} onChange={e=>{
                        const f = e.target.files?.[0]; if (!f) return
                        if (f.size > 5*1024*1024) { toast.error('Max 5MB'); return }
                        const reader = new FileReader()
                        reader.onload = () => save({ loginBackgrounds: [...((config.loginBackgrounds || [])||[]), reader.result as string] })
                        reader.readAsDataURL(f)
                      }} />
                    </label>
                  </div>
                  <div style={{ fontSize:10, color:'var(--text3)' }}>Max 1MB per gambar. Disarankan rasio 16:9 atau 16:10.</div>
                </div>

                <div>
                  <label style={lbl}>Durasi Slide (ms)</label>
                  <input type="number" min={1000} step={1000} className="input" defaultValue={config.loginSlideInterval||5000} onBlur={e=>save({ loginSlideInterval: parseInt(e.target.value)||5000 })} style={{ width:160 }} />
                  <div style={{ fontSize:10, color:'var(--text3)', marginTop:4 }}>Default 5000ms (5 detik). Berapa lama tiap gambar tampil.</div>
                </div>
              </div>
            </Section>

            <Section title="📱 PWA Install Prompt" sub="Notifikasi instal aplikasi ke home screen">
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div className={`toggle-wrap${config.pwaInstallEnabled?' on':''}`} onClick={()=>save({ pwaInstallEnabled: !config.pwaInstallEnabled })} />
                  <div>
                    <div style={{ fontSize:12, fontWeight:500 }}>Aktifkan PWA Install Prompt</div>
                    <div style={{ fontSize:10, color:'var(--text3)' }}>Tampilkan banner instalasi aplikasi pada device yang support</div>
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <div>
                    <label style={lbl}>Delay sebelum prompt muncul (ms)</label>
                    <input type="number" min={0} step={1000} className="input" defaultValue={config.pwaPromptDelay||8000} onBlur={e=>save({ pwaPromptDelay: parseInt(e.target.value)||8000 })} />
                    <div style={{ fontSize:10, color:'var(--text3)', marginTop:4 }}>Default 8000ms. Setelah user buka app berapa lama prompt muncul.</div>
                  </div>
                  <div>
                    <label style={lbl}>Cooldown setelah dismiss (hari)</label>
                    <input type="number" min={1} max={90} className="input" defaultValue={config.pwaPromptCooldown||7} onBlur={e=>save({ pwaPromptCooldown: parseInt(e.target.value)||7 })} />
                    <div style={{ fontSize:10, color:'var(--text3)', marginTop:4 }}>Default 7 hari. Berapa lama tidak muncul setelah user klik "Nanti".</div>
                  </div>
                </div>
              </div>
            </Section>
          </>
        )}

        {tab === 'taxonomies' && (
          <>
            <Section title="🏷️ Kategori Activities" sub="SI / Non-SI / Others / GoLive — bisa edit, tambah, hapus" action={<button className="btn btn-sm btn-primary" onClick={()=>save({ activityCategories: (config.activityCategories || []) })}>💾 Simpan</button>}>
              <TaxonomyEditor items={(config.activityCategories || [])} onChange={items=>setConfig((c:any)=>({...c, activityCategories:items}))} label="kategori" />
            </Section>

            <Section title="📈 Sub-tabs Progress of Projects" sub="KPI / Non-KPI / Others — wording bisa diganti" action={<button className="btn btn-sm btn-primary" onClick={()=>save({ progressSubTabs: (config.progressSubTabs || []) })}>💾 Simpan</button>}>
              <TaxonomyEditor items={(config.progressSubTabs || [])} onChange={items=>setConfig((c:any)=>({...c, progressSubTabs:items}))} label="sub-tab" />
            </Section>

            <Section title="🔖 Sub-tipe Activities" sub="KPI-SI / KPI-Non SI / Go-Live / Others — turunan tiap activity" action={<button className="btn btn-sm btn-primary" onClick={()=>save({ activitySubTypes: (config.activitySubTypes || []) })}>💾 Simpan</button>}>
              <TaxonomyEditor items={(config.activitySubTypes || [])||[]} onChange={items=>setConfig((c:any)=>({...c, activitySubTypes:items}))} label="sub-tipe" />
            </Section>

            <Section title="📊 Segmen Dashboard" sub="5 segmen dashboard utama — bisa edit dan tambah" action={<button className="btn btn-sm btn-primary" onClick={()=>save({ dashboardSegments: config.dashboardSegments })}>💾 Simpan</button>}>
              <TaxonomyEditor items={config.dashboardSegments||[]} onChange={items=>setConfig((c:any)=>({...c, dashboardSegments:items}))} label="segmen" />
            </Section>

            <Section title="◫ Status Issue" sub="On Track / At Risk / Delayed / Completed — editable" action={<button className="btn btn-sm btn-primary" onClick={()=>save({ issueStatuses: (config.issueStatuses || []) })}>💾 Simpan</button>}>
              <TaxonomyEditor items={(config.issueStatuses || [])} onChange={items=>setConfig((c:any)=>({...c, issueStatuses:items}))} label="status" />
            </Section>

            <Section title="📝 Kategori Meeting Reports" sub="Weekly / Project / 1-on-1 / Workshop / etc" action={<button className="btn btn-sm btn-primary" onClick={()=>save({ meetingCategories: (config.meetingCategories || []) })}>💾 Simpan</button>}>
              <TaxonomyEditor items={(config.meetingCategories || [])} onChange={items=>setConfig((c:any)=>({...c, meetingCategories:items}))} label="kategori meeting" />
            </Section>
          </>
        )}

        {tab === 'attendance' && (
          <Section title="📅 Tipe Kehadiran" sub="WFO / WFH / Dinas / Cuti — bisa tambah/edit/hapus" action={<button className="btn btn-sm btn-primary" onClick={()=>save({ attendanceTypes: (config.attendanceTypes || []) })}>💾 Simpan</button>}>
            <TaxonomyEditor items={(config.attendanceTypes || []).map((t:any)=>({...t,color:t.textColor||t.color}))} onChange={items=>setConfig((c:any)=>({...c, attendanceTypes:items.map(i=>({...i,textColor:i.color,color:i.color+'22'}))}))} label="tipe kehadiran" />
          </Section>
        )}

        {tab === 'budget' && (
          <Section title="💰 Kategori Anggaran" sub="Dinas Travel / External Accommodation — set anggaran tahunan & threshold">
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {(config.budgetCategories || []).map((cat:any, i:number) => (
                <div key={i} style={{ padding:'10px 12px', background:'var(--bg3)', borderRadius:7 }}>
                  <div style={{ display:'grid', gridTemplateColumns:'1.5fr 1fr 1fr 1.5fr auto', gap:8, alignItems:'center' }}>
                    <input className="input" defaultValue={cat.label} placeholder="Label" onBlur={e=>save({ budgetCategories: (config.budgetCategories || []).map((c:any,idx:number)=>idx===i?{...c,label:e.target.value}:c) })} />
                    <input type="number" className="input" defaultValue={cat.annualBudget} placeholder="Anggaran (Rp)" onBlur={e=>save({ budgetCategories: (config.budgetCategories || []).map((c:any,idx:number)=>idx===i?{...c,annualBudget:parseInt(e.target.value)||0}:c) })} />
                    <input type="number" min={50} max={100} className="input" defaultValue={cat.threshold} placeholder="Threshold %" onBlur={e=>save({ budgetCategories: (config.budgetCategories || []).map((c:any,idx:number)=>idx===i?{...c,threshold:parseInt(e.target.value)||80}:c) })} />
                    <input className="input" defaultValue={cat.pic||''} placeholder="PIC pengisi" onBlur={e=>save({ budgetCategories: (config.budgetCategories || []).map((c:any,idx:number)=>idx===i?{...c,pic:e.target.value}:c) })} />
                    <button className="btn btn-icon btn-sm" onClick={()=>{if(confirm('Hapus kategori?'))save({budgetCategories: (config.budgetCategories || []).filter((_:any,idx:number)=>idx!==i)})}} style={{ fontSize:14 }}>🗑</button>
                  </div>
                </div>
              ))}
              <button className="btn btn-sm" onClick={()=>save({ budgetCategories: [...(config.budgetCategories || []), { key:`cat_${Date.now()}`, label:'Kategori Baru', annualBudget:0, threshold:80, pic:'' }] })}>+ Tambah Kategori</button>
            </div>
          </Section>
        )}

        {tab === 'roles' && (
          <Section title="🔐 Roles & Permissions" sub="Atur role dan menu apa saja yang bisa diakses per role" action={
            <button className="btn btn-sm btn-primary" onClick={()=>save({ roleDefs: withBuiltins(config.roleDefs) })}>💾 Simpan Roles</button>
          }>
            <RolesEditor roles={withBuiltins(config.roleDefs)} onChange={(v:any)=>setConfig((c:any)=>({...c, roleDefs:v}))} />
          </Section>
        )}
        {tab === 'widgets' && (
          <Section title="📊 Widget Dashboard" sub="Tampilkan/sembunyikan komponen dashboard per tab. Cocok untuk fokus ke metrik yang penting saja." action={
            <button className="btn btn-sm btn-primary" onClick={()=>save({ dashboardWidgets: (config.dashboardWidgets && config.dashboardWidgets.length) ? config.dashboardWidgets : DEFAULT_WIDGETS, linkCategories: (config.linkCategories && config.linkCategories.length) ? config.linkCategories : DEFAULT_LINK_CATEGORIES })}>💾 Simpan</button>
          }>
            <WidgetGroupsEditor widgets={(config.dashboardWidgets && config.dashboardWidgets.length) ? config.dashboardWidgets : DEFAULT_WIDGETS} onChange={(v:any)=>setConfig((c:any)=>({...c, dashboardWidgets:v}))} />
            <div style={{ marginTop:18, paddingTop:18, borderTop:'1px solid var(--border)' }}>
              <div style={{ fontSize:13, fontWeight:600, marginBottom:6 }}>🔗 Kategori Link Hub</div>
              <div style={{ fontSize:11, color:'var(--text3)', marginBottom:10 }}>Kategori link yang dipakai di menu Link Hub</div>
              <TaxonomyEditor items={(config.linkCategories && config.linkCategories.length) ? config.linkCategories : DEFAULT_LINK_CATEGORIES} onChange={(v:any)=>setConfig((c:any)=>({...c, linkCategories:v}))} label="Link Categories" />
            </div>
          </Section>
        )}
        {tab === 'fonnte' && (
          <Section title="💬 WhatsApp / Fonnte Integration" sub="Konfigurasi notifikasi WhatsApp otomatis via fonnte.com">
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div className="card" style={{ padding:12, background:'var(--bg3)', fontSize:11, color:'var(--text3)', lineHeight:1.6 }}>
                <b style={{ color:'var(--text)' }}>How it works:</b> Set role <code>cashier</code> ke salah satu user di menu Member. Edit member tsb, masukkan Token Fonnte (dari fonnte.com → Device → Token) dan no HP. Lalu pilih user-nya di dropdown di bawah.
              </div>
              <FonnteSettings config={{...config, fonnte: { ...DEFAULT_FONNTE, ...(config.fonnte||{}) }}} onSave={(patch:any)=>save({ fonnte: { ...DEFAULT_FONNTE, ...(config.fonnte||{}), ...patch } })} />
            </div>
          </Section>
        )}
        {tab === 'reset' && <ResetSection />}

        {tab === 'system' && (
          <Section title="ℹ️ Informasi Sistem">
            {[
              ['Versi App','WorkPulse v5.0'],
              ['Framework','Next.js 16 (App Router)'],
              ['Database','MongoDB Atlas'],
              ['Auth','NextAuth.js'],
              ['Deploy','Vercel'],
              ['AI','Anthropic Claude'],
            ].map(([k,v]) => (
              <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid var(--border)' }}>
                <span style={{ fontSize:12, color:'var(--text2)' }}>{k}</span>
                <span style={{ fontSize:12, color:'var(--text)', fontWeight:500 }}>{v}</span>
              </div>
            ))}
          </Section>
        )}
      </div>
    </div>
  )
}
const lbl: React.CSSProperties = { display:'block', fontSize:11, fontWeight:500, color:'var(--text2)', marginBottom:5 }
