'use client'
import { useCallback, useEffect, useState } from 'react'

/**
 * Tab yang tersimpan di URL (?tab=…): menu lama (mis. Cashier → Reimbursement) bisa membuka
 * tab yang tepat, dan tab tetap sama saat halaman dimuat ulang atau dibagikan.
 * Nilai di luar `allowed` diabaikan (kembali ke default).
 */
export function useTabParam<T extends string>(allowed: readonly T[], initial: T, key = 'tab'): [T, (v: T) => void] {
  const [tab, setTabState] = useState<T>(initial)
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get(key) as T | null
    if (v && allowed.includes(v)) setTabState(v)
    // allowed adalah literal konstan per halaman
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  const setTab = useCallback((v: T) => {
    setTabState(v)
    try {
      const u = new URL(window.location.href)
      if (v === initial) u.searchParams.delete(key); else u.searchParams.set(key, v)
      window.history.replaceState(window.history.state, '', u.pathname + u.search + u.hash)
    } catch {}
  }, [initial, key])
  return [tab, setTab]
}
