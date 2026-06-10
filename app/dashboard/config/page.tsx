'use client'
import { useEffect, useState } from 'react'
import { AppConfig, AttendanceType } from '@/types'
import toast from 'react-hot-toast'

const ROLE_PERMS = [
  { key:'canViewDashboard',   label:'Lihat Dashboard',    desc:'Akses halaman overview & KPI' },
  { key:'canViewGantt',       label:'Lihat Gantt Chart',  desc:'Akses timeline plan vs actual' },
  { key:'canViewIssues',      label:'Lihat Issues',       desc:'Akses daftar issue' },
  { key:'canEditIssues',      label:'Edit Issues',        desc:'Update progress & status issue' },
  { key:'canViewAttendance',  label:'Lihat Absensi',      desc:'Akses kalender kehadiran' },
  { key:'canEditAttendance',  label:'Edit Absensi',       desc:'Set kehadiran diri sendiri' },
  { key:'canEditAllAttendance',label:'Edit Absensi Tim',  desc:'Set kehadiran semua anggota' },
  { key:'canViewInfograph',   label:'Lihat Infografis',   desc:'Akses visual charts & summary' },
  { key:'canViewConfig',      label:'Lihat Konfigurasi',  desc:'Akses halaman config (admin only)' },
  { key:'canEditConfig',      label:'Edit Konfigurasi',   desc:'Ubah pengaturan sistem' },
]

const DEFAULT_ROLE_CONFIG = {
  admin:   { canViewDashboard:true, canViewGantt:true, canViewIssues:true, canEditIssues:true, canViewAttendance:true, canEditAttendance:true, canEditAllAttendance:true, canViewInfograph:true, canViewConfig:true, canEditConfig:true },
  manager: { canViewDashboard:true, canViewGantt:true, canViewIssues:true, canEditIssues:true, canViewAttendance:true, canEditAttendance:true, canEditAllAttendance:true, canViewInfograph:true, canViewConfig:false, canEditConfig:false },
  member:  { canViewDashboard:true, canViewGantt:true, canViewIssues:true, canEditIssues:true, canViewAttendance:true, canEditAttendance:true, canEditAllAttendance:false, canViewInfograph:true, canViewConfig:false, canEditConfig:false },
  guest:   { canViewDashboard:true, canViewGantt:false, canViewIssues:false, canEditIssues:false, canViewAttendance:false, canEditAttendance:false, canEditAllAttendance:false, canViewInfograph:true, canViewConfig:false, canEditConfig:false },
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return <div className={`toggle-wrap${on?' on':''}`} onClick={onToggle} />
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="card" style={{ marginBottom:14, overflow:'hidden' }}>
      <div style={{ padding:'13px 16px', borderBottom: open ? '1px solid var(--border)' : 'none', display:'flex', alignItems:'center', gap:10, cursor:'pointer', background:'var(--bg3)' }} onClick={() => setOpen(!open)}>
        <span style={{ fontSize:16 }}>{icon}</span>
        <span style={{ fontSize:13, fontWeight:600, color:'var(--text)', flex:1 }}>{title}</span>
        <span style={{ color:'var(--text3)', fontSize:12, transform: open?'rotate(180deg)':'rotate(0)', transition:'transform 0.2s' }}>▼</span>
      </div>
      {open && <div style={{ padding:'14px 16px' }}>{children}</div>}
    </div>
  )
}

function Row({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'9px 0', borderBottom:'1px solid var(--border)' }}>
      <div><div style={{ fontSize:13, color:'var(--text)', fontWeight:500 }}>{label}</div>{desc && <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>{desc}</div>}</div>
      <div style={{ flexShrink:0, marginLeft:12 }}>{children}</div>
    </div>
  )
}

export default function ConfigPage() {
  const [config, setConfig] = useState<AppConfig|null>(null)
  const [roleConfig, setRoleConfig] = useState(DEFAULT_ROLE_CONFIG)
  const [activeRole, setActiveRole] = useState<'admin'|'manager'|'member'|'guest'>('manager')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newType, setNewType] = useState({ key:'', label:'', color:'#1a2a2a', textColor:'#4f8ef7' })
  const [showAddType, setShowAddType] = useState(false)

  useEffect(() => { fetch('/api/config').then(r => r.json()).then(d => { setConfig(d.data); setLoading(false) }) }, [])

  async function save(patch: any) {
    setSaving(true)
    try { const r = await fetch('/api/config', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(patch) }); const d = await r.json(); setConfig(d.data); toast.success('Tersimpan!') }
    catch { toast.error('Gagal menyimpan') } finally { setSaving(false) }
  }

  function toggleNotif(key: string) {
    if (!config) return
    const notif = { ...config.notifications, [key]: !(config.notifications as any)[key] }
    setConfig({...config, notifications: notif}); save({ notifications: notif })
  }

  function toggleAttType(idx: number) {
    if (!config) return
    const types = config.attendanceTypes.map((t,i) => i===idx ? {...t, active: !t.active} : t)
    setConfig({...config, attendanceTypes: types}); save({ attendanceTypes: types })
  }

  function removeAttType(idx: number) {
    if (!config) return
    const types = config.attendanceTypes.filter((_,i) => i!==idx)
    setConfig({...config, attendanceTypes: types}); save({ attendanceTypes: types })
  }

  function addAttType() {
    if (!newType.key || !newType.label) { toast.error('Key dan label wajib diisi'); return }
    if (!config) return
    const types = [...config.attendanceTypes, { ...newType, active: true }]
    setConfig({...config, attendanceTypes: types}); save({ attendanceTypes: types })
    setNewType({ key:'', label:'', color:'#1a2a2a', textColor:'#4f8ef7' }); setShowAddType(false)
    toast.success('Tipe ditambahkan')
  }

  function toggleRolePerm(role: string, perm: string) {
    const updated = { ...roleConfig, [role]: { ...(roleConfig as any)[role], [perm]: !(roleConfig as any)[role][perm] } }
    setRoleConfig(updated as typeof DEFAULT_ROLE_CONFIG)
    toast.success(`Hak akses ${role} diperbarui`)
  }

  if (loading) return <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text3)' }}>Memuat...</div>

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ padding:'12px 20px', borderBottom:'1px solid var(--border)', background:'var(--bg2)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div><div style={{ fontSize:14, fontWeight:600 }}>Konfigurasi Admin</div><div style={{ fontSize:11, color:'var(--text3)' }}>Semua pengaturan sistem WorkPulse</div></div>
        {saving && <span style={{ fontSize:12, color:'var(--amber)' }}>⟳ Menyimpan...</span>}
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'16px 20px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, alignItems:'start' }}>
          {/* Left col */}
          <div>
            {/* Role & permissions */}
            <Section title="Role & Hak Akses" icon="👥">
              <div style={{ marginBottom:12, fontSize:12, color:'var(--text3)' }}>Atur hak akses per role. Admin selalu punya akses penuh.</div>
              <div style={{ display:'flex', gap:6, marginBottom:14 }}>
                {(['admin','manager','member','guest'] as const).map(r => (
                  <button key={r} onClick={() => setActiveRole(r)} style={{ padding:'5px 14px', borderRadius:6, fontSize:12, fontWeight:500, cursor:'pointer', border:'1px solid', borderColor: activeRole===r ? 'var(--blue)' : 'var(--border2)', background: activeRole===r ? 'var(--bluebg)' : 'var(--bg3)', color: activeRole===r ? 'var(--blue)' : 'var(--text2)', textTransform:'capitalize' }}>{r}</button>
                ))}
              </div>
              {ROLE_PERMS.map(p => (
                <Row key={p.key} label={p.label} desc={p.desc}>
                  <Toggle on={(roleConfig as any)[activeRole][p.key]} onToggle={() => activeRole !== 'admin' ? toggleRolePerm(activeRole, p.key) : toast('Admin selalu punya akses penuh')} />
                </Row>
              ))}
            </Section>

            {/* Notifikasi */}
            <Section title="Notifikasi" icon="🔔">
              {[
                { key:'waEnabled', label:'WA Notifikasi (Fonnte)', desc:'Kirim reminder ke tim via WhatsApp' },
                { key:'waDueDateReminder', label:'Reminder Due Date', desc:'Notif H-3 dan H-1 sebelum deadline' },
                { key:'waWeeklyDigest', label:'Weekly Digest ke Manager', desc:'Summary mingguan setiap Jumat 17.00' },
              ].map(item => (
                <Row key={item.key} label={item.label} desc={item.desc}>
                  <Toggle on={!!(config?.notifications as any)[item.key]} onToggle={() => toggleNotif(item.key)} />
                </Row>
              ))}
            </Section>
          </div>

          {/* Right col */}
          <div>
            {/* Attendance types */}
            <Section title="Tipe Kehadiran" icon="📅">
              <div style={{ fontSize:12, color:'var(--text3)', marginBottom:12 }}>Klik toggle untuk aktif/nonaktif. Tambah tipe custom sesuai kebutuhan.</div>
              <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:12 }}>
                {config?.attendanceTypes.map((t,i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', background: t.color, border:`1px solid ${t.textColor}33`, borderRadius:8, opacity: t.active ? 1 : 0.5 }}>
                    <div style={{ width:10, height:10, borderRadius:3, background: t.textColor, flexShrink:0 }} />
                    <span style={{ fontSize:12, fontWeight:600, color: t.textColor, flex:1 }}>{t.label}</span>
                    <span style={{ fontSize:10, color: t.textColor, opacity:0.7 }}>({t.key})</span>
                    <Toggle on={t.active} onToggle={() => toggleAttType(i)} />
                    <button onClick={() => removeAttType(i)} style={{ background:'none', border:'none', cursor:'pointer', color: t.textColor, opacity:0.6, fontSize:16, lineHeight:1, padding:'0 2px' }}>×</button>
                  </div>
                ))}
              </div>
              {!showAddType ? (
                <button className="btn btn-sm" onClick={() => setShowAddType(true)}>+ Tambah tipe</button>
              ) : (
                <div style={{ background:'var(--bg3)', borderRadius:8, padding:12, display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                    <input className="input" placeholder="key (cth: remote)" value={newType.key} onChange={e => setNewType({...newType, key: e.target.value})} />
                    <input className="input" placeholder="Label (cth: Remote)" value={newType.label} onChange={e => setNewType({...newType, label: e.target.value})} />
                  </div>
                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    <span style={{ fontSize:11, color:'var(--text3)' }}>Background:</span>
                    <input type="color" value={newType.color} onChange={e => setNewType({...newType, color: e.target.value})} style={{ width:32, height:28, borderRadius:4, border:'1px solid var(--border)', cursor:'pointer' }} />
                    <span style={{ fontSize:11, color:'var(--text3)' }}>Text:</span>
                    <input type="color" value={newType.textColor} onChange={e => setNewType({...newType, textColor: e.target.value})} style={{ width:32, height:28, borderRadius:4, border:'1px solid var(--border)', cursor:'pointer' }} />
                    <div style={{ flex:1 }} />
                    <button className="btn btn-sm btn-primary" onClick={addAttType}>Tambah</button>
                    <button className="btn btn-sm" onClick={() => setShowAddType(false)}>Batal</button>
                  </div>
                  {newType.label && <div style={{ padding:'6px 10px', background: newType.color, borderRadius:6, border:`1px solid ${newType.textColor}44`, fontSize:11, fontWeight:600, color: newType.textColor }}>Preview: {newType.label}</div>}
                </div>
              )}
            </Section>

            {/* Periode & target */}
            <Section title="Periode & Target" icon="📆">
              {[
                { label:'Tahun aktif', value: config?.activeYear, color:'var(--text)' },
                { label:'Target Mid Year (M6)', value:`${config?.midYearTarget}%`, color:'var(--amber)' },
                { label:'Target Year End (M12)', value:`${config?.yearEndTarget}%`, color:'var(--green)' },
                { label:'Mid Year Bulan ke-', value:`M${config?.midYearMonth}`, color:'var(--blue)' },
              ].map(item => (
                <Row key={item.label} label={item.label}>
                  <span style={{ fontSize:14, fontWeight:700, color: item.color }}>{item.value}</span>
                </Row>
              ))}
              <div style={{ marginTop:10, padding:10, background:'var(--bg3)', borderRadius:7, fontSize:11, color:'var(--text3)' }}>
                Edit target periode dapat dilakukan langsung di database atau via update API.
              </div>
            </Section>

            {/* System info */}
            <Section title="Informasi Sistem" icon="ℹ️">
              {[
                ['Versi App', 'WorkPulse v2.0'],
                ['Framework', 'Next.js 16 (App Router)'],
                ['Database', 'MongoDB Atlas'],
                ['Auth', 'NextAuth.js'],
                ['Deploy', 'Vercel'],
                ['Charts', 'Recharts'],
              ].map(([k,v]) => (
                <Row key={k} label={k}><span style={{ fontSize:12, color:'var(--text2)', fontWeight:500 }}>{v}</span></Row>
              ))}
            </Section>
          </div>
        </div>
      </div>
    </div>
  )
}
// Config page already exists - branding section handled via API
