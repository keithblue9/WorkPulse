'use client'
// Hook klien: kebijakan tamu dari /api/config (server sudah menyaring config untuk tamu).
// Dipakai sidebar, widget, hero dan halaman lihat-saja supaya tautan tidak pernah memantul.
import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { getConfig } from '@/lib/configCache'
import { userRolesOf } from '@/lib/perms'
import { isInternalUser } from '@/lib/nav'
import { DEFAULT_GUEST_ACCESS, guestCanOpenHref, normalizeGuestAccess, type GuestAccess } from '@/lib/guestPolicy'

export type GuestView = { isGuest: boolean; ready: boolean; menus: Set<string>; access: GuestAccess; canOpen: (href?: string) => boolean
  /** Data presensi terbuka untuk sesi ini (internal selalu true). */
  attendanceOn: boolean }

export function guestViewFrom(cfg: any, isGuest: boolean): GuestView {
  const def = (cfg?.roleDefs || []).find((r: any) => r?.key === 'guest')
  const menus = new Set<string>(['dashboard', ...(def?.allowedMenus || ['links'])])
  const access = cfg ? normalizeGuestAccess(cfg.guestAccess) : DEFAULT_GUEST_ACCESS
  return { isGuest, ready: !!cfg, menus, access, canOpen: href => !isGuest || guestCanOpenHref(href, menus), attendanceOn: !isGuest || menus.has('attendance') || menus.has('calendar') }
}

export function useGuest(): GuestView {
  const { data: session } = useSession()
  const isGuest = !!session?.user && !isInternalUser(userRolesOf(session.user))
  const [cfg, setCfg] = useState<any>(null)
  useEffect(() => { if (isGuest) getConfig().then(setCfg).catch(() => setCfg({})) }, [isGuest])
  return useMemo(() => guestViewFrom(isGuest ? cfg : {}, isGuest), [cfg, isGuest])
}
