// Pemuat kebijakan tamu di server (proxy & route handler). Cache singkat di memori proses
// supaya tiap request tamu tidak membaca database; perubahan admin berlaku ≤ 30 detik.
import { connectDB } from '@/lib/db'
import { ConfigModel } from '@/models/Config'
import { DEFAULT_ROLES } from '@/lib/defaults'
import { WIDGET_BY_ID } from '@/lib/widgets'
import { effectiveGuestMenus, normalizeGuestAccess, type GuestAccess } from '@/lib/guestPolicy'
import { currentRoles } from '@/lib/session'

export type GuestPolicy = { menus: Set<string>; access: GuestAccess }
const TTL = 30_000
let cache: { at: number; p: GuestPolicy } | null = null

export function clearGuestPolicyCache() { cache = null }

export async function loadGuestPolicy(): Promise<GuestPolicy> {
  if (cache && Date.now() - cache.at < TTL) return cache.p
  try {
    await connectDB()
    const c: any = await ConfigModel.findOne({}, 'roleDefs guestAccess guestLayout').lean()
    const def = (c?.roleDefs || []).find((r: any) => r?.key === 'guest') || DEFAULT_ROLES.find(r => r.key === 'guest')
    const layout: any[] = Array.isArray(c?.guestLayout) ? c.guestLayout : []
    const ids = layout.map(p => String(p?.id || '')).filter(Boolean)
    const fams = ids.map(id => WIDGET_BY_ID.get(id)?.fam || '').filter(Boolean)
    const p = { menus: effectiveGuestMenus(def?.allowedMenus || [], fams, ids), access: normalizeGuestAccess(c?.guestAccess) }
    cache = { at: Date.now(), p }
    return p
  } catch {
    // DB tidak terjangkau: pakai bawaan paling ketat (hanya dashboard + link), atau cadangan dari env
    // GUEST_POLICY_FALLBACK='{"menus":["links","golive"],"access":{...}}' (untuk uji lokal / darurat).
    let p: GuestPolicy = { menus: new Set(['dashboard', 'links']), access: normalizeGuestAccess(null) }
    try {
      const f = JSON.parse(process.env.GUEST_POLICY_FALLBACK || 'null')
      if (f && Array.isArray(f.menus)) p = { menus: new Set(['dashboard', ...f.menus.map(String)]), access: normalizeGuestAccess(f.access) }
    } catch { /* abaikan env rusak */ }
    cache = { at: Date.now() - TTL + 10_000, p }   // simpan 10 dtk supaya request berikutnya tidak menunggu DB lagi
    return p
  }
}

/** Dipakai route handler: kebijakan tamu bila sesi ini tamu, selain itu null. */
export async function guestPolicyForRequest(): Promise<GuestPolicy | null> {
  const roles = await currentRoles()
  const guest = !roles || roles.length === 0 || roles.every(r => r === 'guest')
  return guest ? loadGuestPolicy() : null
}
