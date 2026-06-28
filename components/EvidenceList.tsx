'use client'
import React, { useState } from 'react'

function parseMime(url:string){ const m=/^data:([^;]+)/.exec(url||''); return m?m[1]:'' }
function isImg(d:any){ const t=(d.type||parseMime(d.url)||'').toLowerCase(); return t.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(d.name||'') }
function isPdf(d:any){ const t=(d.type||parseMime(d.url)||'').toLowerCase(); return t.includes('pdf') || /\.pdf$/i.test(d.name||'') }

export function EvidenceList({ documents, zipName='evidence' }:{ documents:any[]; zipName?:string }) {
  const [preview, setPreview] = useState<any>(null)
  const docs = Array.isArray(documents) ? documents : []

  async function downloadAll() {
    if (docs.length === 0) return
    try {
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()
      docs.forEach((d:any, i:number) => {
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

  if (docs.length === 0) return <div style={{ fontSize:11, color:'var(--red)' }}>Belum ada evidence diupload.</div>

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5 }}>
        <span style={{ fontSize:11, color:'var(--text3)' }}>Evidence ({docs.length} file) — klik untuk preview</span>
        <button onClick={downloadAll} className="btn btn-sm" style={{ fontSize:10 }}>⬇ Download semua</button>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
        {docs.map((d:any, i:number) => (
          <button key={i} onClick={()=>setPreview(d)} className="btn btn-sm" style={{ justifyContent:'flex-start', fontSize:11, textAlign:'left' }}>
            {isImg(d)?'🖼':isPdf(d)?'📄':'📎'} {d.name || `evidence_${i+1}`}
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
