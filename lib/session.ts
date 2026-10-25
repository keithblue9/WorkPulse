import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { userRolesOf } from '@/lib/perms'

/** Roles of the signed-in user for route handlers, or null when nobody is signed in. */
export async function currentRoles(): Promise<string[] | null> {
  const session = await getServerSession(authOptions)
  return session?.user ? userRolesOf(session.user) : null
}
