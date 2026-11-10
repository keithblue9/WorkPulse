'use client'
// Konfigurasi → Akses tamu: satu tempat untuk mengatur apa yang dilihat sesi External (guest).
// Menu disimpan di roleDefs['guest'].allowedMenus (sama dengan sidebar & proxy); opsi lain di guestAccess.
import Link from 'next/link'
import { useState } from 'react'
import { Icon } from '@/components/ui'
import { GUEST_DATA_CHOICES, GUEST_MENU_CHOICES, normalizeGuestAccess, type GuestAccess } from '@/lib/guestPolicy'
import { DEFAULT_ROLES } from '@/lib/defaults'

type Props = { config: any; saving: boolean; onSave: (patch: { roleDefs: any[]; guestAccess: GuestAccess }) => void }

function Toggle({ on, onChange, title, desc, warn }: { on: boolean; onChange: (v: boolean) => void; title: string; desc: string; warn?: string }) {
  return (
    <label className="ga-row">
      <span className="au-col" style={{ gap: 2, minWidth: 0, flex: 1 }}>
        <b>{title}</b>
        <span className="au-xs au-muted">{desc}</span>
        {warn && on && <span className="au-xs" style={{ color: 'var(--warn)', fontWeight: 600 }}>{warn}</span>}
      </span>
      <input type="checkbox" className="au-sw" checked={on} onChange={e => onChange(e.target.checked)} />
    </label>
  )
}

export default function GuestAccessEditor({ config, saving, onSave }: Props) {
  const base: any[] = config?.roleDefs?.length ? [...config.roleDefs] : [...DEFAULT_ROLES]
  const roles: any[] = base.some((r: any) => r.key === 'guest') ? base : [...base, { ...DEFAULT_ROLES.find(r => r.key === 'guest') }]
  const saved = roles.find((r: any) => r.key === 'guest')?.allowedMenus || ['dashboard', 'links']
  const [menus, setMenus] = useState<Set<string>>(() => new Set(saved))
  const [opt, setOpt] = useState<GuestAccess>(() => normalizeGuestAccess(config?.guestAccess))
  const toggleMenu = (m: string, on: boolean) => setMenus(prev => { const n = new Set(prev); if (on) n.add(m); else n.delete(m); n.add('dashboard'); return n })
  const set = <K extends keyof GuestAccess>(k: K, v: GuestAccess[K]) => setOpt(o => ({ ...o, [k]: v }))

  const dirty = JSON.stringify([...menus].sort()) !== JSON.stringify([...new Set(['dashboard', ...saved])].sort())
    || JSON.stringify(opt) !== JSON.stringify(normalizeGuestAccess(config?.guestAccess))
  const pages = GUEST_MENU_CHOICES.filter(c => menus.has(c.menu))
  const data = GUEST_DATA_CHOICES.filter(c => menus.has(c.menu))

  function save() {
    const next = roles.map((r: any) => r.key === 'guest' ? { ...r, allowedMenus: Array.from(new Set(['dashboard', ...menus])) } : r)
    onSave({ roleDefs: next, guestAccess: opt })
  }

  return (
    <div className="ga">
      <div className="ga-main">
        <section className="au-card" aria-labelledby="ga-pages">
          <div className="au-col" style={{ gap: 2 }}><h2 id="ga-pages">Halaman yang bisa dibuka</h2><span className="au-small au-muted">Tamu hanya bisa melihat — tidak ada tombol tambah, ubah, atau hapus. Dashboard selalu terbuka.</span></div>
          <div className="ga-list">
            {GUEST_MENU_CHOICES.map(c => <Toggle key={c.menu} on={menus.has(c.menu)} onChange={v => toggleMenu(c.menu, v)} title={c.label} desc={c.desc} />)}
          </div>
        </section>

        <section className="au-card" aria-labelledby="ga-data">
          <div className="au-col" style={{ gap: 2 }}><h2 id="ga-data">Data untuk widget</h2><span className="au-small au-muted">Data ini juga terbuka otomatis bila widget-nya kamu pasang di Tampilan tamu.</span></div>
          <div className="ga-list">
            {GUEST_DATA_CHOICES.map(c => <Toggle key={c.menu} on={menus.has(c.menu)} onChange={v => toggleMenu(c.menu, v)} title={c.label} desc={c.desc}
              warn={c.menu === 'mandatory' ? 'Berisi hasil MCU per orang — pastikan memang perlu dibagikan.' : c.menu === 'budget' || c.menu === 'cashcard' ? 'Angka keuangan internal akan terlihat oleh siapa pun yang masuk sebagai tamu.' : undefined} />)}
          </div>
        </section>

        <section className="au-card" aria-labelledby="ga-dash">
          <div className="au-col" style={{ gap: 2 }}><h2 id="ga-dash">Dashboard & privasi</h2></div>
          <div className="ga-list">
            <Toggle on={opt.issuesTab} onChange={v => set('issuesTab', v)} title="Tab Issues" desc="Daftar issue/aktivitas tim beserta progres dan next plan." />
            <Toggle on={opt.hideLinks} onChange={v => set('hideLinks', v)} title="Sembunyikan link di aktivitas" desc="Link Teams/Zoom/dokumen di progres & next plan diganti “[link disembunyikan]”." />
            <Toggle on={opt.showPic} onChange={v => set('showPic', v)} title="Tampilkan nama PIC" desc="Bila dimatikan, PIC tampil sebagai “Tim BPD”." />
            <Toggle on={opt.allowExport} onChange={v => set('allowExport', v)} title="Izinkan export" desc="Tombol Export di Issues, Enhancement dan Go-Live." />
            <label className="ga-row"><span className="au-col" style={{ gap: 2, flex: 1 }}><b>Sapaan</b><span className="au-xs au-muted">Dipakai di kartu sorotan, mis. “Pagi, Mitra.”</span></span>
              <input className="input input-sm" style={{ width: 150 }} maxLength={24} value={opt.greetingName} onChange={e => set('greetingName', e.target.value)} aria-label="Sapaan tamu" /></label>
          </div>
        </section>

        <section className="au-card" aria-labelledby="ga-wg">
          <div className="au-row au-between au-wrap" style={{ gap: 10 }}>
            <div className="au-col" style={{ gap: 2, flex: '1 1 260px' }}><h2 id="ga-wg">Widget & sorotan tamu</h2><span className="au-small au-muted">Susun widget dan pilih kartu sorotan khusus tamu langsung di Dashboard.</span></div>
            <Link href="/dashboard?widgets=guest" className="btn">Atur Tampilan tamu <Icon name="arrow" size={15} stroke={2.2} /></Link>
          </div>
        </section>
      </div>

      <aside className="ga-side" aria-label="Ringkasan akses tamu">
        <div className="au-card ga-sum">
          <span className="lbl">Yang dilihat tamu</span>
          <ul>
            <li><Icon name="dash" size={15} />Dashboard{opt.issuesTab ? ' + Issues' : ''}</li>
            {pages.map(p => <li key={p.menu}><Icon name="check" size={15} />{p.label}</li>)}
            {data.map(p => <li key={p.menu}><Icon name="spark" size={15} />Data {p.label.toLowerCase()}</li>)}
          </ul>
          <span className="au-xs au-muted">{opt.hideLinks ? 'Link disembunyikan' : 'Link terlihat'} · {opt.showPic ? 'PIC terlihat' : 'PIC disamarkan'} · {opt.allowExport ? 'boleh export' : 'tanpa export'}</span>
          <button type="button" className="btn btn-primary au-tap" disabled={!dirty || saving} onClick={save}>{saving ? 'Menyimpan…' : dirty ? 'Simpan akses tamu' : 'Tersimpan'}</button>
          <span className="au-xs au-muted">Berlaku untuk sesi tamu dalam ±30 detik. Untuk mencoba: buka jendela private, pilih External (guest).</span>
        </div>
      </aside>
    </div>
  )
}
