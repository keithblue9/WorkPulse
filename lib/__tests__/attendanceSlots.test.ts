import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { isFullDaySlot, isDuplicateSlot, duplicateSlotIds, slotsClash } from '../attendanceSlots'

const FD = { startTime: 'fullday', endTime: 'fullday' }

describe('slot presensi', () => {
  it('full day dikenali dari sentinel / jam kosong / flag', () => {
    expect(isFullDaySlot({ type: 'wfo', ...FD })).toBe(true)
    expect(isFullDaySlot({ type: 'wfo' })).toBe(true)
    expect(isFullDaySlot({ type: 'wfo', startTime: '08:00', endTime: '17:00', isFullDay: true })).toBe(true)
    expect(isFullDaySlot({ type: 'wfo', startTime: '08:00', endTime: '12:00' })).toBe(false)
  })
  it('kasus nyata tgl 11: WFO seharian + WFO 08:00 = dobel', () => {
    expect(isDuplicateSlot([{ type: 'wfo', ...FD }], { type: 'wfo', startTime: '08:00', endTime: '17:00' })).toBe(true)
    expect(isDuplicateSlot([{ type: 'wfo', startTime: '08:00', endTime: '17:00' }], { type: 'wfo', ...FD })).toBe(true)
    expect(isDuplicateSlot([{ type: 'WFO' }], { type: 'wfo', isFullDay: true })).toBe(true)
  })
  it('pagi WFO + sore WFO sah; beda tipe sah', () => {
    const ex = [{ type: 'wfo', startTime: '08:00', endTime: '12:00' }]
    expect(isDuplicateSlot(ex, { type: 'wfo', startTime: '12:00', endTime: '17:00' })).toBe(false)
    expect(isDuplicateSlot(ex, { type: 'wfo', startTime: '11:00', endTime: '13:00' })).toBe(true)
    expect(isDuplicateSlot(ex, { type: 'dinas', startTime: '08:00', endTime: '12:00' })).toBe(false)
    expect(isDuplicateSlot([{ type: 'wfo', ...FD }], { type: 'izin', ...FD })).toBe(false)
    expect(isDuplicateSlot([], { type: 'wfo' })).toBe(false)
    expect(isDuplicateSlot(null, { type: 'wfo' })).toBe(false)
  })
  it('duplicateSlotIds menyisakan kemunculan pertama', () => {
    const s = [{ _id: 'a', type: 'wfo', ...FD }, { _id: 'b', type: 'wfo', startTime: '08:00', endTime: '17:00' }, { _id: 'c', type: 'izin', ...FD }, { _id: 'd', type: 'wfo', ...FD }]
    expect(duplicateSlotIds(s)).toEqual(['b', 'd'])
  })
  it('properti: setelah hapus dobel, tak ada slot yang saling bentrok & tiap tipe tetap terwakili', () => {
    const slotArb = fc.oneof(
      fc.record({ _id: fc.uuid(), type: fc.constantFrom('wfo', 'wfh', 'dinas'), startTime: fc.constant('fullday'), endTime: fc.constant('fullday') }),
      fc.record({ _id: fc.uuid(), type: fc.constantFrom('wfo', 'wfh', 'dinas'), startTime: fc.constantFrom('07:00', '08:00', '12:00', '13:00'), endTime: fc.constantFrom('12:00', '15:00', '17:00') }),
    )
    fc.assert(fc.property(fc.array(slotArb, { maxLength: 12 }), slots => {
      const drop = new Set(duplicateSlotIds(slots))
      const kept = slots.filter(s => !drop.has(s._id))
      for (let i = 0; i < kept.length; i++) for (let j = i + 1; j < kept.length; j++) expect(slotsClash(kept[i], kept[j])).toBe(false)
      expect(new Set(kept.map(s => s.type))).toEqual(new Set(slots.map(s => s.type)))
      if (slots.length) expect(drop.has(slots[0]._id)).toBe(false)
    }), { numRuns: 1000 })
  })
})
