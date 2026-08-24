'use client'
import React, { useState } from 'react'

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

  if (metaDocs.length === 0) return <div style={{ fontSize:11, color:'var(--red)' }}>Belum ada evidence diupload.</div>

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5 }}>
        <span style={{ fontSize:11, color:'var(--text3)' }}>Evidence ({metaDocs.length} file) — klik untuk preview</span>
        <button onClick={downloadAll} disabled={busy} className="btn btn-sm" style={{ fontSize:10 }}>{busy?'Memuat…':'⬇ Download semua'}</button>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
        {metaDocs.map((d:any, i:number) => (
          <button key={i} onClick={()=>openPreview(i)} disabled={busy} className="btn btn-sm" style={{ justifyContent:'flex-start', fontSize:11, textAlign:'left', gap:6 }}>
            {isImg(d)?'🖼':isPdf(d)?'📄':'📎'}
            {slotLabel(d.slot) && <span style={{ fontSize:9, fontWeight:700, padding:'1px 6px', borderRadius:4, background:'var(--brand-soft)', color:'var(--brand)', flexShrink:0 }}>{slotLabel(d.slot)}</span>}
            <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.name || `evidence_${i+1}`}</span>
            {busy && <span style={{ fontSize:9, color:'var(--text3)', marginLeft:'auto' }}>memuat…</span>}
          </button>
        ))}
      </div>
      {preview && <PreviewModal doc={preview} onClose={()=>setPreview(null)} />}
    </div>
  )
}

function PreviewModal({ doc, onClose }:{ doc:any; onClose:()=>void }) {
  return (
    <div className="modal-overlay" style={{ zIndex:2000 }} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ width:'min(920px,94vw)', height:'88vh', display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:13, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{doc.name || 'Evidence'}</span>
          <div style={{ display:'flex', gap:8, flexShrink:0 }}>
            <a href={doc.url} download={doc.name} className="btn btn-sm" style={{ textDecoration:'none' }}>⬇ Download</a>
            <button onClick={onClose} className="btn btn-icon">×</button>
          </div>
        </div>
        <div style={{ flex:1, overflow:'auto', background:'var(--bg3)', display:'flex', alignItems:'center', justifyContent:'center' }}>
          {isImg(doc) ? <img src={doc.url} alt={doc.name} style={{ maxWidth:'100%', maxHeight:'100%', objectFit:'contain' }} />
           : isPdf(doc) ? <iframe src={doc.url} title={doc.name} style={{ width:'100%', height:'100%', border:'none' }} />
           : <div style={{ padding:30, textAlign:'center', fontSize:12, color:'var(--text2)' }}>Preview tidak tersedia untuk tipe file ini.<br/><a href={doc.url} download={doc.name} className="btn btn-sm" style={{ marginTop:10, textDecoration:'none' }}>⬇ Download</a></div>}
        </div>
      </div>
    </div>
  )
}
