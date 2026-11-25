import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'

// JSON per-pengguna yang boleh disimpan browser TAPI selalu divalidasi ulang (ETag).
// - `private`  : CDN/Vercel tidak boleh menyimpan (isi berbeda per pengguna & peran; CDN mengabaikan query string).
// - `no-cache` : browser wajib bertanya dulu; kalau isi sama server cukup membalas 304 tanpa badan → transfer ≈ 0.
// Dibanding `no-store` (selalu kirim penuh), data tetap selalu segar.
export function etagOf(body: string): string {
  return `W/"${createHash('sha1').update(body).digest('base64url')}"`
}

export function matchesEtag(header: string | null, etag: string): boolean {
  if (!header) return false
  const strip = (v: string) => v.trim().replace(/^W\//, '')
  const mine = strip(etag)
  return header.split(',').some(v => v.trim() === '*' || strip(v) === mine)
}

export function jsonRevalidate(req: Request, payload: unknown): NextResponse {
  const body = JSON.stringify(payload)
  const etag = etagOf(body)
  const headers = { 'Cache-Control': 'private, no-cache', 'Vary': 'Cookie', 'ETag': etag }
  if (matchesEtag(req.headers.get('if-none-match'), etag)) return new NextResponse(null, { status: 304, headers })
  return new NextResponse(body, { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } })
}
