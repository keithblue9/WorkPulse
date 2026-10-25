'use client'
import React, { useEffect, useState } from 'react'
import { Icon, Portal } from '@/components/ui'

function parseMime(url:string){ const m=/^data:([^;]+)/.exec(url||''); return m?m[1]:'' }
function isImg(d:any){ const t=(d.type||parseMime(d.url)||'').toLowerCase(); return t.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(d.name||'') }
function isPdf(d:any){ const t=(d.type||parseMime(d.url)||'').toLowerCase(); return t.includes('pdf') || /\.pdf$/i.test(d.name||'') }
// Label kategori bukti (khusus Cash Card). 'bukti'/kosong = dokumen umum -> tanpa label.
const SLOT_LABELS: Record<string,string> = { calmeet:'Calmeet', invoice:'Invoice', dokumentasi:'Dokumentasi', buktitf:'Bukti TF' }
function slotLabel(slot?:string){ return SLOT_LABELS[String(slot||'')] || '' }

export function EvidenceList({ documents, zipName='evidence', itemId }:{ documents:any[]; zipName?:string; itemId?:string }) {
  const [preview, setPreview] = useState<any>(null)
  const [full, setFull] = useState<any[]|null>(null)
  const [busy, setBusy] = useState(false)
  const metaDocs = Array.isArray(documents) ? documents : []
  const docs = full || metaDocs

  // Daftar dikirim tanpa isi file (documents.url) supaya ringan.
  // Isi file baru diambil saat benar-benar dibutuhkan (preview / download).
  async function ensureLoaded(): Promise<any[]> {
    if (full) return full
    if (metaDocs.every(d => !!d?.url)) { setFull(metaDocs); return metaDocs }
    if (!itemId) return metaDocs
    setBusy(true)
    try {
      const { fetchFullReimbursement } = await import('@/lib/reimbursementDetail')
      const item = await fetchFullReimbursement(itemId)
      const loaded = Array.isArray(item?.documents) && item.documents.length ? item.documents : metaDocs
      setFull(loaded)
      return loaded
    } finally { setBusy(false) }
  }

  async function openPreview(idx:number) {
    const loaded = await ensureLoaded()
    setPreview(loaded[idx] || metaDocs[idx])
  }

  async function downloadAll() {
    if (metaDocs.length === 0) return
    const loaded = await ensureLoaded()
    try {
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()
      loaded.forEach((d:any, i:number) => {
        const m = /^data:([^;]+);base64,([\s\S]*)$/.exec(d.url || '')
        const name = (d.name || `evidence_${i+1}`).replace(/[\\/:*?"<>|]+/g, '_')
        if (m) zip.file(name, m[2], { base64:true })
        else if (d.url) zip.file(name + '.txt', d.url)
      })
      const blob = await zip.generateAsync({ type:'blob' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `${zipName}.zip`
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(()=>URL.revokeObjectURL(url), 2000)
    } catch {}
  }

  if (metaDocs.length === 0) return <div className="au-xs" style={{ color: 'var(--bad)', fontWeight: 600 }}>Belum ada evidence diupload.</div>

  return (
    <div className="au-col" style={{ gap: 8 }}>
      <div className="au-row au-between" style={{ gap: 8 }}>
        <span className="lbl">Evidence · {metaDocs.length} file</span>
        <button type="button" onClick={downloadAll} disabled={busy} className="btn btn-sm"><Icon name="down" size={14} />{busy ? 'Memuat…' : 'Unduh semua'}</button>
      </div>
      <div className="au-ig">
        {metaDocs.map((d:any, i:number) => (
          <button type="button" key={i} onClick={()=>openPreview(i)} disabled={busy} className="au-igr" style={{ minHeight: 46, padding: '8px 14px' }} aria-label={`Lihat ${d.name || `evidence ${i+1}`}`}>
            <span className="au-evic"><Icon name={isImg(d) ? 'eye' : 'file'} size={15} /></span>
            {slotLabel(d.slot) && <span className="au-tag" style={{ flexShrink:0 }}>{slotLabel(d.slot)}</span>}
            <span className="au-small" style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex: 1, minWidth: 0 }}>{d.name || `evidence_${i+1}`}</span>
            <span className="au-xs au-muted">{busy ? 'memuat…' : isPdf(d) ? 'PDF' : isImg(d) ? 'Gambar' : ''}</span>
          </button>
        ))}
      </div>
      {preview && <PreviewModal doc={preview} onClose={()=>setPreview(null)} />}
    </div>
  )
}

function PreviewModal({ doc, onClose }:{ doc:any; onClose:()=>void }) {
  useEffect(() => {
    // Esc hanya menutup pratinjau (sheet di bawahnya tetap terbuka).
    const onKey = (e:KeyboardEvent) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); onClose() } }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])
  return (
    <Portal>
    <div className="modal-overlay" style={{ zIndex:2000 }} onMouseDown={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={doc.name || 'Evidence'} style={{ width:'min(920px,94vw)', height:'88vh', display:'flex', flexDirection:'column' }}>
        <div className="au-sheet-h">
          <button type="button" className="au-link" onClick={onClose}>Tutup</button>
          <h2 style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{doc.name || 'Evidence'}</h2>
          <a href={doc.url} download={doc.name} className="au-link" style={{ textDecoration:'none', fontWeight:800 }}>Unduh</a>
        </div>
        <div style={{ flex:1, overflow:'auto', background:'var(--sunken)', display:'flex', alignItems:'center', justifyContent:'center' }}>
          {isImg(doc) ? <img src={doc.url} alt={doc.name} style={{ maxWidth:'100%', maxHeight:'100%', objectFit:'contain' }} />
           : isPdf(doc) ? <iframe src={doc.url} title={doc.name} style={{ width:'100%', height:'100%', border:'none' }} />
           : <div className="au-col au-small au-ink2" style={{ padding:30, alignItems:'center', gap:12 }}>Pratinjau tidak tersedia untuk tipe file ini.<a href={doc.url} download={doc.name} className="btn btn-sm" style={{ textDecoration:'none' }}><Icon name="down" size={14} />Unduh</a></div>}
        </div>
      </div>
    </div>
    </Portal>
  )
}
