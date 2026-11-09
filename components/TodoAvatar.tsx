// Avatar inisial dengan warna stabil per nama (dipakai halaman To-do & popup tugas).
const initials = (s?: string) => String(s || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('')
const hue = (s: string) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360; return h }

export function Avatar({ name, size = 26 }: { name?: string; size?: number }) {
  return <span className="td-av" title={name} aria-hidden="true" style={{ width: size, height: size, fontSize: Math.round(size * 0.38), ['--h' as any]: hue(String(name || '')) }}>{initials(name)}</span>
}
