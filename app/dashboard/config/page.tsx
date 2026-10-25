'use client'
import { invalidateConfig } from '@/lib/configCache'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import { DEFAULT_ROLES, DEFAULT_WIDGETS, DEFAULT_LINK_CATEGORIES } from '@/lib/defaults'
import { displayAppName } from '@/lib/appName'
import { TPL, STAGES, normWeights } from '@/lib/enhancement'
import { Empty, Icon, PageHeader } from '@/components/ui'

type Tab = 'branding'|'login'|'taxonomies'|'attendance'|'budget'|'roles'|'widgets'|'enhancement'|'reset'|'system'

const TPL_COLORS = ['var(--accent)', '#7B6BFF', 'var(--aqua)', 'var(--warn-bar)', 'var(--muted)']
// Bobot default timeline Enhancement. Tiap enhancement memakai bobot ini kecuali diatur sendiri.
function EnhTemplateEditor({ value, saving, onSave }: { value: any; saving: boolean; onSave: (v: { name: string; w: number }[]) => void }) {
  const [w, setW] = useState<number[]>(() => normWeights(value))
  const total = Math.round(w.reduce((a, b) => a + (Number(b) || 0), 0) * 100) / 100
  const even = () => { const b = Math.floor(100 / TPL.length); setW(TPL.map((_, i) => b + (i < 100 - b * TPL.length ? 1 : 0))) }
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div style={{ display:'flex', gap:3, height:14, borderRadius:7, overflow:'hidden' }} aria-hidden="true">
        {TPL.map((k, i) => <i key={k} style={{ flex: Math.max(0.0001, w[i] || 0), background: TPL_COLORS[i], borderRadius:3 }} />)}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:10 }}>
        {TPL.map((k, i) => (
          <label key={k} style={{ display:'flex', flexDirection:'column', gap:6, fontSize:13, fontWeight:600 }}>{k}
            <span style={{ display:'flex', alignItems:'center', gap:6 }}>
              <input className="input" type="number" inputMode="numeric" min={0} max={100} value={w[i]} onChange={e => setW(ws => ws.map((x, j) => j === i ? Math.max(0, Math.min(100, Number(e.target.value) || 0)) : x))} style={{ textAlign:'right' }} />%
            </span>
          </label>
        ))}
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
        <b style={{ color: total === 100 ? 'var(--ok)' : 'var(--bad)' }}>Total {total}%{total === 100 ? '' : ' · harus 100%'}</b>
        <button type="button" className="btn btn-sm" onClick={even}>Ratakan</button>
        <button type="button" className="btn btn-primary btn-sm" disabled={saving || total !== 100} onClick={() => onSave(TPL.map((name, i) => ({ name, w: w[i] })))}>Simpan bobot</button>
      </div>
      <div style={{ fontSize:12, color:'var(--muted)', lineHeight:1.6 }}>
        Progress BRD otomatis dari tahap: {STAGES.map((s, i) => `${i + 1}. ${s}`).join(' · ')} — BRD % = tahap ÷ 7.
      </div>
    </div>
  )
}

function Section({ title, sub, children, action }: { title:string; sub?:string; children:React.ReactNode; action?:React.ReactNode }) {
  return (
    <section className="au-card rise">
      <div className="au-row au-between au-wrap" style={{ gap:10, alignItems:'flex-start' }}>
        <div className="au-col" style={{ gap:3, minWidth:0, flex:'1 1 240px' }}>
          <h2>{title}</h2>
          {sub && <span className="au-xs au-muted" style={{ lineHeight:1.5 }}>{sub}</span>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function TaxonomyEditor({ items, onChange, label }: { items:any[]; onChange:(items:any[])=>void; label:string }) {
  const [editing, setEditing] = useState<number|null>(null)
  const [newItem, setNewItem] = useState({ key:'', label:'', color:'#4f8ef7' })
  const [showAdd, setShowAdd] = useState(false)

  function update(i:number, patch:any) { onChange(items.map((it,idx) => idx===i ? {...it, ...patch} : it)) }
  const [delAsk, setDelAsk] = useState<number|null>(null)
  function remove(i:number) {
    if (delAsk !== i) { setDelAsk(i); return }
    setDelAsk(null); onChange(items.filter((_,idx) => idx!==i))
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
      <div className="au-col" style={{ gap:6, marginBottom:10 }}>
        {items.map((item:any, i:number) => (
          <div key={i} className="au-taxrow" style={{ opacity:item.active?1:0.55 }}>
            <span className="au-col" style={{ gap:2, flexShrink:0 }}>
              <button type="button" className="au-mv" onClick={()=>move(i,-1)} disabled={i===0} aria-label={`Naikkan ${item.label}`}><Icon name="up" size={12} stroke={2.4} /></button>
              <button type="button" className="au-mv" onClick={()=>move(i,1)} disabled={i===items.length-1} aria-label={`Turunkan ${item.label}`}><Icon name="up" size={12} stroke={2.4} style={{ transform:'rotate(180deg)' }} /></button>
            </span>
            <input type="color" value={item.color} onChange={e=>update(i,{color:e.target.value})} aria-label={`Warna ${item.label}`} className="au-color" />
            <input value={item.label} onChange={e=>update(i,{label:e.target.value})} aria-label={`Label ${item.key}`} className="au-taxlbl" />
            <code className="au-xs au-muted">{item.key}</code>
            <input type="checkbox" className="au-sw" checked={!!item.active} onChange={()=>update(i,{active:!item.active})} aria-label={`Aktifkan ${item.label}`} />
            <button type="button" onClick={()=>remove(i)} className={`btn btn-sm${delAsk===i?' btn-danger':' btn-icon'}`} aria-label={`Hapus ${item.label}`}>{delAsk===i ? 'Hapus?' : <Icon name="trash" size={14} />}</button>
          </div>
        ))}
      </div>
      {showAdd ? (
        <div className="au-row au-wrap au-box" style={{ padding:10, gap:6 }}>
          <input type="color" value={newItem.color} onChange={e=>setNewItem({...newItem,color:e.target.value})} className="au-color" aria-label="Warna" />
          <input value={newItem.key} onChange={e=>setNewItem({...newItem,key:e.target.value.toLowerCase().replace(/\s/g,'_')})} placeholder="key" style={{ width:80, padding:'4px 8px', fontSize:11 }} className="input" />
          <input value={newItem.label} onChange={e=>setNewItem({...newItem,label:e.target.value})} placeholder="Label tampilan" style={{ flex:1, padding:'4px 8px', fontSize:12 }} className="input" />
          <button className="btn btn-sm btn-primary" onClick={add}>Tambah</button>
          <button type="button" className="btn btn-sm" onClick={()=>setShowAdd(false)}>Batal</button>
        </div>
      ) : (
        <button type="button" className="btn btn-sm" onClick={()=>setShowAdd(true)}><Icon name="plus" size={14} />Tambah {label}</button>
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
      toast.success(`${total} item terhapus`)
      setConfirmText(''); setScope([])
    } catch (e:any) { toast.error('Gagal: '+e.message) } finally { setLoading(false) }
  }

  return (
    <Section title="Reset data" sub="Hapus data berdasarkan kategori. Tidak bisa dibatalkan.">
      <div className="p-bad au-small" role="note" style={{ borderRadius:14, padding:12, lineHeight:1.5 }}>
        <b>Peringatan:</b> reset menghapus data secara permanen. Akun user tidak ikut terhapus. Untuk konfirmasi, ketik <b>RESET</b> di bawah.
      </div>
      <div className="au-grid" style={{ gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:6 }}>
        {options.map(o => (
          <label key={o.key} className="au-row au-box" style={{ gap:10, padding:'10px 12px', cursor:'pointer' }}>
            <input type="checkbox" className="au-check" checked={scope.includes(o.key)} onChange={()=>toggle(o.key)} />
            <span className="au-small">{o.label}</span>
          </label>
        ))}
      </div>
      <div className="au-row au-wrap" style={{ gap:8 }}>
        <input value={confirmText} onChange={e=>setConfirmText(e.target.value)} placeholder="Ketik RESET untuk konfirmasi" className="input" aria-label="Konfirmasi reset" style={{ flex:'1 1 220px' }} />
        <button type="button" className="btn btn-danger" onClick={()=>reset(false)} disabled={loading||confirmText!=='RESET'||!scope.length}>Hapus terpilih ({scope.length})</button>
        <button type="button" className="btn" onClick={()=>reset(true)} disabled={loading||confirmText!=='RESET'} style={{ color:'var(--bad)' }}>Reset semua</button>
      </div>
    </Section>
  )
}


const MENU_KEYS = ['dashboard','progress','activities','mandatory','golive','calendar','issues','attendance','biodata','links','notes','quicknotes','reimbursement','operasional','pettycash','cashcard','thirdparty','budgetreport','cashier','settlementcc','members','config','biodata-export']
const MENU_LABELS: Record<string,string> = {
  dashboard:'Dashboard', progress:'Progress Project', activities:'Activities', mandatory:'Mandatory', golive:'Go-Live', calendar:'Calendar', issues:'Issues',
  attendance:'Presensi', biodata:'Biodata', links:'Link Hub', notes:'[Team] Notes', quicknotes:'[Personal] Notes',
  reimbursement:'Reimbursement', operasional:'Operasional', pettycash:'Petty Cash (tab)', cashcard:'Cash Card', thirdparty:'[3rd Party] Event', budgetreport:'Budget Report',
  cashier:'Akses Cashier (tab)', settlementcc:'Akses Settlement CC (CC Holder)',
  members:'Member', config:'Configuration', 'biodata-export':'Export Biodata (Excel) — admin'
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
  const [delAsk, setDelAsk] = useState<number|null>(null)
  function remove(i:number) { if (delAsk !== i) { setDelAsk(i); return } setDelAsk(null); onChange(roles.filter((_:any,idx:number)=>idx!==i)) }
  function add() {
    if (!newRole.key) return
    onChange([...roles, { ...newRole, builtin:false }])
    setNewRole({ key:'', label:'', allowedMenus:[] }); setShowAdd(false)
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      {roles.map((r:any, i:number) => (
        <div key={i} className="au-box" style={{ padding:14, gap:10 }}>
          <div className="au-row au-between au-wrap" style={{ gap:8 }}>
            <div className="au-row au-wrap" style={{ gap:8 }}>
              {editing===i ? (
                <>
                  <input className="input input-sm" style={{ width:120 }} value={r.key} onChange={e=>update(i, { key:e.target.value })} disabled={r.builtin} />
                  <input className="input input-sm" style={{ width:160 }} value={r.label} onChange={e=>update(i, { label:e.target.value })} placeholder="Label" />
                </>
              ) : (
                <>
                  <code className="au-tag">{r.key}</code>
                  <b className="au-small">{r.label}</b>
                  {r.builtin && <span className="au-tag" style={{ background:'var(--accent-soft)', color:'var(--accent-ink)' }}>built-in</span>}
                </>
              )}
            </div>
            <div className="au-row" style={{ gap:5 }}>
              <button type="button" className="btn btn-icon btn-sm" onClick={()=>setEditing(editing===i?null:i)} aria-label={editing===i?'Selesai ubah':'Ubah nama role'}><Icon name={editing===i?'check':'edit'} size={14} /></button>
              {!r.builtin && <button type="button" onClick={()=>remove(i)} className={`btn btn-sm${delAsk===i?' btn-danger':' btn-icon'}`} aria-label={`Hapus role ${r.label}`}>{delAsk===i ? 'Hapus?' : <Icon name="trash" size={14} />}</button>}
            </div>
          </div>
          <span className="au-xs au-muted">Menu yang bisa diakses · {(r.allowedMenus||[]).length}</span>
          <div className="au-chips wrap" role="group" aria-label={`Menu untuk ${r.label}`}>
            {MENU_KEYS.map(menu => {
              const checked = (r.allowedMenus||[]).includes(menu)
              return (
                <button type="button" key={menu} onClick={()=>toggleMenu(i, menu)} className="au-chip" aria-pressed={checked} style={{ minHeight:30, fontSize:12, padding:'4px 10px' }}>
                  {checked && <Icon name="check" size={12} stroke={2.6} style={{ marginRight:4, verticalAlign:'-2px' }} />}{MENU_LABELS[menu]}
                </button>
              )
            })}
          </div>
        </div>
      ))}
      {showAdd ? (
        <div className="au-box" style={{ padding:12, borderStyle:'dashed', borderColor:'var(--accent)' }}>
          <div className="au-row au-wrap" style={{ gap:8 }}>
            <input className="input input-sm" placeholder="Key (e.g. auditor)" value={newRole.key} onChange={e=>setNewRole(r=>({...r, key:e.target.value.replace(/\s+/g,'_').toLowerCase()}))} />
            <input className="input input-sm" placeholder="Label (e.g. Auditor)" value={newRole.label} onChange={e=>setNewRole(r=>({...r, label:e.target.value}))} />
            <button type="button" onClick={add} className="btn btn-primary btn-sm">Tambah</button>
            <button onClick={()=>setShowAdd(false)} className="btn btn-sm">Batal</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={()=>setShowAdd(true)} className="btn btn-sm" style={{ alignSelf:'flex-start' }}><Icon name="plus" size={14} />Tambah role</button>
      )}
    </div>
  )
}

function WidgetGroupsEditor({ widgets, onChange }: { widgets:any[]; onChange:(w:any[])=>void }) {
  // Group widgets by segment with dashboard-tab semantic mapping
  // Grup 'ai' tidak ditampilkan lagi (menu AI Insight dihapus); data lamanya tidak diubah.
  const GROUPS: { key:string; label:string }[] = [
    { key:'stats', label:'Stat cards' },
    { key:'main',  label:'Widget utama' },
  ]
  function toggleAll(segment:string, active:boolean) {
    onChange(widgets.map(w => w.segment === segment ? { ...w, active } : w))
  }
  function toggleOne(key:string, active:boolean) {
    onChange(widgets.map(w => w.key === key ? { ...w, active } : w))
  }
  return (
    <div className="au-grid" style={{ gridTemplateColumns:'repeat(auto-fit, minmax(300px, 1fr))', gap:16 }}>
      {GROUPS.map(g => {
        const items = widgets.filter(w => w.segment === g.key)
        const allOn = items.length > 0 && items.every(w => w.active !== false)
        return (
          <div key={g.key} className="au-col" style={{ gap:8 }}>
            <div className="au-row au-between" style={{ gap:8 }}>
              <span className="lbl">{g.label} · {items.length}</span>
              <button type="button" onClick={()=>toggleAll(g.key, !allOn)} className="btn btn-sm">{allOn ? 'Sembunyikan semua' : 'Tampilkan semua'}</button>
            </div>
            <div className="au-ig">
              {items.length === 0 ? (
                <div className="au-igr au-xs au-muted">Tidak ada widget di grup ini</div>
              ) : items.map(w => (
                <label key={w.key} className="au-igr">
                  <span className="au-col" style={{ flex:1, minWidth:0, gap:1 }}><span className="au-small" style={{ fontWeight:600 }}>{w.label}</span><code className="au-xs au-muted">{w.key}</code></span>
                  <input type="checkbox" className="au-sw" checked={w.active !== false} onChange={e=>toggleOne(w.key, e.target.checked)} aria-label={`Tampilkan ${w.label}`} />
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

  // Halaman ini butuh gambar login juga, jadi ambil config lengkap tanpa cache bersama
  const [bgDelAsk, setBgDelAsk] = useState<number|null>(null)
  const [catDelAsk, setCatDelAsk] = useState<number|null>(null)
  useEffect(()=>{ fetch('/api/config?include=loginBackgrounds',{ cache:'no-store' }).then(r=>r.json()).then(d=>{ setConfig(d.data); setLoading(false) }).catch(()=>setLoading(false)) }, [])

  async function save(patch:any) {
    setSaving(true)
    try {
      const r = await fetch('/api/config', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(patch) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d?.data) { toast.error(d?.error || 'Gagal menyimpan'); return }
      setConfig(d.data); invalidateConfig(); toast.success('Tersimpan')
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
    <div className="au-page"><div className="au-view au-anim">
      <div className="au-card"><Empty title="Hanya admin yang bisa membuka Configuration" text="Kalau role kamu baru diubah menjadi admin di menu Member, keluar lalu masuk lagi agar sesi memuat role baru."
        action={<button type="button" onClick={()=>{ import('next-auth/react').then(m=>m.signOut({ callbackUrl:'/login' })) }} className="btn btn-primary">Keluar sekarang</button>} /></div>
    </div></div>
  )

  if (loading || !config) return <div className="au-page"><div className="au-view">{loading ? <div className="au-card">{[0,1,2].map(k => <div key={k} className="au-skel" />)}</div> : <div className="au-card"><Empty title="Konfigurasi gagal dimuat" action={<button type="button" className="btn" onClick={()=>location.reload()}>Muat ulang</button>} /></div>}</div></div>

  const tabs: { key:Tab; label:string; icon:string }[] = [
    { key:'branding',   label:'Branding',  icon:'spark' },
    { key:'login',      label:'Login & notifikasi', icon:'lock' },
    { key:'taxonomies', label:'Kategori & status', icon:'list' },
    { key:'attendance', label:'Tipe absensi', icon:'cal' },
    { key:'budget',     label:'Anggaran & transfer', icon:'budget' },
    { key:'roles',      label:'Roles & akses', icon:'shield' },
    { key:'widgets',    label:'Widget dashboard', icon:'dash' },
    { key:'enhancement', label:'Template enhancement', icon:'enh' },
    { key:'reset',      label:'Reset data', icon:'trash' },
    { key:'system',     label:'Info sistem', icon:'gear' },
  ]

  return (
    <div className="au-page">
      <div className="au-view au-anim">
      <PageHeader eyebrow="Admin · semua pengaturan" title="Configuration" actions={saving ? <span className="au-row au-xs au-muted" role="status" style={{ gap:6 }}><Icon name="clock" size={14} />Menyimpan…</span> : undefined} />
      <div className="au-chips rise" role="tablist" aria-label="Bagian konfigurasi">
        {tabs.map(t => (
          <button type="button" role="tab" key={t.key} onClick={()=>setTab(t.key)} className="au-chip" aria-selected={tab===t.key} style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
            <Icon name={t.icon} size={14} />{t.label}
          </button>
        ))}
      </div>

      <div className="au-col" style={{ gap:16 }}>
        {tab === 'branding' && (
          <>
            <Section title="Branding aplikasi" sub="Atur nama, tagline, ikon dan warna utama">
              <div className="au-row au-wrap" style={{ gap:18, alignItems:'flex-start' }}>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
                  <div style={{ width:84, height:84, borderRadius:18, background:config.appIcon?'transparent':config.appColor, display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', border:'1px solid var(--line)' }}>
                    {config.appIcon ? <img src={config.appIcon} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="logo" /> :
                      <span style={{ fontSize:36, fontWeight:700, color:'#fff' }}>{config.appName?.[0]||'W'}</span>}
                  </div>
                  <label className="btn btn-sm" style={{ cursor:'pointer' }}>
                    <Icon name="plus" size={14} />Unggah ikon
                    <input type="file" accept="image/*" className="sr-only" onChange={handleIconUpload} />
                  </label>
                  {config.appIcon && <button type="button" className="btn btn-sm" onClick={()=>save({ appIcon:'' })}>Hapus ikon</button>}
                  <span className="au-xs au-muted">Maks 300KB</span>
                </div>
                <div className="au-col" style={{ gap:12, flex:'1 1 260px', minWidth:0 }}>
                  <label style={{ display:'block' }}><span style={lbl}>Nama Aplikasi</span>
                    <input className="input" defaultValue={displayAppName(config.appName)} onBlur={e=>{ const v=e.target.value.trim(); if (v && v!==displayAppName(config.appName)) save({ appName: v }) }} placeholder="WINS" /></label>
                  <label style={{ display:'block' }}><span style={lbl}>Tagline / Subtitle</span>
                    <input className="input" defaultValue={config.appTagline} onBlur={e=>e.target.value!==config.appTagline && save({ appTagline: e.target.value })} placeholder="BPD Procurement" /></label>
                  <div style={{ display:'flex', gap:10, alignItems:'flex-end' }}>
                    <div style={{ flex:1 }}><label style={lbl}>Warna Brand Utama</label>
                      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                        <input type="color" aria-label="Warna brand utama" defaultValue={config.appColor} onChange={e=>save({ appColor: e.target.value })} style={{ width:40, height:36, borderRadius:6, border:'1px solid var(--line)', cursor:'pointer' }} />
                        <input className="input" aria-label="Kode warna brand" defaultValue={config.appColor} onBlur={e=>e.target.value!==config.appColor && save({ appColor: e.target.value })} placeholder="#4f8ef7" style={{ width:120 }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Section>

            <Section title="Periode & target" sub="Tahun aktif dan target kumulatif">
              <div className="au-grid" style={{ gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:10 }}>
                <label style={{ display:'block' }}><span style={lbl}>Tahun Aktif</span><input type="number" className="input" defaultValue={config.activeYear} onBlur={e=>save({ activeYear: parseInt(e.target.value) })} /></label>
                <label style={{ display:'block' }}><span style={lbl}>Bulan Mid Year</span><input type="number" min={1} max={12} className="input" defaultValue={config.midYearMonth} onBlur={e=>save({ midYearMonth: parseInt(e.target.value) })} /></label>
                <label style={{ display:'block' }}><span style={lbl}>Target M{config.midYearMonth} (%)</span><input type="number" className="input" defaultValue={config.midYearTarget} onBlur={e=>save({ midYearTarget: parseInt(e.target.value) })} /></label>
                <label style={{ display:'block' }}><span style={lbl}>Target Year End (%)</span><input type="number" className="input" defaultValue={config.yearEndTarget} onBlur={e=>save({ yearEndTarget: parseInt(e.target.value) })} /></label>
              </div>
            </Section>
          </>
        )}

        
        {tab === 'login' && (
          <>
            <Section title="Halaman login" sub="Tulisan dan slideshow background di halaman login">
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div>
                  <label style={lbl}>Tagline Login Page</label>
                  <input className="input" aria-label="Tagline login page" defaultValue={config.loginTagline||''} onBlur={e=>e.target.value!==config.loginTagline && save({ loginTagline: e.target.value })} placeholder="BPD Procurement — Pertamina" />
                  <div className="au-xs au-muted" style={{ marginTop:6 }}>Tulisan ini muncul di bawah nama aplikasi di halaman login.</div>
                </div>

                <div>
                  <span style={lbl}>Background Slideshow ({((config.loginBackgrounds || [])||[]).length} gambar)</span>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(140px, 1fr))', gap:8, marginBottom:8 }}>
                    {((config.loginBackgrounds || [])||[]).map((bg:string, i:number) => (
                      <div key={i} style={{ position:'relative', aspectRatio:'16/10', borderRadius:14, overflow:'hidden', border:'1px solid var(--line)' }}>
                        <img src={bg} alt={`Background ${i+1}`} loading="lazy" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                        <button type="button" onClick={()=>{ if (bgDelAsk!==i) { setBgDelAsk(i); return } setBgDelAsk(null); save({ loginBackgrounds: (config.loginBackgrounds || []).filter((_:any,idx:number)=>idx!==i) }) }} className="btn btn-sm" aria-label={`Hapus background ${i+1}`} style={{ position:'absolute', top:6, right:6, background:bgDelAsk===i?'var(--bad)':'rgba(0,0,0,0.6)', color:'#fff', border:'none', minHeight:30 }}>{bgDelAsk===i ? 'Hapus?' : <Icon name="x" size={13} />}</button>
                      </div>
                    ))}
                    <label className="au-drop" style={{ aspectRatio:'16/10', padding:10, justifyContent:'center' }}>
                      <Icon name="plus" size={20} />
                      <span className="au-xs">Tambah</span>
                      <input type="file" accept="image/*" aria-label="Tambah background" onChange={e=>{
                        const f = e.target.files?.[0]; if (!f) return
                        if (f.size > 5*1024*1024) { toast.error('Max 5MB'); return }
                        const reader = new FileReader()
                        reader.onload = () => save({ loginBackgrounds: [...((config.loginBackgrounds || [])||[]), reader.result as string] })
                        reader.readAsDataURL(f)
                      }} />
                    </label>
                  </div>
                  <div className="au-xs au-muted">Maks 5MB per gambar. Disarankan rasio 16:9 atau 16:10.</div>
                </div>

                <div>
                  <label style={lbl}>Durasi Slide (ms)</label>
                  <input type="number" aria-label="Durasi slide (ms)" min={1000} step={1000} className="input" defaultValue={config.loginSlideInterval||5000} onBlur={e=>save({ loginSlideInterval: parseInt(e.target.value)||5000 })} style={{ width:160 }} />
                  <div className="au-xs au-muted" style={{ marginTop:6 }}>Default 5000ms (5 detik). Berapa lama tiap gambar tampil.</div>
                </div>
              </div>
            </Section>

            <Section title="Ajakan instal aplikasi (PWA)" sub="Notifikasi instal aplikasi ke home screen">
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <label className="au-igr au-box" style={{ cursor:'pointer' }}>
                  <span className="au-col" style={{ flex:1, minWidth:0, gap:1 }}><span className="au-small" style={{ fontWeight:600 }}>Aktifkan ajakan instal</span><span className="au-xs au-muted">Tampilkan banner instalasi aplikasi pada perangkat yang mendukung</span></span>
                  <input type="checkbox" className="au-sw" checked={!!config.pwaInstallEnabled} onChange={()=>save({ pwaInstallEnabled: !config.pwaInstallEnabled })} />
                </label>
                <div className="au-grid" style={{ gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:10 }}>
                  <div>
                    <label style={lbl}>Delay sebelum prompt muncul (ms)</label>
                    <input type="number" aria-label="Delay sebelum prompt muncul (ms)" min={0} step={1000} className="input" defaultValue={config.pwaPromptDelay||8000} onBlur={e=>save({ pwaPromptDelay: parseInt(e.target.value)||8000 })} />
                    <div className="au-xs au-muted" style={{ marginTop:6 }}>Default 8000ms. Setelah user buka app berapa lama prompt muncul.</div>
                  </div>
                  <div>
                    <label style={lbl}>Cooldown setelah dismiss (hari)</label>
                    <input type="number" aria-label="Cooldown setelah dismiss (hari)" min={1} max={90} className="input" defaultValue={config.pwaPromptCooldown||7} onBlur={e=>save({ pwaPromptCooldown: parseInt(e.target.value)||7 })} />
                    <div className="au-xs au-muted" style={{ marginTop:6 }}>Default 7 hari. Berapa lama tidak muncul setelah user klik "Nanti".</div>
                  </div>
                </div>
              </div>
            </Section>

            <Section title="Notifikasi reimbursement (push)" sub="Push notification otomatis untuk alur reimbursement — khusus member pengaju & cashier">
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div className="au-small au-ink2" style={{ lineHeight:1.6 }}>
                  <b style={{ color:'var(--ink)' }}>Alur notifikasi:</b> (1) Member submit reimburse → notif ke <b>member pengaju</b> (konfirmasi terkirim) + <b>semua cashier</b> (ada pengajuan baru). (2) Cashier klik transfer → notif ke <b>member pengaju</b> (sudah ditransfer) + <b>cashier</b> (konfirmasi transfer selesai). Hanya user yang sudah mengaktifkan notifikasi di HP-nya yang menerima.
                </div>
                {(() => {
                  const rn = { enabled:true, notifySubmit:true, notifyTransfer:true, ...(config.reimburseNotif||{}) }
                  const saveRn = (patch:any) => save({ reimburseNotif: { ...rn, ...patch } })
                  const Toggle = ({ on, onClick, label, sub }:{ on:boolean; onClick:()=>void; label:string; sub:string }) => (
                    <label className="au-igr" style={{ cursor:'pointer' }}>
                      <span className="au-col" style={{ flex:1, minWidth:0, gap:1 }}><span className="au-small" style={{ fontWeight:600 }}>{label}</span><span className="au-xs au-muted">{sub}</span></span>
                      <input type="checkbox" className="au-sw" checked={on} onChange={onClick} />
                    </label>
                  )
                  return (
                    <div className="au-ig">
                      <Toggle on={rn.enabled} onClick={()=>saveRn({ enabled: !rn.enabled })} label="Aktifkan Notifikasi Reimbursement" sub="Master switch — matikan untuk menonaktifkan semua notif reimburse" />
                      <Toggle on={rn.enabled && rn.notifySubmit} onClick={()=>rn.enabled && saveRn({ notifySubmit: !rn.notifySubmit })} label="Notif saat Submit" sub="Member submit → pengaju dapat konfirmasi + cashier dapat alert pengajuan baru" />
                      <Toggle on={rn.enabled && rn.notifyTransfer} onClick={()=>rn.enabled && saveRn({ notifyTransfer: !rn.notifyTransfer })} label="Notif saat Transfer" sub="Cashier transfer → pengaju dapat notif sudah ditransfer + cashier dapat konfirmasi selesai" />
                    </div>
                  )
                })()}
              </div>
            </Section>

            <Section title="Notifikasi terjadwal (push)" sub="Berjalan otomatis lewat cron pagi ±08:00 WIB">
              <div className="au-ig">
                <label className="au-igr" style={{ cursor:'pointer' }}>
                  <span className="au-col" style={{ flex:1, minWidth:0, gap:1 }}><span className="au-small" style={{ fontWeight:600 }}>Ringkasan mingguan (Senin)</span><span className="au-xs au-muted">Tiap Senin, tiap member menerima ringkasan activity, tugas initiative, dan enhancement dengan PIC dirinya</span></span>
                  <input type="checkbox" className="au-sw" checked={config.weeklyDigest !== false} onChange={()=>save({ weeklyDigest: config.weeklyDigest === false })} />
                </label>
                <div className="au-igr">
                  <span className="au-col" style={{ flex:1, minWidth:0, gap:1 }}><span className="au-small" style={{ fontWeight:600 }}>Pengingat reimburse menggantung</span><span className="au-xs au-muted">Ingatkan semua cashier bila ada reimburse belum ditransfer lebih dari N hari (0 = mati)</span></span>
                  <input type="number" min={0} max={30} className="input input-sm" aria-label="Batas hari reimburse menggantung" style={{ width:80 }} defaultValue={config.staleReimburseDays ?? 3} onBlur={e=>save({ staleReimburseDays: Math.max(0, Math.min(30, parseInt(e.target.value)||0)) })} />
                </div>
              </div>
            </Section>

            <Section title="Pengingat harian (push)" sub="Notifikasi otomatis ke HP semua member (iOS & Android) tiap pagi ±08:00 WIB">
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div className="au-small au-ink2" style={{ lineHeight:1.6 }}>
                  Tiap pagi sistem otomatis kirim push ke semua member yang sudah mengaktifkan notifikasi: pengingat <b>isi presensi hari ini</b> + ringkasan <b>agenda hari ini</b> (agenda pribadi &amp; jumlah agenda tim di calendar). Berjalan otomatis 1×/hari via cron.
                </div>
                <div>
                  <button onClick={async()=>{
                    try {
                      const r = await fetch('/api/cron/reminders', { method:'POST' })
                      const j = await r.json()
                      if (!r.ok) { toast.error(j.error||'Gagal'); return }
                      toast.success(`Terkirim ke ${j.sent}/${j.recipients} member`)
                    } catch { toast.error('Gagal kirim') }
                  }} className="btn btn-sm btn-primary"><Icon name="bell" size={14} />Tes kirim sekarang</button>
                  <div className="au-xs au-muted" style={{ marginTop:6 }}>Kirim pengingat harian ke semua member saat ini juga (untuk tes). Hanya admin/manager.</div>
                </div>
              </div>
            </Section>
          </>
        )}

        {tab === 'taxonomies' && (
          <>
            <Section title="Kategori activities" sub="SI / Non-SI / Others / GoLive — bisa edit, tambah, hapus" action={<button className="btn btn-sm btn-primary" onClick={()=>save({ activityCategories: (config.activityCategories || []) })}>Simpan</button>}>
              <TaxonomyEditor items={(config.activityCategories || [])} onChange={items=>setConfig((c:any)=>({...c, activityCategories:items}))} label="kategori" />
            </Section>

            <Section title="Sub-tab progress project" sub="KPI / Non-KPI / Others — wording bisa diganti" action={<button className="btn btn-sm btn-primary" onClick={()=>save({ progressSubTabs: (config.progressSubTabs || []) })}>Simpan</button>}>
              <TaxonomyEditor items={(config.progressSubTabs || [])} onChange={items=>setConfig((c:any)=>({...c, progressSubTabs:items}))} label="sub-tab" />
            </Section>

            <Section title="Sub-tipe activities" sub="KPI-SI / KPI-Non SI / Go-Live / Others — turunan tiap activity" action={<button className="btn btn-sm btn-primary" onClick={()=>save({ activitySubTypes: (config.activitySubTypes || []) })}>Simpan</button>}>
              <TaxonomyEditor items={(config.activitySubTypes || [])||[]} onChange={items=>setConfig((c:any)=>({...c, activitySubTypes:items}))} label="sub-tipe" />
            </Section>

            <Section title="Segmen dashboard" sub="5 segmen dashboard utama — bisa edit dan tambah" action={<button className="btn btn-sm btn-primary" onClick={()=>save({ dashboardSegments: config.dashboardSegments })}>Simpan</button>}>
              <TaxonomyEditor items={config.dashboardSegments||[]} onChange={items=>setConfig((c:any)=>({...c, dashboardSegments:items}))} label="segmen" />
            </Section>

            <Section title="Status issue" sub="On Track / At Risk / Delayed / Completed — editable" action={<button className="btn btn-sm btn-primary" onClick={()=>save({ issueStatuses: (config.issueStatuses || []) })}>Simpan</button>}>
              <TaxonomyEditor items={(config.issueStatuses || [])} onChange={items=>setConfig((c:any)=>({...c, issueStatuses:items}))} label="status" />
            </Section>

          </>
        )}

        {tab === 'attendance' && (
          <Section title="Tipe kehadiran" sub="WFO / WFH / Dinas / Cuti — bisa tambah/edit/hapus" action={<button className="btn btn-sm btn-primary" onClick={()=>save({ attendanceTypes: (config.attendanceTypes || []) })}>Simpan</button>}>
            <TaxonomyEditor items={(config.attendanceTypes || []).map((t:any)=>({...t,color:t.textColor||t.color}))} onChange={items=>setConfig((c:any)=>({...c, attendanceTypes:items.map(i=>({...i,textColor:i.color,color:i.color+'22'}))}))} label="tipe kehadiran" />
          </Section>
        )}

        {tab === 'budget' && (<>
          <Section title="Transfer reimburse · biaya antar bank" sub="Dipakai Cashier: biaya otomatis terisi bila bank tujuan berbeda dari bank sumber dana">
            {(() => { const tf = { pettyBank:'Mandiri', cashCardBank:'Mandiri', amount:6500, auto:true, ...(config.transferFee||{}) }; const saveTf = (p:any) => save({ transferFee: { ...tf, ...p } }); return (
              <div className="au-ig">
                <label className="au-igr" style={{ cursor:'pointer' }}><span className="au-col" style={{ flex:1, minWidth:0, gap:1 }}><span className="au-small" style={{ fontWeight:600 }}>Isi biaya otomatis</span><span className="au-xs au-muted">Cashier tetap bisa mengubah per transfer</span></span><input type="checkbox" className="au-sw" checked={tf.auto !== false} onChange={()=>saveTf({ auto: tf.auto === false })} /></label>
                <div className="au-igr"><span className="k" style={{ flex:1 }}>Bank rekening Petty Cash</span><input className="input input-sm" aria-label="Bank rekening Petty Cash" style={{ width:160 }} defaultValue={tf.pettyBank} onBlur={e=>saveTf({ pettyBank: e.target.value.trim() })} /></div>
                <div className="au-igr"><span className="k" style={{ flex:1 }}>Bank Cash Card</span><input className="input input-sm" aria-label="Bank Cash Card" style={{ width:160 }} defaultValue={tf.cashCardBank} onBlur={e=>saveTf({ cashCardBank: e.target.value.trim() })} /></div>
                <div className="au-igr"><span className="k" style={{ flex:1 }}>Biaya antar bank (Rp)</span><input type="number" min={0} className="input input-sm" aria-label="Biaya antar bank default" style={{ width:120 }} defaultValue={tf.amount} onBlur={e=>saveTf({ amount: Math.max(0, parseInt(e.target.value)||0) })} /></div>
              </div>) })()}
          </Section>
          <Section title="Kategori anggaran" sub="Dinas Travel / External Accommodation — set anggaran tahunan & threshold">
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {(config.budgetCategories || []).map((cat:any, i:number) => (
                <div key={i} className="au-box" style={{ padding:12 }}>
                  <div className="au-bcrow">
                    <input className="input" defaultValue={cat.label} placeholder="Label" onBlur={e=>save({ budgetCategories: (config.budgetCategories || []).map((c:any,idx:number)=>idx===i?{...c,label:e.target.value}:c) })} />
                    <input type="number" className="input" defaultValue={cat.annualBudget} placeholder="Anggaran (Rp)" onBlur={e=>save({ budgetCategories: (config.budgetCategories || []).map((c:any,idx:number)=>idx===i?{...c,annualBudget:parseInt(e.target.value)||0}:c) })} />
                    <input type="number" min={50} max={100} className="input" defaultValue={cat.threshold} placeholder="Threshold %" onBlur={e=>save({ budgetCategories: (config.budgetCategories || []).map((c:any,idx:number)=>idx===i?{...c,threshold:parseInt(e.target.value)||80}:c) })} />
                    <input className="input" defaultValue={cat.pic||''} placeholder="PIC pengisi" onBlur={e=>save({ budgetCategories: (config.budgetCategories || []).map((c:any,idx:number)=>idx===i?{...c,pic:e.target.value}:c) })} />
                    <button type="button" className={`btn btn-sm${catDelAsk===i?' btn-danger':' btn-icon'}`} aria-label={`Hapus kategori ${cat.label}`} onClick={()=>{ if (catDelAsk!==i) { setCatDelAsk(i); return } setCatDelAsk(null); save({budgetCategories: (config.budgetCategories || []).filter((_:any,idx:number)=>idx!==i)}) }}>{catDelAsk===i ? 'Hapus?' : <Icon name="trash" size={14} />}</button>
                  </div>
                </div>
              ))}
              <button type="button" className="btn btn-sm" style={{ alignSelf:'flex-start' }} onClick={()=>save({ budgetCategories: [...(config.budgetCategories || []), { key:`cat_${Date.now()}`, label:'Kategori Baru', annualBudget:0, threshold:80, pic:'' }] })}><Icon name="plus" size={14} />Tambah kategori</button>
            </div>
          </Section>
       </>)}

        {tab === 'roles' && (
          <Section title="Roles & akses" sub="Atur role dan menu apa saja yang bisa diakses per role" action={
            <button className="btn btn-sm btn-primary" onClick={()=>save({ roleDefs: withBuiltins(config.roleDefs) })}>Simpan roles</button>
          }>
            <RolesEditor roles={withBuiltins(config.roleDefs)} onChange={(v:any)=>setConfig((c:any)=>({...c, roleDefs:v}))} />
          </Section>
        )}
        {tab === 'widgets' && (
          <Section title="Widget dashboard" sub="Tampilkan/sembunyikan komponen dashboard per tab. Cocok untuk fokus ke metrik yang penting saja." action={
            <button className="btn btn-sm btn-primary" onClick={()=>save({ dashboardWidgets: (config.dashboardWidgets && config.dashboardWidgets.length) ? config.dashboardWidgets : DEFAULT_WIDGETS, linkCategories: (config.linkCategories && config.linkCategories.length) ? config.linkCategories : DEFAULT_LINK_CATEGORIES })}>Simpan</button>
          }>
            <WidgetGroupsEditor widgets={(config.dashboardWidgets && config.dashboardWidgets.length) ? config.dashboardWidgets : DEFAULT_WIDGETS} onChange={(v:any)=>setConfig((c:any)=>({...c, dashboardWidgets:v}))} />
            <div className="au-col" style={{ gap:6, paddingTop:16, borderTop:'1px solid var(--line)' }}>
              <span className="lbl">Kategori Link Hub</span>
              <span className="au-xs au-muted" style={{ marginBottom:6 }}>Kategori link yang dipakai di menu Link Hub</span>
              <TaxonomyEditor items={(config.linkCategories && config.linkCategories.length) ? config.linkCategories : DEFAULT_LINK_CATEGORIES} onChange={(v:any)=>setConfig((c:any)=>({...c, linkCategories:v}))} label="Link Categories" />
            </div>
          </Section>
        )}
        {tab === 'enhancement' && (
          <Section title="Template timeline Enhancement" sub="Bobot default 5 aktivitas (BRD, Development, UAT, Go Live, Stabilisasi). Bisa diubah per enhancement di menu Enhancement.">
            <EnhTemplateEditor value={config.enhancementTemplate} saving={saving} onSave={v => save({ enhancementTemplate: v })} />
          </Section>
        )}
        {tab === 'reset' && <ResetSection />}

        {tab === 'system' && (
          <Section title="Informasi sistem">
            {[
              ['Versi App', displayAppName(config.appName) + ' v6.0 · Pulse Aurora'],
              ['Framework','Next.js 16 (App Router)'],
              ['Database','MongoDB Atlas'],
              ['Auth','NextAuth.js'],
              ['Deploy','Vercel'],
            ].map(([k,v]) => (
              <div key={k} className="au-igr" style={{ padding:'10px 0' }}><span className="k">{k}</span><span className="v">{v}</span></div>
            ))}
          </Section>
        )}
      </div>
      </div>
    </div>
  )
}
const lbl: React.CSSProperties = { display:'block', font:'500 11px var(--mono)', letterSpacing:'.06em', textTransform:'uppercase', color:'var(--muted)', marginBottom:6 }
