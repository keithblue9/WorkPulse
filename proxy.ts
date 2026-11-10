import { NextResponse, type NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { decideAccess, type GuestRules } from '@/lib/access'
import { loadGuestPolicy } from '@/lib/guestServer'

// Authentication gate for every page under /dashboard and every API route.
// Rules live in lib/access.ts (unit-tested); this file only reads the session token.
export async function proxy(req: NextRequest) {
  const token: any = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  const roles: string[] | null = token
    ? (Array.isArray(token.roles) && token.roles.length ? token.roles : [token.role || 'member'])
    : null
  // Tamu: aturan menu & data dibaca dari Konfigurasi admin (cache 30 dtk), bukan daftar tetap.
  let guest: GuestRules | undefined
  if (roles && (roles.length === 0 || roles.every(r => r === 'guest'))) {
    const p = await loadGuestPolicy()
    guest = { menus: p.menus, issuesTab: p.access.issuesTab }
  }
  const d = decideAccess({ pathname: req.nextUrl.pathname, method: req.method, roles, search: req.nextUrl.search, guest })
  if (d.kind === 'next') return NextResponse.next()
  if (d.kind === 'redirect') return NextResponse.redirect(new URL(d.to, req.url))
  return NextResponse.json({ error: d.message }, { status: d.status })
}

export const config = {
  matcher: ['/dashboard', '/dashboard/:path*', '/api/:path*'],
}
