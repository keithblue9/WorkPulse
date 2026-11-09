import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import {
  dueLabel, dueBucket, overallStatus, groupTodos, needsPopup, morningDigest, cleanTodoInput, mergeAssignees,
  inScope, isPersonal, viewStatus, jakartaToday, addDays, type TodoLike, type TodoStatus,
} from '../todo'

const T = '2026-11-09'
const mk = (o: Partial<TodoLike> = {}): TodoLike => ({ title: 'Tugas', createdByEmail: 'erwin@x.id', assignees: [{ email: 'dwi@x.id', status: 'todo' }], ...o })

describe('tenggat', () => {
  it('label relatif', () => {
    expect(dueLabel(T, T)).toBe('Hari ini')
    expect(dueLabel('2026-11-10', T)).toBe('Besok')
    expect(dueLabel('2026-11-08', T)).toBe('Kemarin')
    expect(dueLabel('2026-11-06', T)).toBe('Lewat 3 hari')
    expect(dueLabel('2026-11-12', T)).toBe('3 hari lagi')
    expect(dueLabel('', T)).toBe('Tanpa tenggat')
    expect(dueLabel('2026-13-40', T)).toBe('Tanpa tenggat')
  })
  it('bucket', () => {
    expect(dueBucket('2026-11-01', T)).toBe('overdue')
    expect(dueBucket(T, T)).toBe('today')
    expect(dueBucket('2026-11-10', T)).toBe('tomorrow')
    expect(dueBucket('2026-11-16', T)).toBe('week')
    expect(dueBucket('2026-11-17', T)).toBe('later')
    expect(dueBucket(undefined, T)).toBe('none')
  })
  it('hari ini WIB: 23:30 UTC sudah besoknya di Jakarta', () => {
    expect(jakartaToday(new Date('2026-11-08T23:30:00Z'))).toBe('2026-11-09')
    expect(jakartaToday(new Date('2026-11-09T16:59:00Z'))).toBe('2026-11-09')
  })
})

describe('status & cakupan', () => {
  it('status keseluruhan', () => {
    expect(overallStatus(mk({ assignees: [] }))).toBe('todo')
    expect(overallStatus(mk({ assignees: [{ email: 'a', status: 'done' }, { email: 'b', status: 'todo' }] }))).toBe('in_progress')
    expect(overallStatus(mk({ assignees: [{ email: 'a', status: 'done' }, { email: 'b', status: 'done' }] }))).toBe('done')
  })
  it('pribadi vs diberikan', () => {
    const own = mk({ assignees: [{ email: 'ERWIN@x.id', status: 'todo' }] })
    expect(isPersonal(own)).toBe(true)
    expect(inScope(own, 'erwin@x.id', 'mine')).toBe(true)
    expect(inScope(own, 'erwin@x.id', 'given')).toBe(false)
    const given = mk()
    expect(inScope(given, 'erwin@x.id', 'given')).toBe(true)
    expect(inScope(given, 'erwin@x.id', 'mine')).toBe(false)
    expect(inScope(given, 'dwi@x.id', 'mine')).toBe(true)
    expect(inScope(given, 'felix@x.id', 'all')).toBe(false)
  })
  it('viewStatus pakai progres sendiri', () => {
    const t = mk({ assignees: [{ email: 'dwi@x.id', status: 'done' }, { email: 'felix@x.id', status: 'todo' }] })
    expect(viewStatus(t, 'dwi@x.id')).toBe('done')
    expect(viewStatus(t, 'erwin@x.id')).toBe('in_progress')
  })
})

describe('popup & notif pagi', () => {
  it('hanya tugas dari orang lain, belum selesai, ada tenggat (termasuk terlambat)', () => {
    expect(needsPopup(mk({ dueDate: '2026-11-12' }), 'dwi@x.id')).toBe(true)
    expect(needsPopup(mk({ dueDate: '2026-11-01' }), 'dwi@x.id')).toBe(true)
    expect(needsPopup(mk({ dueDate: '' }), 'dwi@x.id')).toBe(false)
    expect(needsPopup(mk({ dueDate: T }), 'erwin@x.id')).toBe(false)
    expect(needsPopup(mk({ dueDate: T, assignees: [{ email: 'dwi@x.id', status: 'done' }] }), 'dwi@x.id')).toBe(false)
    expect(needsPopup(mk({ dueDate: T, archived: true }), 'dwi@x.id')).toBe(false)
    expect(needsPopup(mk({ dueDate: T, createdByEmail: 'dwi@x.id', assignees: [{ email: 'dwi@x.id', status: 'todo' }] }), 'dwi@x.id')).toBe(false)
  })
  it('isi notif pagi', () => {
    const d = morningDigest([mk({ title: 'Kirim BRD', dueDate: '2026-11-08' }), mk({ title: 'Review SOP', dueDate: '2026-11-11' })], 'dwi@x.id', T)!
    expect(d.title).toContain('2 tugas aktif')
    expect(d.title).toContain('1 terlambat')
    expect(d.body).toContain('Kirim BRD (kemarin)')
    expect(morningDigest([mk({ dueDate: T })], 'felix@x.id', T)).toBeNull()
  })
})

describe('validasi input', () => {
  it('judul wajib & batas', () => {
    expect(cleanTodoInput({ title: '  ' })).toEqual({ error: 'Judul wajib diisi' })
    expect(cleanTodoInput({ title: 'x'.repeat(201) })).toEqual({ error: 'Judul maksimal 200 karakter' })
    expect(cleanTodoInput({ title: { $gt: '' } })).toEqual({ error: 'Judul wajib diisi' })
  })
  it('tanggal/jam/assignee', () => {
    expect(cleanTodoInput({ title: 'a', dueDate: '2026-02-30x' })).toEqual({ error: 'Tanggal tenggat tidak valid' })
    expect(cleanTodoInput({ title: 'a', dueTime: '09:00' })).toEqual({ error: 'Isi tanggal tenggat sebelum jam' })
    expect(cleanTodoInput({ title: 'a', dueDate: T, dueTime: '25:00' })).toEqual({ error: 'Jam tenggat tidak valid' })
    expect(cleanTodoInput({ title: 'a', assignees: [{ $ne: 1 }] })).toEqual({ error: 'Daftar penerima tidak valid' })
    expect(cleanTodoInput({ title: 'a', priority: 'urgent' })).toEqual({ error: 'Prioritas tidak valid' })
    const ok = cleanTodoInput({ title: ' Kirim ', dueDate: T, dueTime: '09:30', assignees: ['Dwi@X.id', 'dwi@x.id', ''] }) as any
    expect(ok.data).toEqual({ title: 'Kirim', dueDate: T, dueTime: '09:30', assignees: ['dwi@x.id'] })
  })
  it('partial edit tidak mewajibkan judul', () => {
    expect(cleanTodoInput({ priority: 'high' }, { partial: true })).toEqual({ data: { priority: 'high' } })
  })
  it('properti: input acak tidak pernah melempar; hasil valid selalu bersih', () => {
    fc.assert(fc.property(fc.record({ title: fc.anything(), note: fc.anything(), dueDate: fc.anything(), dueTime: fc.anything(), priority: fc.anything(), assignees: fc.anything() }, { requiredKeys: [] }), body => {
      const r = cleanTodoInput(body as any)
      if ('data' in r) {
        expect(typeof r.data.title).toBe('string'); expect((r.data.title as string).length).toBeGreaterThan(0)
        if (r.data.assignees) (r.data.assignees as unknown[]).forEach(e => expect(typeof e).toBe('string'))
      } else expect(typeof r.error).toBe('string')
    }), { numRuns: 2000 })
  })
})

describe('assignee & pengelompokan', () => {
  it('merge mempertahankan progres lama', () => {
    const prev = [{ email: 'dwi@x.id', name: 'Dwi', status: 'in_progress' as TodoStatus, eta: '2026-11-12' }]
    const m = mergeAssignees(prev, ['dwi@x.id', 'felix@x.id'], e => e.split('@')[0])
    expect(m[0]).toMatchObject({ status: 'in_progress', eta: '2026-11-12' })
    expect(m[1]).toMatchObject({ email: 'felix@x.id', name: 'felix', status: 'todo' })
  })
  it('properti: pengelompokan memuat setiap tugas tepat sekali, bucket konsisten', () => {
    const arb = fc.record({
      title: fc.string({ minLength: 1, maxLength: 8 }),
      dueDate: fc.oneof(fc.constant(''), fc.integer({ min: -20, max: 30 }).map(n => addDays(T, n))),
      status: fc.constantFrom('todo', 'in_progress', 'done') as fc.Arbitrary<TodoStatus>,
    })
    fc.assert(fc.property(fc.array(arb, { maxLength: 40 }), rows => {
      const list = rows.map((r, i) => mk({ _id: String(i), title: r.title, dueDate: r.dueDate, assignees: [{ email: 'dwi@x.id', status: r.status }] }))
      const g = groupTodos(list, 'dwi@x.id', T)
      const ids = g.flatMap(x => x.items.map(t => t._id)).sort()
      expect(ids).toEqual(list.map(t => t._id).sort())
      g.forEach(grp => grp.items.forEach(t => {
        if (grp.key === 'done') expect(t.assignees[0].status).toBe('done')
        else { expect(t.assignees[0].status).not.toBe('done'); expect(dueBucket(t.dueDate, T)).toBe(grp.key) }
      }))
    }), { numRuns: 1000 })
  })
})
