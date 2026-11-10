// Aturan akses tamu (External / guest) — MURNI, dipakai proxy (server), sidebar, widget & halaman Konfigurasi.
// Satu sumber kebenaran: menu tamu = roleDefs['guest'].allowedMenus; opsi tambahan = Config.guestAccess;
// data widget tamu = widget yang dipasang admin di "Tampilan tamu" (Config.guestLayout).

export type GuestAccess = {
  /** Tab Issues di Dashboard. */
  issuesTab: boolean
  /** Tombol Export (Issues, Go-Live). */
  allowExport: boolean
  /** Ganti URL (link Teams/Zoom/dokumen) di teks aktivitas dengan "[link disembunyikan]". */
  hideLinks: boolean
  /** Tampilkan nama PIC di aktivitas/issue. Bila false → "Tim BPD". */
  showPic: boolean
  /** Sapaan di hero (mis. "Guest", "Tamu", "Mitra"). */
  greetingName: string
}

export const DEFAULT_GUEST_ACCESS: GuestAccess = { issuesTab: true, allowExport: false, hideLinks: true, showPic: true, greetingName: 'Guest' }

export function normalizeGuestAccess(raw: unknown): GuestAccess {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const b = (k: keyof GuestAccess) => (typeof r[k] === 'boolean' ? (r[k] as boolean) : (DEFAULT_GUEST_ACCESS[k] as boolean))
  const name = typeof r.greetingName === 'string' ? r.greetingName.replace(/[<>]/g, '').trim().slice(0, 24).trim() : ''
  return { issuesTab: b('issuesTab'), allowExport: b('allowExport'), hideLinks: b('hideLinks'), showPic: b('showPic'), greetingName: name || DEFAULT_GUEST_ACCESS.greetingName }
}

/** Halaman yang sudah dibuat aman untuk tamu (mode lihat saja) → kunci menu yang harus diizinkan admin. */
export const GUEST_PAGES: { href: string; menu: string | null; label: string; desc: string }[] = [
  { href: '/dashboard', menu: null, label: 'Dashboard', desc: 'Selalu terbuka — widget diatur di Tampilan tamu' },
  { href: '/dashboard/menu', menu: null, label: 'Menu (HP)', desc: 'Daftar menu di HP' },
  { href: '/dashboard/enhancement', menu: 'progress', label: 'Enhancement & progress', desc: 'Daftar enhancement, timeline, dan progres (lihat saja)' },
  { href: '/dashboard/golive', menu: 'golive', label: 'Go-Live', desc: 'Tabel entitas & aplikasi yang sudah go-live (lihat saja)' },
  { href: '/dashboard/calendar', menu: 'calendar', label: 'Calendar', desc: 'Kalender aktivitas tim (lihat saja)' },
  { href: '/dashboard/links', menu: 'links', label: 'Link Hub', desc: 'Kumpulan link tim — tamu hanya bisa membuka' },
]
/** Menu yang bisa diatur untuk tamu di Konfigurasi (urut tampil). */
export const GUEST_MENU_CHOICES = GUEST_PAGES.filter(p => p.menu) as { href: string; menu: string; label: string; desc: string }[]

/** Data widget (tanpa halaman) yang bisa dibuka untuk tamu lewat menu. */
export const GUEST_DATA_CHOICES: { menu: string; label: string; desc: string }[] = [
  { menu: 'attendance', label: 'Presensi tim', desc: 'Widget Tim hari ini & peta WFO' },
  { menu: 'mandatory', label: 'Mandatory', desc: 'Widget MCU, training, support KPI (data kesehatan — hati-hati)' },
  { menu: 'budget', label: 'Budget', desc: 'Widget realisasi anggaran' },
  { menu: 'cashcard', label: 'Cash Card', desc: 'Widget settlement cash card' },
]

const under = (path: string, base: string) => path === base || path.startsWith(base + '/')

/** Boleh tamu membuka halaman ini? */
export function guestCanOpenPage(pathname: string, menus: ReadonlySet<string>): boolean {
  const path = pathname.split('?')[0].replace(/\/+$/, '') || '/'
  const page = GUEST_PAGES.find(p => p.href === path)
  return !!page && (page.menu === null || menus.has(page.menu))
}

/** href widget/tautan → bisa dibuka tamu? (dipakai untuk mematikan tautan yang pasti dialihkan). */
export const guestCanOpenHref = (href: string | undefined, menus: ReadonlySet<string>) => !!href && guestCanOpenPage(href, menus)

// API baca yang selalu dibutuhkan dashboard tamu.
const ALWAYS_GET = ['/api/config', '/api/me/widgets', '/api/presence', '/api/announcements', '/api/users', '/api/projects', '/api/initiatives', '/api/enhancements', '/api/agenda', '/api/birthdays']
// API baca yang terbuka bila salah satu menu diizinkan.
const MENU_GET: { api: string; menus: string[] }[] = [
  { api: '/api/attendance', menus: ['attendance', 'calendar'] },
  { api: '/api/golive', menus: ['golive'] },
  { api: '/api/links', menus: ['links'] },
  { api: '/api/mandatory', menus: ['mandatory'] },
  { api: '/api/budget', menus: ['budget', 'budgetreport'] },
  { api: '/api/cashcard/summary', menus: ['cashcard'] },
]
/** Widget di Tampilan tamu yang butuh data menu tertentu (fam widget → menu data). */
export const FAM_DATA_MENU: Record<string, string> = { team: 'attendance', mandatory: 'mandatory', golive: 'golive', budget: 'budget' }

/**
 * Menu efektif tamu: menu dari role + menu data yang dibutuhkan widget di Tampilan tamu
 * (admin memasang widget → datanya ikut terbuka; widget dilepas → data tertutup lagi).
 */
export function effectiveGuestMenus(roleMenus: string[] | undefined, layoutWidgetFams: string[] = [], layoutWidgetIds: string[] = []): Set<string> {
  const s = new Set<string>(['dashboard', ...(roleMenus || [])])
  for (const f of layoutWidgetFams) if (FAM_DATA_MENU[f]) s.add(FAM_DATA_MENU[f])
  if (layoutWidgetIds.some(id => id === 'cashcard' || id === 'v3-cashcard')) s.add('cashcard')
  return s
}

/** Keputusan API untuk sesi tamu. */
export function guestApiAllowed(pathname: string, method: string, menus: ReadonlySet<string>, opts: { issuesTab: boolean }): boolean {
  const m = (method || 'GET').toUpperCase()
  if (m === 'POST' && pathname === '/api/presence') return true
  if (m === 'PATCH' && /^\/api\/links\/[^/]+$/.test(pathname)) return menus.has('links')   // hanya mencatat klik
  if (m !== 'GET') return false
  if (under(pathname, '/api/issues')) return opts.issuesTab
  if (ALWAYS_GET.some(p => under(pathname, p))) return true
  return MENU_GET.some(r => under(pathname, r.api) && r.menus.some(x => menus.has(x)))
}

// URL tanpa tanda baca penutup kalimat di ujungnya (", ya" tetap utuh).
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"')\]]*[^\s<>"')\].,;:!?]/gi
/** Hapus URL dari teks (link meeting/dokumen) untuk tamu. */
export function stripLinks(text: unknown): string {
  return String(text ?? '').replace(URL_RE, '[link disembunyikan]')
}

const ACT_TEXT_FIELDS = ['progressNotes', 'progress', 'nextPlan', 'notes', 'description', 'location', 'link', 'meetingLink']
/** Bersihkan satu aktivitas untuk tamu sesuai opsi admin. */
export function sanitizeActivityForGuest<T extends Record<string, any>>(a: T, opts: GuestAccess): T {
  const out: Record<string, any> = { ...a }
  if (opts.hideLinks) for (const k of ACT_TEXT_FIELDS) if (typeof out[k] === 'string') out[k] = stripLinks(out[k])
  if (!opts.showPic) {
    for (const k of ['pic', 'pics', 'picTags', 'picName', 'participants', 'members']) {
      if (Array.isArray(out[k])) out[k] = out[k].length ? ['Tim BPD'] : []
      else if (typeof out[k] === 'string' && out[k]) out[k] = 'Tim BPD'
    }
    delete out.createdBy; delete out.createdByName; delete out.updatedBy
  }
  return out as T
}

// Field konfigurasi yang boleh diterima sesi tamu (allowlist). Semua yang lain — WhatsApp/Fonnte,
// kasir, rekening, biaya transfer, nilai anggaran, gambar login, penanda cron — tidak dikirim.
const GUEST_CONFIG_KEYS = [
  'appName', 'appTagline', 'appIcon', 'appColor', 'loginTagline', 'activeYear', 'attendanceTypes', 'activityCategories',
  'activitySubTypes', 'progressSubTabs', 'issueStatuses', 'meetingCategories', 'linkCategories', 'enhancementTemplate',
  'pwaInstallEnabled', 'pwaPromptDelay', 'pwaPromptCooldown', 'guestHero', 'dashboardWidgets',
]
export function guestConfigSlice(cfg: Record<string, any> | null | undefined, menus: ReadonlySet<string>): Record<string, any> {
  const c = cfg || {}
  const out: Record<string, any> = {}
  for (const k of GUEST_CONFIG_KEYS) if (k in c) out[k] = c[k]
  // Role: tamu cukup tahu definisinya sendiri (untuk sidebar), dengan menu efektif.
  const def = (c.roleDefs || []).find((r: any) => r?.key === 'guest')
  out.roleDefs = [{ key: 'guest', label: def?.label || 'Guest', builtin: true, allowedMenus: Array.from(menus) }]
  // Kategori anggaran: label saja kecuali widget Budget dibuka untuk tamu.
  if (Array.isArray(c.budgetCategories)) out.budgetCategories = menus.has('budget') || menus.has('budgetreport')
    ? c.budgetCategories.map((b: any) => ({ key: b.key, label: b.label, annualBudget: b.annualBudget, annualBudgetUSD: b.annualBudgetUSD, threshold: b.threshold }))
    : c.budgetCategories.map((b: any) => ({ key: b.key, label: b.label }))
  out.guestAccess = normalizeGuestAccess(c.guestAccess)
  return out
}
