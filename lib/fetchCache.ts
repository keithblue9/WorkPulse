// Dedupe + cache singkat untuk GET /api/*.
//
// Kenapa perlu: widget dashboard dipecah granular (BudgetInsights dirender 4x,
// MandatoryInsights 3x). Tanpa ini tiap instance nembak API yang SAMA PERSIS
// barengan -> puluhan request duplikat tiap load -> dashboard lemot.
//
// Cara kerja:
// - In-flight dedupe: request identik yang jalan bersamaan share 1 promise.
// - Cache TTL pendek: hasil dipakai ulang sebentar (default 30 dtk).

type Entry = { at: number; data: any }

const cache = new Map<string, Entry>()
const inflight = new Map<string, Promise<any>>()
const DEFAULT_TTL = 30_000

export async function cachedFetch(url: string, ttl: number = DEFAULT_TTL): Promise<any> {
  const hit = cache.get(url)
  if (hit && Date.now() - hit.at < ttl) return hit.data

  const running = inflight.get(url)
  if (running) return running

  const p = fetch(url)
    .then(r => r.json())
    .then(data => { cache.set(url, { at: Date.now(), data }); inflight.delete(url); return data })
    .catch(err => { inflight.delete(url); throw err })

  inflight.set(url, p)
  return p
}

// Buang cache (pakai setelah create/update/delete biar data fresh)
export function invalidateFetch(prefix?: string) {
  if (!prefix) { cache.clear(); return }
  for (const k of Array.from(cache.keys())) if (k.startsWith(prefix)) cache.delete(k)
}
