'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
// Settlement CC kini jadi tab di dalam Operasional (slide 1 & 4).
export default function SettlementCCRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/dashboard/operasional') }, [router])
  return <div className="au-page"><div className="au-view au-muted au-small" style={{ alignItems:'center', paddingTop:40 }}>Mengalihkan ke Operasional…</div></div>
}
