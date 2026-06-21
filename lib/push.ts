import webpush from 'web-push'
import { connectDB } from '@/lib/db'
import { PushSubscriptionModel } from '@/models/PushSubscription'

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || ''
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || ''
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@example.com'

let configured = false
function ensureConfigured() {
  if (configured || !VAPID_PUBLIC || !VAPID_PRIVATE) return
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
  configured = true
}

export async function sendPushToUser(userEmail: string, payload: { title: string; body: string; url?: string; tag?: string }) {
  ensureConfigured()
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return { sent: 0, error: 'VAPID keys belum di-set' }
  await connectDB()
  const subs = await PushSubscriptionModel.find({ userEmail }).lean()
  let sent = 0
  const stale: string[] = []
  for (const s of subs as any[]) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: s.keys } as any,
        JSON.stringify(payload)
      )
      sent++
    } catch (e: any) {
      // 404/410 = subscription expired/revoked on the browser side — clean it up
      if (e?.statusCode === 404 || e?.statusCode === 410) stale.push(s.endpoint)
    }
  }
  if (stale.length) await PushSubscriptionModel.deleteMany({ endpoint: { $in: stale } })
  return { sent, total: subs.length }
}
