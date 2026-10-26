'use client'
// Papan widget ala iOS: mode tampil, mode edit (hapus/ubah ukuran/geser/seret), galeri "Tambah widget".
import { useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { cachedFetch } from '@/lib/fetchCache'
import { Icon, Seg, Sheet } from '@/components/ui'
import { LazyMount } from '@/components/LazyMount'
import {
  DEFAULT_GUEST_LAYOUT, DEFAULT_LAYOUT, FAMILIES, WIDGET_BY_ID, addWidget, availableWidgets, moveWidget, needsOf,
  chunkLayout, normalizeLayout, removeWidget, resizeWidget, type Fam, type Need, type Placed, type Size, type WidgetDef,
} from '@/lib/widgets'
import { WidgetFrame, renderWidget, type WCtx } from './Widgets'
import { renderClassic } from './Classic'

type Extra = WCtx['extra']
const SIZE_LABEL: Record<Size, string> = { S: 'Kecil', M: 'Sedang', L: 'Besar', H: 'Setengah', F: 'Penuh' }
const SIZE_DIM: Record<Size, string> = { S: '1×1', M: '2×1', L: '2×2', H: '½ lebar', F: 'Penuh' }

/** Ambil data tambahan hanya untuk widget yang dipasang/dilihat. */
function useExtra(needs: Set<Need>, year: number): Extra {
  const [x, setX] = useState<Extra>({})
  const key = [...needs].sort().join(',') + '|' + year
  useEffect(() => {
    let alive = true
    const set = (k: keyof Extra, v: any) => { if (alive) setX(p => ({ ...p, [k]: v })) }
    if (needs.has('mandatory')) cachedFetch(`/api/mandatory?year=${year}`).then(r => set('mandatory', r?.data || [])).catch(() => set('mandatory', []))
    if (needs.has('golive')) cachedFetch('/api/golive').then(r => set('golive', r || {})).catch(() => set('golive', {}))
    if (needs.has('budget')) cachedFetch('/api/budget?all=1').then(r => set('budget', r?.data || [])).catch(() => set('budget', []))
    if (needs.has('cashcard')) cachedFetch(`/api/cashcard/summary?year=${year}`).then(r => set('cashcard', r?.data || null)).catch(() => set('cashcard', null))
    return () => { alive = false }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  return x
}

export function WidgetBoard({ ctx, allowed, isAdmin }: { ctx: Omit<WCtx, 'extra'>; allowed: Set<string> | null; isAdmin: boolean }) {
  const internal = ctx.internal
  const avail = useMemo(() => availableWidgets(internal ? allowed : null, internal), [allowed, internal])
  const guestAvail = useMemo(() => availableWidgets(null, false), [])
  const [saved, setSaved] = useState<{ mine: Placed[] | null; guest: Placed[] | null } | null>(null)
  const [scope, setScope] = useState<'mine' | 'guest'>('mine')
  const [editing, setEditing] = useState(false)
  const [gallery, setGallery] = useState(false)
  const [status, setStatus] = useState<'' | 'saving' | 'saved' | 'error'>('')

  useEffect(() => {
    fetch('/api/me/widgets', { cache: 'no-store' }).then(r => r.ok ? r.json() : Promise.reject()).then(j => setSaved(j.data || { mine: null, guest: null })).catch(() => setSaved({ mine: null, guest: null }))
  }, [])

  const viewGuest = !internal || scope === 'guest'
  const layout: Placed[] = useMemo(() => {
    if (!saved) return []
    return viewGuest ? normalizeLayout(saved.guest, guestAvail, DEFAULT_GUEST_LAYOUT) : normalizeLayout(saved.mine, avail, DEFAULT_LAYOUT)
  }, [saved, viewGuest, avail, guestAvail])
  const pool = viewGuest ? guestAvail : avail

  const [peekFam, setPeekFam] = useState<Fam | null>(null)
  const needs = useMemo(() => { const s = needsOf(layout); if (gallery && peekFam) for (const w of pool) if (w.fam === peekFam) (w.needs || []).forEach(n => s.add(n)); return s }, [layout, gallery, peekFam, pool])
  const extra = useExtra(needs, ctx.year)
  const full: WCtx = { ...ctx, extra }

  // Simpan otomatis (debounce) setiap perubahan saat mode edit.
  const timer = useRef<any>(null)
  function commit(next: Placed[]) {
    setSaved(s => s && (viewGuest ? { ...s, guest: next } : { ...s, mine: next }))
    setStatus('saving'); clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      const r = await fetch('/api/me/widgets', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ layout: next, scope: viewGuest ? 'guest' : 'mine' }) }).catch(() => null)
      setStatus(r?.ok ? 'saved' : 'error'); if (!r?.ok) toast.error('Susunan widget gagal disimpan')
    }, 400)
  }
  async function reset() {
    const r = await fetch(`/api/me/widgets${viewGuest ? '?scope=guest' : ''}`, { method: 'DELETE' }).catch(() => null)
    if (!r?.ok) { toast.error('Gagal mengembalikan'); return }
    setSaved(s => s && (viewGuest ? { ...s, guest: null } : { ...s, mine: null })); toast.success('Susunan bawaan dipulihkan')
  }

  // Seret & lepas (desktop). Di layar sentuh pakai tombol geser.
  const drag = useRef<string | null>(null)
  const [over, setOver] = useState<string | null>(null)

  if (!saved) return <div className="wg-grid">{[0, 1, 2, 3].map(k => <div key={k} className={`wg-skel wg-${k === 0 ? 'M' : 'S'}`} />)}</div>
  const canEdit = internal

  return (
    <section className="wg-board" aria-label="Widget dashboard">
      <div className="wg-toolbar">
        {editing ? <>
          {isAdmin && <Seg label="Susunan untuk" value={scope} onChange={setScope} options={[['mine', 'Dashboard saya'], ['guest', 'Tampilan tamu']] as const} />}
          <span className="au-xs au-muted" aria-live="polite" style={{ marginRight: 'auto' }}>{status === 'saving' ? 'Menyimpan…' : status === 'saved' ? 'Tersimpan' : status === 'error' ? 'Gagal menyimpan' : 'Ketuk − untuk hapus, ubah ukuran, atau geser urutan'}</span>
          <button type="button" className="btn btn-sm btn-ghost" onClick={reset}>Pulihkan bawaan</button>
          <button type="button" className="btn btn-sm" onClick={() => setGallery(true)}><Icon name="plus" size={14} />Widget</button>
          <button type="button" className="btn btn-sm btn-primary" onClick={() => { setEditing(false); setScope('mine') }}>Selesai</button>
        </> : <>
          <h2 className="wg-title">Widget</h2>
          {canEdit && <button type="button" className="btn btn-sm btn-ghost" style={{ marginLeft: 'auto' }} onClick={() => setEditing(true)}><Icon name="grid" size={14} />Edit widget</button>}
        </>}
      </div>

      {layout.length === 0 && !editing && <div className="wg-grid"><div className="wg-slot wg-M wg-add" role="note"><span>Belum ada widget.{canEdit ? ' Ketuk Edit widget untuk menambah.' : ''}</span></div></div>}
      {chunkLayout(layout).map((ch, ci) => (
        <div key={ci} className={`${ch.kind === 'grid' ? 'wg-grid' : 'wg-flow'}${editing ? ' editing' : ''}`}>
          {ch.items.map(({ p, i }) => {
            const def = WIDGET_BY_ID.get(p.id)!
            const classic = def.kind === 'classic'
            const inner = classic
              ? <div className="wg-classic" data-fam={def.fam}>{renderClassic(p.id)}</div>
              : <WidgetFrame id={p.id} size={p.size} preview={editing} href={def.id === 'myfocus' ? undefined : def.href} onOpen={def.id === 'myfocus' ? ctx.onMyFocus : undefined}>{renderWidget(p.id, p.size, full)}</WidgetFrame>
            if (!editing) return <div key={p.id} data-id={p.id} className={`wg-slot wg-${p.size} rise`} style={{ ['--d' as any]: Math.min(i, 8) }}><LazyMount eager={i < 4} minHeight={classic ? 280 : 0}>{inner}</LazyMount></div>
            return (
              <div key={p.id} data-id={p.id} className={`wg-slot wg-${p.size} jiggle${over === p.id ? ' over' : ''}`} draggable
                onDragStart={e => { drag.current = p.id; e.dataTransfer.effectAllowed = 'move' }} onDragEnd={() => { drag.current = null; setOver(null) }}
                onDragOver={e => { if (drag.current && drag.current !== p.id) { e.preventDefault(); setOver(p.id) } }} onDragLeave={() => setOver(o => (o === p.id ? null : o))}
                onDrop={e => { e.preventDefault(); const id = drag.current; setOver(null); if (id && id !== p.id) commit(moveWidget(layout, id, i)) }}>
                {classic ? <div className="wg-classic-edit" inert>{inner}</div> : inner}
                <button type="button" className="wg-del" aria-label={`Hapus widget ${def.title}`} onClick={() => commit(removeWidget(layout, p.id))}><span aria-hidden="true">−</span></button>
                <div className="wg-ctl">
                  <button type="button" className="wg-mv" aria-label={`Geser ${def.title} ke depan`} disabled={i === 0} onClick={() => commit(moveWidget(layout, p.id, i - 1))}><Icon name="left" size={14} /></button>
                  <button type="button" className="wg-sz" disabled={def.sizes.length < 2} aria-label={`Ukuran ${def.title}: ${SIZE_LABEL[p.size]}. Ketuk untuk ganti`} title="Ganti ukuran"
                    onClick={() => { const k = def.sizes.indexOf(p.size); commit(resizeWidget(layout, p.id, def.sizes[(k + 1) % def.sizes.length])) }}>{classic ? (p.size === 'F' ? 'Penuh' : '½') : p.size}{def.sizes.length > 1 && <Icon name="resize" size={11} stroke={2.4} />}</button>
                  <button type="button" className="wg-mv" aria-label={`Geser ${def.title} ke belakang`} disabled={i === layout.length - 1} onClick={() => commit(moveWidget(layout, p.id, i + 1))}><Icon name="right" size={14} /></button>
                </div>
              </div>
            )
          })}
        </div>
      ))}
      {editing && <div className="wg-grid"><button type="button" className="wg-slot wg-S wg-add" onClick={() => setGallery(true)}><Icon name="plus" size={26} /><span>Tambah widget</span></button></div>}

      {gallery && <Gallery pool={pool} layout={layout} ctx={full} onPeek={setPeekFam} onClose={() => { setGallery(false); setPeekFam(null) }}
        onAdd={(id, size) => { commit(addWidget(layout, id, size)); toast.success(`${WIDGET_BY_ID.get(id)!.title} (${SIZE_LABEL[size]}) ditambahkan`) }} />}
    </section>
  )
}

/** Galeri widget: pilih menu → geser pratinjau ukuran (S/M/L) dengan data asli → Tambah. */
function Gallery({ pool, layout, ctx, onAdd, onClose, onPeek }: { pool: WidgetDef[]; layout: Placed[]; ctx: WCtx; onAdd: (id: string, size: Size) => void; onClose: () => void; onPeek: (f: Fam | null) => void }) {
  const [q, setQ] = useState('')
  const [fam, setFam] = useState<Fam | null>(null)
  useEffect(() => { onPeek(fam) }, [fam]) // eslint-disable-line react-hooks/exhaustive-deps
  const fams = (Object.keys(FAMILIES) as Fam[]).filter(f => pool.some(w => w.fam === f))
  const ql = q.trim().toLowerCase()
  const list = fams.filter(f => !ql || FAMILIES[f].label.toLowerCase().includes(ql) || pool.some(w => w.fam === f && (w.title + ' ' + w.desc).toLowerCase().includes(ql)))
  return (
    <Sheet open wide title={fam ? FAMILIES[fam].label : 'Tambah widget'} onClose={onClose}>
      {!fam ? <>
        <label className="wg-search"><Icon name="search" size={16} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari widget" aria-label="Cari widget" /></label>
        <div className="wg-fams">{list.map(f => { const n = pool.filter(w => w.fam === f).length; return (
          <button key={f} type="button" className="wg-fam" data-fam={f} style={{ ['--art' as any]: `url(/widgets/${FAMILIES[f].art}.webp)` }} onClick={() => setFam(f)}>
            <span className="wg-ic"><Icon name={FAMILIES[f].icon} size={16} stroke={2.1} /></span><b>{FAMILIES[f].label}</b><span className="au-xs au-muted">{n} widget</span>
          </button>) })}</div>
        {!list.length && <span className="au-small au-muted">Tidak ada widget yang cocok.</span>}
      </> : <>
        <button type="button" className="au-link" style={{ alignSelf: 'flex-start' }} onClick={() => setFam(null)}><Icon name="left" size={14} />Semua menu</button>
        {(['native', 'classic'] as const).map(kind => {
          const ws = pool.filter(w => w.fam === fam && (w.kind || 'native') === kind)
          if (!ws.length) return null
          return <div key={kind} className="au-col" style={{ gap: 4 }}>
            <span className="au-igh">{kind === 'native' ? 'Widget · Instrument Light' : 'Infografis · Aurora v3'}</span>
            {ws.map(w => {
              const cur = layout.find(p => p.id === w.id)
              return (
                <div key={w.id} className="wg-gitem">
                  <div className="au-col" style={{ gap: 2 }}><b>{w.title}</b><span className="au-xs au-muted">{w.desc}</span></div>
                  <div className="wg-carousel" role="list" aria-label={`Ukuran ${w.title}`}>
                    {(kind === 'classic' ? [w.sizes[0]] : w.sizes).map(s => (
                      <div key={s} className="wg-gslide" role="listitem">
                        {kind === 'classic'
                          ? <div className="wg-prev-classic" inert><div className="scale">{renderClassic(w.id)}</div></div>
                          : <div className={`wg-prev wg-${s}`}><WidgetFrame id={w.id} size={s} preview>{renderWidget(w.id, s, ctx)}</WidgetFrame></div>}
                        <span className="au-xs au-muted" style={{ fontFamily: 'var(--mono)' }}>{kind === 'classic' ? w.sizes.map(z => SIZE_DIM[z]).join(' / ').toUpperCase() : `${SIZE_LABEL[s].toUpperCase()} · ${SIZE_DIM[s]}`}</span>
                        {cur && (kind === 'classic' || cur.size === s) ? <span className="wg-on"><Icon name="check" size={13} stroke={2.4} />Terpasang</span>
                          : <button type="button" className="btn btn-sm btn-primary" onClick={() => onAdd(w.id, s)}>{cur ? `Ganti ke ${SIZE_LABEL[s].toLowerCase()}` : 'Tambah'}</button>}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        })}
      </>}
    </Sheet>
  )
}
