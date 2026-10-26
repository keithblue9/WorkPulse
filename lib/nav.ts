// Menu structure (as-is + Enhancement) and permission rules shared by the sidebar,
// the phone tab bar, the Menu page and the command palette.
export type NavItem = { href: string; label: string; icon: string; permKey: string; perms?: string[]; internal?: boolean; isNew?: boolean }
export type NavGroup = { key: string; label: string; items: NavItem[] }

export const NAV_GROUPS: NavGroup[] = [
  { key: 'dashboard', label: 'Dashboard & Overview', items: [
    { href: '/dashboard', label: 'Dashboard', icon: 'dash', permKey: 'dashboard' },
    { href: '/dashboard/enhancement', label: 'Enhancement', icon: 'enh', permKey: 'enhancement', internal: true, isNew: true },
  ] },
  { key: 'activities', label: 'Activities', items: [
    { href: '/dashboard/activities', label: 'Activities', icon: 'act', permKey: 'activities' },
    { href: '/dashboard/mandatory', label: 'Mandatory', icon: 'shield', permKey: 'mandatory' },
    { href: '/dashboard/golive', label: 'Go-Live', icon: 'rocket', permKey: 'golive' },
    { href: '/dashboard/notes', label: '[Team] Notes', icon: 'notes', permKey: 'notes' },
    { href: '/dashboard/quicknotes', label: '[Personal] Notes', icon: 'pnote', permKey: 'quicknotes' },
  ] },
  { key: 'team', label: 'Team', items: [
    { href: '/dashboard/attendance', label: 'Presensi', icon: 'user', permKey: 'attendance' },
    { href: '/dashboard/calendar', label: 'Calendar', icon: 'cal', permKey: 'calendar' },
    { href: '/dashboard/links', label: 'Link Hub', icon: 'link', permKey: 'links' },
    { href: '/dashboard/biodata', label: 'Member Biodata', icon: 'id', permKey: 'biodata' },
  ] },
  { key: 'finance', label: 'Finance', items: [
    { href: '/dashboard/reimbursements', label: 'Reimbursement', icon: 'wallet', permKey: 'reimbursement', perms: ['reimbursement', 'cashier'] },
    { href: '/dashboard/operasional', label: 'Operasional', icon: 'ops', permKey: 'operasional', perms: ['operasional', 'settlementcc', 'cashier'] },
    { href: '/dashboard/cashcard', label: 'Cash Card', icon: 'card', permKey: 'cashcard', perms: ['cashcard'] },
    { href: '/dashboard/thirdparty', label: '[3rd Party] Event', icon: 'ev', permKey: 'thirdparty', perms: ['thirdparty', 'budget', 'cashier'] },
    { href: '/dashboard/budget', label: 'Budget Report', icon: 'budget', permKey: 'budget', perms: ['budgetreport', 'budget'] },
  ] },
  { key: 'admin', label: 'Admin', items: [
    { href: '/dashboard/members', label: 'Member', icon: 'team', permKey: 'members' },
    { href: '/dashboard/config', label: 'Configuration', icon: 'gear', permKey: 'config' },
  ] },
]

export const FALLBACK_MENUS: Record<string, string[]> = {
  admin: ['dashboard', 'activities', 'mandatory', 'golive', 'calendar', 'issues', 'progress', 'attendance', 'biodata', 'links', 'notes', 'quicknotes', 'budget', 'budgetreport', 'reimbursement', 'operasional', 'cashcard', 'cashier', 'settlementcc', 'thirdparty', 'members', 'config'],
  manager: ['dashboard', 'activities', 'mandatory', 'golive', 'calendar', 'issues', 'progress', 'attendance', 'biodata', 'links', 'notes', 'quicknotes', 'budget', 'budgetreport', 'reimbursement', 'operasional', 'cashcard', 'cashier', 'thirdparty', 'members'],
  member: ['dashboard', 'activities', 'mandatory', 'golive', 'calendar', 'issues', 'progress', 'attendance', 'biodata', 'links', 'notes', 'quicknotes', 'reimbursement'],
  finance: ['dashboard', 'attendance', 'biodata', 'links', 'quicknotes', 'budget', 'budgetreport', 'reimbursement', 'operasional', 'cashcard', 'cashier', 'thirdparty'],
  cashier: ['dashboard', 'reimbursement', 'operasional', 'cashier', 'cashcard', 'biodata', 'quicknotes'],
  ccholder: ['dashboard', 'reimbursement', 'operasional', 'cashcard', 'settlementcc', 'quicknotes'],
  guest: ['dashboard', 'links'],
}

export function getAllowedMenus(roleDefs: any[], userRoles: string[], configLoaded: boolean): Set<string> {
  const allowed = new Set<string>()
  for (const role of userRoles) {
    // Admin always sees every menu, even when the saved roles predate a new menu.
    if (role === 'admin') { FALLBACK_MENUS.admin.forEach(m => allowed.add(m)); continue }
    const def = roleDefs?.find((r: any) => r.key === role)
    if (def?.allowedMenus) def.allowedMenus.forEach((m: string) => allowed.add(m))
  }
  if (allowed.size === 0) {
    for (const role of userRoles) (FALLBACK_MENUS[role] || []).forEach(m => allowed.add(m))
    if (allowed.size === 0 && !configLoaded) FALLBACK_MENUS.admin.forEach(m => allowed.add(m))
  }
  return allowed
}

export const isInternalUser = (roles: string[]) => roles.some(r => r !== 'guest')

/** Groups with only the items this user may open (empty groups removed). */
export function visibleNav(allowed: Set<string>, roles: string[]): NavGroup[] {
  const internal = isInternalUser(roles)
  return NAV_GROUPS.map(g => ({
    ...g,
    items: g.items.filter(i => i.internal ? internal : (i.perms ? i.perms.some(p => allowed.has(p)) : allowed.has(i.permKey))),
  })).filter(g => g.items.length)
}

export const isActive = (pathname: string, href: string) => pathname === href || (href !== '/dashboard' && pathname.startsWith(href + '/')) || (href !== '/dashboard' && pathname === href)
