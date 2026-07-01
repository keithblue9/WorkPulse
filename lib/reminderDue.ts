// Menentukan apakah sebuah reminder "due" (harus dikirim) pada waktu `now`.
// Pakai CATCH-UP window: reminder dianggap due kalau waktu terjadwal utk periode ini
// SUDAH lewat dan belum pernah difire utk periode itu (pakai fireKey). Jadi walau cek
// tidak tepat di menit yg sama (mis. app baru dibuka jam 9 utk reminder jam 8:30),
// tetap terkirim — asal endpoint dipanggil minimal sekali setelah waktu terjadwal.

type Reminder = {
  enabled?: boolean
  mode?: 'once' | 'daily' | 'weekly' | 'biweekly' | 'monthly'
  datetime?: string
  time?: string
  weekday?: number | null
  dayOfMonth?: number | null
  anchorDate?: string
  lastFiredKey?: string
}

const pad = (n: number) => String(n).padStart(2, '0')
const toMin = (t?: string) => { const [h, m] = String(t || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0) }

export function computeReminderDue(r: Reminder | undefined, now: Date): { due: boolean; fireKey: string; disable: boolean } {
  const none = { due: false, fireKey: '', disable: false }
  if (!r || !r.enabled) return none

  const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const nowMin = now.getHours() * 60 + now.getMinutes()

  if (r.mode === 'once') {
    if (!r.datetime) return none
    const diff = now.getTime() - new Date(r.datetime).getTime()
    // fire sekali setelah target lewat (catch-up sampai 24 jam biar yg lama ga nge-spam)
    if (diff >= 0 && diff < 24 * 3600 * 1000) return { due: true, fireKey: `once-${r.datetime}`, disable: true }
    return none
  }

  if (!r.time) return none
  const timePassed = nowMin >= toMin(r.time)
  if (!timePassed) return none

  if (r.mode === 'daily') {
    return { due: true, fireKey: `daily-${dateStr}`, disable: false }
  }

  if (r.mode === 'weekly' || r.mode === 'biweekly') {
    const wd = (typeof r.weekday === 'number') ? r.weekday : new Date((r.anchorDate || dateStr) + 'T00:00:00').getDay()
    if (now.getDay() !== wd) return none
    if (r.mode === 'biweekly' && r.anchorDate) {
      const a = new Date(r.anchorDate + 'T00:00:00')
      const weeks = Math.floor((now.getTime() - a.getTime()) / (7 * 24 * 3600 * 1000))
      if (weeks % 2 !== 0) return none
    }
    return { due: true, fireKey: `${r.mode}-${dateStr}`, disable: false }
  }

  if (r.mode === 'monthly') {
    const dom = r.dayOfMonth || new Date((r.anchorDate || dateStr) + 'T00:00:00').getDate()
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const targetDom = Math.min(dom, lastDay) // tanggal 31 di bulan pendek -> hari terakhir
    if (now.getDate() !== targetDom) return none
    return { due: true, fireKey: `monthly-${now.getFullYear()}-${pad(now.getMonth() + 1)}`, disable: false }
  }

  return none
}

export function reminderLabel(r: Reminder | undefined): string {
  if (!r?.enabled) return ''
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
  if (r.mode === 'once') return r.datetime ? new Date(r.datetime).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Aktif'
  if (r.mode === 'daily') return `Tiap hari ${r.time || ''}`
  if (r.mode === 'weekly') return `Tiap ${days[r.weekday ?? 0]} ${r.time || ''}`
  if (r.mode === 'biweekly') return `Tiap 2 pekan (${days[r.weekday ?? 0]}) ${r.time || ''}`
  if (r.mode === 'monthly') return `Tiap tgl ${r.dayOfMonth || '?'} ${r.time || ''}`
  return 'Aktif'
}
