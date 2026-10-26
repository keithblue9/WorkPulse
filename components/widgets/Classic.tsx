'use client'
// Infografis Aurora v3 sebagai widget (komponen lengkap & interaktif). Dimuat terpisah (code split)
// sehingga hanya diunduh bila widgetnya dipasang/dilihat di galeri.
import dynamic from 'next/dynamic'

const skel = () => <section className="au-card" aria-hidden="true"><div className="au-skel" style={{ width: '40%' }} /><div className="au-skel" /><div className="au-skel" style={{ width: '70%' }} /></section>
const TeamAvailability = dynamic(() => import('@/components/TeamAvailability'), { ssr: false, loading: skel })
const BudgetInsights = dynamic(() => import('@/components/BudgetInsights'), { ssr: false, loading: skel })
const MandatoryInsights = dynamic(() => import('@/components/MandatoryInsights'), { ssr: false, loading: skel })
const GoLiveInsights = dynamic(() => import('@/components/GoLiveInsights'), { ssr: false, loading: skel })

export function renderClassic(id: string): React.ReactNode {
  switch (id) {
    case 'v3-team': return <TeamAvailability />
    case 'v3-budget-yield': return <BudgetInsights section="yield" />
    case 'v3-budget-realpct': return <BudgetInsights section="realpct" />
    case 'v3-budget-prognosa': return <BudgetInsights section="prognosa" />
    case 'v3-cashcard': return <BudgetInsights section="cashcard" />
    case 'v3-mcu': return <MandatoryInsights section="mcu" />
    case 'v3-training': return <MandatoryInsights section="training" />
    case 'v3-kpi': return <MandatoryInsights section="kpi" />
    case 'v3-golive': return <GoLiveInsights />
  }
  return null
}
