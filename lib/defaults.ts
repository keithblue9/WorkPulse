// Shared default values used as fallback when config in DB is missing fields.
// These match the Mongoose schema defaults in models/Config.ts

export const ALL_MENU_KEYS = ['dashboard','activities','calendar','issues','progress','attendance','biodata','links','meetings','notes','budget','reimbursement','cashcard','cashier','members','config']

export const MENU_LABELS: Record<string,string> = {
  dashboard:'Dashboard', activities:'Activities', calendar:'Calendar', issues:'Issues', progress:'Progress',
  attendance:'Presensi', biodata:'Biodata', links:'Link Hub', meetings:'Meeting Reports', notes:'Notes',
  budget:'Anggaran', reimbursement:'Reimbursement', cashcard:'Cash Card', cashier:'Cashier',
  members:'Member', config:'Configuration'
}

export const DEFAULT_ROLES = [
  { key:'admin',   label:'Admin',   builtin:true,  allowedMenus:[...ALL_MENU_KEYS] },
  { key:'manager', label:'Manager', builtin:true,  allowedMenus:ALL_MENU_KEYS.filter(m=>m!=='config') },
  { key:'member',  label:'Member',  builtin:true,  allowedMenus:['dashboard','activities','calendar','issues','progress','attendance','biodata','links','meetings','notes','reimbursement'] },
  { key:'finance', label:'Finance', builtin:true,  allowedMenus:['dashboard','attendance','biodata','links','budget','reimbursement','cashcard','cashier'] },
  { key:'cashier', label:'Cashier', builtin:true,  allowedMenus:['dashboard','reimbursement','cashier','cashcard','biodata'] },
  { key:'guest',   label:'Guest',   builtin:true,  allowedMenus:['dashboard','links'] },
]

export const DEFAULT_WIDGETS = [
  { key:'stat-kpi',           label:'Stat: KPI',           segment:'stats', active:true, order:1 },
  { key:'stat-nonkpi',        label:'Stat: Non KPI',       segment:'stats', active:true, order:2 },
  { key:'stat-golive',        label:'Stat: Go Live',       segment:'stats', active:true, order:3 },
  { key:'stat-anggaran',      label:'Stat: Anggaran',      segment:'stats', active:true, order:4 },
  { key:'stat-others',        label:'Stat: Others',        segment:'stats', active:true, order:5 },
  { key:'stat-highpriority',  label:'Stat: High Priority', segment:'stats', active:true, order:6 },
  { key:'progress-chart',     label:'Chart Progress (donut)', segment:'main', active:true, order:1 },
  { key:'ai-quotes',          label:'AI Quotes (daily)',   segment:'ai',    active:true, order:1 },
  { key:'ai-insight-personal',label:'AI Insight Personal', segment:'ai',    active:true, order:2 },
  { key:'ai-insight-team',    label:'AI Insight Team',     segment:'ai',    active:true, order:3 },
  { key:'top-contributors',   label:'Top Contributors',    segment:'main',  active:true, order:2 },
  { key:'upcoming-agenda',    label:'Agenda Mendatang',    segment:'main',  active:true, order:3 },
  { key:'issue-distribution', label:'Issue Distribution',  segment:'main',  active:true, order:4 },
  { key:'member-count',       label:'Member Count Card',   segment:'main',  active:false, order:5 },
]

export const DEFAULT_LINK_CATEGORIES = [
  { key:'doc',     label:'Document',    color:'#4f8ef7', active:true },
  { key:'system',  label:'System Tool', color:'#8b7adc', active:true },
  { key:'sop',     label:'SOP',         color:'#56a47a', active:true },
  { key:'others',  label:'Others',      color:'#9aa6b3', active:true },
]

export const DEFAULT_FONNTE = {
  apiUrl: 'https://api.fonnte.com/send',
  cashierUserId: '',
  messageToCashier: '🔔 Reimbursement Baru\n\nDari: {memberName}\nKeperluan: {purpose}\nNominal: {amount}\nKategori: {category}\n\nMohon segera diproses di menu Cashier.',
  messageToMember: '✅ Reimbursement Disetujui\n\nHi {memberName}, pengajuan reimburse "{purpose}" senilai {amount} telah ditransfer ke:\n\n🏦 {bank}\n💳 {noRekening}\n\nTerima kasih.',
}

// Coerce pic field: legacy data might have it as String, new schema is String[]
export function picArray(p: any): string[] {
  if (!p) return []
  if (Array.isArray(p)) return p.filter(Boolean)
  if (typeof p === 'string') return p ? [p] : []
  return []
}


// ─── Initiative progress calculation (week-level) ───
// planPct per phase = (phase plan weeks / total plan weeks across all phases) × 100
// actualPct per phase = (phase actual weeks / phase plan weeks) × phase planPct
// total planProgress = sum(planPct) ; total actualProgress = sum(actualPct)
export function calcInitiativeProgress(phases: any[]) {
  const planWeeksArr = phases.map(p => (p.planCells || []).length)
  const totalPlanWeeks = planWeeksArr.reduce((a, b) => a + b, 0)
  const result = phases.map((p, i) => {
    const planWeeks = planWeeksArr[i]
    const actualWeeks = (p.actualCells || []).length
    const planPct = totalPlanWeeks > 0 ? (planWeeks / totalPlanWeeks) * 100 : 0
    const actualPct = planWeeks > 0 ? (actualWeeks / planWeeks) * planPct : 0
    return { ...p, planPct, actualPct, _planWeeks: planWeeks, _actualWeeks: actualWeeks }
  })
  const planProgress = result.reduce((a, b) => a + b.planPct, 0)
  const actualProgress = result.reduce((a, b) => a + b.actualPct, 0)
  return { phases: result, planProgress, actualProgress }
}
