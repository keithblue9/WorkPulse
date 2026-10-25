'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { Empty, Icon, PageHeader } from '@/components/ui'
import NotifySettings from '@/components/NotifySettings'

const initials = (s: string) => String(s || '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') || '?'
const BIO_KEYS = ['name', 'noPekerja', 'noKtp', 'jabatan', 'birthPlace', 'birthDate', 'alamatJakarta', 'alamatAsal', 'phone', 'phoneLinkAja', 'bank', 'noRekening', 'kontakDaruratNama', 'kontakDaruratHubungan', 'kontakDaruratHp', 'sizeKaos', 'sizeKemeja', 'sizeJaket', 'sizeCelana', 'sizeSepatu']

function PinField({ label, value, onChange, err }: { label: string; value: string; onChange: (v: string) => void; err?: string }) {
  return (
    <label className="au-col" style={{ gap: 6 }}><span className="lbl">{label}</span>
      <input className="input" type="password" inputMode="numeric" autoComplete="off" maxLength={6} value={value} onChange={e => onChange(e.target.value.replace(/\D/g, ''))} aria-invalid={!!err} placeholder="••••••" style={{ fontFamily: 'var(--mono)', letterSpacing: '.3em' }} />
      {err && <span role="alert" className="au-xs" style={{ color: 'var(--bad)', fontWeight: 600 }}>{err}</span>}</label>
  )
}

function ChangePin() {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ currentPin: '', newPin: '', confirmPin: '' })
  const [tried, setTried] = useState(false), [saving, setSaving] = useState(false)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))
  const errCur = tried && !form.currentPin ? 'Isi PIN lama' : ''
  const errNew = tried && !/^\d{6}$/.test(form.newPin) ? 'PIN baru harus 6 digit angka' : ''
  const errConf = tried && !errNew && form.newPin !== form.confirmPin ? 'Konfirmasi PIN tidak sama' : ''
  const close = () => { setOpen(false); setTried(false); setForm({ currentPin: '', newPin: '', confirmPin: '' }) }

  async function save() {
    setTried(true)
    if (!form.currentPin || !/^\d{6}$/.test(form.newPin) || form.newPin !== form.confirmPin) return
    setSaving(true)
    try {
      const r = await fetch('/api/auth/change-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword: form.currentPin, newPassword: form.newPin }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { toast.error(d.error || 'Gagal mengubah PIN'); return }
      toast.success('PIN berhasil diubah'); close()
    } catch { toast.error('Gagal mengubah PIN') } finally { setSaving(false) }
  }

  return (
    <section className="au-col rise" style={{ gap: 8 }}>
      <span className="lbl">Keamanan</span>
      <div className="au-ig">
        <button type="button" className="au-igr" aria-expanded={open} onClick={() => (open ? close() : setOpen(true))}>
          <span className="ti au-pti" style={{ background: 'var(--accent)' }}><Icon name="lock" size={16} stroke={2.1} /></span>
          <span className="au-col" style={{ flex: 1, minWidth: 0, gap: 1 }}><b className="au-small">Ganti PIN</b><span className="au-xs au-muted">PIN 6 digit untuk login</span></span>
          <Icon name="chev" size={16} style={{ transform: `rotate(${open ? 0 : -90}deg)`, transition: 'transform .2s', color: 'var(--muted)' }} />
        </button>
        {open && <div className="au-col" style={{ gap: 12, padding: 16, borderTop: '1px solid var(--line)' }}>
          <PinField label="PIN lama" value={form.currentPin} onChange={v => set('currentPin', v)} err={errCur} />
          <div className="au-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
            <PinField label="PIN baru" value={form.newPin} onChange={v => set('newPin', v)} err={errNew} />
            <PinField label="Ulangi PIN baru" value={form.confirmPin} onChange={v => set('confirmPin', v)} err={errConf} />
          </div>
          <div className="au-row" style={{ gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="btn" onClick={close}>Batal</button>
            <button type="button" className="btn btn-primary" disabled={saving} onClick={save}>{saving ? 'Mengubah…' : 'Simpan PIN baru'}</button>
          </div>
        </div>}
      </div>
    </section>
  )
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<any>(undefined)
  const load = useCallback(() => {
    setProfile(undefined)
    fetch('/api/profile').then(r => (r.ok ? r.json() : Promise.reject())).then(d => setProfile(d.data || null)).catch(() => setProfile(null))
  }, [])
  useEffect(() => { load() }, [load])

  const roles: string[] = profile ? (profile.roles?.length ? profile.roles : profile.role ? [profile.role] : []) : []
  const filled = profile ? BIO_KEYS.filter(k => String(profile[k] ?? '').trim()).length : 0
  const pct = Math.round((filled / BIO_KEYS.length) * 100)

  return (
    <div className="au-page">
      <div className="au-view au-anim" style={{ maxWidth: 640, margin: '0 auto', width: '100%' }}>
        <PageHeader eyebrow="Akun" title="My Profile" />
        {profile === undefined ? <div className="au-card">{[0, 1].map(k => <div key={k} className="au-skel" />)}</div>
          : profile === null ? <div className="au-card"><Empty title="Profil gagal dimuat" action={<button type="button" className="btn" onClick={load}>Coba lagi</button>} /></div>
          : <>
            <div className="au-card au-phero rise">
              <span className="au-av" style={{ width: 88, height: 88, fontSize: 30 }}>{initials(profile.name)}</span>
              <h2 style={{ fontSize: 22 }}>{profile.name}</h2>
              <span className="au-small au-muted">{[profile.jabatan, profile.division].filter(Boolean).join(' · ') || '—'}</span>
              {roles.length > 0 && <span className="au-row au-wrap" style={{ gap: 4, justifyContent: 'center' }}>{roles.map(r => <span key={r} className="au-tag">{r}</span>)}</span>}
            </div>
            <section className="au-col rise" style={{ gap: 8 }}>
              <span className="lbl">Biodata</span>
              <div className="au-ig">
                <Link href="/dashboard/biodata" className="au-igr" style={{ textDecoration: 'none' }}>
                  <span className="ti au-pti" style={{ background: 'var(--aqua)' }}><Icon name="id" size={16} stroke={2.1} /></span>
                  <span className="au-col" style={{ flex: 1, minWidth: 0, gap: 6 }}><b className="au-small">Biodata lengkap</b>
                    <span className="au-row" style={{ gap: 8 }}><span className="au-track" style={{ flex: 1, maxWidth: 180, height: 6 }} role="img" aria-label={`Kelengkapan ${pct}%`}><i className="a" style={{ width: `${pct}%` }} /></span><span className="au-xs au-muted" style={{ fontFamily: 'var(--mono)' }}>{pct}%</span></span></span>
                  <Icon name="chev" size={16} style={{ transform: 'rotate(-90deg)', color: 'var(--muted)' }} />
                </Link>
                <div className="au-igr"><span className="k">Email</span><span className="v au-small" style={{ fontFamily: 'var(--mono)' }}>{profile.email || '—'}</span></div>
                <div className="au-igr"><span className="k">No HP</span><span className="v">{profile.phone || '—'}</span></div>
              </div>
              <span className="au-xs au-muted" style={{ padding: '0 4px' }}>Alamat, rekening, kontak darurat dan ukuran diubah dari halaman Biodata.</span>
            </section>
            <NotifySettings />
            <ChangePin />
          </>}
      </div>
    </div>
  )
}
