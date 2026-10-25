import { NextResponse, type NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { decideAccess } from '@/lib/access'

// Authentication gate for every page under /dashboard and every API route.
// Rules live in lib/access.ts (unit-tested); this file only reads the session token.
export async function proxy(req: NextRequest) {
  const token: any = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  const roles: string[] | null = token
    ? (Array.isArray(token.roles) && token.roles.length ? token.roles : [token.role || 'member'])
    : null
  const d = decideAccess({ pathname: req.nextUrl.pathname, method: req.method, roles, search: req.nextUrl.search })
  if (d.kind === 'next') return NextResponse.next()
  if (d.kind === 'redirect') return NextResponse.redirect(new URL(d.to, req.url))
  return NextResponse.json({ error: d.message }, { status: d.status })
}

export const config = {
  matcher: ['/dashboard', '/dashboard/:path*', '/api/:path*'],
}
