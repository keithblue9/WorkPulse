// Client-side cache for /api/config — drastically reduces repeat fetches
// Config rarely changes; cache across page navigations in sessionStorage.

const CACHE_KEY = 'wp_config_cache_v1'
const TTL_MS = 5 * 60 * 1000 // 5 minutes

type Cached = { data:any; ts:number }

export async function getConfig(force=false): Promise<any> {
  // Try sessionStorage first
  if (typeof window !== 'undefined' && !force) {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY)
      if (raw) {
        const c: Cached = JSON.parse(raw)
        if (Date.now() - c.ts < TTL_MS) return c.data
      }
    } catch {}
  }
  // Fetch fresh
  const r = await fetch('/api/config', force ? { cache: 'no-store' } : {})
  const j = await r.json()
  const data = j.data
  if (typeof window !== 'undefined' && data) {
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() })) } catch {}
  }
  return data
}

export function invalidateConfig() {
  if (typeof window !== 'undefined') {
    try { sessionStorage.removeItem(CACHE_KEY) } catch {}
  }
}
