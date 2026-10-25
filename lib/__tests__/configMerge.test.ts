import { describe, it, expect } from 'vitest'
import { mergeWidgets, mergeConfigDefaults, CONFIG_FALLBACKS } from '@/lib/configMerge'

const DEFAULTS = [
  { key: 'stat-kpi', label: 'Stat: KPI', segment: 'stats', active: true, order: 1 },
  { key: 'upcoming-agenda', label: 'Agenda Mendatang', segment: 'main', active: true, order: 12, size: 'half' },
]

describe('mergeWidgets', () => {
  it('drops widget keys that are no longer defined (e.g. legacy AI widgets)', () => {
    const existing = [{ key: 'ai-row', label: 'AI', active: true, order: 10 }, { key: 'stat-kpi', label: 'Stat: KPI', active: false, order: 3 }]
    const out = mergeWidgets(existing, DEFAULTS)
    expect(out.map(w => w.key)).toEqual(['stat-kpi', 'upcoming-agenda'])
  })
  it('keeps the saved active/order/size of existing widgets', () => {
    const out = mergeWidgets([{ key: 'upcoming-agenda', active: false, activeGuest: false, order: 2, size: 'full', sizeGuest: 'half' }], DEFAULTS)
    const w = out.find(x => x.key === 'upcoming-agenda')!
    expect(w).toMatchObject({ active: false, activeGuest: false, order: 2, size: 'full', sizeGuest: 'half', label: 'Agenda Mendatang' })
  })
  it('does not mutate its input', () => {
    const existing = [{ key: 'ai-row', active: true }]
    const snap = JSON.stringify(existing)
    mergeWidgets(existing, DEFAULTS)
    expect(JSON.stringify(existing)).toBe(snap)
  })
  it('handles a missing widget list', () => {
    expect(mergeWidgets(undefined, DEFAULTS).length).toBe(2)
  })
})

describe('mergeConfigDefaults', () => {
  it('fills every empty taxonomy with its fallback', () => {
    const out = mergeConfigDefaults({}, DEFAULTS)
    for (const k of Object.keys(CONFIG_FALLBACKS)) expect(out[k].length, k).toBeGreaterThan(0)
    expect(out.loginBackgrounds).toEqual([])
    expect(out.dashboardWidgets.map((w: any) => w.key)).toEqual(['stat-kpi', 'upcoming-agenda'])
  })
  it('keeps existing non-empty values untouched', () => {
    const cfg = { attendanceTypes: [{ key: 'wfo', label: 'Kantor' }] }
    expect(mergeConfigDefaults(cfg, DEFAULTS).attendanceTypes).toEqual([{ key: 'wfo', label: 'Kantor' }])
  })
  it('cleans the legacy SS Procurement tagline in memory only', () => {
    const cfg = { appTagline: 'BPD & SS Procurement', loginTagline: 'SS Procurement — Pertamina' }
    const out = mergeConfigDefaults(cfg, DEFAULTS)
    expect(out.appTagline).toBe('BPD Procurement')
    expect(out.loginTagline).toBe('BPD Procurement — Pertamina')
    expect(cfg.appTagline).toBe('BPD & SS Procurement')
  })
})

import { loginSlice, withoutLoginBackgrounds } from '@/lib/configMerge'

describe('config payload slices', () => {
  const cfg = { appName: 'WINS', appTagline: 'BPD', loginTagline: 'L', loginBackgrounds: ['data:x'], loginSlideInterval: 5000, appIcon: '', roleDefs: [{ key: 'admin' }], fonnte: { apiUrl: 'x' } }
  it('login slice exposes only what the login page needs', () => {
    expect(Object.keys(loginSlice(cfg)).sort()).toEqual(['appIcon', 'appName', 'appTagline', 'loginBackgrounds', 'loginSlideInterval', 'loginTagline'])
  })
  it('dashboard payload drops the heavy login backgrounds', () => {
    const out = withoutLoginBackgrounds(cfg)
    expect(out).not.toHaveProperty('loginBackgrounds')
    expect(out.loginBackgroundCount).toBe(1)
    expect(out.roleDefs).toEqual([{ key: 'admin' }])
  })
})
