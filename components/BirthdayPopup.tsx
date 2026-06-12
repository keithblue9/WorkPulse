'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { format } from 'date-fns'

export default function BirthdayPopup() {
  const { data:session } = useSession()
  const [show, setShow] = useState(false)
  const [birthdays, setBirthdays] = useState<any[]>([])
  const [pantun, setPantun] = useState('')
  const [generating, setGenerating] = useState(false)
  const [currentIdx, setCurrentIdx] = useState(0)

  useEffect(() => {
    if (!session) return
    const today = format(new Date(), 'yyyy-MM-dd')
    const seenKey = `bday-seen-${today}`
    if (localStorage.getItem(seenKey)) return
    fetch('/api/birthdays').then(r=>r.json()).then(d => {
      if (d.data && d.data.length > 0) {
        setBirthdays(d.data); setShow(true); generatePantun(d.data[0])
      }
    }).catch(()=>{})
  }, [session])

  async function generatePantun(person:any) {
    if (!person) return
    setGenerating(true); setPantun('')
    try {
      const r = await fetch('/api/ai-insight', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ type:'birthday', birthdayName: person.name, age: person.age }) })
      const d = await r.json()
      setPantun(d.data?.insight || d.error || '🎂 Selamat ulang tahun! Semoga panjang umur, sehat selalu, dan rezeki melimpah.')
    } catch { setPantun('🎂 Selamat ulang tahun! Semoga panjang umur, sehat selalu, dan rezeki melimpah.') }
    finally { setGenerating(false) }
  }

  function close() {
    setShow(false)
    localStorage.setItem(`bday-seen-${format(new Date(),'yyyy-MM-dd')}`, '1')
  }

  function nextPerson() {
    const next = (currentIdx + 1) % birthdays.length
    setCurrentIdx(next); generatePantun(birthdays[next])
  }

  if (!show || !birthdays[currentIdx]) return null
  const p = birthdays[currentIdx]

  return (
    <div className="modal-overlay" style={{ zIndex:1000 }} onClick={e=>e.target===e.currentTarget&&close()}>
      <div className="glass-strong scale-in" style={{ width:460, maxWidth:'92vw', borderRadius:20, padding:0, overflow:'hidden', position:'relative' }}>
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(135deg, var(--brand) 0%, var(--purple) 100%)', opacity:0.18, pointerEvents:'none' }} />
        <div className="ambient-bg">
          <div className="orb" style={{ width:240, height:240, top:'-30%', left:'-15%', opacity:0.35 }} />
          <div className="orb" style={{ width:180, height:180, bottom:'-25%', right:'-10%', animationDelay:'-7s', opacity:0.35, background:'var(--purple)' }} />
        </div>
        <div style={{ position:'relative', padding:28, textAlign:'center' }}>
          <div style={{ fontSize:48, marginBottom:8 }}>🎂🎉🎈</div>
          <div style={{ fontSize:11, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.12em', fontWeight:600 }}>Hari Ini Ulang Tahun</div>
          <div style={{ width:78, height:78, borderRadius:'50%', background:'var(--brand)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:32, fontWeight:800, color:'#fff', margin:'14px auto 6px', boxShadow:'0 8px 24px var(--brand-soft)' }}>{p.name[0]}</div>
          <div className="gradient-text" style={{ fontSize:24, fontWeight:800, letterSpacing:'-0.02em' }}>{p.name}</div>
          {p.jabatan && <div style={{ fontSize:11, color:'var(--text3)', marginTop:3 }}>{p.jabatan}{p.division ? ' · ' + p.division : ''}</div>}
          {p.age > 0 && <div style={{ fontSize:11, color:'var(--text2)', marginTop:3 }}>Genap <b>{p.age}</b> tahun 🥳</div>}
          <div className="glass" style={{ marginTop:16, padding:'14px 16px', borderRadius:14, textAlign:'left' }}>
            <div style={{ fontSize:9, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.1em', fontWeight:600, marginBottom:8 }}>🎭 Pantun untuk {p.name}</div>
            {generating ? (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:'14px 0', color:'var(--text3)', fontSize:11 }}>
                <span className="spin" style={{ width:14, height:14, border:'2px solid var(--border2)', borderTopColor:'var(--brand)', borderRadius:'50%', marginRight:8 }} />
                AI lagi bikin pantun...
              </div>
            ) : (
              <div style={{ fontSize:12.5, lineHeight:1.85, color:'var(--text)', whiteSpace:'pre-wrap', fontStyle:'italic' }}>{pantun}</div>
            )}
            <button onClick={()=>generatePantun(p)} disabled={generating} className="btn btn-sm" style={{ marginTop:10, fontSize:10 }}>↻ Pantun baru</button>
          </div>
          <div style={{ display:'flex', gap:8, marginTop:16, justifyContent:'center' }}>
            {birthdays.length > 1 && (
              <button onClick={nextPerson} className="btn btn-sm">→ Next ({currentIdx+1}/{birthdays.length})</button>
            )}
            <button onClick={close} className="btn btn-primary btn-sm">🎉 Tutup</button>
          </div>
        </div>
      </div>
    </div>
  )
}
