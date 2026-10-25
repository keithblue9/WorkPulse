// Pilihan "Sorotan" (kartu hero) di Dashboard → General. Disimpan per user; tamu diatur admin.
export const HERO_KINDS = ['progress', 'presensi', 'agenda', 'enhancement', 'fokus', 'none'] as const
export type HeroKind = (typeof HERO_KINDS)[number]
export const HERO_META: Record<HeroKind, { label: string; desc: string; icon: string; internalOnly?: boolean }> = {
  progress: { label: 'Progress project', desc: 'Realisasi portofolio vs rencana dan initiative yang tertinggal', icon: 'prog' },
  presensi: { label: 'Presensi tim', desc: 'Siapa WFO, WFH, dinas, atau cuti hari ini dan pekan ini', icon: 'user' },
  agenda: { label: 'Agenda mendatang', desc: 'Agenda tim berikutnya dan jadwal pekan ini', icon: 'cal' },
  enhancement: { label: 'Enhancement', desc: 'Jumlah enhancement, Quick Win, dan tahap BRD', icon: 'enh' },
  fokus: { label: 'Tugas saya', desc: 'Tugas dengan PIC kamu yang perlu di-update', icon: 'me', internalOnly: true },
  none: { label: 'Tanpa sorotan', desc: 'Langsung tampilkan widget', icon: 'grid' },
}
export const isHeroKind = (v: unknown): v is HeroKind => typeof v === 'string' && (HERO_KINDS as readonly string[]).includes(v)
export function heroFor(saved: unknown, internal: boolean, fallback: HeroKind = 'progress'): HeroKind {
  if (!isHeroKind(saved)) return fallback
  return !internal && HERO_META[saved].internalOnly ? fallback : saved
}

/** Tahun lain yang punya data, terdekat dari tahun terpilih (untuk petunjuk "ada N di 2027"). */
export function otherYearHint(items: { year?: number }[], year: number): { year: number; n: number } | null {
  const by = new Map<number, number>()
  for (const e of items || []) { const y = Number(e?.year); if (Number.isInteger(y) && y !== year) by.set(y, (by.get(y) || 0) + 1) }
  if (!by.size) return null
  const y = [...by.keys()].sort((a, b) => Math.abs(a - year) - Math.abs(b - year) || b - a)[0]
  return { year: y, n: by.get(y)! }
}
