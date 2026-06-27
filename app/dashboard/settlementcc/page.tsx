'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
// Settlement CC kini jadi tab di dalam Operasional (slide 1 & 4).
export default function SettlementCCRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/dashboard/operasional') }, [router])
  return <div style={{ padding:40, textAlign:'center', color:'var(--text3)' }}>Mengalihkan ke Operasional…</div>
}
