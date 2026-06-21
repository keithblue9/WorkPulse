// Shared default values used as fallback when config in DB is missing fields.
// These match the Mongoose schema defaults in models/Config.ts

export const ALL_MENU_KEYS = ['dashboard','activities','calendar','issues','progress','attendance','biodata','links','meetings','notes','quicknotes','budget','reimbursement','cashcard','cashier','settlementcc','members','config']

export const MENU_LABELS: Record<string,string> = {
  dashboard:'Dashboard', activities:'Activities', calendar:'Calendar', issues:'Issues', progress:'Progress',
  attendance:'Presensi', biodata:'Biodata', links:'Link Hub', meetings:'Meeting Reports', notes:'[Team] Notes', quicknotes:'[Personal] Notes',
  budget:'Anggaran', reimbursement:'Reimbursement', cashcard:'Cash Card', cashier:'Cashier', settlementcc:'Settlement CC',
  members:'Member', config:'Configuration'
}

export const DEFAULT_ROLES = [
  { key:'admin',    label:'Admin',     builtin:true,  allowedMenus:[...ALL_MENU_KEYS] },
  // manager broad access but NOT the CC Holder report by default (settlementcc is opt-in per role)
  { key:'manager',  label:'Manager',   builtin:true,  allowedMenus:ALL_MENU_KEYS.filter(m=>m!=='config' && m!=='settlementcc') },
  { key:'member',   label:'Member',    builtin:true,  allowedMenus:['dashboard','activities','calendar','issues','progress','attendance','biodata','links','meetings','notes','quicknotes','reimbursement'] },
  { key:'finance',  label:'Finance',   builtin:true,  allowedMenus:['dashboard','attendance','biodata','links','quicknotes','budget','reimbursement','cashcard','cashier'] },
  { key:'cashier',  label:'Cashier',   builtin:true,  allowedMenus:['dashboard','reimbursement','cashier','cashcard','biodata','quicknotes'] },
  { key:'ccholder', label:'CC Holder', builtin:true,  allowedMenus:['dashboard','reimbursement','cashcard','settlementcc','quicknotes'] },
  { key:'guest',    label:'Guest',     builtin:true,  allowedMenus:['dashboard','links'] },
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
// TWO metrics per the team's KPI model:
//  1. COMPLETION (planProgress / actualProgress): how much work is done vs planned
//     amount. Counts all actual weeks (early/on-time/late), capped at 100% (no bonus).
//  2. SPI (Schedule Performance Index): schedule efficiency vs TODAY. Only planned
//     weeks whose schedule has already arrived (on-or-before the current week) are
//     evaluated — future planned weeks are not yet due and never count against you.
//     Per due planned week (a deadline checkpoint), it's "earned" if enough actual
//     weeks were done on-or-before it. SPI = earned / due, clamped 0..1. A phase that
//     is entirely in the future returns null (excluded from the overall SPI).
//     Overall SPI is weighted by each phase's number of due planned weeks.
// Cell format "M-W" (month-week), converted to an absolute week index for ordering.
function _weekIndex(cell: string): number {
  const [m, w] = String(cell).split('-').map(Number)
  return ((m || 1) - 1) * 4 + ((w || 1) - 1)
}
// Absolute week index of "now" within a given plan year. Earlier year than now →
// everything is due (Infinity); a future year → nothing due yet (-1); same year →
// month/week index of today (week-of-month 1..4 by 7-day buckets).
function _nowIndex(year?: number): number {
  const now = new Date()
  const cy = now.getFullYear()
  const y = year || cy
  if (cy > y) return Infinity
  if (cy < y) return -1
  const m = now.getMonth() + 1
  const w = Math.min(4, Math.ceil(now.getDate() / 7))
  return (m - 1) * 4 + (w - 1)
}
export function calcInitiativeProgress(phases: any[], year?: number) {
  const nowIdx = _nowIndex(year)
  const planWeeksArr = phases.map(p => (p.planCells || []).length)
  const totalPlanWeeks = planWeeksArr.reduce((a, b) => a + b, 0)
  const result = phases.map((p, i) => {
    const planWeeks = planWeeksArr[i]
    const planCells: string[] = p.planCells || []
    const actualCells: string[] = p.actualCells || []
    const actualWeeks = actualCells.length
    const planPct = totalPlanWeeks > 0 ? (planWeeks / totalPlanWeeks) * 100 : 0

    // ── COMPLETION: work done vs planned amount, capped at 100% (early or late both count) ──
    const completionRatio = planWeeks > 0 ? Math.min(actualWeeks / planWeeks, 1) : 0
    const actualPct = completionRatio * planPct

    // ── SPI: schedule efficiency vs TODAY ──
    // Only evaluate planned weeks whose schedule has already arrived (deadline on-or-before
    // the current week). Future planned weeks are not yet due and must NOT count against us.
    // Per due planned week (a deadline checkpoint), it's "earned" if enough actual weeks
    // were done on-or-before it. SPI = earned / due, clamped 0..1.
    let spi: number | null = null
    let dueWeeks = 0
    if (planWeeks > 0) {
      const planSorted = [...planCells].map(_weekIndex).sort((a, b) => a - b)
      const duePlan = planSorted.filter(idx => idx <= nowIdx)
      dueWeeks = duePlan.length
      if (dueWeeks > 0) {
        const actualIdx = actualCells.map(_weekIndex).sort((a, b) => a - b)
        let earned = 0
        for (let k = 0; k < duePlan.length; k++) {
          const deadline = duePlan[k]
          const doneByDeadline = actualIdx.filter(a => a <= deadline).length
          if (doneByDeadline >= k + 1) earned++
        }
        spi = Math.max(0, Math.min(earned / dueWeeks, 1))
      }
      // else: phase entirely in the future → not yet due → spi stays null (excluded)
    }
    return { ...p, planPct, actualPct, spi, _planWeeks: planWeeks, _actualWeeks: actualWeeks, _dueWeeks: dueWeeks }
  })
  const planProgress = result.reduce((a, b) => a + b.planPct, 0)
  const actualProgress = result.reduce((a, b) => a + b.actualPct, 0)
  // Overall SPI weighted by each phase's DUE planned weeks (phases with no due work yet excluded)
  const spiPhases = result.filter(r => r.spi !== null && r._dueWeeks > 0)
  const totalDueW = spiPhases.reduce((a, b) => a + b._dueWeeks, 0)
  const spi = totalDueW > 0
    ? spiPhases.reduce((a, b) => a + (b.spi as number) * b._dueWeeks, 0) / totalDueW
    : null
  return { phases: result, planProgress, actualProgress, spi }
}
