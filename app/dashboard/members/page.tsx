'use client'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { getConfig } from '@/lib/configCache'
import { DEFAULT_ROLES } from '@/lib/defaults'
import { Empty, Icon, PageHeader, Pill, Sheet, Tile, type Tone } from '@/components/ui'

type User = Record<string, any>
const ROLE_TONE: Record<string, Tone> = { admin: 'bad', manager: 'accent', member: 'ok', finance: 'warn', cashier: 'warn', guest: 'none' }
const rolesOf = (u: User): string[] => (u.roles && u.roles.length ? u.roles : u.role ? [u.role] : [])
const initials = (s: string) => String(s || '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') || '?'

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error || 'Gagal menyimpan, coba lagi')
  return data
}

function MemberSheet({ editing, allRoles, onClose, onSaved }: { editing: User | null; allRoles: any[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: editing?.name || '', password: '', roles: editing ? rolesOf(editing) : ['member'],
    division: editing?.division || '', status: editing?.status || 'pekerja', phone: editing?.phone || '',
  })
  const [saving, setSaving] = useState(false), [tried, setTried] = useState(false), [confirmDel, setConfirmDel] = useState(false)
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
  const toggleRole = (k: string) => setForm(f => ({ ...f, roles: f.roles.includes(k) ? f.roles.filter(r => r !== k) : [...f.roles, k] }))
  const errName = tried && !form.name.trim() ? 'Nama wajib diisi' : ''
  const errRole = tried && !form.roles.length ? 'Pilih minimal 1 role' : ''
  const errPin = !tried ? '' : (!editing && !form.password) ? 'PIN wajib untuk member baru' : form.password && form.password.length !== 6 ? 'PIN harus 6 digit' : ''

  async function save() {
    setTried(true)
    if (!form.name.trim() || !form.roles.length || (!editing && !form.password) || (form.password && form.password.length !== 6)) { toast.error('Periksa isian yang ditandai'); return }
    setSaving(true)
    try {
      const body: Record<string, unknown> = { name: form.name.trim(), roles: form.roles, role: form.roles[0], division: form.division, status: form.status, phone: form.phone }
      if (!editing) body.email = `${form.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '')}@workpulse.local`
      if (form.password) body.password = form.password
      await send(editing ? `/api/users/${editing._id}` : '/api/users', editing ? 'PATCH' : 'POST', body)
      toast.success(editing ? 'Member diperbarui' : 'Member ditambahkan'); onSaved(); onClose()
    } catch (e: any) { toast.error(e.message) } finally { setSaving(false) }
  }
  async function del() {
    if (!editing) return
    setSaving(true)
    try { await send(`/api/users/${editing._id}`, 'DELETE'); toast.success('Member dihapus'); onSaved(); onClose() } catch (e: any) { toast.error(e.message) } finally { setSaving(false) }
  }
  const err = (m: string) => m ? <span role="alert" className="au-xs" style={{ color: 'var(--bad)', fontWeight: 600 }}>{m}</span> : null

  return (
    <Sheet open title={editing ? 'Edit member' : 'Member baru'} onClose={onClose} onSave={save} saveDisabled={saving} saveLabel={saving ? 'Menyimpan…' : 'Simpan'}>
      <div className="au-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
        <label className="au-col" style={{ gap: 6 }}><span className="lbl">Nama *</span><input className="input" value={form.name} maxLength={120} onChange={e => set('name', e.target.value)} aria-invalid={!!errName} />{err(errName)}</label>
        <label className="au-col" style={{ gap: 6 }}><span className="lbl">Divisi</span><input className="input" value={form.division} onChange={e => set('division', e.target.value)} placeholder="BPD Proc, TnD" /></label>
        <label className="au-col" style={{ gap: 6 }}><span className="lbl">No. HP</span><input className="input" type="tel" inputMode="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="08xxxxxxxxxx" /></label>
        <div className="au-col" style={{ gap: 6 }}><span className="lbl">Status kepegawaian</span>
          <div className="au-seg au-segf" role="group" aria-label="Status kepegawaian">{[['pekerja', 'Pekerja'], ['TAD', 'TAD']].map(([v, l]) => <button key={v} type="button" aria-pressed={form.status === v} onClick={() => set('status', v)}>{l}</button>)}</div></div>
      </div>
      <div className="au-col" style={{ gap: 6 }}><span className="lbl">Role (boleh lebih dari satu)</span>
        <div className="au-chips wrap" role="group" aria-label="Role">{allRoles.map((r: any) => <button key={r.key} type="button" className="au-chip" aria-pressed={form.roles.includes(r.key)} onClick={() => toggleRole(r.key)}>{form.roles.includes(r.key) && <Icon name="check" size={13} stroke={2.6} style={{ marginRight: 4, verticalAlign: '-2px' }} />}{r.label || r.key}</button>)}</div>
        {err(errRole) || <span className="au-xs au-muted">Hak akses menu mengikuti konfigurasi role di Configuration.</span>}</div>
      <label className="au-col" style={{ gap: 6 }}><span className="lbl">{editing ? 'PIN baru (kosongkan bila tidak diubah)' : 'PIN 6 digit *'}</span>
        <input className="input" type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} value={form.password} onChange={e => set('password', e.target.value.replace(/\D/g, ''))} aria-invalid={!!errPin} placeholder="••••••" style={{ fontFamily: 'var(--mono)', letterSpacing: '.3em' }} />{err(errPin)}</label>
      {editing && (confirmDel
        ? <div className="au-row au-wrap p-bad" style={{ borderRadius: 14, padding: 12, gap: 10 }}><span className="au-small" style={{ flex: 1 }}>Hapus {editing.name}? Tindakan ini permanen.</span><button type="button" className="btn btn-sm" onClick={() => setConfirmDel(false)}>Batal</button><button type="button" className="btn btn-danger btn-sm" disabled={saving} onClick={del}>Ya, hapus</button></div>
        : <button type="button" className="btn btn-danger" style={{ alignSelf: 'flex-start' }} onClick={() => setConfirmDel(true)}><Icon name="trash" size={15} />Hapus member</button>)}
    </Sheet>
  )
}

function ResetPinSheet({ user, onClose }: { user: User; onClose: () => void }) {
  const [busy, setBusy] = useState(false)
  async function reset() {
    setBusy(true)
    try { await send(`/api/users/${user._id}`, 'PATCH', { password: '123456' }); toast.success(`PIN ${user.name} di-reset ke 123456`); onClose() } catch { toast.error('Gagal reset PIN') } finally { setBusy(false) }
  }
  return (
    <Sheet open title="Reset PIN" onClose={onClose}>
      <div className="au-row" style={{ gap: 12 }}><span className="au-av">{initials(user.name)}</span><span className="au-col" style={{ minWidth: 0 }}><b>{user.name}</b><span className="au-xs au-muted">{user.division || rolesOf(user).join(', ')}</span></span></div>
      <p className="au-small au-ink2" style={{ margin: 0 }}>PIN akan dikembalikan ke default <b style={{ fontFamily: 'var(--mono)' }}>123456</b>. Member harus login memakai PIN ini lalu menggantinya di My Profile.</p>
      <div className="au-row" style={{ gap: 8, justifyContent: 'flex-end' }}><button type="button" className="btn" onClick={onClose}>Batal</button><button type="button" className="btn btn-danger" disabled={busy} onClick={reset}><Icon name="key" size={15} />{busy ? 'Mereset…' : 'Reset PIN'}</button></div>
    </Sheet>
  )
}

export default function MembersPage() {
  const [users, setUsers] = useState<User[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [config, setConfig] = useState<any>(null)
  const [sheet, setSheet] = useState<{ user: User | null } | null>(null)
  const [pinFor, setPinFor] = useState<User | null>(null)
  const [q, setQ] = useState('')
  const [role, setRole] = useState('all')

  const load = useCallback(async () => {
    setFailed(false)
    try { const d = await send('/api/users', 'GET'); setUsers(Array.isArray(d?.data) ? d.data : []) } catch { setFailed(true); setUsers(u => u ?? []) }
  }, [])
  useEffect(() => { load(); getConfig().then(setConfig).catch(() => {}) }, [load])

  async function move(idx: number, dir: number) {
    const list = users || [], to = idx + dir
    if (to < 0 || to >= list.length) return
    const prev = list, next = [...list]
    const [m] = next.splice(idx, 1); next.splice(to, 0, m)
    setUsers(next)
    try {
      await Promise.all(next.map((u, i) => send(`/api/users/${u._id}`, 'PATCH', { sortOrder: i })))
      toast.success('Urutan disimpan')
    } catch { setUsers(prev); toast.error('Gagal simpan urutan') }
  }

  const allRoles = (config?.roleDefs && config.roleDefs.length > 0) ? config.roleDefs : DEFAULT_ROLES
  const roleLabel = (k: string) => allRoles.find((r: any) => r.key === k)?.label || k
  const all = users || []
  const needle = q.trim().toLowerCase()
  const filtering = !!needle || role !== 'all'
  const shown = all.filter(u => (!needle || [u.name, u.division, u.jabatan, u.phone].some(s => String(s || '').toLowerCase().includes(needle))) && (role === 'all' || rolesOf(u).includes(role)))
  const usedRoles = allRoles.filter((r: any) => all.some(u => rolesOf(u).includes(r.key)))
  const active = all.filter(u => u.active !== false).length, tad = all.filter(u => u.status === 'TAD').length

  return (
    <div className="au-page">
      {sheet && <MemberSheet editing={sheet.user} allRoles={allRoles.filter((r: any) => r.key !== 'guest')} onClose={() => setSheet(null)} onSaved={load} />}
      {pinFor && <ResetPinSheet user={pinFor} onClose={() => setPinFor(null)} />}
      <div className="au-view au-anim">
        <PageHeader eyebrow="Workspace · Multi-role" title="Member" actions={
          <button type="button" className="btn btn-primary" onClick={() => setSheet({ user: null })}><Icon name="plus" size={16} stroke={2.2} />Member baru</button>} />
        <div className="au-grid g4 au-tiles">
          <Tile icon="team" color="var(--accent)" value={users ? all.length : '–'} label="Total member" />
          <Tile icon="check" color="var(--aqua)" value={users ? active : '–'} label="Aktif" />
          <Tile icon="user" color="var(--hot)" value={users ? all.length - tad : '–'} label="Pekerja" />
          <Tile icon="id" color="var(--volt)" iconInk="var(--on-volt)" value={users ? tad : '–'} label="TAD" />
        </div>
        <div className="au-col rise" style={{ gap: 10 }}>
          <label className="input au-row" style={{ gap: 8, padding: '0 12px', maxWidth: 520 }}><Icon name="search" size={16} />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari nama, divisi atau no. HP" aria-label="Cari member" style={{ border: 0, background: 'transparent', flex: 1, minHeight: 42, outline: 0, color: 'var(--ink)' }} /></label>
          {usedRoles.length > 1 && <div className="au-chips" role="group" aria-label="Filter role">
            <button type="button" className="au-chip" aria-pressed={role === 'all'} onClick={() => setRole('all')}>Semua</button>
            {usedRoles.map((r: any) => <button key={r.key} type="button" className="au-chip" aria-pressed={role === r.key} onClick={() => setRole(r.key)}>{r.label || r.key}</button>)}</div>}
        </div>
        {failed && <div className="au-row au-wrap p-bad" role="alert" style={{ borderRadius: 14, padding: 12 }}><span className="au-small" style={{ flex: 1 }}>Data member gagal dimuat.</span><button type="button" className="btn btn-sm" onClick={load}>Coba lagi</button></div>}

        {users === null ? <div className="au-card">{[0, 1, 2].map(k => <div key={k} className="au-skel" />)}</div>
          : !shown.length ? <div className="au-card"><Empty title={all.length ? 'Tidak ada yang cocok' : 'Belum ada member'} text={all.length ? 'Ubah kata kunci atau filter role.' : undefined}
            action={all.length ? <button type="button" className="btn" onClick={() => { setQ(''); setRole('all') }}>Reset filter</button> : undefined} /></div>
          : <div className="au-tblw rise">
            <table className="wp-table au-mtbl">
              <thead><tr><th style={{ width: 44 }}>#</th><th>Nama</th><th>Role</th><th>No. HP</th><th>Status</th><th style={{ width: 96 }}>{filtering ? '' : 'Urutan'}</th><th style={{ width: 96 }}><span className="sr-only">Aksi</span></th></tr></thead>
              <tbody>
                {shown.map((u, idx) => (
                  <tr key={u._id}>
                    <td className="au-xs au-muted" style={{ textAlign: 'center', fontFamily: 'var(--mono)' }}>{idx + 1}</td>
                    <td>
                      <button type="button" className="au-mname" onClick={() => setSheet({ user: u })} aria-label={`Edit ${u.name}`}>
                        <span className={`au-av c${(idx % 7) + 1}`}>{initials(u.name)}</span>
                        <span className="au-col" style={{ minWidth: 0, gap: 2 }}><b>{u.name}</b><span className="au-xs au-muted">{[u.jabatan, u.division].filter(Boolean).join(' · ') || (u.status === 'TAD' ? 'TAD' : 'Pekerja')}</span></span>
                      </button>
                    </td>
                    <td><span className="au-row au-wrap" style={{ gap: 4 }}>{rolesOf(u).map(r => <Pill key={r} tone={ROLE_TONE[r] || 'none'}>{roleLabel(r)}</Pill>)}</span></td>
                    <td className="au-small" style={{ fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }}>{u.phone || '—'}</td>
                    <td><span className="au-row au-wrap" style={{ gap: 4 }}><Pill tone={u.active !== false ? 'ok' : 'bad'}>{u.active !== false ? 'Aktif' : 'Nonaktif'}</Pill>{u.status === 'TAD' && <span className="au-tag">TAD</span>}</span></td>
                    <td>{!filtering && <span className="au-row" style={{ gap: 4 }}>
                      <button type="button" className="btn btn-icon btn-sm" disabled={idx === 0} aria-label={`Naikkan ${u.name}`} title="Naik" onClick={() => move(idx, -1)}><Icon name="up" size={15} /></button>
                      <button type="button" className="btn btn-icon btn-sm" disabled={idx === shown.length - 1} aria-label={`Turunkan ${u.name}`} title="Turun" onClick={() => move(idx, 1)}><Icon name="up" size={15} style={{ transform: 'rotate(180deg)' }} /></button></span>}</td>
                    <td><span className="au-row" style={{ gap: 4, justifyContent: 'flex-end' }}>
                      <button type="button" className="btn btn-icon btn-sm" aria-label={`Reset PIN ${u.name}`} title="Reset PIN ke 123456" onClick={() => setPinFor(u)}><Icon name="key" size={15} /></button>
                      <button type="button" className="btn btn-icon btn-sm" aria-label={`Edit ${u.name}`} title="Edit" onClick={() => setSheet({ user: u })}><Icon name="edit" size={15} /></button></span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>}
      </div>
    </div>
  )
}
