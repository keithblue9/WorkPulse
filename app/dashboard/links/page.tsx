'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'

const DEFAULT_CATS = ['General','Files','Tools','References','Reports','Social','Other']

function LinkForm({ onClose, onSave, editing }: { onClose:()=>void; onSave:()=>void; editing?:any }) {
  const { data:session } = useSession(); const user = session?.user as any
  const [form, setForm] = useState({ title:editing?.title||'', url:editing?.url||'', description:editing?.description||'', category:editing?.category||'General', pinned:editing?.pinned||false })
  const [saving, setSaving] = useState(false)
  const set = (k:string,v:any) => setForm(f=>({...f,[k]:v}))

  function getIcon(url: string) {
    if (url.includes('drive.google')) return '📁'
    if (url.includes('docs.google')) return '📄'
    if (url.includes('sheets.google')) return '📊'
    if (url.includes('slides.google')) return '📊'
    if (url.includes('notion')) return '📓'
    if (url.includes('figma')) return '🎨'
    if (url.includes('github')) return '💻'
    if (url.includes('teams') || url.includes('microsoft')) return '💼'
    if (url.includes('zoom')) return '🔵'
    if (url.includes('youtube')) return '▶️'
    if (url.includes('slack')) return '💬'
    return '🔗'
  }

  async function save() {
    if (!form.title || !form.url) { toast.error('Judul dan URL wajib'); return }
    if (!form.url.startsWith('http')) { toast.error('URL harus dimulai dengan http/https'); return }
    setSaving(true)
    try {
      const url = editing ? `/api/links/${editing._id}` : '/api/links'
      await fetch(url, { method: editing?'PATCH':'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ ...form, icon: getIcon(form.url), addedBy: user?.name }) })
      toast.success(editing ? 'Link diperbarui!' : 'Link ditambahkan!'); onSave(); onClose()
    } catch { toast.error('Gagal') } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ width:480 }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between' }}>
          <span style={{ fontSize:14, fontWeight:600 }}>{editing ? 'Edit Link' : '+ Tambah Link'}</span>
          <button onClick={onClose} className="btn btn-icon">×</button>
        </div>
        <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:12 }}>
          <div><label style={lbl}>Judul *</label><input className="input" value={form.title} onChange={e=>set('title',e.target.value)} placeholder="Nama link..." /></div>
          <div><label style={lbl}>URL *</label><input className="input" value={form.url} onChange={e=>set('url',e.target.value)} placeholder="https://..." /></div>
          <div><label style={lbl}>Deskripsi</label><input className="input" value={form.description} onChange={e=>set('description',e.target.value)} placeholder="Deskripsi singkat..." /></div>
          <div><label style={lbl}>Kategori</label>
            <select className="input" value={form.category} onChange={e=>set('category',e.target.value)}>
              {DEFAULT_CATS.map(c => <option key={c} value={c}>{c}</option>)}
            </select></div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div className={`toggle-wrap${form.pinned?' on':''}`} onClick={() => set('pinned',!form.pinned)} />
            <span style={{ fontSize:12, color:'var(--text2)' }}>Pin di atas</span>
          </div>
          {form.url && form.url.startsWith('http') && (
            <div style={{ padding:'8px 12px', background:'var(--bg3)', borderRadius:7, fontSize:12, color:'var(--text2)', display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:18 }}>{['📁','📄','📊','📓','🎨','💻','💼','🔵','▶️','💬','🔗'].includes('🔗') ? '🔗' : '🔗'}</span>
              <span>{form.title || 'Preview link'}</span>
            </div>
          )}
        </div>
        <div style={{ padding:'12px 20px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'flex-end', gap:8 }}>
          <button onClick={onClose} className="btn">Batal</button>
          <button onClick={save} disabled={saving} className="btn btn-primary">{saving ? 'Menyimpan...' : editing ? 'Simpan' : 'Tambah Link'}</button>
        </div>
      </div>
    </div>
  )
}

export default function LinksPage() {
  const { data:session } = useSession(); const user = session?.user as any
  const [links, setLinks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('Semua')

  async function load() { const d = await fetch('/api/links').then(r=>r.json()); setLinks(d.data||[]); setLoading(false) }
  useEffect(() => { load() }, [])

  async function del(id: string) {
    if (!confirm('Hapus link ini?')) return
    await fetch(`/api/links/${id}`, { method:'DELETE' })
    toast.success('Link dihapus'); load()
  }

  async function togglePin(link: any) {
    await fetch(`/api/links/${link._id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ pinned: !link.pinned }) })
    load()
  }

  async function trackClick(link: any) {
    await fetch(`/api/links/${link._id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ clickCount: (link.clickCount||0)+1 }) })
    window.open(link.url, '_blank')
  }

  const categories = ['Semua', ...Array.from(new Set(links.map(l => l.category||'General')))]
  const filtered = links.filter(l => {
    const matchSearch = !search || l.title.toLowerCase().includes(search.toLowerCase()) || l.description?.toLowerCase().includes(search.toLowerCase())
    const matchCat = activeCategory === 'Semua' || l.category === activeCategory
    return matchSearch && matchCat
  })

  const canManage = ['admin','manager'].includes(user?.role||'')

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {(showForm||editing) && <LinkForm onClose={()=>{setShowForm(false);setEditing(null)}} onSave={load} editing={editing} />}

      <div style={{ padding:'12px 20px', borderBottom:'1px solid var(--border)', background:'var(--bg2)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div><div style={{ fontSize:14, fontWeight:600 }}>Link Hub</div><div style={{ fontSize:11, color:'var(--text3)' }}>Koleksi link tim — files, tools, referensi</div></div>
        <button className="btn btn-primary btn-sm" onClick={()=>setShowForm(true)}>+ Tambah Link</button>
      </div>

      <div style={{ padding:'10px 20px', borderBottom:'1px solid var(--border)', background:'var(--bg2)', display:'flex', gap:8, alignItems:'center', flexShrink:0, flexWrap:'wrap' }}>
        <input className="input" style={{ width:200 }} value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Cari link..." />
        <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
          {categories.map(cat => (
            <button key={cat} onClick={()=>setActiveCategory(cat)} style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:500, cursor:'pointer', border:`1px solid ${activeCategory===cat?'var(--blue)':'var(--border)'}`, background: activeCategory===cat?'var(--bluebg)':'var(--bg3)', color: activeCategory===cat?'var(--blue)':'var(--text2)' }}>{cat}</button>
          ))}
        </div>
        <div style={{ marginLeft:'auto', fontSize:12, color:'var(--text3)' }}>{filtered.length} link</div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'16px 20px' }}>
        {loading ? <div style={{ textAlign:'center', padding:40, color:'var(--text3)' }}>Memuat...</div> : (
          filtered.length === 0 ? (
            <div style={{ textAlign:'center', padding:60, color:'var(--text3)' }}>
              <div style={{ fontSize:32, marginBottom:12 }}>🔗</div>
              <div>Belum ada link. Tambahkan link pertama tim lo!</div>
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:10 }}>
              {filtered.map((link, i) => (
                <div key={link._id} className="card fade-in" style={{ padding:'14px 16px', cursor:'pointer', transition:'all 0.15s', animationDelay:`${i*0.04}s`, position:'relative' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor='var(--blue)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor='var(--border)'}>
                  {link.pinned && <span style={{ position:'absolute', top:10, right:10, fontSize:11 }}>📌</span>}
                  <div style={{ display:'flex', alignItems:'flex-start', gap:10, marginBottom:8 }}>
                    <span style={{ fontSize:22, flexShrink:0 }}>{link.icon || '🔗'}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:'var(--text)', marginBottom:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{link.title}</div>
                      <div style={{ fontSize:10, color:'var(--text3)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{link.url}</div>
                    </div>
                  </div>
                  {link.description && <div style={{ fontSize:11, color:'var(--text2)', marginBottom:8, lineHeight:1.4 }}>{link.description}</div>}
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div style={{ display:'flex', gap:4 }}>
                      <span style={{ padding:'2px 8px', borderRadius:20, fontSize:10, background:'var(--bg4)', color:'var(--text3)' }}>{link.category}</span>
                      {link.clickCount > 0 && <span style={{ padding:'2px 8px', borderRadius:20, fontSize:10, background:'var(--bg4)', color:'var(--text3)' }}>👆 {link.clickCount}</span>}
                    </div>
                    <div style={{ display:'flex', gap:4 }}>
                      {canManage && <>
                        <button className="btn btn-icon btn-sm" onClick={e=>{e.stopPropagation();togglePin(link)}} style={{ fontSize:11 }}>📌</button>
                        <button className="btn btn-icon btn-sm" onClick={e=>{e.stopPropagation();setEditing(link)}} style={{ fontSize:11 }}>✏️</button>
                        <button className="btn btn-icon btn-sm" onClick={e=>{e.stopPropagation();del(link._id)}} style={{ fontSize:11 }}>🗑</button>
                      </>}
                      <button className="btn btn-sm btn-primary" onClick={()=>trackClick(link)} style={{ fontSize:11 }}>Buka →</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  )
}
const lbl: React.CSSProperties = { display:'block', fontSize:11, fontWeight:500, color:'var(--text2)', marginBottom:5 }
