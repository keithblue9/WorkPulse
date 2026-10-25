// Pure helpers that build the config view returned by GET /api/config.
// They never touch the database: legacy or incomplete config documents are
// completed in memory only, so opening the app never changes stored data.
import { DEFAULT_ROLES, DEFAULT_LINK_CATEGORIES } from '@/lib/defaults'

export const CONFIG_FALLBACKS: Record<string, any[]> = {
  attendanceTypes: [
    { key: 'wfo', label: 'WFO', textColor: '#4f8ef7', color: '#1a2d4a', active: true },
    { key: 'wfh', label: 'WFH', textColor: '#8b7adc', color: '#1e1630', active: true },
    { key: 'dinas', label: 'Dinas Luar', textColor: '#c9954d', color: '#2a1f0a', active: true },
    { key: 'cuti', label: 'Cuti', textColor: '#56a47a', color: '#142a1e', active: true },
    { key: 'sakit', label: 'Sakit', textColor: '#d65f5f', color: '#2a1010', active: true },
    { key: 'izin', label: 'Izin', textColor: '#9aa6b3', color: '#1a1a2a', active: true },
  ],
  budgetCategories: [
    { key: 'travel', label: 'Dinas & Travel', annualBudget: 0, annualBudgetUSD: 0, pic: '', threshold: 80 },
    { key: 'accommodation', label: 'External Accommodation', annualBudget: 0, annualBudgetUSD: 0, pic: '', threshold: 80 },
  ],
  activityCategories: [
    { key: 'iVendor', label: 'iVendor', color: '#4f8ef7', active: true },
    { key: 'iPRO', label: 'iPRO', color: '#8b7adc', active: true },
    { key: 'OnePro', label: 'OnePro', color: '#56a47a', active: true },
    { key: 'PAL', label: 'PAL', color: '#c9954d', active: true },
    { key: 'KIMS', label: 'KIMS', color: '#5fb3ad', active: true },
    { key: 'Others', label: 'Others', color: '#9aa6b3', active: true },
  ],
  activitySubTypes: [
    { key: 'KPI', label: 'KPI', color: '#4f8ef7', active: true },
    { key: 'Non-KPI', label: 'Non KPI', color: '#8b7adc', active: true },
    { key: 'Go-Live', label: 'Go Live', color: '#56a47a', active: true },
    { key: 'Others', label: 'Others', color: '#9aa6b3', active: true },
    { key: 'Anggaran', label: 'Anggaran', color: '#c9954d', active: true },
  ],
  progressSubTabs: [
    { key: 'KPI', label: 'KPI', color: '#4f8ef7', active: true },
    { key: 'Non-KPI', label: 'Non KPI', color: '#8b7adc', active: true },
    { key: 'Go-Live', label: 'Go Live', color: '#56a47a', active: true },
    { key: 'Others', label: 'Others', color: '#9aa6b3', active: true },
    { key: 'Anggaran', label: 'Anggaran', color: '#c9954d', active: true },
  ],
  issueStatuses: [
    { key: 'on_track', label: 'On Track', color: '#56a47a', active: true },
    { key: 'at_risk', label: 'At Risk', color: '#c9954d', active: true },
    { key: 'delayed', label: 'Delayed', color: '#d65f5f', active: true },
    { key: 'completed', label: 'Completed', color: '#4f8ef7', active: true },
  ],
  roleDefs: DEFAULT_ROLES,
  linkCategories: DEFAULT_LINK_CATEGORIES,
}

/** Merge saved dashboard widgets with the current widget catalogue (pure). */
export function mergeWidgets(existing: any[] | undefined, defaults: any[]): any[] {
  const byKey: Record<string, any> = {}
  for (const w of Array.isArray(existing) ? existing : []) if (w && w.key) byKey[w.key] = w
  return defaults.map((dw: any) => {
    const ex = byKey[dw.key]
    if (!ex) return { ...dw, activeGuest: dw.activeGuest !== false, size: dw.size || 'full', sizeGuest: dw.sizeGuest || dw.size || 'full' }
    return {
      ...dw,
      active: ex.active !== false,
      activeGuest: ex.activeGuest !== false,
      order: ex.order ?? dw.order,
      size: ex.size || dw.size || 'full',
      sizeGuest: ex.sizeGuest || ex.size || dw.size || 'full',
    }
  })
}

function cleanTagline(v: unknown): unknown {
  if (typeof v !== 'string' || !/SS Procurement/i.test(v)) return v
  return v.replace(/BPD\s*&\s*SS Procurement/gi, 'BPD Procurement').replace(/\s*&\s*SS Procurement/gi, '').replace(/SS Procurement/gi, 'BPD Procurement')
}

/** Complete a (possibly legacy) config document in memory (pure). */
export function mergeConfigDefaults(cfg: any, widgetDefaults: any[]): any {
  const out: any = { ...(cfg || {}) }
  for (const k of Object.keys(CONFIG_FALLBACKS)) {
    if (!Array.isArray(out[k]) || out[k].length === 0) out[k] = CONFIG_FALLBACKS[k]
  }
  out.loginBackgrounds = Array.isArray(out.loginBackgrounds) ? out.loginBackgrounds : []
  out.appTagline = cleanTagline(out.appTagline)
  out.loginTagline = cleanTagline(out.loginTagline)
  out.dashboardWidgets = mergeWidgets(out.dashboardWidgets, widgetDefaults)
  return out
}
