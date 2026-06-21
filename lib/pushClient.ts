'use client'

// Converts the VAPID public key (base64url) into the Uint8Array format the Push API expects.
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

export async function ensurePushSubscription(): Promise<{ ok: boolean; reason?: string }> {
  if (typeof window === 'undefined') return { ok: false, reason: 'no-window' }
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { ok: false, reason: 'unsupported' }
  }
  let permission = Notification.permission
  if (permission === 'default') permission = await Notification.requestPermission()
  if (permission !== 'granted') return { ok: false, reason: 'denied' }

  try {
    const reg = await navigator.serviceWorker.ready
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidPublic) return { ok: false, reason: 'no-vapid-key' }
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidPublic) })
    }
    await fetch('/api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: sub }) })
    return { ok: true }
  } catch (e: any) {
    return { ok: false, reason: e?.message || 'subscribe-failed' }
  }
}
