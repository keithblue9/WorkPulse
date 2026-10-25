import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { EnhancementModel } from '@/models/Enhancement'
import { CODE_PREFIX } from '@/lib/enhancement'

export async function sessionEmail(): Promise<string> {
  const s = await getServerSession(authOptions)
  return String((s?.user as any)?.email || '')
}

/** Next free code for an app in a year, e.g. B-IV-08. */
export async function nextCode(app: string, year: number): Promise<string> {
  const prefix = CODE_PREFIX[app] || `B-${app.slice(0, 2).toUpperCase()}`
  const docs = await EnhancementModel.find({ app, year }, { code: 1 }).lean() as any[]
  const used = docs.map(d => Number(String(d.code || '').match(/-(\d+)$/)?.[1] || 0))
  return `${prefix}-${String(Math.max(0, ...used) + 1).padStart(2, '0')}`
}

export const titleKey = (app: string, title: string, year: number) => `${app.toLowerCase()}|${title.trim().replace(/\s+/g, ' ').toLowerCase()}|${year}`
