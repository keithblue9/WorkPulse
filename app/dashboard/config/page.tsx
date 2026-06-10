'use client'
import { useEffect, useState } from 'react'
import { AppConfig, AttendanceType } from '@/types'
import toast from 'react-hot-toast'

export default function ConfigPage() {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newType, setNewType] = useState({ key: '', label: '', color: '#1a2a2a', textColor: '#4f8ef7' })
  const [showAddType, setShowAddType] = useState(false)

  useEffect(() => {
    fetch('/api/config').then(r => r.json()).then(d => {
      setConfig(d.data)
      setLoading(false)
    })
  }, [])

  async function save(patch: Partial<AppConfig>) {
    setSaving(true)
    try {
      const r = await fetch('/api/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const d = await r.json()
      setConfig(d.data)
      toast.success('Tersimpan!')
    } catch { toast.error('Gagal menyimpan') }
    finally { setSaving(false) }
  }

  function toggleNotif(key: string) {
    if (!config) return
    const notif = { ...config.notifications, [key]: !(config.notifications as any)[key] }
    setConfig({ ...config, notifications: notif })
    save({ notifications: notif })
  }

  function toggleRole(key: string) {
    if (!config) return
    const roles = { ...config.roles, [key]: !(config.roles as any)[key] }
    setConfig({ ...config, roles })
    save({ roles })
  }

  function toggleAttType(idx: number) {
    if (!config) return
    const types = config.attendanceTypes.map((t, i) => i === idx ? { ...t, active: !t.active } : t)
    setConfig({ ...config, attendanceTypes: types })
    save({ attendanceTypes: types })
  }

  function removeAttType(idx: number) {
    if (!config) return
    const types = config.attendanceTypes.filter((_, i) => i !== idx)
    setConfig({ ...config, attendanceTypes: types })
    save({ attendanceTypes: types })
  }

  function addAttType() {
    if (!newType.key || !newType.label) { toast.error('Key dan label wajib diisi'); return }
    if (!config) return
    const types = [...config.attendanceTypes, { ...newType, active: true }]
    setConfig({ ...config, attendanceTypes: types })
    save({ attendanceTypes: types })
    setNewType({ key: '', label: '', color: '#1a2a2a', textColor: '#4f8ef7' })
    setShowAddType(false)
    toast.success('Tipe kehadiran ditambahkan')
  }

  function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
    return (
      <div onClick={onToggle} style={{ width: 38, height: 22, borderRadius: 11, background: on ? 'var(--blue)' : 'var(--bg4)', border: `1px solid ${on ? 'var(--blue)' : 'var(--border2)'}`, cursor: 'pointer', position: 'relative', transition: 'all 0.2s', flexShrink: 0 }}>
        <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: on ? 18 : 2, transition: 'left 0.2s' }} />
      </div>
    )
  }

  if (loading) return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)' }}>Memuat...</div>

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Konfigurasi Admin</div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>Pengaturan sistem WorkPulse</div>
        </div>
        {saving && <div style={{ fontSize: 12, color: 'var(--amber)' }}>Menyimpan...</div>}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignContent: 'start' }}>

        {/* Attendance types */}
        <div style={{ ...sectionStyle, gridColumn: '1 / -1' }}>
          <div style={sectionTitle}><span style={{ color: 'var(--blue)' }}>📅</span> Tipe Kehadiran</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>
            Atur tipe kehadiran yang tersedia di kalender absensi. Klik toggle untuk aktif/nonaktif, warna bisa dikustomisasi.
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {config?.attendanceTypes.map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: t.color, border: `1px solid ${t.textColor}44`, borderRadius: 8, padding: '8px 12px', opacity: t.active ? 1 : 0.5 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: t.textColor }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: t.textColor }}>{t.label}</span>
                <span style={{ fontSize: 10, color: t.textColor, opacity: 0.7 }}>({t.key})</span>
                <Toggle on={t.active} onToggle={() => toggleAttType(i)} />
                <button onClick={() => removeAttType(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textColor, opacity: 0.6, fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
              </div>
            ))}
            <button onClick={() => setShowAddType(!showAddType)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px dashed var(--border2)', background: 'transparent', color: 'var(--text3)', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
              + Tambah tipe
            </button>
          </div>

          {showAddType && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '12px', background: 'var(--bg3)', borderRadius: 8, flexWrap: 'wrap' }}>
              <input placeholder="key (cth: wfo2)" value={newType.key} onChange={e => setNewType({ ...newType, key: e.target.value })} style={{ ...inputStyle, width: 120 }} />
              <input placeholder="Label (cth: WFO 2)" value={newType.label} onChange={e => setNewType({ ...newType, label: e.target.value })} style={{ ...inputStyle, width: 120 }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>Bg:</span>
                <input type="color" value={newType.color} onChange={e => setNewType({ ...newType, color: e.target.value })} style={{ width: 32, height: 28, borderRadius: 4, border: '1px solid var(--border)', cursor: 'pointer' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>Text:</span>
                <input type="color" value={newType.textColor} onChange={e => setNewType({ ...newType, textColor: e.target.value })} style={{ width: 32, height: 28, borderRadius: 4, border: '1px solid var(--border)', cursor: 'pointer' }} />
              </div>
              <button onClick={addAttType} style={{ ...saveBtnStyle }}>Tambah</button>
              <button onClick={() => setShowAddType(false)} style={{ ...cancelBtnStyle }}>Batal</button>
            </div>
          )}
        </div>

        {/* Notifications */}
        <div style={sectionStyle}>
          <div style={sectionTitle}><span style={{ color: 'var(--amber)' }}>🔔</span> Notifikasi</div>
          {[
            { key: 'waEnabled', label: 'WA Notifikasi (Fonnte)', desc: 'Kirim reminder ke tim via WhatsApp' },
            { key: 'waDueDateReminder', label: 'Reminder Due Date', desc: 'Notif H-3 dan H-1 sebelum deadline' },
            { key: 'waWeeklyDigest', label: 'Weekly Digest ke Manager', desc: 'Summary mingguan setiap Jumat 17.00' },
          ].map(item => (
            <div key={item.key} style={rowStyle}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{item.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{item.desc}</div>
              </div>
              <Toggle on={!!(config?.notifications as any)[item.key]} onToggle={() => toggleNotif(item.key)} />
            </div>
          ))}
        </div>

        {/* Role & Access */}
        <div style={sectionStyle}>
          <div style={sectionTitle}><span style={{ color: 'var(--teal)' }}>👥</span> Role & Akses</div>
          {[
            { key: 'managerCanEditAll', label: 'Manager bisa edit semua issue', desc: 'Manager bisa edit issue milik semua anggota tim' },
            { key: 'memberSeeOwnOnly', label: 'Member hanya lihat issue sendiri', desc: 'Member tidak bisa melihat issue anggota lain' },
            { key: 'guestViewEnabled', label: 'Guest view (read-only)', desc: 'Akses tanpa login, hanya bisa lihat dashboard' },
          ].map(item => (
            <div key={item.key} style={rowStyle}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{item.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{item.desc}</div>
              </div>
              <Toggle on={!!(config?.roles as any)[item.key]} onToggle={() => toggleRole(item.key)} />
            </div>
          ))}
        </div>

        {/* Period & Target */}
        <div style={sectionStyle}>
          <div style={sectionTitle}><span style={{ color: 'var(--purple)' }}>📆</span> Periode & Target</div>
          {[
            { label: 'Tahun aktif', value: config?.activeYear, key: 'activeYear', color: 'var(--text)' },
            { label: 'Target Mid Year (M6)', value: `${config?.midYearTarget}%`, key: 'midYearTarget', color: 'var(--red)' },
            { label: 'Target Year End (M12)', value: `${config?.yearEndTarget}%`, key: 'yearEndTarget', color: 'var(--green)' },
            { label: 'Mid Year Month', value: `M${config?.midYearMonth}`, key: 'midYearMonth', color: 'var(--amber)' },
          ].map(item => (
            <div key={item.key} style={rowStyle}>
              <div style={{ fontSize: 13, color: 'var(--text2)' }}>{item.label}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: item.color }}>{item.value}</div>
            </div>
          ))}
          <div style={{ marginTop: 12, padding: '10px', background: 'var(--bg3)', borderRadius: 7, fontSize: 12, color: 'var(--text3)' }}>
            Edit periode dan target bisa dilakukan melalui update langsung di database atau UI edit yang akan ditambahkan di versi berikutnya.
          </div>
        </div>

        {/* System info */}
        <div style={sectionStyle}>
          <div style={sectionTitle}><span style={{ color: 'var(--green)' }}>ℹ</span> Informasi Sistem</div>
          {[
            { label: 'Versi App', value: 'WorkPulse v1.0.0' },
            { label: 'Framework', value: 'Next.js 14 App Router' },
            { label: 'Database', value: 'MongoDB Atlas' },
            { label: 'Auth', value: 'NextAuth.js (Credentials)' },
            { label: 'Charts', value: 'Recharts' },
          ].map(item => (
            <div key={item.label} style={rowStyle}>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>{item.label}</div>
              <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 500 }}>{item.value}</div>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}

const sectionStyle: React.CSSProperties = { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px' }
const sectionTitle: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }
const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)', gap: 10 }
const inputStyle: React.CSSProperties = { background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 6, padding: '7px 10px', color: 'var(--text)', fontSize: 12, outline: 'none' }
const btnBaseStyle: React.CSSProperties = { padding: '7px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer' }
const saveBtnStyle: React.CSSProperties = { ...btnBaseStyle, background: 'var(--blue)', border: '1px solid var(--blue)', color: '#fff' }
const cancelBtnStyle: React.CSSProperties = { ...btnBaseStyle, background: 'var(--bg2)', border: '1px solid var(--border2)', color: 'var(--text2)' }
const tealVar = 'var(--teal)'
