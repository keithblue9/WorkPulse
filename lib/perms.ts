import { DEFAULT_ROLES, ALL_MENU_KEYS } from './defaults'

export function userRolesOf(user:any):string[] {
  if (!user) return ['guest']
  if (user.roles && user.roles.length) return user.roles
  if (user.role) return [user.role]
  return ['guest']
}

export function allowedMenusFor(roleDefs:any[], userRoles:string[]):Set<string> {
  const allowed = new Set<string>()
  for (const role of userRoles) {
    if (role === 'admin') { ALL_MENU_KEYS.forEach(m=>allowed.add(m)); continue }
    const def = (roleDefs||[]).find((r:any)=>r.key===role)
    if (def?.allowedMenus?.length) def.allowedMenus.forEach((m:string)=>allowed.add(m))
    else { const d = DEFAULT_ROLES.find(r=>r.key===role); d?.allowedMenus.forEach((m:string)=>allowed.add(m)) }
  }
  return allowed
}
