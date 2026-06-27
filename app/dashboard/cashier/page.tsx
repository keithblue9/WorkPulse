'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
// Menu Cashier kini jadi tab di dalam Reimbursement (slide 1 & 3).
export default function CashierRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/dashboard/reimbursements') }, [router])
  return <div style={{ padding:40, textAlign:'center', color:'var(--text3)' }}>Mengalihkan ke Reimbursement…</div>
}
