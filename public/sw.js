const CACHE = 'wins-v2'
const ASSETS = ['/', '/dashboard', '/icon-192.svg', '/icon-512.svg']

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(()=>{}))
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))))
  self.clients.claim()
})

self.addEventListener('fetch', e => {
  // Network-first for API/manifest (always fresh), cache-first for static assets
  if (e.request.url.includes('/api/') || e.request.url.includes('/_next/data/') || e.request.url.includes('manifest.webmanifest')) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)))
  } else if (e.request.method === 'GET') {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
        if (res.status === 200 && e.request.url.startsWith('http')) {
          const clone = res.clone()
          caches.open(CACHE).then(c => c.put(e.request, clone))
        }
        return res
      }).catch(() => caches.match('/dashboard')))
    )
  }
})

// ── Web Push: show a notification when the server sends one (Quick Note reminders) ──
self.addEventListener('push', e => {
  let data = { title: 'WinS', body: 'Kamu punya pengingat baru', url: '/dashboard' }
  try { if (e.data) data = { ...data, ...e.data.json() } } catch {}
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.svg',
      badge: '/icon-192.svg',
      tag: data.tag || 'wins-notif',
      data: { url: data.url || '/dashboard' },
    })
  )
})

// Clicking the notification focuses an existing tab if open, else opens a new one
self.addEventListener('notificationclick', e => {
  e.notification.close()
  const url = (e.notification.data && e.notification.data.url) || '/dashboard'
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientsArr => {
      for (const c of clientsArr) {
        if (c.url.includes(self.location.origin) && 'focus' in c) { c.navigate(url); return c.focus() }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
    })
  )
})
