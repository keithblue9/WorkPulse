import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { decideAccess } from '../access'
import {
  guestCanOpenPage, guestApiAllowed, effectiveGuestMenus, normalizeGuestAccess, stripLinks, sanitizeActivityForGuest,
  DEFAULT_GUEST_ACCESS, GUEST_PAGES,
} from '../guestPolicy'

const M = (...m: string[]) => new Set(['dashboard', ...m])

describe('halaman tamu mengikuti menu dari Konfigurasi', () => {
  it('dashboard & menu selalu terbuka', () => {
    expect(guestCanOpenPage('/dashboard', M())).toBe(true)
    expect(guestCanOpenPage('/dashboard/menu', M())).toBe(true)
  })
  it('Go-Live/Calendar/Enhancement hanya bila diizinkan (bug: dulu selalu dialihkan)', () => {
    expect(guestCanOpenPage('/dashboard/golive', M())).toBe(false)
    expect(guestCanOpenPage('/dashboard/golive', M('golive'))).toBe(true)
    expect(guestCanOpenPage('/dashboard/calendar', M('calendar'))).toBe(true)
    expect(guestCanOpenPage('/dashboard/enhancement?view=progress', M('progress'))).toBe(true)
    expect(guestCanOpenPage('/dashboard/enhancement/', M('progress'))).toBe(true)
  })
  it('halaman internal tidak pernah terbuka walau menunya dicentang', () => {
    const all = M('members', 'config', 'reimbursement', 'notes', 'attendance', 'budget', 'activities', 'biodata')
    for (const p of ['/dashboard/members', '/dashboard/config', '/dashboard/reimbursements', '/dashboard/notes', '/dashboard/attendance', '/dashboard/budget', '/dashboard/activities', '/dashboard/biodata', '/dashboard/quicknotes'])
      expect(guestCanOpenPage(p, all)).toBe(false)
  })
  it('proxy memakai aturan dari Konfigurasi', () => {
    const guest = { menus: M('golive'), issuesTab: true }
    expect(decideAccess({ pathname: '/dashboard/golive', method: 'GET', roles: ['guest'], guest }).kind).toBe('next')
    expect(decideAccess({ pathname: '/dashboard/calendar', method: 'GET', roles: ['guest'], guest })).toEqual({ kind: 'redirect', to: '/dashboard?guest=blocked' })
    expect(decideAccess({ pathname: '/api/golive', method: 'GET', roles: ['guest'], guest }).kind).toBe('next')
    expect(decideAccess({ pathname: '/api/golive', method: 'POST', roles: ['guest'], guest }).kind).toBe('deny')
  })
})

describe('API tamu', () => {
  it('data keuangan & kesehatan tertutup kecuali dibuka admin (bug: dulu selalu terbuka)', () => {
    for (const a of ['/api/budget', '/api/cashcard/summary', '/api/mandatory', '/api/golive', '/api/attendance'])
      expect(guestApiAllowed(a, 'GET', M(), { issuesTab: true })).toBe(false)
    expect(guestApiAllowed('/api/budget', 'GET', M('budget'), { issuesTab: true })).toBe(true)
    expect(guestApiAllowed('/api/attendance', 'GET', M('calendar'), { issuesTab: true })).toBe(true)
  })
  it('issues mengikuti opsi tab Issues', () => {
    expect(guestApiAllowed('/api/issues', 'GET', M(), { issuesTab: false })).toBe(false)
    expect(guestApiAllowed('/api/issues', 'GET', M(), { issuesTab: true })).toBe(true)
  })
  it('klik Link Hub hanya bila Link Hub dibuka', () => {
    expect(guestApiAllowed('/api/links/abc', 'PATCH', M(), { issuesTab: true })).toBe(false)
    expect(guestApiAllowed('/api/links/abc', 'PATCH', M('links'), { issuesTab: true })).toBe(true)
    expect(guestApiAllowed('/api/links', 'POST', M('links'), { issuesTab: true })).toBe(false)
  })
  it('properti: tamu tidak pernah bisa menulis selain presence & klik link, menu apa pun', () => {
    const menus = fc.subarray(['links', 'golive', 'calendar', 'progress', 'budget', 'mandatory', 'attendance', 'cashcard', 'config', 'members'])
    const paths = fc.constantFrom('/api/projects', '/api/golive', '/api/links', '/api/users', '/api/config', '/api/todos', '/api/me/widgets', '/api/budget', '/api/mandatory', '/api/enhancements/x', '/api/attendance')
    fc.assert(fc.property(menus, paths, fc.constantFrom('POST', 'PUT', 'PATCH', 'DELETE'), fc.boolean(), (m, p, meth, it) => {
      expect(guestApiAllowed(p, meth, M(...m), { issuesTab: it })).toBe(false)
    }), { numRuns: 3000 })
  })
  it('properti: menu yang dibuka tidak pernah membuka API internal', () => {
    const menus = fc.subarray(['links', 'golive', 'calendar', 'progress', 'budget', 'mandatory', 'attendance', 'cashcard', 'notes', 'reimbursement', 'members', 'config'])
    const internal = fc.constantFrom('/api/reimbursements', '/api/notes', '/api/quicknotes', '/api/todos', '/api/pettycash', '/api/settlement', '/api/cashier', '/api/thirdparty', '/api/audit', '/api/admin/reset', '/api/profile', '/api/push', '/api/kpi', '/api/souvenir', '/api/dashboard', '/api/blob')
    fc.assert(fc.property(menus, internal, fc.boolean(), (m, p, it) => {
      expect(guestApiAllowed(p, 'GET', M(...m), { issuesTab: it })).toBe(false)
    }), { numRuns: 3000 })
  })
})

describe('menu efektif', () => {
  it('widget yang dipasang di Tampilan tamu membuka datanya', () => {
    const s = effectiveGuestMenus(['links'], ['golive', 'team', 'progress'], ['golive', 'team', 'v3-cashcard'])
    expect([...s].sort()).toEqual(['attendance', 'cashcard', 'dashboard', 'golive', 'links'])
  })
  it('tanpa widget data → tidak ada data tambahan', () => {
    expect([...effectiveGuestMenus(undefined)]).toEqual(['dashboard'])
  })
})

describe('opsi tamu & pembersihan data', () => {
  it('normalisasi aman', () => {
    expect(normalizeGuestAccess(null)).toEqual(DEFAULT_GUEST_ACCESS)
    expect(normalizeGuestAccess({ issuesTab: 'ya', greetingName: '<b>Mitra</b> SS Procurement yang panjang sekali' })).toEqual({ ...DEFAULT_GUEST_ACCESS, greetingName: 'bMitra/b SS Procurement' })
    expect(normalizeGuestAccess({ issuesTab: false, greetingName: '   ' }).greetingName).toBe('Guest')
  })
  it('link meeting dihapus', () => {
    expect(stripLinks('Link MTeams : https://teams.microsoft.com/meet/4116?p=MCv PIC : Faska')).toBe('Link MTeams : [link disembunyikan] PIC : Faska')
    expect(stripLinks('lihat www.contoh.id/doc, ya')).toBe('lihat [link disembunyikan], ya')
    expect(stripLinks(undefined)).toBe('')
  })
  it('PIC disembunyikan bila diminta, field lain utuh', () => {
    const a = { title: 'Rapat', pic: ['Erwin', 'Dwi'], picName: 'Erwin', progressNotes: 'https://x.id ok', nextPlan: 'n' }
    const r = sanitizeActivityForGuest(a, { ...DEFAULT_GUEST_ACCESS, showPic: false })
    expect(r).toEqual({ title: 'Rapat', pic: ['Tim BPD'], picName: 'Tim BPD', progressNotes: '[link disembunyikan] ok', nextPlan: 'n' })
    expect(sanitizeActivityForGuest(a, { ...DEFAULT_GUEST_ACCESS, hideLinks: false }).progressNotes).toBe('https://x.id ok')
  })
  it('properti: hasil stripLinks tidak memuat URL', () => {
    fc.assert(fc.property(fc.array(fc.oneof(fc.webUrl(), fc.string({ maxLength: 12 })), { maxLength: 8 }), parts => {
      expect(/https?:\/\//i.test(stripLinks(parts.join(' ')))).toBe(false)
    }), { numRuns: 2000 })
  })
  it('setiap halaman tamu terdaftar unik', () => {
    expect(new Set(GUEST_PAGES.map(p => p.href)).size).toBe(GUEST_PAGES.length)
  })
})

import { guestConfigSlice } from '../guestPolicy'
describe('config untuk tamu', () => {
  const cfg = {
    appName: 'WINS', fonnte: { apiUrl: 'https://api', cashierUserId: 'u9', messageToCashier: 'x' }, notifications: { waEnabled: true },
    pettyBank: { name: 'BNI', account: '123' }, cashCardBank: { account: '999' }, transferFee: { amount: 6500 }, loginBackgrounds: ['data:..'],
    lastDailyBroadcast: '2026-11-10', reimburseNotif: { enabled: true },
    roleDefs: [{ key: 'admin', allowedMenus: ['config'] }, { key: 'guest', label: 'Tamu', allowedMenus: ['links'] }],
    budgetCategories: [{ key: 'dinas', label: 'Dinas', annualBudget: 1e9, pic: 'Erwin' }],
    guestAccess: { issuesTab: false },
  }
  it('tidak membocorkan rahasia & data internal', () => {
    const s = guestConfigSlice(cfg, M('links'))
    for (const k of ['fonnte', 'notifications', 'pettyBank', 'cashCardBank', 'transferFee', 'loginBackgrounds', 'lastDailyBroadcast', 'reimburseNotif']) expect(s).not.toHaveProperty(k)
    expect(s.roleDefs).toEqual([{ key: 'guest', label: 'Tamu', builtin: true, allowedMenus: ['dashboard', 'links'] }])
    expect(s.budgetCategories).toEqual([{ key: 'dinas', label: 'Dinas' }])
    expect(s.guestAccess.issuesTab).toBe(false)
  })
  it('nilai anggaran hanya bila widget Budget dibuka; PIC tidak pernah', () => {
    expect(guestConfigSlice(cfg, M('budget')).budgetCategories[0]).toEqual({ key: 'dinas', label: 'Dinas', annualBudget: 1e9, annualBudgetUSD: undefined, threshold: undefined })
  })
})
