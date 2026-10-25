'use client'
import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import { getConfig } from '@/lib/configCache'
import { allowedMenusFor, userRolesOf } from '@/lib/perms'
import { Empty, Icon, PageHeader, Sheet } from '@/components/ui'

type User = Record<string, any>
// External/guest collaborators are not internal staff → excluded from biodata
const NON_STAFF_ROLES = ['external', 'guest']
function isInternalMember(u: User): boolean {
  const roles = (u?.roles && u.roles.length) ? u.roles : (u?.role ? [u.role] : [])
  return !roles.some((r: string) => NON_STAFF_ROLES.includes(String(r).toLowerCase()))
}
const BANKS = ['BCA', 'Mandiri', 'BRI', 'BNI', 'BSI', 'CIMB Niaga', 'Permata', 'Danamon', 'BTN', 'Mega', 'OCBC NISP', 'UOB', 'Bank Jago', 'Bank Neo Commerce', 'Other']
const initials = (s: string) => String(s || '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') || '?'
const BLN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const fmtD = (s?: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? `${Number(m[3])} ${BLN[Number(m[2]) - 1]} ${m[1]}` : (s || '') }

type Field = { k: string; label: string; type?: 'date' | 'tel' | 'bank'; sensitive?: boolean; wide?: boolean }
const SECTIONS: { title: string; icon: string; fields: Field[] }[] = [
  { title: 'Informasi personal', icon: 'user', fields: [
    { k: 'name', label: 'Nama lengkap', wide: true }, { k: 'noPekerja', label: 'No pekerja' }, { k: 'noKtp', label: 'No KTP', sensitive: true },
    { k: 'jabatan', label: 'Jabatan', wide: true }, { k: 'birthPlace', label: 'Tempat lahir' }, { k: 'birthDate', label: 'Tanggal lahir', type: 'date' },
    { k: 'alamatJakarta', label: 'Alamat Jakarta', wide: true }, { k: 'alamatAsal', label: 'Alamat asal', wide: true },
    { k: 'phone', label: 'No HP', type: 'tel' }, { k: 'phoneLinkAja', label: 'No HP (LinkAja)', type: 'tel' },
  ] },
  { title: 'Informasi bank', icon: 'wallet', fields: [{ k: 'bank', label: 'Bank', type: 'bank' }, { k: 'noRekening', label: 'No rekening' }] },
  { title: 'Kontak darurat', icon: 'bell', fields: [{ k: 'kontakDaruratNama', label: 'Nama' }, { k: 'kontakDaruratHubungan', label: 'Hubungan' }, { k: 'kontakDaruratHp', label: 'No HP', type: 'tel' }] },
  { title: 'Ukuran', icon: 'id', fields: [{ k: 'sizeKaos', label: 'Kaos' }, { k: 'sizeKemeja', label: 'Kemeja' }, { k: 'sizeJaket', label: 'Jaket' }, { k: 'sizeCelana', label: 'Celana' }, { k: 'sizeSepatu', label: 'Sepatu' }] },
]
const EDITABLE = SECTIONS.flatMap(s => s.fields.map(f => f.k))

function Secret({ value }: { value: string }) {
  const [show, setShow] = useState(false)
  return (
    <span className="au-row" style={{ gap: 6, justifyContent: 'flex-end' }}>
      <span style={{ filter: show ? 'none' : 'blur(5px)', transition: 'filter .15s', userSelect: show ? 'text' : 'none', fontFamily: 'var(--mono)' }} aria-hidden={!show}>{value}</span>
      <button type="button" className="btn btn-icon btn-sm" aria-pressed={show} aria-label={show ? 'Sembunyikan No KTP' : 'Tampilkan No KTP'} title={show ? 'Sembunyikan' : 'Tampilkan'} onClick={() => setShow(s => !s)}><Icon name="eye" size={15} /></button>
    </span>
  )
}

function EditSheet({ user, onClose, onSaved }: { user: User; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<User>(() => Object.fromEntries(EDITABLE.map(k => [k, user[k] ?? ''])))
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))
  async function save() {
    if (!String(form.name || '').trim()) { toast.error('Nama wajib diisi'); return }
    // Kirim hanya field yang benar-benar diubah — field lain di database tidak disentuh.
    const changed = Object.fromEntries(EDITABLE.filter(k => String(form[k] ?? '') !== String(user[k] ?? '')).map(k => [k, form[k]]))
    if (!Object.keys(changed).length) { onClose(); return }
    setSaving(true)
    try {
      const r = await fetch('/api/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(changed) })
      if (!r.ok) { toast.error('Gagal menyimpan'); return }
      toast.success('Biodata tersimpan'); onSaved(); onClose()
    } catch { toast.error('Gagal menyimpan') } finally { setSaving(false) }
  }
  return (
    <Sheet open wide title="Edit biodata" onClose={onClose} onSave={save} saveDisabled={saving} saveLabel={saving ? 'Menyimpan…' : 'Simpan'}>
      {SECTIONS.map(s => (
        <fieldset key={s.title} className="au-col" style={{ gap: 10, border: 0, padding: 0, margin: 0 }}>
          <legend className="lbl" style={{ marginBottom: 8 }}>{s.title}</legend>
          <div className="au-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 10 }}>
            {s.fields.map(f => (
              <label key={f.k} className="au-col" style={{ gap: 6, gridColumn: f.wide ? '1 / -1' : undefined }}><span className="lbl">{f.label}</span>
                {f.type === 'bank'
                  ? <select className="input" value={form[f.k] || ''} onChange={e => set(f.k, e.target.value)}><option value="">Pilih bank</option>{(form[f.k] && !BANKS.includes(form[f.k]) ? [form[f.k], ...BANKS] : BANKS).map(b => <option key={b} value={b}>{b}</option>)}</select>
                  : <input className="input" type={f.type === 'date' ? 'date' : f.type === 'tel' ? 'tel' : 'text'} inputMode={f.type === 'tel' || f.k === 'noRekening' || f.k === 'noKtp' ? 'numeric' : undefined} value={form[f.k] || ''} onChange={e => set(f.k, e.target.value)} />}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </Sheet>
  )
}

function Detail({ user, isMine, onBack, onEdit }: { user: User; isMine: boolean; onBack: () => void; onEdit: () => void }) {
  const filled = EDITABLE.filter(k => String(user[k] ?? '').trim()).length
  const pct = Math.round((filled / EDITABLE.length) * 100)
  return (
    <>
      <button type="button" className="au-link au-row" style={{ alignSelf: 'flex-start', gap: 4 }} onClick={onBack}><Icon name="back" size={14} />Semua member</button>
      <div className="au-card au-bhero rise">
        <span className="au-av" style={{ width: 64, height: 64, fontSize: 22 }}>{initials(user.name)}</span>
        <span className="au-col" style={{ gap: 4, minWidth: 0, flex: 1 }}>
          <h2 style={{ overflowWrap: 'anywhere' }}>{user.name}</h2>
          <span className="au-small au-muted">{[user.jabatan, user.division].filter(Boolean).join(' · ') || (user.roles?.join(', ') || user.role)}</span>
          <span className="au-row" style={{ gap: 8, marginTop: 6 }}>
            <span className="au-track" style={{ flex: 1, maxWidth: 200, height: 8 }} role="img" aria-label={`Kelengkapan biodata ${pct}%`}><i className="a" style={{ width: `${pct}%` }} /></span>
            <span className="au-xs au-muted" style={{ fontFamily: 'var(--mono)' }}>{pct}% lengkap</span>
          </span>
        </span>
        {isMine && <button type="button" className="btn btn-primary" onClick={onEdit}><Icon name="edit" size={15} />Edit biodata</button>}
      </div>
      <div className="au-bgrid">
        {SECTIONS.map(s => (
          <section key={s.title} className="au-col rise" style={{ gap: 8 }}>
            <span className="lbl au-row" style={{ gap: 6 }}><Icon name={s.icon} size={14} />{s.title}</span>
            <div className="au-ig">
              {s.fields.map(f => {
                const v = String(user[f.k] ?? '').trim()
                return (
                  <div key={f.k} className="au-igr"><span className="k">{f.label}</span>
                    <span className="v">{!v ? <span className="au-muted" style={{ fontWeight: 400 }}>—</span> : f.sensitive ? <Secret value={v} /> : f.type === 'date' ? fmtD(v) : v}</span></div>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </>
  )
}

export default function BiodataPage() {
  const { data: session } = useSession(); const sessUser = session?.user as any
  const [users, setUsers] = useState<User[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [selId, setSelId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [canExport, setCanExport] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [q, setQ] = useState('')

  useEffect(() => {
    getConfig().then((cfg: any) => setCanExport(allowedMenusFor(cfg?.roleDefs || [], userRolesOf(sessUser)).has('biodata-export'))).catch(() => setCanExport(false))
  }, [sessUser?.email])

  const load = useCallback(async () => {
    setFailed(false)
    try {
      const r = await fetch('/api/users')
      if (!r.ok) throw new Error()
      const d = await r.json()
      const list = (d.data || []).filter((u: User) => u.active !== false && isInternalMember(u))
      setUsers(list)
      // Default: biodata sendiri (hanya di layar lebar — di HP mulai dari daftar).
      setSelId(cur => cur ?? (typeof window !== 'undefined' && window.innerWidth > 1180 ? list.find((u: User) => u.email === sessUser?.email)?._id ?? null : null))
    } catch { setFailed(true); setUsers(u => u ?? []) }
  }, [sessUser?.email])
  useEffect(() => { if (sessUser?.email) load() }, [sessUser?.email, load])

  async function exportAllXLSX() {
    const list = users || []
    setExporting(true)
    try {
      const _xl: any = await import('exceljs'); const ExcelJS = _xl.default || _xl
      const wb = new ExcelJS.Workbook(); wb.creator = 'WINS'; wb.created = new Date()
      const box = () => ({ top: { style: 'thin' as const, color: { argb: 'FFE0E4EA' } }, left: { style: 'thin' as const, color: { argb: 'FFE0E4EA' } }, bottom: { style: 'thin' as const, color: { argb: 'FFE0E4EA' } }, right: { style: 'thin' as const, color: { argb: 'FFE0E4EA' } } })
      const roleOf = (u: User) => (u.roles?.length ? u.roles.join(', ') : (u.role || '-'))

      const sum = wb.addWorksheet('Ringkasan', { views: [{ showGridLines: false, state: 'frozen', ySplit: 2 }] })
      sum.columns = [{ width: 4 }, { width: 24 }, { width: 12 }, { width: 20 }, { width: 18 }, { width: 20 }, { width: 16 }, { width: 14 }, { width: 22 }]
      sum.mergeCells('A1:I1'); const st = sum.getCell('A1'); st.value = 'MEMBER BIODATA — BPD Procurement'; st.font = { bold: true, size: 14, color: { argb: 'FF1A3D7C' } }; st.alignment = { horizontal: 'center' }
      const sh = sum.getRow(2); ['No', 'Nama', 'No Pekerja', 'Jabatan', 'No KTP', 'Email', 'No HP', 'Bank', 'No Rekening'].forEach((h, i) => { const c = sh.getCell(i + 1); c.value = h; c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F8EF7' } }; c.alignment = { horizontal: 'center' }; c.border = box() })
      list.forEach((u, i) => { const r = sum.getRow(3 + i); const vals = [i + 1, u.name, u.noPekerja || '-', u.jabatan || '-', u.noKtp || '-', u.email || '-', u.phone || '-', u.bank || '-', u.noRekening || '-']; vals.forEach((v, j) => { const c = r.getCell(j + 1); c.value = v as any; c.border = box(); c.alignment = { vertical: 'middle', horizontal: j === 0 ? 'center' : 'left' }; if (j === 4 || j === 8) c.numFmt = '@' }) })

      const used = new Set<string>()
      const sheetName = (name: string, idx: number) => { let n = (name || `Member ${idx + 1}`).replace(/[\\/?*[\]:]/g, ' ').slice(0, 28).trim() || `Member ${idx + 1}`; const base = n; let k = 2; while (used.has(n.toLowerCase())) { n = `${base.slice(0, 25)} ${k++}` } used.add(n.toLowerCase()); return n }
      const XSECTIONS: { title: string; rows: [string, string][] }[] = [
        { title: 'Informasi Personal', rows: [['Nama Lengkap', 'name'], ['No Pekerja', 'noPekerja'], ['No KTP', 'noKtp'], ['Jabatan', 'jabatan'], ['Email', 'email'], ['Divisi', 'division'], ['Role', '__role'], ['Tempat Lahir', 'birthPlace'], ['Tanggal Lahir', 'birthDate'], ['Alamat Jakarta', 'alamatJakarta'], ['Alamat Asal', 'alamatAsal'], ['No HP', 'phone'], ['No HP (Link Aja)', 'phoneLinkAja']] },
        { title: 'Informasi Bank', rows: [['Bank', 'bank'], ['No Rekening', 'noRekening']] },
        { title: 'Kontak Darurat', rows: [['Nama', 'kontakDaruratNama'], ['Hubungan', 'kontakDaruratHubungan'], ['No HP', 'kontakDaruratHp']] },
        { title: 'Ukuran', rows: [['Size Kaos', 'sizeKaos'], ['Size Kemeja', 'sizeKemeja'], ['Size Jaket', 'sizeJaket'], ['Size Celana', 'sizeCelana'], ['Size Sepatu', 'sizeSepatu']] },
      ]
      list.forEach((u, idx) => {
        const ws = wb.addWorksheet(sheetName(u.name, idx), { views: [{ showGridLines: false }] })
        ws.columns = [{ width: 22 }, { width: 48 }]
        ws.mergeCells('A1:B1'); const t = ws.getCell('A1'); t.value = u.name; t.font = { bold: true, size: 14, color: { argb: 'FF1A3D7C' } }; t.alignment = { horizontal: 'center' }
        ws.mergeCells('A2:B2'); const t2 = ws.getCell('A2'); t2.value = `${u.jabatan || '-'} · ${u.division || roleOf(u)}`; t2.font = { size: 10, color: { argb: 'FF667085' } }; t2.alignment = { horizontal: 'center' }
        let row = 4
        XSECTIONS.forEach(sec => {
          ws.mergeCells(`A${row}:B${row}`); const sc = ws.getCell(`A${row}`); sc.value = sec.title; sc.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } }; sc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F8EF7' } }; sc.alignment = { horizontal: 'left', vertical: 'middle' }; ws.getRow(row).height = 18; row++
          sec.rows.forEach(([label, key]) => {
            const r = ws.getRow(row); const lc = r.getCell(1); lc.value = label; lc.font = { bold: true, size: 10, color: { argb: 'FF475467' } }; lc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F9FC' } }; lc.alignment = { vertical: 'middle' }; lc.border = box()
            const vc = r.getCell(2); vc.value = key === '__role' ? roleOf(u) : (u[key] || '-'); vc.alignment = { vertical: 'middle' }; vc.border = box(); if (key === 'noKtp' || key === 'noRekening' || key === 'phone' || key === 'phoneLinkAja' || key === 'kontakDaruratHp') vc.numFmt = '@'
            row++
          })
          row++
        })
      })
      const buf = await wb.xlsx.writeBuffer()
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `Member_Biodata_BPD_Procurement_${new Date().toISOString().slice(0, 10)}.xlsx`; a.click(); URL.revokeObjectURL(url)
      toast.success(`Excel ${list.length} member diunduh`)
    } catch (e: any) { toast.error('Gagal export: ' + (e?.message || '')) } finally { setExporting(false) }
  }

  const all = users || []
  const sel = all.find(u => u._id === selId) || null
  const needle = q.trim().toLowerCase()
  const shown = all.filter(u => !needle || [u.name, u.division, u.jabatan].some(s => String(s || '').toLowerCase().includes(needle)))
  const me = sessUser?.email

  return (
    <div className="au-page">
      {editing && sel && <EditSheet user={sel} onClose={() => setEditing(false)} onSaved={load} />}
      <div className="au-view au-anim">
        <PageHeader eyebrow={`Workspace · ${all.length} member`} title="Member Biodata" actions={canExport &&
          <button type="button" className="btn" disabled={exporting || !all.length} onClick={exportAllXLSX}><Icon name="down" size={16} />{exporting ? 'Menyiapkan…' : 'Export Excel'}</button>} />
        {failed && <div className="au-row au-wrap p-bad" role="alert" style={{ borderRadius: 14, padding: 12 }}><span className="au-small" style={{ flex: 1 }}>Data member gagal dimuat.</span><button type="button" className="btn btn-sm" onClick={load}>Coba lagi</button></div>}
        {users === null ? <div className="au-card">{[0, 1, 2].map(k => <div key={k} className="au-skel" />)}</div>
          : !all.length ? <div className="au-card"><Empty title="Belum ada member" /></div>
          : <div className={`au-split${sel ? ' has' : ''}`}>
            <div className="au-lp au-lpane">
              <label className="input au-row" style={{ gap: 8, padding: '0 12px' }}><Icon name="search" size={16} />
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari nama, divisi, jabatan" aria-label="Cari member" style={{ border: 0, background: 'transparent', flex: 1, minHeight: 42, outline: 0, color: 'var(--ink)' }} /></label>
              <div className="au-ig" role="list">
                {shown.map((u, i) => (
                  <button key={u._id} type="button" role="listitem" className="au-igr" aria-current={sel?._id === u._id} onClick={() => setSelId(u._id)}>
                    <span className={`au-av s c${(i % 7) + 1}`}>{initials(u.name)}</span>
                    <span className="au-col" style={{ minWidth: 0, flex: 1, gap: 1 }}><b className="au-small" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</b><span className="au-xs au-muted">{u.division || u.jabatan || u.role}</span></span>
                    {u.email === me && <span className="au-pin">SAYA</span>}
                    <Icon name="chev" size={16} style={{ transform: 'rotate(-90deg)', color: 'var(--muted)' }} />
                  </button>
                ))}
                {!shown.length && <div className="au-igr au-muted au-small">Tidak ada yang cocok dengan “{q}”.</div>}
              </div>
            </div>
            <div className="au-dp au-col" style={{ gap: 16, minWidth: 0 }}>
              {sel ? <Detail key={sel._id} user={sel} isMine={sel.email === me} onBack={() => setSelId(null)} onEdit={() => setEditing(true)} />
                : <div className="au-card"><Empty title="Pilih member" text="Data personal, bank, kontak darurat dan ukuran tampil di sini." /></div>}
            </div>
          </div>}
      </div>
    </div>
  )
}
