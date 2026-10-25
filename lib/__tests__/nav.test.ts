import { describe, it, expect } from 'vitest'
import { getAllowedMenus, visibleNav, NAV_GROUPS } from '@/lib/nav'

const hrefs = (groups: ReturnType<typeof visibleNav>) => groups.flatMap(g => g.items.map(i => i.href))

describe('nav permissions', () => {
  it('admin sees every menu including Enhancement', () => {
    const all = hrefs(visibleNav(getAllowedMenus([], ['admin'], true), ['admin']))
    expect(all).toContain('/dashboard/enhancement')
    expect(all).toContain('/dashboard/config')
    expect(all.length).toBe(NAV_GROUPS.flatMap(g => g.items).length)
  })
  it('a member sees Enhancement but not admin menus', () => {
    const roleDefs = [{ key: 'member', allowedMenus: ['dashboard', 'progress', 'activities'] }]
    const all = hrefs(visibleNav(getAllowedMenus(roleDefs, ['member'], true), ['member']))
    expect(all).toEqual(['/dashboard', '/dashboard/progress', '/dashboard/enhancement', '/dashboard/activities'])
  })
  it('a guest sees only the guest menus, never Enhancement', () => {
    const all = hrefs(visibleNav(getAllowedMenus([], ['guest'], true), ['guest']))
    expect(all).toEqual(['/dashboard', '/dashboard/links'])
  })
  it('removed menus are gone', () => {
    const all = NAV_GROUPS.flatMap(g => g.items.map(i => i.href))
    expect(all).not.toContain('/dashboard/meetings')
    expect(all).not.toContain('/dashboard/playground')
  })
})
