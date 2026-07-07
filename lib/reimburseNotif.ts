import { connectDB } from '@/lib/db'
import { ConfigModel } from '@/models/Config'
import { UserModel } from '@/models/User'
import { sendPushToUser } from '@/lib/push'

function fmt(n: number) { return new Intl.NumberFormat('id-ID').format(n || 0) }

// Ambil setting notif reimburse dari config (default: semua aktif)
export async function getReimburseNotifCfg() {
  try {
    await connectDB()
    const cfg: any = await ConfigModel.findOne({}, 'reimburseNotif').lean()
    const rn = cfg?.reimburseNotif || {}
    return {
      enabled: rn.enabled !== false,
      notifySubmit: rn.notifySubmit !== false,
      notifyTransfer: rn.notifyTransfer !== false,
    }
  } catch { return { enabled: true, notifySubmit: true, notifyTransfer: true } }
}

// Resolve email dari userId (bisa berupa email langsung, _id, atau nama)
async function resolveEmail(uid: string): Promise<string | null> {
  if (!uid) return null
  if (/@/.test(uid)) return uid
  try {
    const u: any = await UserModel.findOne({ $or: [{ _id: uid }, { name: uid }] }, 'email').lean()
    return u?.email || null
  } catch {
    try { const u: any = await UserModel.findOne({ name: uid }, 'email').lean(); return u?.email || null } catch { return null }
  }
}

// Semua email cashier aktif
async function cashierEmails(): Promise<string[]> {
  try {
    await connectDB()
    const users: any[] = await UserModel.find({ active: { $ne: false } }, 'email roles role').lean()
    return users.filter(u => (u.roles || []).includes('cashier') || u.role === 'cashier').map(u => u.email).filter(Boolean)
  } catch { return [] }
}

// Event 1: member submit reimbursement baru -> notif ke member pengaju + semua cashier
export async function notifyReimburseSubmitted(item: any) {
  const cfg = await getReimburseNotifCfg()
  if (!cfg.enabled || !cfg.notifySubmit) return { skipped: true }
  const results: any[] = []
  const submitterEmail = await resolveEmail(item.userId || item.userName)

  // Ke member pengaju: konfirmasi pengajuan diterima sistem
  if (submitterEmail) {
    results.push(await sendPushToUser(submitterEmail, {
      title: '📨 Reimburse terkirim',
      body: `Pengajuan "${item.title}" (Rp ${fmt(item.amount)}) berhasil disubmit. Menunggu transfer cashier.`,
      url: '/dashboard/reimbursements',
      tag: `reimb-submit-${item._id}`,
    }).catch(() => null))
  }

  // Ke semua cashier: ada pengajuan baru
  for (const ce of await cashierEmails()) {
    if (ce === submitterEmail) continue
    results.push(await sendPushToUser(ce, {
      title: '🔔 Reimburse baru masuk',
      body: `${item.userName || 'Member'} mengajukan "${item.title}" — Rp ${fmt(item.amount)}. Segera proses transfer.`,
      url: '/dashboard/reimbursements',
      tag: `reimb-new-${item._id}`,
    }).catch(() => null))
  }
  return { sent: results.filter(Boolean).length }
}

// Event 2: cashier klik transfer -> notif ke member pengaju (sudah ditransfer) + cashier (konfirmasi selesai)
export async function notifyReimburseTransferred(item: any) {
  const cfg = await getReimburseNotifCfg()
  if (!cfg.enabled || !cfg.notifyTransfer) return { skipped: true }
  const results: any[] = []
  const submitterEmail = await resolveEmail(item.userId || item.userName)
  const isPetty = item.isCashCard === false || item.source === 'petty_cash'

  // Ke member pengaju
  if (submitterEmail) {
    results.push(await sendPushToUser(submitterEmail, {
      title: '💸 Reimburse sudah ditransfer',
      body: `"${item.title}" — Rp ${fmt(item.totalTransfer || item.amount)} sudah ditransfer${item.bank ? ` ke ${item.bank}` : ''}${isPetty ? ' (Petty Cash — selesai)' : '. Menunggu verifikasi CC.'}`,
      url: '/dashboard/reimbursements',
      tag: `reimb-paid-${item._id}`,
    }).catch(() => null))
  }

  // Ke cashier yang transfer (by name) + fallback semua cashier: konfirmasi selesai
  const doneBy = await resolveEmail(item.transferredBy)
  const targets = doneBy ? [doneBy] : await cashierEmails()
  for (const ce of targets) {
    if (ce === submitterEmail) continue
    results.push(await sendPushToUser(ce, {
      title: '✅ Transfer berhasil',
      body: `Transfer "${item.title}" ke ${item.userName || 'member'} (Rp ${fmt(item.totalTransfer || item.amount)}) selesai.`,
      url: '/dashboard/reimbursements',
      tag: `reimb-done-${item._id}`,
    }).catch(() => null))
  }
  return { sent: results.filter(Boolean).length }
}
