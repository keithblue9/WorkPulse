// Pure access rules used by proxy.ts. Kept free of Next.js imports so they can be unit-tested.

export type Decision =
  | { kind: 'next' }
  | { kind: 'redirect'; to: string }
  | { kind: 'deny'; status: 401 | 403; message: string }

/** True when `path` equals `base` or is nested below it (no lookalike prefixes). */
const under = (path: string, base: string) => path === base || path.startsWith(base + '/')

const PUBLIC_API = ['/api/auth', '/api/warmup', '/api/cron']

// Read-only endpoints a guest (external) session needs for the guest dashboard and Link Hub.
const GUEST_GET_API = [
  '/api/config', '/api/dashboard', '/api/attendance', '/api/users', '/api/presence', '/api/projects', '/api/issues',
  '/api/initiatives', '/api/enhancements', '/api/golive', '/api/cashcard/summary', '/api/budget', '/api/mandatory',
  '/api/links', '/api/agenda', '/api/birthdays', '/api/profile', '/api/announcements', '/api/me/widgets',
]
const GUEST_PAGES = ['/dashboard', '/dashboard/links', '/dashboard/menu']

export function decideAccess(input: { pathname: string; method: string; roles: string[] | null; search?: string }): Decision {
  const { pathname, roles } = input
  const method = (input.method || 'GET').toUpperCase()
  const signedIn = Array.isArray(roles)
  const isGuest = signedIn && (roles!.length === 0 || roles!.every(r => r === 'guest'))
  const has = (...rs: string[]) => signedIn && roles!.some(r => rs.includes(r))

  if (under(pathname, '/api')) {
    if (PUBLIC_API.some(p => under(pathname, p))) return { kind: 'next' }
    if (pathname === '/api/config' && method === 'GET' && /(^|[?&])scope=login(&|$)/.test(input.search || '')) return { kind: 'next' }
    // Login account picker: a minimal directory (see loginDirectory) is readable before sign-in.
    if (pathname === '/api/users' && method === 'GET' && /(^|[?&])scope=login(&|$)/.test(input.search || '')) return { kind: 'next' }
    if (!signedIn) return { kind: 'deny', status: 401, message: 'Silakan login dulu' }
    if (isGuest) {
      const ok = (method === 'GET' && GUEST_GET_API.some(p => under(pathname, p)))
        || (method === 'POST' && pathname === '/api/presence')
        || (method === 'PATCH' && /^\/api\/links\/[^/]+$/.test(pathname))
      return ok ? { kind: 'next' } : { kind: 'deny', status: 403, message: 'Akses tamu tidak diizinkan' }
    }
    if (under(pathname, '/api/admin') && !has('admin')) return { kind: 'deny', status: 403, message: 'Khusus admin' }
    if (under(pathname, '/api/users') && (method === 'POST' || method === 'DELETE') && !has('admin', 'manager')) {
      return { kind: 'deny', status: 403, message: 'Khusus admin' }
    }
    return { kind: 'next' }
  }

  if (under(pathname, '/dashboard')) {
    if (!signedIn) return { kind: 'redirect', to: '/login?callbackUrl=' + encodeURIComponent(pathname) }
    if (isGuest && !GUEST_PAGES.includes(pathname)) return { kind: 'redirect', to: '/dashboard' }
    return { kind: 'next' }
  }
  return { kind: 'next' }
}

// Fields of a member record that only admins/managers may change (role escalation, PIN, activation).
const USER_ADMIN_FIELDS = ['role', 'roles', 'password', 'active', 'email', 'sortOrder']
export function forbiddenUserFields(body: Record<string, unknown>, roles: string[]): string[] {
  if (roles.some(r => r === 'admin' || r === 'manager')) return []
  return USER_ADMIN_FIELDS.filter(k => k in (body || {}))
}

// What a member list may expose. Secrets never leave the server; guests only get a directory.
const GUEST_USER_FIELDS = ['_id', 'name', 'email', 'status', 'sortOrder', 'active', 'role', 'roles', 'division', 'jabatan']
export function sanitizeUser(u: Record<string, any>, roles: string[]): Record<string, any> {
  const { password: _p, fonnteToken: _t, ...rest } = u || {}
  if (roles.length && roles.every(r => r === 'guest')) {
    return Object.fromEntries(Object.entries(rest).filter(([k]) => GUEST_USER_FIELDS.includes(k)))
  }
  return rest
}

// Account picker on the login page (no session yet): active internal users only, no personal data.
export function loginDirectory(users: Record<string, any>[]): { name: string; email: string; division: string; role: string }[] {
  return (users || [])
    .filter(u => u && u.active !== false)
    .map(u => ({ u, roles: (Array.isArray(u.roles) && u.roles.length ? u.roles : u.role ? [u.role] : []) as string[] }))
    .filter(({ roles }) => !(roles.length > 0 && roles.every(r => r === 'guest')))
    .map(({ u, roles }) => ({ name: String(u.name || ''), email: String(u.email || ''), division: String(u.division || ''), role: String(roles[0] || '') }))
}
