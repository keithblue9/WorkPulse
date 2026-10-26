// Katalog widget dashboard ala Apple + helper layout (pure, teruji). Tiap widget milik satu
// "keluarga" menu (warna & aset aurora sendiri) dan punya ukuran S (1×1), M (2×1), L (2×2).
/** S/M/L = widget native di grid (1×1, 2×1, 2×2). H/F = infografis Aurora v3: setengah / penuh lebar, tinggi natural. */
export type Size = 'S' | 'M' | 'L' | 'H' | 'F'
export type Fam = 'progress' | 'enhancement' | 'agenda' | 'team' | 'mandatory' | 'golive' | 'budget' | 'notes' | 'issues'
export type Need = 'mandatory' | 'golive' | 'budget' | 'cashcard'
export type WidgetDef = {
  id: string; fam: Fam; title: string; desc: string; sizes: Size[]
  /** native = Instrument Light (grid); classic = infografis Aurora v3 (blok tinggi natural) */
  kind?: 'native' | 'classic'
  /** Kunci menu (lib/nav permKey/perms). Widget tampil bila salah satunya diizinkan. Kosong = semua. */
  menus: string[]; internalOnly?: boolean; needs?: Need[]; href: string
}
export type Placed = { id: string; size: Size }

export const FAMILIES: Record<Fam, { label: string; art: string; icon: string }> = {
  progress: { label: 'Progress', art: 'indigo', icon: 'prog' },
  enhancement: { label: 'Enhancement', art: 'violet', icon: 'enh' },
  agenda: { label: 'Activities & Agenda', art: 'blue', icon: 'cal' },
  issues: { label: 'Issues', art: 'rose', icon: 'bolt' },
  team: { label: 'Tim & Presensi', art: 'teal', icon: 'user' },
  mandatory: { label: 'Mandatory', art: 'green', icon: 'shield' },
  golive: { label: 'Go-Live', art: 'coral', icon: 'rocket' },
  budget: { label: 'Finance', art: 'gold', icon: 'budget' },
  notes: { label: 'Notes', art: 'violet', icon: 'notes' },
}

export const WIDGETS: WidgetDef[] = [
  { id: 'summary', fam: 'progress', title: 'Ringkasan hari ini', desc: 'Tiga hal terpenting hari ini dari semua data', sizes: ['M', 'L'], menus: [], href: '/dashboard' },
  { id: 'progress', fam: 'progress', title: 'Progress project', desc: 'Realisasi portofolio vs rencana, status tiap initiative', sizes: ['S', 'M', 'L'], menus: ['progress'], href: '/dashboard/progress' },
  { id: 'myfocus', fam: 'progress', title: 'Tugas saya', desc: 'Tugas dengan PIC kamu yang perlu di-update', sizes: ['S', 'M'], menus: ['progress'], internalOnly: true, href: '/dashboard' },
  { id: 'enhancement', fam: 'enhancement', title: 'Enhancement', desc: 'Jumlah, kategori Quick Win s.d. Strategis, dan tahap BRD', sizes: ['S', 'M', 'L'], menus: [], href: '/dashboard/enhancement' },
  { id: 'agenda', fam: 'agenda', title: 'Agenda berikutnya', desc: 'Aktivitas terjadwal paling dekat', sizes: ['S', 'M', 'L'], menus: ['activities', 'calendar'], href: '/dashboard/calendar' },
  { id: 'activity-stats', fam: 'agenda', title: 'Statistik aktivitas', desc: 'KPI, Non KPI, Go Live, Anggaran, Others, prioritas tinggi', sizes: ['M', 'L'], menus: ['activities'], href: '/dashboard/activities' },
  { id: 'issues', fam: 'issues', title: 'Prioritas tinggi', desc: 'Issue prioritas tinggi yang masih aktif', sizes: ['S', 'M'], menus: ['activities', 'issues'], href: '/dashboard/issues' },
  { id: 'team', fam: 'team', title: 'Tim hari ini', desc: 'Siapa WFO, WFH, dinas, atau cuti', sizes: ['S', 'M', 'L'], menus: ['attendance'], href: '/dashboard/attendance' },
  { id: 'workload', fam: 'team', title: 'Beban kerja', desc: 'Activity, initiative & enhancement per member', sizes: ['M', 'L'], menus: [], internalOnly: true, href: '/dashboard' },
  { id: 'mandatory', fam: 'mandatory', title: 'Mandatory', desc: 'Kepatuhan MCU, training, dan support KPI', sizes: ['S', 'M', 'L'], menus: ['mandatory'], needs: ['mandatory'], href: '/dashboard/mandatory' },
  { id: 'golive', fam: 'golive', title: 'Go-Live', desc: 'Entitas yang sudah go-live per aplikasi', sizes: ['S', 'M', 'L'], menus: ['golive'], needs: ['golive'], href: '/dashboard/golive' },
  { id: 'budget', fam: 'budget', title: 'Budget', desc: 'Realisasi vs RKAP per kategori dan prognosa', sizes: ['S', 'M', 'L'], menus: ['budget', 'budgetreport'], needs: ['budget'], href: '/dashboard/budget' },
  { id: 'cashcard', fam: 'budget', title: 'Settlement Cash Card', desc: 'Total settlement dibanding top up', sizes: ['S', 'M'], menus: ['cashcard'], needs: ['cashcard'], href: '/dashboard/cashcard' },
  // ── Infografis native baru ──
  { id: 'team-heatmap', fam: 'team', title: 'Peta WFO bulan ini', desc: 'Heatmap kehadiran WFO per hari kerja, sekali lihat', sizes: ['M', 'L'], menus: ['attendance'], href: '/dashboard/attendance' },
  { id: 'enh-map', fam: 'enhancement', title: 'Peta enhancement', desc: 'Matriks impact vs effort dan sebaran tahap BRD', sizes: ['L'], menus: [], href: '/dashboard/enhancement' },
  { id: 'mcu-results', fam: 'mandatory', title: 'Hasil MCU', desc: 'Sebaran hasil P1–P6 dan yang belum MCU', sizes: ['M', 'L'], menus: ['mandatory'], needs: ['mandatory'], href: '/dashboard/mandatory' },
  { id: 'progress-status', fam: 'progress', title: 'Status progress', desc: 'Komposisi on track, perhatian, terlambat', sizes: ['M'], menus: ['progress'], href: '/dashboard/progress' },
  // ── Infografis Aurora v3 (klasik, interaktif penuh) ──
  { id: 'v3-team', fam: 'team', kind: 'classic', title: 'Ketersediaan tim · Aurora v3', desc: 'Presensi per hari/pekan, donut tipe kehadiran, rekap cuti — lengkap & interaktif', sizes: ['F', 'H'], menus: ['attendance'], href: '/dashboard/attendance' },
  { id: 'v3-budget-yield', fam: 'budget', kind: 'classic', title: 'Yield plan vs realisasi · Aurora v3', desc: 'Bullet chart RKAP vs realisasi per tahun', sizes: ['F', 'H'], menus: ['budget', 'budgetreport'], href: '/dashboard/budget' },
  { id: 'v3-budget-realpct', fam: 'budget', kind: 'classic', title: '% realisasi per cost element · Aurora v3', desc: 'Ring realisasi per kategori anggaran', sizes: ['H', 'F'], menus: ['budget', 'budgetreport'], href: '/dashboard/budget' },
  { id: 'v3-budget-prognosa', fam: 'budget', kind: 'classic', title: 'Prognosa & sisa budget · Aurora v3', desc: 'RKAP, terpakai, dan garis prognosa 3 tahun', sizes: ['H', 'F'], menus: ['budget', 'budgetreport'], href: '/dashboard/budget' },
  { id: 'v3-cashcard', fam: 'budget', kind: 'classic', title: 'Settlement Cash Card · Aurora v3', desc: 'Ring settlement dibanding top up', sizes: ['H', 'F'], menus: ['cashcard'], href: '/dashboard/cashcard' },
  { id: 'v3-mcu', fam: 'mandatory', kind: 'classic', title: 'MCU · Aurora v3', desc: 'Ring MCU, hasil P1–P6, terakhir MCU per status — ketuk untuk detail', sizes: ['H', 'F'], menus: ['mandatory'], href: '/dashboard/mandatory' },
  { id: 'v3-training', fam: 'mandatory', kind: 'classic', title: 'Training · Aurora v3', desc: 'Kepatuhan training per member', sizes: ['H', 'F'], menus: ['mandatory'], href: '/dashboard/mandatory' },
  { id: 'v3-kpi', fam: 'mandatory', kind: 'classic', title: 'Support KPI · Aurora v3', desc: 'Pengisian support KPI per jenis', sizes: ['H', 'F'], menus: ['mandatory'], href: '/dashboard/mandatory' },
  { id: 'v3-golive', fam: 'golive', kind: 'classic', title: 'Go-live per aplikasi · Aurora v3', desc: 'Kartu per aplikasi, ketuk untuk daftar entitas', sizes: ['F', 'H'], menus: ['golive'], href: '/dashboard/golive' },
  { id: 'notes', fam: 'notes', title: 'Catatan disematkan', desc: 'Catatan tim yang disematkan', sizes: ['M', 'L'], menus: ['notes'], internalOnly: true, href: '/dashboard/notes' },
]
export const WIDGET_BY_ID = new Map(WIDGETS.map(w => [w.id, w]))

export const DEFAULT_LAYOUT: Placed[] = [
  { id: 'summary', size: 'M' }, { id: 'progress', size: 'S' }, { id: 'team', size: 'S' },
  { id: 'agenda', size: 'M' }, { id: 'team-heatmap', size: 'M' }, { id: 'enhancement', size: 'M' }, { id: 'activity-stats', size: 'M' },
  { id: 'golive', size: 'M' }, { id: 'mandatory', size: 'M' }, { id: 'budget', size: 'M' }, { id: 'workload', size: 'L' },
  { id: 'v3-team', size: 'F' },
]
export const DEFAULT_GUEST_LAYOUT: Placed[] = [
  { id: 'progress', size: 'L' }, { id: 'enhancement', size: 'M' }, { id: 'agenda', size: 'M' }, { id: 'golive', size: 'M' },
]

/** Widget yang boleh dipakai user ini (menu diizinkan + internal/tamu). */
export function availableWidgets(allowed: Set<string> | null, internal: boolean): WidgetDef[] {
  return WIDGETS.filter(w => (internal || !w.internalOnly) && (!w.menus.length || !allowed || w.menus.some(m => allowed.has(m))))
}

export const isClassic = (id: string) => WIDGET_BY_ID.get(id)?.kind === 'classic'
/** Bagi layout menjadi potongan: widget native berurutan → grid; infografis v3 berurutan → blok alir. */
export function chunkLayout(l: Placed[]): { kind: 'grid' | 'flow'; items: { p: Placed; i: number }[] }[] {
  const out: { kind: 'grid' | 'flow'; items: { p: Placed; i: number }[] }[] = []
  l.forEach((p, i) => { const k = isClassic(p.id) ? 'flow' : 'grid'; const last = out[out.length - 1]; if (last && last.kind === k) last.items.push({ p, i }); else out.push({ kind: k, items: [{ p, i }] }) })
  return out
}
const defaultSize = (w: WidgetDef): Size => (w.sizes.includes('M') ? 'M' : w.sizes[0])

/** Bersihkan layout tersimpan: buang id tak dikenal/tak diizinkan/duplikat, ukuran tak didukung → ukuran pertama yg didukung. */
export function normalizeLayout(saved: unknown, avail: WidgetDef[], fallback: Placed[]): Placed[] {
  const ok = new Map(avail.map(w => [w.id, w]))
  const src = Array.isArray(saved) ? saved : fallback
  const out: Placed[] = [], seen = new Set<string>()
  for (const x of src as any[]) {
    const w = ok.get(String(x?.id)); if (!w || seen.has(w.id)) continue
    seen.add(w.id)
    out.push({ id: w.id, size: w.sizes.includes(x?.size) ? x.size : defaultSize(w) })
  }
  return out
}

export const addWidget = (l: Placed[], id: string, size: Size): Placed[] => l.some(p => p.id === id) ? l.map(p => p.id === id ? { ...p, size } : p) : [...l, { id, size }]
export const removeWidget = (l: Placed[], id: string): Placed[] => l.filter(p => p.id !== id)
export const resizeWidget = (l: Placed[], id: string, size: Size): Placed[] => l.map(p => p.id === id ? { ...p, size } : p)
export function moveWidget(l: Placed[], id: string, to: number): Placed[] {
  const i = l.findIndex(p => p.id === id); if (i < 0) return l
  const j = Math.max(0, Math.min(l.length - 1, to)); if (i === j) return l
  const a = [...l]; const [x] = a.splice(i, 1); a.splice(j, 0, x); return a
}
/** Data tambahan yang dibutuhkan layout (diambil hanya bila widgetnya dipasang). */
export const needsOf = (l: Placed[]): Set<Need> => new Set(l.flatMap(p => WIDGET_BY_ID.get(p.id)?.needs || []))

/** Validasi body PUT layout dari klien (server). */
export function sanitizeLayoutInput(body: unknown): Placed[] | null {
  if (!Array.isArray(body) || body.length > 40) return null
  const out: Placed[] = []
  for (const x of body) {
    const w = WIDGET_BY_ID.get(String((x as any)?.id)); const size = (x as any)?.size
    if (!w || !w.sizes.includes(size) || out.some(p => p.id === w.id)) return null
    out.push({ id: w.id, size })
  }
  return out
}
