import { describe, it, expect } from 'vitest'
import { etagOf, matchesEtag, jsonRevalidate } from '@/lib/httpCache'
import { configSizeReport } from '@/lib/configMerge'

const req = (inm?: string) => new Request('https://x.test/api/config', { headers: inm ? { 'if-none-match': inm } : {} })

describe('etag', () => {
  it('stabil untuk isi sama, berbeda untuk isi berbeda', () => {
    expect(etagOf('{"a":1}')).toBe(etagOf('{"a":1}'))
    expect(etagOf('{"a":1}')).not.toBe(etagOf('{"a":2}'))
    expect(etagOf('x')).toMatch(/^W\/"[A-Za-z0-9_-]+"$/)
  })
  it('matchesEtag: weak/strong, daftar, wildcard, kosong', () => {
    const e = etagOf('abc')
    expect(matchesEtag(e, e)).toBe(true)
    expect(matchesEtag(e.replace(/^W\//, ''), e)).toBe(true)
    expect(matchesEtag(`W/"zzz", ${e}`, e)).toBe(true)
    expect(matchesEtag('*', e)).toBe(true)
    expect(matchesEtag(null, e)).toBe(false)
    expect(matchesEtag('W/"lain"', e)).toBe(false)
  })
})

describe('jsonRevalidate', () => {
  it('200 + header private/no-cache + ETag saat belum ada salinan', async () => {
    const r = jsonRevalidate(req(), { data: { a: 1 } })
    expect(r.status).toBe(200)
    expect(r.headers.get('cache-control')).toBe('private, no-cache')
    expect(r.headers.get('content-type')).toContain('application/json')
    expect(await r.json()).toEqual({ data: { a: 1 } })
    expect(r.headers.get('etag')).toBeTruthy()
  })
  it('304 tanpa badan bila If-None-Match cocok; 200 lagi bila isi berubah', async () => {
    const etag = jsonRevalidate(req(), { data: { a: 1 } }).headers.get('etag')!
    const same = jsonRevalidate(req(etag), { data: { a: 1 } })
    expect(same.status).toBe(304)
    expect(await same.text()).toBe('')
    expect(same.headers.get('cache-control')).toBe('private, no-cache')
    expect(jsonRevalidate(req(etag), { data: { a: 2 } }).status).toBe(200)
  })
  it('tidak pernah boleh disimpan CDN (private)', () => {
    expect(jsonRevalidate(req(), {}).headers.get('cache-control')).not.toMatch(/s-maxage|public/)
  })
})

describe('configSizeReport', () => {
  it('mengurutkan field dari yang terbesar', () => {
    const r = configSizeReport({ small: 1, appIcon: 'x'.repeat(500), mid: 'y'.repeat(50), nul: null, undef: undefined }, 2)
    expect(r.top.map(t => t.key)).toEqual(['appIcon', 'mid'])
    expect(r.total).toBeGreaterThan(550)
  })
  it('aman untuk input kosong', () => {
    expect(configSizeReport(null)).toEqual({ total: 0, top: [] })
  })
})
