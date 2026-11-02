// Helper murni slot presensi (tanpa DOM/DB) — dipakai UI & API supaya aturan duplikat sama.
// Aturan: dua slot dianggap DOBEL bila tipenya sama DAN jamnya bertumpuk.
// "Seharian" bertumpuk dengan jam berapa pun (mis. WFO seharian + WFO 08:00–17:00 = dobel),
// sedangkan WFO 08:00–12:00 + WFO 13:00–17:00 sah (tidak bertumpuk).

/** Slot dianggap seharian bila jam kosong / bertanda 'fullday' / isFullDay. */
export function isFullDaySlot(slot: any): boolean {
  const st = slot?.startTime, et = slot?.endTime
  if (!st || !et || st === 'fullday' || et === 'fullday') return true
  return slot?.isFullDay === true
}

const typeOf = (s: any) => String(s?.type || '').trim().toLowerCase()
const mins = (t: string) => { const [h, m] = String(t).split(':').map(Number); return (h || 0) * 60 + (m || 0) }
/** Rentang menit [mulai, selesai); seharian = sepanjang hari. */
function range(s: any): [number, number] {
  if (isFullDaySlot(s)) return [0, 24 * 60]
  const a = mins(s.startTime), b = mins(s.endTime)
  return b > a ? [a, b] : [a, a + 1]   // jam tidak valid → tetap dianggap 1 titik waktu
}

/** Kunci identitas slot: tipe + rentang jam (untuk tampilan/pengelompokan). */
export function slotKey(slot: any): string {
  return isFullDaySlot(slot) ? `${typeOf(slot)}|fullday` : `${typeOf(slot)}|${slot.startTime}|${slot.endTime}`
}

/** True bila dua slot bertipe sama dan jamnya bertumpuk. */
export function slotsClash(a: any, b: any): boolean {
  if (typeOf(a) !== typeOf(b)) return false
  const [a1, a2] = range(a), [b1, b2] = range(b)
  return a1 < b2 && b1 < a2
}

/** True bila `slot` bentrok dengan salah satu slot di `existing`. */
export function isDuplicateSlot(existing: any[] | undefined | null, slot: any): boolean {
  return (existing || []).some(s => slotsClash(s, slot))
}

/** Id slot salinan (yang bentrok dengan slot sebelumnya yang dipertahankan) — untuk "Hapus dobel". */
export function duplicateSlotIds(slots: any[] | undefined | null): string[] {
  const kept: any[] = []; const out: string[] = []
  for (const s of slots || []) {
    if (kept.some(k => slotsClash(k, s))) { if (s?._id) out.push(String(s._id)) } else kept.push(s)
  }
  return out
}
