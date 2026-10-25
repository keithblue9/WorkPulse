'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
// Menu Cashier kini jadi tab di dalam Reimbursement (slide 1 & 3).
export default function CashierRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/dashboard/reimbursements?tab=cashier') }, [router])
  return <div className="au-page"><div className="au-view au-muted au-small" style={{ alignItems:'center', paddingTop:40 }}>Mengalihkan ke Reimbursement…</div></div>
}
