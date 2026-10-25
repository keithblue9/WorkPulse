import { describe, expect, it } from 'vitest'
import { ACTIVITY_FIELDS, addedPics, diffFields } from '../changeLog'

describe('addedPics', () => {
  it('hanya nama yang baru ditambahkan', () => {
    expect(addedPics(['Erwin Harry Saputra'], ['Erwin Harry Saputra', 'Nabila Fithri Azizah'])).toEqual(['Nabila Fithri Azizah'])
  })
  it('nama depan dianggap orang yang sama', () => {
    expect(addedPics(['Erwin'], ['Erwin Harry Saputra'])).toEqual([])
  })
  it('string tunggal & kosong', () => {
    expect(addedPics(undefined, 'Augina')).toEqual(['Augina'])
    expect(addedPics(['A'], [])).toEqual([])
    expect(addedPics([], ['  ', 'Bakhlit', 'bakhlit'])).toEqual(['Bakhlit'])
  })
})

describe('diffFields', () => {
  it('mencatat field yang berubah saja, dengan label', () => {
    const c = diffFields({ status: 'open', title: 'A', pic: ['X'] }, { status: 'done', title: 'A', pic: ['X', 'Y'], foo: 1 }, ACTIVITY_FIELDS)
    expect(c).toEqual([{ field: 'status', label: 'Status', from: 'open', to: 'done' }, { field: 'pic', label: 'PIC', from: 'X', to: 'X, Y' }])
  })
  it('field yang tidak dikirim tidak dicatat; kosong ditampilkan —', () => {
    expect(diffFields({ status: 'open' }, {}, ACTIVITY_FIELDS)).toEqual([])
    expect(diffFields({}, { nextPlan: 'Rapat' }, ACTIVITY_FIELDS)[0]).toMatchObject({ from: '—', to: 'Rapat' })
  })
  it('angka & boolean diformat', () => {
    const c = diffFields({ amount: 1000, isCashCard: false }, { amount: 2500, isCashCard: true }, { amount: 'Nominal', isCashCard: 'CC' })
    expect(c.map(x => x.to)).toEqual(['2.500', 'Ya'])
  })
  it('tanggal ISO dipotong ke tanggal; sama nilai tidak dicatat', () => {
    expect(diffFields({ d: '2026-10-01' }, { d: '2026-10-01T00:00:00.000Z' }, { d: 'Tgl' })).toEqual([])
  })
})
