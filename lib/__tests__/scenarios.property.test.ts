// Step 7A — skenario fungsional terprogram (property-based, fast-check).
// 10.000 skenario POSITIF (input valid → hasil benar) dan 10.000 skenario NEGATIF
// (input kosong/salah format/injeksi/akses tanpa izin → ditolak atau aman).
// Jumlah eksekusi dihitung oleh `run()` dan diverifikasi di akhir file.
import { describe, it, expect, afterAll } from 'vitest'
import fc from 'fast-check'
import { cleanEnhancement } from '@/lib/enhancementInput'
import { score, brdPct, normWeights, CATS, ENH_APPS, TPL } from '@/lib/enhancement'
import { parseScore } from '@/lib/enhancementImport'
import { calc, planAt, ptd, isoDay, DAY, type Act } from '@/lib/progress'
import { fmtMoney, parseMoney } from '@/lib/money'
import { decideAccess, forbiddenUserFields, sanitizeUser, loginDirectory } from '@/lib/access'
import { notesForYear } from '@/lib/notesView'
import { yearsRange, clampYear } from '@/lib/yearRange'

const count = { pos: 0, neg: 0 }
function run<T>(kind: 'pos' | 'neg', arb: fc.Arbitrary<T>, numRuns: number, prop: (v: T) => void) {
  fc.assert(fc.property(arb, v => { prop(v); count[kind]++ }), { numRuns, seed: 20261025 })
}

// ---------- arbitraries ----------
const score05 = fc.integer({ min: 0, max: 5 })
const item = fc.record({ t: fc.string({ minLength: 1, maxLength: 40 }), u: score05, f: score05, fl: score05, pb: score05 })
const validEnh = fc.record({
  app: fc.constantFrom(...ENH_APPS), title: fc.string({ minLength: 3, maxLength: 120 }).filter(s => s.trim().length >= 3),
  year: fc.integer({ min: 2020, max: 2100 }), type: fc.constantFrom('New', 'Carry Over'), stage: fc.integer({ min: 1, max: 7 }),
  items: fc.array(item, { maxLength: 15 }), pic: fc.array(fc.string({ maxLength: 20 }), { maxLength: 5 }),
})
const day = fc.integer({ min: Date.UTC(2024, 0, 1), max: Date.UTC(2028, 11, 31) }).map(t => Math.floor(t / DAY) * DAY)
const act: fc.Arbitrary<Act> = fc.tuple(day, fc.integer({ min: 0, max: 400 }), fc.integer({ min: 0, max: 50 }), fc.integer({ min: 0, max: 100 }))
  .map(([s, len, w, pct]) => ({ name: 'A', start: isoDay(s), end: isoDay(s + len * DAY), w, pct }))
const HOSTILE = ['<script>alert(1)</script>', '"><img src=x onerror=alert(1)>', "'; DROP TABLE users; --", '{"$gt":""}', '$where', '__proto__', 'javascript:alert(1)', '\u0000', '../../etc/passwd', 'x'.repeat(5000)]
const hostileStr = fc.oneof(fc.constantFrom(...HOSTILE), fc.string({ maxLength: 60 }), fc.fullUnicodeString({ maxLength: 30 }))
const apiSeg = fc.stringMatching(/^[a-z][a-z0-9-]{0,14}$/)
const PUBLIC = ['auth', 'warmup', 'cron']
const ROLES = ['admin', 'manager', 'member', 'finance', 'cashier', 'ccholder']

describe('Step 7A — 10.000 skenario positif', () => {
  it('P1 enhancement valid selalu diterima & dinormalisasi (1.500)', () => run('pos', validEnh, 1500, b => {
    const r = cleanEnhancement(b as any, false)
    expect(r.ok).toBe(true)
    if (r.ok) { expect(ENH_APPS).toContain(r.data.app); expect(r.data.title!.length).toBeLessThanOrEqual(300); expect(r.data.items!.length).toBeLessThanOrEqual(b.items.length) }
  }))
  it('P2 skor impact/effort selalu 0–5 dengan kategori sah (1.000)', () => run('pos', fc.array(item, { maxLength: 20 }), 1000, items => {
    const s = score(items)
    expect(s.impact).toBeGreaterThanOrEqual(0); expect(s.impact).toBeLessThanOrEqual(5)
    expect(s.effort).toBeGreaterThanOrEqual(0); expect(s.effort).toBeLessThanOrEqual(5)
    expect([...CATS, 'Belum dinilai', 'Belum lengkap']).toContain(s.cat)
  }))
  it('P3 progress: plan & actual 0–100, SPI null atau ≥ 0 (1.000)', () => run('pos', fc.tuple(fc.array(act, { minLength: 1, maxLength: 8 }), day), 1000, ([acts, t]) => {
    const c = calc(acts, t)
    for (const v of [c.plan, c.actual]) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(100.0000001) }
    expect(c.spi === null || c.spi >= 0).toBe(true)
  }))
  it('P4 rencana-sampai-tanggal linier: monoton naik terhadap waktu (1.000)', () => run('pos', fc.tuple(act, day, fc.integer({ min: 0, max: 60 })), 1000, ([a, t, d]) => {
    const p1 = ptd(a, t), p2 = ptd(a, t + d * DAY)
    expect(p2).toBeGreaterThanOrEqual(p1); expect(p1).toBeGreaterThanOrEqual(0); expect(p2).toBeLessThanOrEqual(100)
    expect(planAt([a], t)).toBeCloseTo(p1, 9)
  }))
  it('P5 format uang IDR bolak-balik tanpa kehilangan nilai (1.000)', () => run('pos', fc.integer({ min: -1e12, max: 1e12 }), 1000, n => {
    expect(parseMoney(fmtMoney(n, 'IDR'), 'IDR')).toBe(n)
  }))
  it('P6 user internal yang login boleh memanggil API umum (1.000)', () => run('pos', fc.tuple(fc.constantFrom(...ROLES), apiSeg, fc.constantFrom('GET', 'POST', 'PATCH')), 1000, ([role, seg, m]) => {
    fc.pre(seg !== 'admin' && seg !== 'users')
    expect(decideAccess({ pathname: `/api/${seg}`, method: m, roles: [role] }).kind).toBe('next')
  }))
  it('P7 direktori login hanya berisi 4 field dari user aktif non-tamu (1.000)', () => run('pos', fc.array(fc.record({ name: fc.string(), email: fc.string(), active: fc.boolean(), roles: fc.array(fc.constantFrom('guest', ...ROLES), { maxLength: 3 }), password: fc.string(), noKtp: fc.string() }), { maxLength: 12 }), 1000, users => {
    const out = loginDirectory(users)
    for (const u of out) expect(Object.keys(u).sort()).toEqual(['division', 'email', 'name', 'role'])
    expect(out.length).toBe(users.filter(u => u.active !== false && !(u.roles.length && u.roles.every(r => r === 'guest'))).length)
  }))
  it('P8 data member yang dikirim tidak pernah memuat password/token (1.000)', () => run('pos', fc.tuple(fc.record({ name: fc.string(), password: fc.string(), fonnteToken: fc.string(), noKtp: fc.string() }), fc.array(fc.constantFrom('guest', ...ROLES), { minLength: 1, maxLength: 2 })), 1000, ([u, roles]) => {
    const s = sanitizeUser(u, roles)
    expect('password' in s).toBe(false); expect('fonnteToken' in s).toBe(false)
    if (roles.every(r => r === 'guest')) expect('noKtp' in s).toBe(false)
  }))
  it('P9 catatan tersemat selalu tampil di tahun mana pun (500)', () => run('pos', fc.tuple(fc.array(fc.record({ _id: fc.uuid(), title: fc.string(), date: day.map(isoDay), pinned: fc.boolean() }), { maxLength: 15 }), fc.integer({ min: 2024, max: 2028 })), 500, ([notes, y]) => {
    const out = notesForYear(notes, y)
    for (const n of notes) if (n.pinned) expect(out).toContain(n)
    for (const n of out) expect(notes).toContain(n)
  }))
  it('P10 BRD % 0–100 dan bobot template selalu 5 angka (500)', () => run('pos', fc.tuple(fc.integer({ min: -10, max: 20 }), fc.array(fc.record({ name: fc.constantFrom(...TPL), w: fc.integer({ min: 0, max: 100 }) }), { maxLength: 5 })), 500, ([st, cfg]) => {
    const p = brdPct(st); expect(p).toBeGreaterThanOrEqual(0); expect(p).toBeLessThanOrEqual(100)
    const w = normWeights(cfg); expect(w).toHaveLength(5); expect(w.some(x => x > 0)).toBe(true)
  }))
  it('P11 pemilih tahun selalu mengembalikan tahun yang tersedia (500)', () => run('pos', fc.tuple(fc.array(fc.integer({ min: 2020, max: 2030 }), { maxLength: 6 }), fc.integer({ min: 2024, max: 2030 }), fc.oneof(fc.integer({ min: 1990, max: 2040 }), fc.constant(null))), 500, ([data, now, saved]) => {
    const ys = yearsRange(data, now)
    expect(ys).toContain(now); expect(ys).toContain(now + 1)
    expect(ys).toContain(clampYear(saved, ys, now))
  }))
})

describe('Step 7A — 10.000 skenario negatif', () => {
  it('N1 skor di luar 0–5 / bukan bilangan bulat ditolak (1.500)', () => run('neg', fc.tuple(validEnh, fc.oneof(fc.integer({ min: 6, max: 1e6 }), fc.integer({ min: -1e6, max: -1 }), fc.double({ min: 0.01, max: 4.99, noInteger: true }), fc.constantFrom('abc', 'NaN', '5x', {}, [])), fc.constantFrom('u', 'f', 'fl', 'pb')), 1500, ([b, bad, k]) => {
    const r = cleanEnhancement({ ...b, items: [{ t: 'x', u: 1, f: 1, fl: 1, pb: 1, [k]: bad }] } as any, false)
    expect(r.ok).toBe(false)
  }))
  it('N2 judul kosong/pendek, tahun, tahap, bobot tidak valid ditolak (1.500)', () => run('neg', fc.tuple(validEnh, fc.oneof(
    fc.record({ title: fc.constantFrom('', ' ', 'ab', '  a ') }),
    fc.record({ year: fc.oneof(fc.integer({ min: -5000, max: 2019 }), fc.integer({ min: 2101, max: 99999 }), fc.constant('dua ribu')) }),
    fc.record({ stage: fc.oneof(fc.integer({ min: 8, max: 999 }), fc.integer({ min: -99, max: 0 }), fc.constant(2.5)) }),
    fc.record({ weights: fc.oneof(fc.constant([0, 0, 0, 0, 0]), fc.array(fc.integer({ min: 0, max: 100 }), { maxLength: 4 }), fc.constant([10, 10, 10, 10, -5]), fc.constant([10, 10, 10, 10, 101])) }),
    fc.record({ app: fc.constantFrom('', '   ') }),
  )), 1500, ([b, bad]) => {
    expect(cleanEnhancement({ ...b, ...bad } as any, false).ok).toBe(false)
  }))
  it('N3 injeksi XSS/NoSQL tidak menambah field liar & panjang dibatasi (1.500)', () => run('neg', fc.tuple(validEnh, hostileStr, hostileStr), 1500, ([b, h1, h2]) => {
    const body: any = { ...b, title: 'abc ' + h1, notes: h2, $where: h1, __proto__: { admin: true }, constructor: h2, ['$set']: { roles: ['admin'] }, code: h2 }
    const r = cleanEnhancement(body, false)
    if (r.ok) {
      const allowed = ['app', 'code', 'title', 'type', 'initiator', 'year', 'items', 'stage', 'weights', 'phases', 'pic', 'notes']
      for (const k of Object.keys(r.data)) expect(allowed).toContain(k)
      expect(r.data.title!.length).toBeLessThanOrEqual(300); expect((r.data.notes || '').length).toBeLessThanOrEqual(5000); expect((r.data.code || '').length).toBeLessThanOrEqual(20)
      expect((r.data as any).admin).toBeUndefined()
    }
  }))
  it('N4 panggilan API tanpa login ditolak 401 (1.500)', () => run('neg', fc.tuple(apiSeg, fc.constantFrom('GET', 'POST', 'PUT', 'PATCH', 'DELETE'), fc.option(apiSeg, { nil: undefined })), 1500, ([seg, m, sub]) => {
    fc.pre(!PUBLIC.includes(seg))
    const d = decideAccess({ pathname: `/api/${seg}${sub ? '/' + sub : ''}`, method: m, roles: null, search: '' })
    expect(d).toMatchObject({ kind: 'deny', status: 401 })
  }))
  it('N5 tamu tidak bisa menulis data (1.500)', () => run('neg', fc.tuple(apiSeg, fc.constantFrom('POST', 'PUT', 'PATCH', 'DELETE'), fc.option(apiSeg, { nil: undefined })), 1500, ([seg, m, sub]) => {
    fc.pre(!PUBLIC.includes(seg) && !(m === 'POST' && seg === 'presence' && !sub) && !(m === 'PATCH' && seg === 'links' && sub))
    expect(decideAccess({ pathname: `/api/${seg}${sub ? '/' + sub : ''}`, method: m, roles: ['guest'] })).toMatchObject({ kind: 'deny', status: 403 })
  }))
  it('N6 member tidak bisa menaikkan role / mengganti PIN orang lain (1.000)', () => run('neg', fc.tuple(fc.subarray(['role', 'roles', 'password', 'active', 'email', 'sortOrder'], { minLength: 1 }), fc.array(fc.constantFrom('member', 'finance', 'cashier', 'ccholder', 'guest'), { minLength: 1, maxLength: 3 })), 1000, ([keys, roles]) => {
    const body = Object.fromEntries(keys.map(k => [k, k === 'roles' ? ['admin'] : 'x']))
    expect(forbiddenUserFields(body, roles).sort()).toEqual([...keys].sort())
  }))
  it('N7 skor Excel rusak tidak pernah jadi angka di luar 0–5 (500)', () => run('neg', fc.oneof(fc.string({ maxLength: 20 }), fc.integer({ min: -100, max: 100 }), fc.double(), fc.constant(null)), 500, v => {
    const r = parseScore(v)
    expect(r === null || r === 'bad' || (Number.isInteger(r) && r >= 0 && r <= 5)).toBe(true)
  }))
  it('N8 input uang sembarang selalu menghasilkan angka berhingga (500)', () => run('neg', fc.tuple(hostileStr, fc.constantFrom('IDR', 'USD') as fc.Arbitrary<'IDR' | 'USD'>), 500, ([s, c]) => {
    expect(Number.isFinite(parseMoney(s, c))).toBe(true)
  }))
  it('N9 path mirip (lookalike) tidak dianggap publik (500)', () => run('neg', fc.tuple(fc.constantFrom(...PUBLIC), fc.stringMatching(/^[a-z0-9-]{1,10}$/)), 500, ([p, suffix]) => {
    expect(decideAccess({ pathname: `/api/${p}${suffix}`, method: 'GET', roles: null }).kind).toBe('deny')
  }))
})

afterAll(() => {
  // eslint-disable-next-line no-console
  console.log(`[Step 7A] skenario positif: ${count.pos} · skenario negatif: ${count.neg}`)
})
describe('Step 7A — jumlah skenario', () => {
  it('tepat 10.000 positif dan 10.000 negatif dijalankan', () => {
    // fc.pre bisa melewati beberapa kasus; hitungan hanya mencatat kasus yang benar-benar diperiksa
    expect(count.pos).toBeGreaterThanOrEqual(9900)
    expect(count.neg).toBeGreaterThanOrEqual(9900)
  })
})
