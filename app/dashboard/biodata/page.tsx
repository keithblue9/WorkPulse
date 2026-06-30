'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import { getConfig } from '@/lib/configCache'
import { allowedMenusFor, userRolesOf } from '@/lib/perms'

// External/guest collaborators are not internal staff → excluded from biodata
const NON_STAFF_ROLES = ['external', 'guest']
function isInternalMember(u:any): boolean {
  const roles = (u?.roles && u.roles.length) ? u.roles : (u?.role ? [u.role] : [])
  return !roles.some((r:string) => NON_STAFF_ROLES.includes(String(r).toLowerCase()))
}

const BANKS = ['BCA','Mandiri','BRI','BNI','BSI','CIMB Niaga','Permata','Danamon','BTN','Mega','OCBC NISP','UOB','Bank Jago','Bank Neo Commerce','Other']

function FieldRow({ label, value, onChange, type='text', editing, sensitive=false }: { label:string; value:any; onChange:(v:any)=>void; type?:string; editing:boolean; sensitive?:boolean }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'160px 1fr', gap:12, padding:'8px 0', borderBottom:'1px solid var(--border)', alignItems:'center' }}>
      <span style={{ fontSize:11, color:'var(--text3)', fontWeight:500 }}>{label}</span>
      {editing ? (
        <input type={type} className="input" value={value||''} onChange={e=>onChange(e.target.value)} />
      ) : sensitive && value ? (
        <span className="blur-sensitive" title="Arahkan kursor untuk lihat" style={{ fontSize:12, color:'var(--text)', fontWeight:500, filter:'blur(5px)', transition:'filter .15s', cursor:'default', userSelect:'none' }}
          onMouseEnter={e=>{ (e.currentTarget as HTMLElement).style.filter='none' }} onMouseLeave={e=>{ (e.currentTarget as HTMLElement).style.filter='blur(5px)' }}>{value}</span>
      ) : (
        <span style={{ fontSize:12, color:'var(--text)', fontWeight:500 }}>{value || <span style={{ color:'var(--text3)', fontWeight:400 }}>—</span>}</span>
      )}
    </div>
  )
}

function SelectRow({ label, value, onChange, options, editing }: { label:string; value:any; onChange:(v:any)=>void; options:string[]; editing:boolean }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'160px 1fr', gap:12, padding:'8px 0', borderBottom:'1px solid var(--border)', alignItems:'center' }}>
      <span style={{ fontSize:11, color:'var(--text3)', fontWeight:500 }}>{label}</span>
      {editing ? (
        <select className="input" value={value||''} onChange={e=>onChange(e.target.value)}>
          <option value="">— Pilih —</option>
          {options.map(o=><option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <span style={{ fontSize:12, color:'var(--text)', fontWeight:500 }}>{value || <span style={{ color:'var(--text3)', fontWeight:400 }}>—</span>}</span>
      )}
    </div>
  )
}

function BiodataDetail({ user, isMine, onUpdate }: { user:any; isMine:boolean; onUpdate:()=>void }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(user)
  const [saving, setSaving] = useState(false)
  const set = (k:string,v:any) => setForm((f:any)=>({...f,[k]:v}))

  // Re-sync form whenever a different member is selected (prop change)
  useEffect(() => { setForm(user); setEditing(false) }, [user])

  async function save() {
    setSaving(true)
    try {
      // For self: use /api/profile (session-based)
      // For admin editing others: use /api/users/[id]
      const url = isMine ? '/api/profile' : `/api/users/${user._id}`
      const r = await fetch(url, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(form) })
      if (!r.ok) { toast.error('Gagal menyimpan'); return }
      toast.success('Biodata tersimpan')
      setEditing(false); onUpdate()
    } catch { toast.error('Gagal') } finally { setSaving(false) }
  }

  return (
    <div className="card" style={{ padding:'20px 24px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <div style={{ width:54, height:54, borderRadius:'50%', background:'var(--brand)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, fontWeight:700, color:'#fff' }}>{user.name?.[0]}</div>
          <div>
            <div style={{ fontSize:16, fontWeight:600, color:'var(--text)' }}>{user.name}</div>
            <div style={{ fontSize:11, color:'var(--text3)' }}>{user.role} · {user.division}</div>
          </div>
        </div>
        {isMine && (
          editing ? (
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={()=>{setEditing(false); setForm(user)}} className="btn btn-sm">Batal</button>
              <button onClick={save} disabled={saving} className="btn btn-primary btn-sm">{saving?'Menyimpan...':'Simpan'}</button>
            </div>
          ) : (
            <button onClick={()=>setEditing(true)} className="btn btn-sm">✏️ Edit Biodata</button>
          )
        )}
      </div>

      <div className="dash-2col" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24 }}>
        {/* LEFT: Personal info */}
        <div>
          <div style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8, paddingBottom:4, borderBottom:'1px solid var(--brand)' }}>Informasi Personal</div>
          <FieldRow label="Nama Lengkap" value={form.name} onChange={v=>set('name',v)} editing={editing} />
          <FieldRow label="No Pekerja" value={form.noPekerja} onChange={v=>set('noPekerja',v)} editing={editing} />
          <FieldRow label="No KTP" value={form.noKtp} onChange={v=>set('noKtp',v)} editing={editing} sensitive />
          <FieldRow label="Jabatan" value={form.jabatan} onChange={v=>set('jabatan',v)} editing={editing} />
          <FieldRow label="Tempat Lahir" value={form.birthPlace} onChange={v=>set('birthPlace',v)} editing={editing} />
          <FieldRow label="Tanggal Lahir" value={form.birthDate} onChange={v=>set('birthDate',v)} type="date" editing={editing} />
          <FieldRow label="Alamat Jakarta" value={form.alamatJakarta} onChange={v=>set('alamatJakarta',v)} editing={editing} />
          <FieldRow label="Alamat Asal" value={form.alamatAsal} onChange={v=>set('alamatAsal',v)} editing={editing} />
          <FieldRow label="No HP" value={form.phone} onChange={v=>set('phone',v)} editing={editing} />
          <FieldRow label="No HP (Link Aja)" value={form.phoneLinkAja} onChange={v=>set('phoneLinkAja',v)} editing={editing} />
        </div>

        {/* RIGHT: Bank + Emergency + Sizes */}
        <div>
          <div style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8, paddingBottom:4, borderBottom:'1px solid var(--brand)' }}>Informasi Bank</div>
          <SelectRow label="Bank" value={form.bank} onChange={v=>set('bank',v)} options={BANKS} editing={editing} />
          <FieldRow label="No Rekening" value={form.noRekening} onChange={v=>set('noRekening',v)} editing={editing} />

          <div style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8, marginTop:18, paddingBottom:4, borderBottom:'1px solid var(--brand)' }}>Kontak Darurat</div>
          <FieldRow label="Nama" value={form.kontakDaruratNama} onChange={v=>set('kontakDaruratNama',v)} editing={editing} />
          <FieldRow label="Hubungan" value={form.kontakDaruratHubungan} onChange={v=>set('kontakDaruratHubungan',v)} editing={editing} />
          <FieldRow label="No HP" value={form.kontakDaruratHp} onChange={v=>set('kontakDaruratHp',v)} editing={editing} />

          <div style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8, marginTop:18, paddingBottom:4, borderBottom:'1px solid var(--brand)' }}>Ukuran</div>
          <FieldRow label="Size Kaos" value={form.sizeKaos} onChange={v=>set('sizeKaos',v)} editing={editing} />
          <FieldRow label="Size Kemeja" value={form.sizeKemeja} onChange={v=>set('sizeKemeja',v)} editing={editing} />
          <FieldRow label="Size Jaket" value={form.sizeJaket} onChange={v=>set('sizeJaket',v)} editing={editing} />
          <FieldRow label="Size Celana" value={form.sizeCelana} onChange={v=>set('sizeCelana',v)} editing={editing} />
          <FieldRow label="Size Sepatu" value={form.sizeSepatu} onChange={v=>set('sizeSepatu',v)} editing={editing} />
        </div>
      </div>
    </div>
  )
}

export default function BiodataPage() {
  const { data:session } = useSession(); const sessUser = session?.user as any
  const [users, setUsers] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [canExport, setCanExport] = useState(false)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        const cfg = await getConfig()
        const allowed = allowedMenusFor(cfg?.roleDefs || [], userRolesOf(sessUser))
        setCanExport(allowed.has('biodata-export'))
      } catch { setCanExport(false) }
    })()
  }, [sessUser?.email])

  async function exportAllXLSX() {
    setExporting(true)
    try {
      const _xl:any = await import('exceljs'); const ExcelJS = _xl.default || _xl
      const wb = new ExcelJS.Workbook(); wb.creator = 'WinS'; wb.created = new Date()
      const box = () => ({ top:{style:'thin' as const, color:{argb:'FFE0E4EA'}}, left:{style:'thin' as const, color:{argb:'FFE0E4EA'}}, bottom:{style:'thin' as const, color:{argb:'FFE0E4EA'}}, right:{style:'thin' as const, color:{argb:'FFE0E4EA'}} })
      const roleOf = (u:any)=> (u.roles?.length ? u.roles.join(', ') : (u.role||'-'))

      // ===== Sheet Ringkasan (semua member) =====
      const sum = wb.addWorksheet('Ringkasan', { views:[{ showGridLines:false, state:'frozen', ySplit:2 }] })
      sum.columns = [{width:4},{width:24},{width:12},{width:20},{width:18},{width:20},{width:16},{width:14},{width:22}]
      sum.mergeCells('A1:I1'); const st = sum.getCell('A1'); st.value = 'MEMBER BIODATA — BPD & SS Procurement'; st.font = { bold:true, size:14, color:{argb:'FF1A3D7C'} }; st.alignment = { horizontal:'center' }
      const sh = sum.getRow(2); ['No','Nama','No Pekerja','Jabatan','No KTP','Email','No HP','Bank','No Rekening'].forEach((h,i)=>{ const c=sh.getCell(i+1); c.value=h; c.font={bold:true,color:{argb:'FFFFFFFF'}}; c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF4F8EF7'}}; c.alignment={horizontal:'center'}; c.border=box() })
      users.forEach((u,i)=>{ const r=sum.getRow(3+i); const vals=[i+1,u.name,u.noPekerja||'-',u.jabatan||'-',u.noKtp||'-',u.email||'-',u.phone||'-',u.bank||'-',u.noRekening||'-']; vals.forEach((v,j)=>{ const c=r.getCell(j+1); c.value=v as any; c.border=box(); c.alignment={ vertical:'middle', horizontal:j===0?'center':'left' }; if(j===4||j===8) c.numFmt='@' }) })

      // ===== Per member sheet =====
      const used = new Set<string>()
      const sheetName = (name:string, idx:number)=>{ let n=(name||`Member ${idx+1}`).replace(/[\\/?*[\]:]/g,' ').slice(0,28).trim()||`Member ${idx+1}`; let base=n,k=2; while(used.has(n.toLowerCase())){ n=`${base.slice(0,25)} ${k++}` } used.add(n.toLowerCase()); return n }

      const SECTIONS: { title:string; rows:[string,string][] }[] = [
        { title:'Informasi Personal', rows:[['Nama Lengkap','name'],['No Pekerja','noPekerja'],['No KTP','noKtp'],['Jabatan','jabatan'],['Email','email'],['Divisi','division'],['Role','__role'],['Tempat Lahir','birthPlace'],['Tanggal Lahir','birthDate'],['Alamat Jakarta','alamatJakarta'],['Alamat Asal','alamatAsal'],['No HP','phone'],['No HP (Link Aja)','phoneLinkAja']] },
        { title:'Informasi Bank', rows:[['Bank','bank'],['No Rekening','noRekening']] },
        { title:'Kontak Darurat', rows:[['Nama','kontakDaruratNama'],['Hubungan','kontakDaruratHubungan'],['No HP','kontakDaruratHp']] },
        { title:'Ukuran', rows:[['Size Kaos','sizeKaos'],['Size Kemeja','sizeKemeja'],['Size Jaket','sizeJaket'],['Size Celana','sizeCelana'],['Size Sepatu','sizeSepatu']] },
      ]
      users.forEach((u,idx)=>{
        const ws = wb.addWorksheet(sheetName(u.name,idx), { views:[{ showGridLines:false }] })
        ws.columns = [{width:22},{width:48}]
        ws.mergeCells('A1:B1'); const t = ws.getCell('A1'); t.value = u.name; t.font={bold:true,size:14,color:{argb:'FF1A3D7C'}}; t.alignment={horizontal:'center'}
        ws.mergeCells('A2:B2'); const t2 = ws.getCell('A2'); t2.value = `${u.jabatan||'-'} · ${u.division||roleOf(u)}`; t2.font={size:10,color:{argb:'FF667085'}}; t2.alignment={horizontal:'center'}
        let row = 4
        SECTIONS.forEach(sec=>{
          ws.mergeCells(`A${row}:B${row}`); const sc=ws.getCell(`A${row}`); sc.value=sec.title; sc.font={bold:true,size:11,color:{argb:'FFFFFFFF'}}; sc.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF4F8EF7'}}; sc.alignment={horizontal:'left',vertical:'middle'}; ws.getRow(row).height=18; row++
          sec.rows.forEach(([label,key])=>{
            const r=ws.getRow(row); const lc=r.getCell(1); lc.value=label; lc.font={bold:true,size:10,color:{argb:'FF475467'}}; lc.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF7F9FC'}}; lc.alignment={vertical:'middle'}; lc.border=box()
            const vc=r.getCell(2); vc.value = key==='__role' ? roleOf(u) : (u[key]||'-'); vc.alignment={vertical:'middle'}; vc.border=box(); if(key==='noKtp'||key==='noRekening'||key==='phone'||key==='phoneLinkAja'||key==='kontakDaruratHp') vc.numFmt='@'
            row++
          })
          row++
        })
      })

      const buf = await wb.xlsx.writeBuffer()
      const blob = new Blob([buf], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`Member_Biodata_BPD_Procurement_${new Date().toISOString().slice(0,10)}.xlsx`; a.click(); URL.revokeObjectURL(url)
      toast.success(`Excel ${users.length} member diunduh`)
    } catch (e:any) { toast.error('Gagal export: '+(e?.message||'')) } finally { setExporting(false) }
  }

  async function load() {
    setLoading(true)
    const d = await fetch('/api/users').then(r=>r.json())
    const list = (d.data||[]).filter((u:any)=>u.active!==false && isInternalMember(u))
    setUsers(list)
    // Default selection: self
    const me = list.find((u:any)=>u.email===sessUser?.email)
    if (me && !selected) setSelected(me)
    else if (selected) {
      const updated = list.find((u:any)=>u._id===selected._id)
      if (updated) setSelected(updated)
    }
    setLoading(false)
  }
  useEffect(() => { if (sessUser?.email) load() }, [sessUser?.email])

  if (loading) return <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text3)' }}>Memuat...</div>

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ padding:'12px 20px', borderBottom:'1px solid var(--border)', background:'var(--bg2)', flexShrink:0, display:'flex', justifyContent:'space-between', alignItems:'center', gap:10 }}>
        <div>
          <div style={{ fontSize:14, fontWeight:600 }}>Member Biodata</div>
          <div style={{ fontSize:11, color:'var(--text3)' }}>Data lengkap anggota tim · {users.length} member</div>
        </div>
        {canExport && <button onClick={exportAllXLSX} disabled={exporting} className="btn btn-sm btn-primary">{exporting?'...':'⬇ Export Excel'}</button>}
      </div>

      <div className="biodata-split" style={{ flex:1, display:'flex', overflow:'hidden' }}>
        {/* Left: member list */}
        <div className="biodata-list" style={{ width:240, borderRight:'1px solid var(--border)', overflowY:'auto', background:'var(--bg2)', padding:8, flexShrink:0 }}>
          {users.map(u => {
            const isSelected = selected?._id === u._id
            return (
              <div key={u._id} onClick={()=>setSelected(u)} style={{ padding:'9px 11px', borderRadius:7, cursor:'pointer', marginBottom:3, display:'flex', alignItems:'center', gap:9, background:isSelected?'var(--brand-soft)':'transparent' }}
                onMouseEnter={e=>{if(!isSelected)(e.currentTarget as HTMLElement).style.background='var(--bg3)'}}
                onMouseLeave={e=>{if(!isSelected)(e.currentTarget as HTMLElement).style.background='transparent'}}>
                <div style={{ width:28, height:28, borderRadius:'50%', background:'var(--brand)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'#fff' }}>{u.name[0]}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:500, color:isSelected?'var(--brand)':'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{u.name}</div>
                  <div style={{ fontSize:10, color:'var(--text3)' }}>{u.division || u.role}</div>
                </div>
                {u.email === sessUser?.email && <span style={{ fontSize:9, color:'var(--brand)', fontWeight:600 }}>SAYA</span>}
              </div>
            )
          })}
        </div>

        {/* Right: biodata detail */}
        <div style={{ flex:1, overflowY:'auto', padding:20 }} className="safe-bottom page-pad">
          {selected ? (
            <BiodataDetail key={selected._id} user={selected} isMine={selected.email === sessUser?.email} onUpdate={load} />
          ) : (
            <div style={{ textAlign:'center', padding:40, color:'var(--text3)' }}>Pilih member</div>
          )}
        </div>
      </div>
    </div>
  )
}
