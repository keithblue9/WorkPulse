'use client'
import { useEffect } from 'react'

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('Dashboard page error:', error) }, [error])
  return (
    <div style={{ minHeight:'60vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:14, padding:24, textAlign:'center' }}>
      <div style={{ fontSize:40 }}>⚠️</div>
      <div style={{ fontSize:18, fontWeight:700, color:'var(--text)' }}>Ada kendala memuat halaman ini</div>
      <div style={{ fontSize:13, color:'var(--text3)', maxWidth:360 }}>
        Coba muat ulang. Kalau masih bermasalah, kembali ke Dashboard.
      </div>
      <div style={{ display:'flex', gap:8, marginTop:6 }}>
        <button onClick={()=>reset()} className="btn btn-primary btn-sm">🔄 Coba Lagi</button>
        <button onClick={()=>{ window.location.href='/dashboard' }} className="btn btn-sm">← Dashboard</button>
      </div>
    </div>
  )
}
