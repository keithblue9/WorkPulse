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

export async function cachedFetch(url: string, ttl: number = DEFAULT_TTL, force = false): Promise<any> {
  const hit = cache.get(url)
  if (!force && hit && Date.now() - hit.at < ttl) return hit.data
  if (force) cache.delete(url)

  const running = inflight.get(url)
  if (running) return running

  // Penting: response gagal TIDAK boleh ikut di-cache, dan errornya harus
  // dilempar supaya pemanggil bisa membedakan "gagal memuat" vs "data kosong".
  const p = fetch(url)
    .then(async r => {
      const data = await r.json().catch(() => null)
      if (!r.ok) throw new Error(data?.error || `Server error ${r.status}`)
      return data
    })
    .then(data => { cache.set(url, { at: Date.now(), data }); inflight.delete(url); return data })
    .catch(err => { inflight.delete(url); cache.delete(url); throw err })

  inflight.set(url, p)
  return p
}

// Buang cache (pakai setelah create/update/delete biar data fresh)
export function invalidateFetch(prefix?: string) {
  if (!prefix) { cache.clear(); return }
  for (const k of Array.from(cache.keys())) if (k.startsWith(prefix)) cache.delete(k)
}

// Setiap simpan/ubah/hapus yang berhasil ke /api/* membuang cache, supaya dashboard, badge menu
// dan widget langsung memakai data terbaru (sebelumnya bisa tertahan sampai 30 detik).
// Dipasang sekali di Providers. Hanya memantau; respons tidak diubah.
let watching = false
export function watchMutations() {
  if (watching || typeof window === 'undefined' || typeof window.fetch !== 'function') return
  watching = true
  const orig = window.fetch.bind(window)
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const res = await orig(input, init)
    try {
      const method = String(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase()
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (method !== 'GET' && method !== 'HEAD' && res.ok && /\/api\//.test(url) && !/\/api\/auth\//.test(url)) {
        cache.clear()
        window.dispatchEvent(new CustomEvent('wins:data-changed', { detail: { url, method } }))
      }
    } catch {}
    return res
  }
}
